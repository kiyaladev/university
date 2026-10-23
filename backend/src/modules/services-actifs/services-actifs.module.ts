import { Module } from '@nestjs/common';
import { ServicesActifsController } from './services-actifs.controller';
import { ServicesActifsGuard } from './services-actifs.guard';
import { ServicesActifsService } from './services-actifs.service';

@Module({ controllers: [ServicesActifsController], providers: [ServicesActifsService, ServicesActifsGuard], exports: [ServicesActifsGuard] })
export class ServicesActifsModule {}
