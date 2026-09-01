import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Role } from '@sahara/shared';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './types';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string, fullName?: string) {
    const user = await this.usersService.createUser(email, password, fullName);
    return this.issueToken({ sub: user.id, role: Role.RetailUser, kind: 'user' });
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueToken({ sub: user.id, role: Role.RetailUser, kind: 'user' });
  }

  async staffLogin(email: string, password: string) {
    const staff = await this.prisma.staffAccount.findUnique({ where: { email } });
    if (!staff || !staff.active || !(await bcrypt.compare(password, staff.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueToken({ sub: staff.id, role: staff.role as unknown as Role, kind: 'staff' });
  }

  private issueToken(payload: JwtPayload) {
    return { accessToken: this.jwtService.sign(payload) };
  }
}
