import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateTravailDto } from './stages.dto';

describe('contrat de dépôt du rapport', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const parse = (body: unknown) => pipe.transform(body, { type: 'body', metatype: UpdateTravailDto });

  it.each([true, false])('conserve le constat %s envoyé par le bouton du dossier', async (rapportRendu) => {
    await expect(parse({ rapportRendu })).resolves.toMatchObject({ rapportRendu });
  });

  it.each(['false', 'true', 0, 1])('refuse le faux booléen %s malgré la conversion implicite', async (rapportRendu) => {
    await expect(parse({ rapportRendu })).rejects.toBeInstanceOf(BadRequestException);
  });
});
