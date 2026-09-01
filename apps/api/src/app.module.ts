import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { KycModule } from './kyc/kyc.module';
import { WalletModule } from './wallet/wallet.module';
import { TradingModule } from './trading/trading.module';
import { AdminModule } from './admin/admin.module';
import { SupportModule } from './support/support.module';
import { CircleModule } from './circle/circle.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    KycModule,
    WalletModule,
    TradingModule,
    AdminModule,
    SupportModule,
    CircleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
