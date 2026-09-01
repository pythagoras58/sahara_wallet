import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { RejectKycDto } from './dto/reject-kyc.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';

const PENDING_STATUSES = ['PENDING_AUTO_REVIEW', 'PENDING_OFFICER_REVIEW'] as const;
const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'kyc');

export interface KycDocumentFiles {
  documentFront?: Express.Multer.File[];
  documentBack?: Express.Multer.File[];
}

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  async submit(userId: string, dto: SubmitKycDto, files: KycDocumentFiles) {
    const front = files.documentFront?.[0];
    const back = files.documentBack?.[0];

    if (!front) {
      throw new BadRequestException(
        dto.idType === 'passport' ? 'Upload the passport detail page.' : 'Upload the front of your ID.',
      );
    }
    if (dto.idType !== 'passport' && !back) {
      throw new BadRequestException('Upload the back of your ID.');
    }

    const openCase = await this.prisma.kycCase.findFirst({
      where: { userId, status: { in: [...PENDING_STATUSES] } },
    });
    if (openCase) {
      throw new BadRequestException('You already have a KYC submission under review.');
    }

    const kycCase = await this.prisma.kycCase.create({
      data: {
        userId,
        status: 'PENDING_OFFICER_REVIEW',
        triggerReason: 'user_submission',
        evidenceRef: JSON.stringify({ idType: dto.idType, idNumber: dto.idNumber, country: dto.country }),
      },
    });

    const documentPaths = await this.saveDocuments(kycCase.id, front, back);

    return this.prisma.kycCase.update({
      where: { id: kycCase.id },
      data: { documentPaths },
    });
  }

  async myStatus(userId: string) {
    const [user, latestCase] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { kycTier: true } }),
      this.prisma.kycCase.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { kycTier: user.kycTier, latestCase };
  }

  queue() {
    return this.prisma.kycCase.findMany({
      where: { status: { in: [...PENDING_STATUSES] } },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { email: true, fullName: true, country: true } } },
    });
  }

  async approve(caseId: string, reviewerStaffId: string) {
    const kycCase = await this.getPendingCaseOrThrow(caseId);

    const [updatedCase] = await this.prisma.$transaction([
      this.prisma.kycCase.update({
        where: { id: caseId },
        data: { status: 'APPROVED', reviewerStaffId, decidedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: kycCase.userId },
        data: { kycTier: 'TIER_1_VERIFIED' },
      }),
    ]);

    await this.walletService.provisionWallet(kycCase.userId);
    await this.walletService.provisionCircleWallets(kycCase.userId);

    await this.prisma.auditLogEntry.create({
      data: {
        actorType: 'STAFF',
        actorId: reviewerStaffId,
        action: 'kyc.approve',
        targetType: 'KycCase',
        targetId: caseId,
      },
    });

    return updatedCase;
  }

  async reject(caseId: string, reviewerStaffId: string, dto: RejectKycDto) {
    await this.getPendingCaseOrThrow(caseId);

    const updatedCase = await this.prisma.kycCase.update({
      where: { id: caseId },
      data: {
        status: 'REJECTED',
        reviewerStaffId,
        decisionReason: dto.reason,
        decidedAt: new Date(),
      },
    });

    await this.prisma.auditLogEntry.create({
      data: {
        actorType: 'STAFF',
        actorId: reviewerStaffId,
        action: 'kyc.reject',
        targetType: 'KycCase',
        targetId: caseId,
        metadata: { reason: dto.reason },
      },
    });

    return updatedCase;
  }

  /** Returns the case (for auth checks by the caller) and the resolved file path for the given document index. */
  async getDocumentPath(caseId: string, index: number) {
    const kycCase = await this.prisma.kycCase.findUnique({ where: { id: caseId } });
    if (!kycCase) {
      throw new NotFoundException('KYC case not found.');
    }
    const filePath = kycCase.documentPaths[index];
    if (!filePath) {
      throw new NotFoundException('Document not found.');
    }
    return { kycCase, filePath };
  }

  private async saveDocuments(caseId: string, front: Express.Multer.File, back?: Express.Multer.File) {
    const dir = path.join(UPLOAD_ROOT, caseId);
    await fs.mkdir(dir, { recursive: true });

    const paths: string[] = [];
    const frontPath = path.join(dir, `front${extensionFor(front)}`);
    await fs.writeFile(frontPath, front.buffer);
    paths.push(frontPath);

    if (back) {
      const backPath = path.join(dir, `back${extensionFor(back)}`);
      await fs.writeFile(backPath, back.buffer);
      paths.push(backPath);
    }

    return paths;
  }

  private async getPendingCaseOrThrow(caseId: string) {
    const kycCase = await this.prisma.kycCase.findUnique({ where: { id: caseId } });
    if (!kycCase || !(PENDING_STATUSES as readonly string[]).includes(kycCase.status)) {
      throw new BadRequestException('This case is not awaiting review.');
    }
    return kycCase;
  }
}

function extensionFor(file: Express.Multer.File): string {
  const ext = path.extname(file.originalname);
  return ext || (file.mimetype === 'image/png' ? '.png' : '.jpg');
}
