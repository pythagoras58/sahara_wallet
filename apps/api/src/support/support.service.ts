import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto, priorityForCategory } from './dto/create-ticket.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';

const OPEN_STATUSES = ['OPEN', 'ESCALATED_FINANCE', 'ESCALATED_KYC'] as const;

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        userId,
        category: dto.category,
        description: dto.description,
        transactionRef: dto.transactionRef,
        priority: priorityForCategory(dto.category),
      },
    });
  }

  myTickets(userId: string) {
    return this.prisma.supportTicket.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  queue() {
    return this.prisma.supportTicket.findMany({
      where: { status: { in: [...OPEN_STATUSES] } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: { user: { select: { email: true, fullName: true } } },
    });
  }

  async claim(ticketId: string, staffId: string) {
    await this.getOpenTicketOrThrow(ticketId);
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedStaffId: staffId },
    });
  }

  async resolve(ticketId: string, staffId: string, dto: ResolveTicketDto) {
    await this.getOpenTicketOrThrow(ticketId);

    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'RESOLVED',
        assignedStaffId: staffId,
        resolutionNote: dto.resolutionNote,
        resolvedAt: new Date(),
      },
    });

    await this.prisma.auditLogEntry.create({
      data: {
        actorType: 'STAFF',
        actorId: staffId,
        action: 'support.resolve',
        targetType: 'SupportTicket',
        targetId: ticketId,
      },
    });

    return ticket;
  }

  private async getOpenTicketOrThrow(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found.');
    }
    if (!(OPEN_STATUSES as readonly string[]).includes(ticket.status)) {
      throw new BadRequestException('This ticket is already closed.');
    }
    return ticket;
  }
}
