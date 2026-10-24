import { Module } from '@nestjs/common';
import { PortailController } from './portail.controller';
import { PortailService } from './portail.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsService } from './sms.service';
import { OtpClient } from './otp.client';

/**
 * Module portail & notifications SMS : connexion par code OTP, espace
 * étudiant, diffusion et historique des SMS.
 */
@Module({
  imports: [],
  controllers: [PortailController, NotificationsController],
  providers: [PortailService, NotificationsService, SmsService, OtpClient],
  exports: [PortailService, SmsService, OtpClient],
})
export class PortailModule {}
