import { Role } from '@prisma/client';
import { sansSecrets } from './sensitive-data.interceptor';

describe('Réponses HTTP sans secrets', () => {
  it('retire les hashes et gabarits même dans les relations imbriquées', () => {
    expect(
      sansSecrets({
        data: [
          {
            enseignant: { nom: 'Démo', codePin: 'hash', empreinteTemplate: 'cipher' },
            user: { password: 'hash' },
            nip: 'hash',
          },
        ],
      }),
    ).toEqual({ data: [{ enseignant: { nom: 'Démo' }, user: {} }] });
  });

  it('préserve les indicateurs de disponibilité et le jeton de connexion', () => {
    expect(sansSecrets({ codePin: true, empreinte: false, token: 'jwt' })).toEqual({
      codePin: true,
      empreinte: false,
      token: 'jwt',
    });
  });

  it('retire le jeton QR resto même des réponses imbriquées', () => {
    expect(sansSecrets({ etudiant: { id: 'et-1', qrRestoToken: 'secret' } })).toEqual({ etudiant: { id: 'et-1' } });
  });

  it('ne détruit pas les dates et données binaires', () => {
    const date = new Date();
    const bytes = Buffer.from('demo');
    expect(sansSecrets({ date, bytes })).toEqual({ date, bytes });
  });
});

describe('Projection professionnelle des relations imbriquées', () => {
  const enseignant = {
    id: 'ens-1',
    matricule: 'ENS-1',
    nom: 'Démo',
    prenom: 'Test',
    tauxHoraire: 100,
    email: 'demo@example.invalid',
    telephone: '620000000',
    codePin: 'hash',
  };
  it.each([Role.ETUDIANT, Role.CONTROLEUR, Role.ENSEIGNANT, Role.CHEF_DEPARTEMENT])(
    'ne transmet pas les données privées à %s',
    (role) => {
      expect(sansSecrets({ affectation: { enseignant } }, { role, enseignantId: 'ens-2' } as any)).toEqual({
        affectation: { enseignant: { id: 'ens-1', matricule: 'ENS-1', nom: 'Démo', prenom: 'Test' } },
      });
    },
  );
  it('conserve les coordonnées nécessaires à l’administration, sans PIN', () => {
    expect(sansSecrets(enseignant, { role: Role.ADMIN } as any)).toEqual({
      id: 'ens-1',
      matricule: 'ENS-1',
      nom: 'Démo',
      prenom: 'Test',
      tauxHoraire: 100,
      email: 'demo@example.invalid',
      telephone: '620000000',
    });
  });

  it('retire les preuves biométriques, GPS et pièces médicales aux contrôleurs', () => {
    expect(
      sansSecrets(
        {
          controle: {
            signatureBase64: 'signature',
            latitude: 9.5,
            longitude: -13.6,
            justificatif: { motif: 'motif médical', piece: 'data-url', commentaire: 'note privée' },
            observation: 'Absence justifiée (MALADIE) : diagnostic privé',
          },
        },
        { role: Role.CONTROLEUR } as any,
      ),
    ).toEqual({
      controle: {
        justificatif: {},
        observation: 'Absence justifiée',
      },
    });
  });

  it('masque aussi les anciens motifs médicaux conservés dans les observations pour les rôles de gestion', () => {
    expect(
      sansSecrets({ observation: 'Absence justifiée (MALADIE) : diagnostic privé' }, { role: Role.ADMIN } as any),
    ).toEqual({ observation: 'Absence justifiée' });
  });

  it('limite les données de l’étudiant transmises à un enseignant encadrant', () => {
    expect(
      sansSecrets(
        {
          etudiant: {
            id: 'et-1',
            matricule: 'ET-1',
            nom: 'Barry',
            prenom: 'Awa',
            promotionId: 'promo-1',
            dateNaissance: new Date('2000-01-01'),
            adresse: 'adresse privée',
            telephone: '620000000',
            email: 'awa@example.test',
            userId: 'user-1',
            qrRestoToken: 'secret',
          },
        },
        { role: Role.ENSEIGNANT, enseignantId: 'ens-1' } as any,
      ),
    ).toEqual({
      etudiant: { id: 'et-1', matricule: 'ET-1', nom: 'Barry', prenom: 'Awa', promotionId: 'promo-1' },
    });
  });
});
