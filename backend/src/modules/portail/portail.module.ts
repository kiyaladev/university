import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
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
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '12h') as any },
    }),
  ],
  controllers: [PortailController, NotificationsController],
  providers: [PortailService, NotificationsService, SmsService, OtpClient],
  exports: [PortailService, SmsService, OtpClient],
})
export class PortailModule {}