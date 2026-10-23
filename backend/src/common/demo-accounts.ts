import * as bcrypt from 'bcryptjs';

/** Valeurs publiques du seed : elles ne doivent jamais authentifier la production. */
const DEMO_PASSWORDS = ['Passer@2026', 'Etu#2026'];
const verdicts = new Map<string, boolean>();

export async function motDePasseDemo(hash: string): Promise<boolean> {
  if (verdicts.has(hash)) return verdicts.get(hash)!;
  const demo = (await Promise.all(DEMO_PASSWORDS.map((password) => bcrypt.compare(password, hash)))).some(Boolean);
  if (verdicts.size >= 1000) verdicts.clear();
  verdicts.set(hash, demo);
  return demo;
}
