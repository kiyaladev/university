import { Module } from '@nestjs/common';
import { ParametresModule } from '../../socle/parametres/parametres.module';
import { PresencePreuvesModule } from '../presence-preuves/presence-preuves.module';
import { ControleController } from './controle.controller';
import { ControleService } from './controle.service';

@Module({
  imports: [ParametresModule, PresencePreuvesModule],
  controllers: [ControleController],
  providers: [ControleService],
  exports: [ControleService],
})
export class ControleModule {}
