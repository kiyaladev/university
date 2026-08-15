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
          `(numéro ${dto.telephone}) — MOBILE_MONEY_URL absent, confirmation au guichet ` +
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
      this.logger.error(
        `Passerelle Mobile Money injoignable pour ${dto.reference} : ${e?.message ?? e}`,
      );
      throw new HttpException(
        'La passerelle Mobile Money est injoignable : le paiement reste en attente, ' +
          'la confirmation se fera au guichet.',
        502,
      );
    }

    const corps: any = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      this.logger.warn(
        `Passerelle Mobile Money a refusé ${dto.reference} : ${reponse.status} ${JSON.stringify(corps).slice(0, 240)}`,
      );
      throw new HttpException(
        `La demande de paiement a été refusée par l'opérateur (${corps?.message ?? `statut ${reponse.status}`}) — le paiement reste en attente.`,
        502,
      );
    }

    return {
      mode: 'operateur',
      transactionId: corps?.transactionId ?? corps?.reference ?? corps?.id ?? null,
    };
  }
}