import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  auditLog(limit?: number) {
    const take = Math.min(limit && limit > 0 ? limit : DEFAULT_LIMIT, MAX_LIMIT);
    return this.prisma.auditLogEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
