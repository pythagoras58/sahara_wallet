import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [WalletModule],
  controllers: [KycController],
  providers: [KycService],
})
export class KycModule {}
