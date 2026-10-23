/**
 * Point d'intégration Mobile Money (Orange Money / MTN MoMo / Telecel).
 *
 * Mode pilote : tant que `MOBILE_MONEY_URL` n'est pas configuré, la demande de
 * paiement est simulée — trace console, aucun appel réseau, `transactionId`
 * reste nul — et la confirmation de l'opérateur est répercutée par l'agent
 * comptable via POST /paiements/:id/simuler. Aucun secret n'est journalisé ni
 * transmit en clair dans les logs : la clé d'API passe en en-tête d'autorisation.
 */
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { t } from '../../common/i18n';

export interface DemandePaiement {
  reference: string;
  montant: number;
  devise: string;
  operateur: string;
  telephone: string;
  motif?: string;
}

export type ReponseDemande = {
  mode: 'simulation' | 'operateur';
  transactionId: string | null;
};

@Injectable()
export class MobileMoneyService {
  private readonly logger = new Logger(MobileMoneyService.name);

  async demanderPaiement(dto: DemandePaiement): Promise<ReponseDemande> {
    const url = process.env.MOBILE_MONEY_URL?.replace(/\/+$/, '');
    if (!url) {
      this.logger.log(
        `[SIMULATION] Paiement ${dto.reference} : ${dto.montant} ${dto.devise} via ${dto.operateur} ` +
          `— MOBILE_MONEY_URL absent, confirmation au guichet ` +
          `(POST /paiements/:id/simuler)`,
      );
      return { mode: 'simulation', transactionId: null };
    }

    const cleApi = process.env.MOBILE_MONEY_API_KEY;
    let reponse: Response;
    try {
      reponse = await fetch(`${url}/paiements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cleApi ? { Authorization: `Bearer ${cleApi}` } : {}),
        },
        body: JSON.stringify({
          reference: dto.reference,
          montant: dto.montant,
          devise: dto.devise,
          operateur: dto.operateur,
          telephone: dto.telephone,
          motif: dto.motif ?? null,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e: any) {
      this.logger.error(`Passerelle Mobile Money injoignable pour ${dto.reference}`);
      throw new HttpException(t('inscription.mobileMoneyUnavailable'), 502);
    }

    const corps: any = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      this.logger.warn(`Passerelle Mobile Money a refusé ${dto.reference} : HTTP ${reponse.status}`);
      throw new HttpException(t('inscription.mobileMoneyRejected', { status: reponse.status }), 502);
    }

    const transaction = corps?.transactionId ?? corps?.reference ?? corps?.id;
    if (
      (typeof transaction !== 'string' && typeof transaction !== 'number') ||
      !String(transaction).trim() ||
      String(transaction).length > 200 ||
      (typeof transaction === 'number' && (!Number.isFinite(transaction) || transaction <= 0))
    ) {
      this.logger.warn(`Passerelle Mobile Money : référence de transaction absente pour ${dto.reference}`);
      throw new HttpException(t('inscription.mobileMoneyInvalidResponse'), 502);
    }
    return {
      mode: 'operateur',
      transactionId: String(transaction).trim(),
    };
  }
}
