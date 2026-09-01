import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { PriceService } from './price.service';

@Module({
  imports: [WalletModule],
  controllers: [TradingController],
  providers: [TradingService, PriceService],
})
export class TradingModule {}
