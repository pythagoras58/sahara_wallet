import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { Role } from '@sahara/shared';
import { AuthenticatedPrincipal } from '../auth/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RejectKycDto } from './dto/reject-kyc.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { KycService } from './kyc.service';
import type { KycDocumentFiles } from './kyc.service';

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'documentFront', maxCount: 1 },
        { name: 'documentBack', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: MAX_FILE_SIZE_BYTES },
        fileFilter: (_req, file, callback) => {
          callback(null, ALLOWED_MIME_TYPES.has(file.mimetype));
        },
      },
    ),
  )
  submit(
    @Req() req: { user: AuthenticatedPrincipal },
    @Body() dto: SubmitKycDto,
    @UploadedFiles() files: KycDocumentFiles,
  ) {
    return this.kycService.submit(req.user.id, dto, files);
  }

  @Get('my-status')
  @UseGuards(JwtAuthGuard)
  myStatus(@Req() req: { user: AuthenticatedPrincipal }) {
    return this.kycService.myStatus(req.user.id);
  }

  @Get('queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.KycOfficer, Role.SuperAdmin)
  queue() {
    return this.kycService.queue();
  }

  @Get(':id/document/:index')
  @UseGuards(JwtAuthGuard)
  async getDocument(
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
    @Req() req: { user: AuthenticatedPrincipal },
    @Res() res: Response,
  ) {
    const { kycCase, filePath } = await this.kycService.getDocumentPath(id, index);
    const isOwner = req.user.kind === 'user' && req.user.id === kycCase.userId;
    const isKycStaff = req.user.kind === 'staff' && (req.user.role === Role.KycOfficer || req.user.role === Role.SuperAdmin);
    if (!isOwner && !isKycStaff) {
      throw new ForbiddenException('You cannot view this document.');
    }
    res.sendFile(filePath);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.KycOfficer)
  approve(@Param('id') id: string, @Req() req: { user: AuthenticatedPrincipal }) {
    return this.kycService.approve(id, req.user.id);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.KycOfficer)
  reject(@Param('id') id: string, @Req() req: { user: AuthenticatedPrincipal }, @Body() dto: RejectKycDto) {
    return this.kycService.reject(id, req.user.id, dto);
  }
}
