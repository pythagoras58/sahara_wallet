import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@sahara/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedPrincipal } from './types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.fullName);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('staff-login')
  @HttpCode(200)
  staffLogin(@Body() dto: LoginDto) {
    return this.authService.staffLogin(dto.email, dto.password);
  }

  @Get('whoami')
  @UseGuards(JwtAuthGuard)
  whoami(@Req() req: { user: AuthenticatedPrincipal }) {
    return req.user;
  }

  @Get('super-admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin)
  superAdminOnly() {
    return { status: 'ok' };
  }
}
