import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@sahara/shared';
import { AuthenticatedPrincipal } from '../auth/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { TradingService } from './trading.service';

@Controller('trading')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Post('assets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ListingAdmin, Role.SuperAdmin)
  create(@Req() req: { user: AuthenticatedPrincipal }, @Body() dto: CreateAssetDto) {
    return this.tradingService.createDraft(req.user.id, dto);
  }

  @Get('assets/drafts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ListingAdmin, Role.SuperAdmin)
  drafts() {
    return this.tradingService.listDraftsAndPending();
  }

  /** Live listings with mock price/change/sparkline -- see trading/mock-price.ts. */
  @Get('assets')
  @UseGuards(JwtAuthGuard)
  live() {
    return this.tradingService.listLiveWithPrices();
  }

  @Post('assets/:id/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ListingAdmin, Role.SuperAdmin)
  submit(@Param('id') id: string) {
    return this.tradingService.submitForApproval(id);
  }

  @Post('assets/:id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin)
  publish(@Param('id') id: string, @Req() req: { user: AuthenticatedPrincipal }) {
    return this.tradingService.publish(id, req.user.id);
  }

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  placeOrder(@Req() req: { user: AuthenticatedPrincipal }, @Body() dto: CreateOrderDto) {
    return this.tradingService.placeOrder(req.user.id, dto);
  }

  @Get('orders/mine')
  @UseGuards(JwtAuthGuard)
  myOrders(@Req() req: { user: AuthenticatedPrincipal }) {
    return this.tradingService.myOrders(req.user.id);
  }

  @Get('positions/mine')
  @UseGuards(JwtAuthGuard)
  myPositions(@Req() req: { user: AuthenticatedPrincipal }) {
    return this.tradingService.myPositions(req.user.id);
  }
}
