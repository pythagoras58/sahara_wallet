import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@sahara/shared';
import { AuthenticatedPrincipal } from '../auth/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';
import { SupportService } from './support.service';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @UseGuards(JwtAuthGuard)
  create(@Req() req: { user: AuthenticatedPrincipal }, @Body() dto: CreateTicketDto) {
    return this.supportService.create(req.user.id, dto);
  }

  @Get('tickets/mine')
  @UseGuards(JwtAuthGuard)
  mine(@Req() req: { user: AuthenticatedPrincipal }) {
    return this.supportService.myTickets(req.user.id);
  }

  @Get('tickets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SupportAgent, Role.SuperAdmin)
  queue() {
    return this.supportService.queue();
  }

  @Post('tickets/:id/claim')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SupportAgent, Role.SuperAdmin)
  claim(@Param('id') id: string, @Req() req: { user: AuthenticatedPrincipal }) {
    return this.supportService.claim(id, req.user.id);
  }

  @Post('tickets/:id/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SupportAgent, Role.SuperAdmin)
  resolve(@Param('id') id: string, @Req() req: { user: AuthenticatedPrincipal }, @Body() dto: ResolveTicketDto) {
    return this.supportService.resolve(id, req.user.id, dto);
  }
}
