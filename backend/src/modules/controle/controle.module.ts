import { Module } from '@nestjs/common';
import { ParametresModule } from '../parametres/parametres.module';
import { MoyensAttestationModule } from '../moyens-attestation/moyens-attestation.module';
import { ControleController } from './controle.controller';
import { ControleService } from './controle.service';

@Module({
  imports: [ParametresModule, MoyensAttestationModule],
  controllers: [ControleController],
  providers: [ControleService],
  exports: [ControleService],
})
export class ControleModule {}
