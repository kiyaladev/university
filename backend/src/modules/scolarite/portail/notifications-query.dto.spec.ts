import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EstimationDestinatairesQueryDto, RepartitionNotificationsQueryDto } from './portail.dto';
import { AffichesQrQueryDto, RapportImprimableQueryDto } from '../../pilotage/rapports/rapports.dto';

function erreurs<T extends object>(classe: new () => T, brut: Record<string, unknown>) {
  const dto = plainToInstance(classe, brut, { enableImplicitConversion: true });
  return { dto, erreurs: validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }) };
}

describe('paramètres de requête typés', () => {
  it('accepte les modes d’estimation connus et refuse les autres', () => {
    expect(erreurs(EstimationDestinatairesQueryDto, { mode: 'tousInscrits' }).erreurs).toHaveLength(0);
    expect(erreurs(EstimationDestinatairesQueryDto, {}).erreurs).toHaveLength(0);
    expect(erreurs(EstimationDestinatairesQueryDto, { mode: 'nimporte' }).erreurs).toHaveLength(1);
  });

  it('convertit la fenêtre de répartition en entier et refuse le texte', () => {
    const { dto, erreurs: ok } = erreurs(RepartitionNotificationsQueryDto, { jours: '30' });
    expect(ok).toHaveLength(0);
    expect(dto.jours).toBe(30);
    expect(erreurs(RepartitionNotificationsQueryDto, { jours: 'abc' }).erreurs).toHaveLength(1);
  });

  it('valide les filtres des états imprimables, jeton compris', () => {
    expect(erreurs(RapportImprimableQueryDto, { dateDebut: '2026-01-05', token: 'jwt' }).erreurs).toHaveLength(0);
    expect(erreurs(RapportImprimableQueryDto, { enseignantId: 'pas-un-uuid' }).erreurs).toHaveLength(1);
    expect(erreurs(AffichesQrQueryDto, { salleId: 'x' }).erreurs).toHaveLength(1);
    expect(erreurs(AffichesQrQueryDto, { salleId: '6f1c2b1e-8d4a-4c55-9a43-2f1d0f6f4a10' }).erreurs).toHaveLength(0);
  });
});
