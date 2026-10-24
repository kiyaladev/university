import { Module } from '@nestjs/common';
import { MobileMoneyService } from './mobile-money.service';

@Module({
  providers: [MobileMoneyService],
  exports: [MobileMoneyService],
})
export class MobileMoneyModule {}
