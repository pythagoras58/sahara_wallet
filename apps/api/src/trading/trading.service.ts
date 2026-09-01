import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { PriceService } from './price.service';

@Injectable()
export class TradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly priceService: PriceService,
  ) {}

  createDraft(staffId: string, dto: CreateAssetDto) {
    return this.prisma.asset.create({
      data: {
        symbol: dto.symbol.toUpperCase(),
        name: dto.name,
        issuer: dto.issuer,
        chain: dto.chain,
        contractAddress: dto.contractAddress,
        minOrderUsdc: dto.minOrderUsdc,
        feeBps: dto.feeBps ?? 0,
        coingeckoId: dto.coingeckoId,
        createdByStaffId: staffId,
      },
    });
  }

  listDraftsAndPending() {
    return this.prisma.asset.findMany({
      where: { status: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  listLive() {
    return this.prisma.asset.findMany({ where: { status: 'LIVE' }, orderBy: { publishedAt: 'desc' } });
  }

  /**
   * Live listings plus price/change/sparkline for the markets page. Assets with a
   * coingeckoId get real data from CoinGecko (see PriceService); everything else falls
   * back to the deterministic mock price. `live` on each entry tells the frontend which.
   */
  async listLiveWithPrices() {
    const assets = await this.listLive();
    const prices = await this.priceService.getPrices(assets);
    return assets.map((asset) => ({ ...asset, ...prices.get(asset.symbol)! }));
  }

  async submitForApproval(assetId: string) {
    const asset = await this.getAssetOrThrow(assetId);
    if (asset.status !== 'DRAFT') {
      throw new BadRequestException('Only a draft listing can be submitted for approval.');
    }
    return this.prisma.asset.update({ where: { id: assetId }, data: { status: 'PENDING_APPROVAL' } });
  }

  async publish(assetId: string, approverStaffId: string) {
    const asset = await this.getAssetOrThrow(assetId);
    if (asset.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only a listing pending approval can be published.');
    }

    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: { status: 'LIVE', approvedByStaffId: approverStaffId, publishedAt: new Date() },
    });

    await this.prisma.auditLogEntry.create({
      data: {
        actorType: 'STAFF',
        actorId: approverStaffId,
        action: 'asset.publish',
        targetType: 'Asset',
        targetId: assetId,
      },
    });

    return updated;
  }

  myPositions(userId: string) {
    return this.prisma.assetPosition.findMany({
      where: { wallet: { userId }, quantity: { gt: 0 } },
      include: { asset: true },
    });
  }

  myOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { asset: { select: { symbol: true, name: true } } },
    });
  }

  /**
   * Mock settlement -- no real venue/issuer routing yet (see design doc sections 6.4/6.5
   * for the real flow). Settles instantly against the current display price (live via
   * CoinGecko where configured, deterministic mock otherwise) so a buy/sell round-trip
   * works end to end and never drifts from what the user saw; replace the settlement
   * routing before any of this touches real money.
   */
  async placeOrder(userId: string, dto: CreateOrderDto) {
    const asset = await this.getAssetOrThrow(dto.assetId);
    if (asset.status !== 'LIVE') {
      throw new BadRequestException('This asset is not open for trading.');
    }

    const wallet = await this.walletService.findByUserId(userId);
    if (!wallet) {
      throw new BadRequestException('Complete KYC to get a wallet before trading.');
    }

    const { price } = await this.priceService.getPrice(asset);

    if (dto.side === 'BUY') {
      return this.executeBuy(userId, wallet.id, asset, dto.amount, price);
    }
    return this.executeSell(userId, wallet.id, asset, dto.amount, price);
  }

  private async executeBuy(
    userId: string,
    walletId: string,
    asset: { id: string; symbol: string; minOrderUsdc: unknown },
    usdcAmount: number,
    price: number,
  ) {
    if (usdcAmount < Number(asset.minOrderUsdc)) {
      throw new BadRequestException(`Minimum order is ${asset.minOrderUsdc} USDC.`);
    }
    const quantity = usdcAmount / price;

    const order = await this.prisma.order.create({
      data: { userId, assetId: asset.id, side: 'BUY', usdcAmount, quantity, status: 'PENDING' },
    });

    try {
      await this.walletService.debit(walletId, usdcAmount, {
        type: 'ASSET_BUY',
        referenceType: 'Order',
        referenceId: order.id,
      });
    } catch (err) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'REJECTED', rejectionReason: err instanceof Error ? err.message : 'Debit failed' },
      });
      throw err;
    }

    await this.prisma.assetPosition.upsert({
      where: { walletId_assetId: { walletId, assetId: asset.id } },
      create: { walletId, assetId: asset.id, quantity },
      update: { quantity: { increment: quantity } },
    });

    return this.prisma.order.update({ where: { id: order.id }, data: { status: 'SETTLED', settledAt: new Date() } });
  }

  private async executeSell(
    userId: string,
    walletId: string,
    asset: { id: string; symbol: string },
    quantity: number,
    price: number,
  ) {
    const position = await this.prisma.assetPosition.findUnique({
      where: { walletId_assetId: { walletId, assetId: asset.id } },
    });
    if (!position || position.quantity.lessThan(quantity)) {
      throw new BadRequestException('You do not hold enough of this asset to sell that amount.');
    }

    const proceeds = quantity * price;
    const order = await this.prisma.order.create({
      data: { userId, assetId: asset.id, side: 'SELL', usdcAmount: proceeds, quantity, status: 'PENDING' },
    });

    await this.prisma.assetPosition.update({
      where: { walletId_assetId: { walletId, assetId: asset.id } },
      data: { quantity: { decrement: quantity } },
    });

    await this.walletService.credit(walletId, proceeds, {
      type: 'ASSET_SELL',
      referenceType: 'Order',
      referenceId: order.id,
    });

    return this.prisma.order.update({ where: { id: order.id }, data: { status: 'SETTLED', settledAt: new Date() } });
  }

  private async getAssetOrThrow(assetId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundException('Asset listing not found.');
    }
    return asset;
  }
}
