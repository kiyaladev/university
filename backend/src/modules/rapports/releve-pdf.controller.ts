import { Body, Controller, Post, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthUser, CurrentUser, ProtectedDocument } from '../../common/decorators';
import { ReleveHebdomadaireDto } from './rapports.dto';
import { RelevePdfService } from './releve-pdf.service';

@ApiTags('Rapports')
@ApiBearerAuth()
@Controller('impression')
export class ReleveHebdomadaireController {
  constructor(private readonly relevePdf: RelevePdfService) {}

  @ProtectedDocument(Role.CHEF_DEPARTEMENT)
  @Post('releve-hebdomadaire')
  async generer(
    @Body() dto: ReleveHebdomadaireDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { numero, pdf, pdfHash } = await this.relevePdf.generer(dto, user);
    res
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="${numero}.pdf"`)
      .header('X-Document-SHA256', pdfHash)
      .send(pdf);
  }
}
