import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@sahara/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedPrincipal } from '../auth/types';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { DepositDto } from './dto/deposit.dto';
import { FreezeWalletDto } from './dto/freeze-wallet.dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: { user: AuthenticatedPrincipal }) {
    const wallet = await this.walletService.findByUserId(req.user.id);
    if (!wallet) {
      throw new NotFoundException('No wallet yet -- complete KYC to get one provisioned.');
    }
    return {
      id: wallet.id,
      usdcBalance: wallet.usdcBalance.toString(),
      frozen: wallet.frozen,
      createdAt: wallet.createdAt,
    };
  }

  @Post('deposit')
  @UseGuards(JwtAuthGuard)
  async deposit(@Req() req: { user: AuthenticatedPrincipal }, @Body() dto: DepositDto) {
    const { deposit, wallet } = await this.walletService.mockDeposit(req.user.id, dto.amountUsdc);
    return {
      deposit: { id: deposit.id, amountUsdc: deposit.amountUsdc.toString(), status: deposit.status },
      usdcBalance: wallet.usdcBalance.toString(),
    };
  }

  /** Status for the send/receive UI -- see WalletService.getChainStatus. */
  @Get('chains')
  @UseGuards(JwtAuthGuard)
  chains(@Req() req: { user: AuthenticatedPrincipal }) {
    return this.walletService.getChainStatus(req.user.id);
  }

  @Get('ledger')
  @UseGuards(JwtAuthGuard)
  async ledger(@Req() req: { user: AuthenticatedPrincipal }) {
    const wallet = await this.walletService.findByUserId(req.user.id);
    if (!wallet) {
      throw new NotFoundException('No wallet yet -- complete KYC to get one provisioned.');
    }
    const entries = await this.walletService.ledgerHistory(wallet.id);
    return entries.map((e) => ({
      id: e.id,
      type: e.type,
      direction: e.direction,
      amountUsdc: e.amountUsdc.toString(),
      balanceAfter: e.balanceAfter.toString(),
      createdAt: e.createdAt,
    }));
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FinanceManager, Role.SuperAdmin)
  async listAll() {
    const wallets = await this.walletService.listAll();
    return wallets.map((w) => ({
      id: w.id,
      usdcBalance: w.usdcBalance.toString(),
      frozen: w.frozen,
      frozenReason: w.frozenReason,
      user: w.user,
      createdAt: w.createdAt,
    }));
  }

  @Post('admin/:id/freeze')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FinanceManager, Role.SuperAdmin)
  async freeze(
    @Param('id') id: string,
    @Body() dto: FreezeWalletDto,
    @Req() req: { user: AuthenticatedPrincipal },
  ) {
    const wallet = await this.walletService.setFrozen(id, true, dto.reason, req.user.id);
    return { id: wallet.id, frozen: wallet.frozen, frozenReason: wallet.frozenReason };
  }

  @Post('admin/:id/unfreeze')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FinanceManager, Role.SuperAdmin)
  async unfreeze(@Param('id') id: string, @Req() req: { user: AuthenticatedPrincipal }) {
    const wallet = await this.walletService.setFrozen(id, false, undefined, req.user.id);
    return { id: wallet.id, frozen: wallet.frozen, frozenReason: wallet.frozenReason };
  }
}
