import * as QRCode from 'qrcode';
import { qrDataUrl, qrSvg } from './qr';

describe('rendu des QR codes', () => {
  const contenu = 'https://university.test/verifier?ref=ABC-1&k=secret';

  it('produit un SVG identique à l’appel direct à la bibliothèque', async () => {
    const attendu = await QRCode.toString(contenu, {
      type: 'svg',
      margin: 2,
      width: 230,
      errorCorrectionLevel: 'M',
    });
    expect(await qrSvg(contenu, { margin: 2, width: 230 })).toBe(attendu);
  });

  it('applique des valeurs par défaut explicites', async () => {
    const attendu = await QRCode.toString(contenu, {
      type: 'svg',
      margin: 1,
      width: 220,
      errorCorrectionLevel: 'M',
    });
    expect(await qrSvg(contenu)).toBe(attendu);
  });

  it('produit une data-URL identique à l’appel direct', async () => {
    const attendu = await QRCode.toDataURL(contenu, { width: 360, margin: 1, errorCorrectionLevel: 'M' });
    expect(await qrDataUrl(contenu, { width: 360 })).toBe(attendu);
  });

  it('reste une image PNG encodée en base64', async () => {
    const url = await qrDataUrl(contenu);
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('change le rendu quand la largeur change', async () => {
    const petit = await qrSvg(contenu, { width: 80 });
    const grand = await qrSvg(contenu, { width: 240 });
    expect(petit).not.toBe(grand);
  });
});
