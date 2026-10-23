import { Module } from '@nestjs/common';
import { ParametresModule } from '../../socle/parametres/parametres.module';
import { PresencePreuvesController } from './presence-preuves.controller';
import { PresencePreuvesService } from './presence-preuves.service';

@Module({
  imports: [ParametresModule],
  controllers: [PresencePreuvesController],
  providers: [PresencePreuvesService],
  exports: [PresencePreuvesService],
})
export class PresencePreuvesModule {}
