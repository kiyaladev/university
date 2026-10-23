import { Injectable, Logger } from '@nestjs/common';
import { t } from '../../common/i18n';

/**
 * Client minimal vers la passerelle OTP/SMS locale (`/opt/apps/otp-gateway`,
 * port 5027) — `fetch` natif de Node, aucune dépendance ajoutée. Tous les
 * appels portent la clé d'API dans `x-api-key`, avec un délai maximal de 8 s.
 *
 * `/api/otp/send` génère un code ; `/api/sms/send` met un message libre en
 * file sans créer d'OTP. Ces deux opérations ont des contrats distincts.
 */

export interface ReponseEnvoiOtp {
  ok: boolean;
  requestId?: number;
  expiresAt?: number;
  raison?: string;
}

export interface ReponseVerificationOtp {
  valid: boolean;
  raison?: string;
  tentativesRestantes?: number;
}

export interface EntreeEnvoiOtp {
  but?: string;
  message?: string;
}

const DELAI_MAX_MS = 8_000;

/**
 * Normalisation des numéros : chiffres seuls, sans l'indicatif international
 * guinéen (224) ni le zéro de tête. « +224 62 200 0001 », « 622000001 » et
 * « 0622000001 » deviennent tous « 622000001 ».
 */
export function numerique(telephone: string | null | undefined): string {
  const chiffres = String(telephone ?? '').replace(/\D+/g, '');
  const sansIndicatif = chiffres.startsWith('224') ? chiffres.slice(3) : chiffres;
  return sansIndicatif.replace(/^0+/, '');
}

@Injectable()
export class OtpClient {
  private readonly journal = new Logger(OtpClient.name);
  private readonly base: string;
  private readonly cle: string;
  private readonly gabaritOtp: string | undefined;

  constructor() {
    this.base = (process.env.OTP_GATEWAY_URL ?? 'http://127.0.0.1:5027').replace(/\/+$/, '');
    this.cle = process.env.OTP_API_KEY ?? '';
    this.gabaritOtp = process.env.OTP_MESSAGE_TEMPLATE || undefined;
  }

  /** POST JSON à la passerelle ; `null` si injoignable, en délai ou illisible. */
  private async poster<T>(chemin: string, corps: Record<string, unknown>): Promise<T | null> {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), DELAI_MAX_MS);
    try {
      const reponse = await fetch(`${this.base}${chemin}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.cle },
        body: JSON.stringify(corps),
        signal: controleur.signal,
      });
      const donnees = (await reponse.json().catch(() => ({}))) as T & { error?: string };
      if (!reponse.ok) {
        this.journal.warn(`Passerelle ${chemin} : HTTP ${reponse.status}`);
        return null;
      }
      return donnees;
    } catch (erreur) {
      const motif = erreur instanceof Error && erreur.name === 'AbortError' ? 'délai dépassé (8 s)' : 'injoignable';
      this.journal.warn(`Passerelle ${chemin} ${motif}`);
      return null;
    } finally {
      clearTimeout(minuteur);
    }
  }

  /**
   * Émet un SMS via la passerelle. Sans `message` fourni, le gabarit OTP de
   * l'université (OTP_MESSAGE_TEMPLATE) est utilisé : le code généré y est
   * injecté par la passerelle. Avec `message`, le texte passe tel quel.
   */
  async envoyer(telephone: string, entree: EntreeEnvoiOtp = {}): Promise<ReponseEnvoiOtp> {
    const corps: Record<string, unknown> = {
      phone: numerique(telephone),
      purpose: entree.but ?? 'PORTAL',
    };
    if (entree.message) corps.template = entree.message;
    else if (this.gabaritOtp) corps.template = this.gabaritOtp;

    const reponse = await this.poster<ReponseEnvoiOtp>('/api/otp/send', corps);
    if (!reponse) return { ok: false, raison: t('sms.gatewayUnavailable') };
    if (typeof reponse.ok !== 'boolean' || (reponse.ok && !Number.isSafeInteger(reponse.requestId))) {
      return { ok: false, raison: t('sms.gatewayInvalidResponse') };
    }
    return reponse;
  }

  async envoyerSms(telephone: string, message: string): Promise<ReponseEnvoiOtp> {
    const reponse = await this.poster<ReponseEnvoiOtp>('/api/sms/send', {
      phone: numerique(telephone),
      message,
    });
    if (!reponse) return { ok: false, raison: t('sms.gatewayUnavailable') };
    if (typeof reponse.ok !== 'boolean' || (reponse.ok && !Number.isSafeInteger(reponse.requestId))) {
      return { ok: false, raison: t('sms.gatewayInvalidResponse') };
    }
    return reponse;
  }

  async verifier(telephone: string, code: string): Promise<ReponseVerificationOtp> {
    const reponse = await this.poster<{ valid?: boolean; reason?: string; remainingAttempts?: number }>(
      '/api/otp/verify',
      {
        phone: numerique(telephone),
        code,
      },
    );
    if (!reponse || typeof reponse.valid !== 'boolean') {
      return { valid: false, raison: 'passerelle_injoignable', tentativesRestantes: 0 };
    }
    return {
      valid: reponse.valid,
      ...(typeof reponse.reason === 'string' ? { raison: reponse.reason } : {}),
      ...(Number.isSafeInteger(reponse.remainingAttempts) && reponse.remainingAttempts! >= 0
        ? { tentativesRestantes: reponse.remainingAttempts }
        : {}),
    };
  }
}
