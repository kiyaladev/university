import { Module } from '@nestjs/common';
import { ParametresModule } from '../parametres/parametres.module';
import { MoyensAttestationController } from './moyens-attestation.controller';
import { MoyensAttestationService } from './moyens-attestation.service';

@Module({
  imports: [ParametresModule],
  controllers: [MoyensAttestationController],
  providers: [MoyensAttestationService],
  exports: [MoyensAttestationService],
})
export class MoyensAttestationModule {}
