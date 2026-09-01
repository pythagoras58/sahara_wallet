import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { LedgerEntryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CircleService } from '../circle/circle.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly circleService: CircleService,
  ) {}

  /** Idempotent: returns the existing wallet if one already exists for this user. */
  async provisionWallet(userId: string) {
    const existing = await this.prisma.wallet.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.wallet.create({ data: { userId } });
  }

  /**
   * Creates the user's Circle wallet set (one ETH-SEPOLIA + one SOL-DEVNET wallet) and
   * stores the resulting CircleWallet rows. Idempotent (skips if circleWalletSetId is
   * already set). No-ops if Circle isn't configured -- this must never block KYC approval,
   * so callers should not await failures out of this into a hard error; errors are logged
   * and swallowed here instead.
   */
  async provisionCircleWallets(userId: string) {
    if (!this.circleService.isConfigured()) return;

    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.circleWalletSetId) return;

    try {
      const walletSet = await this.circleService.createWalletSetForUser(userId);
      const circleWallets = await this.circleService.createWalletsForSet(walletSet.id);

      await this.prisma.$transaction([
        this.prisma.wallet.update({
          where: { id: wallet.id },
          data: { circleWalletSetId: walletSet.id },
        }),
        ...circleWallets.map((w) =>
          this.prisma.circleWallet.create({
            data: { walletId: wallet.id, chain: w.blockchain, circleWalletId: w.id, address: w.address },
          }),
        ),
      ]);
    } catch (err) {
      this.logger.error(`Failed to provision Circle wallets for user ${userId}`, err instanceof Error ? err.stack : err);
    }
  }

  findByUserId(userId: string) {
    return this.prisma.wallet.findUnique({ where: { userId } });
  }

  /**
   * Status for the send/receive UI. `configured` is false until CIRCLE_API_KEY and
   * CIRCLE_ENTITY_SECRET are both set. `chainWallets` is populated by
   * `provisionCircleWallets`, called from KYC approval.
   */
  async getChainStatus(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { circleWallets: true },
    });
    return {
      configured: this.circleService.isConfigured(),
      chainWallets: wallet?.circleWallets.map((w) => ({ chain: w.chain, address: w.address })) ?? [],
    };
  }

  /**
   * Atomically increments the wallet balance (DB-level increment, not read-modify-write)
   * and writes a matching ledger entry in the same transaction.
   */
  async credit(
    walletId: string,
    amountUsdc: number,
    params: { type: LedgerEntryType; referenceType: string; referenceId: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } });
      if (wallet.frozen) {
        throw new ForbiddenException('This wallet is frozen.');
      }

      const updated = await tx.wallet.update({
        where: { id: walletId },
        data: { usdcBalance: { increment: amountUsdc } },
      });

      const entry = await tx.ledgerEntry.create({
        data: {
          walletId,
          type: params.type,
          direction: 'CREDIT',
          amountUsdc,
          balanceAfter: updated.usdcBalance,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
        },
      });

      return { wallet: updated, entry };
    });
  }

  /**
   * Atomically decrements the wallet balance and writes a matching ledger entry in the
   * same transaction. Throws if the wallet is frozen or the balance would go negative --
   * callers should not pre-check the balance themselves, this is the single source of truth.
   */
  async debit(
    walletId: string,
    amountUsdc: number,
    params: { type: LedgerEntryType; referenceType: string; referenceId: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } });
      if (wallet.frozen) {
        throw new ForbiddenException('This wallet is frozen.');
      }
      if (wallet.usdcBalance.lessThan(amountUsdc)) {
        throw new BadRequestException('Insufficient balance.');
      }

      const updated = await tx.wallet.update({
        where: { id: walletId },
        data: { usdcBalance: { decrement: amountUsdc } },
      });

      const entry = await tx.ledgerEntry.create({
        data: {
          walletId,
          type: params.type,
          direction: 'DEBIT',
          amountUsdc,
          balanceAfter: updated.usdcBalance,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
        },
      });

      return { wallet: updated, entry };
    });
  }

  ledgerHistory(walletId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Dev-only: simulates an instant-settle fiat deposit. There is no real payment
   * provider (Flutterwave/Paystack) wired up yet -- see design doc section 6.2 for
   * the real flow (pending -> provider webhook -> settled). Replace this, don't build on it.
   */
  async mockDeposit(userId: string, amountUsdc: number) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new NotFoundException('No wallet yet -- complete KYC first.');
    }

    const deposit = await this.prisma.deposit.create({
      data: {
        userId,
        method: 'FIAT',
        asset: 'FIAT_LOCAL',
        amountGross: amountUsdc,
        amountUsdc,
        status: 'SETTLED',
        providerRef: 'mock-instant-settle',
        settledAt: new Date(),
      },
    });

    const { wallet: updatedWallet } = await this.credit(wallet.id, amountUsdc, {
      type: 'DEPOSIT',
      referenceType: 'Deposit',
      referenceId: deposit.id,
    });

    return { deposit, wallet: updatedWallet };
  }

  listAll() {
    return this.prisma.wallet.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, fullName: true, kycTier: true } } },
    });
  }

  async setFrozen(walletId: string, frozen: boolean, reason: string | undefined, staffId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found.');
    }

    const updated = await this.prisma.wallet.update({
      where: { id: walletId },
      data: { frozen, frozenReason: frozen ? (reason ?? 'No reason given') : null },
    });

    await this.prisma.auditLogEntry.create({
      data: {
        actorType: 'STAFF',
        actorId: staffId,
        action: frozen ? 'wallet.freeze' : 'wallet.unfreeze',
        targetType: 'Wallet',
        targetId: walletId,
        metadata: frozen ? { reason: reason ?? null } : undefined,
      },
    });

    return updated;
  }
}
