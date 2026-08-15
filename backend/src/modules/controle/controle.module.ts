import { Module } from '@nestjs/common';
import { ParametresModule } from '../parametres/parametres.module';
import { AttestationModule } from '../attestation/attestation.module';
import { ControleController } from './controle.controller';
import { ControleService } from './controle.service';

@Module({
  imports: [ParametresModule, AttestationModule],
  controllers: [ControleController],
  providers: [ControleService],
  exports: [ControleService],
})
export class ControleModule {}
