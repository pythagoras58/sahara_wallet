import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@sahara/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('audit-log')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Auditor, Role.SuperAdmin)
  auditLog(@Query('limit') limit?: string) {
    return this.adminService.auditLog(limit ? Number(limit) : undefined);
  }
}
