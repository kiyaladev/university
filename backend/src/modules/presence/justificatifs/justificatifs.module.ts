import { Module } from '@nestjs/common';
import { JustificatifsController } from './justificatifs.controller';
import { JustificatifsService } from './justificatifs.service';

@Module({
  controllers: [JustificatifsController],
  providers: [JustificatifsService],
  exports: [JustificatifsService],
})
export class JustificatifsModule {}
