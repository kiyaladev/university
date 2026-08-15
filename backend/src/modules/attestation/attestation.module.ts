import { Module } from '@nestjs/common';
import { ParametresModule } from '../parametres/parametres.module';
import { AttestationController } from './attestation.controller';
import { AttestationService } from './attestation.service';

@Module({
  imports: [ParametresModule],
  controllers: [AttestationController],
  providers: [AttestationService],
  exports: [AttestationService],
})
export class AttestationModule {}
