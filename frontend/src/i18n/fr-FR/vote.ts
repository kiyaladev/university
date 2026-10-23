/** Namespace `vote`. */
export default {
  title: 'Voter',
  subtitle: 'Les scrutins ouverts à votre voix, et les résultats des scrutins proclamés. Votre bulletin est anonyme.',
  loading: 'Chargement des scrutins…',
  errors: {
    load: 'Impossible de charger les scrutins.',
    submit: 'Dépôt du bulletin impossible.',
    max_seats_one: 'Un seul siège est à pourvoir : décochez d’abord votre choix actuel.',
    max_seats: 'Vous pouvez retenir au plus {n} candidats.',
  },
  empty_state: {
    title: 'Aucun scrutin en ce moment',
    message:
      'Aucune élection n’est ouverte et aucun résultat n’a encore été proclamé. Vous serez informé de l’ouverture du prochain scrutin.',
    my_space: 'Mon espace',
  },
  list: {
    title: 'Scrutins',
    subtitle: 'Choisissez le scrutin à consulter ou auquel participer.',
    seat: 'siège',
    seats: 'sièges',
    closes_on: 'clôture le {date}',
  },
  detail: {
    period: 'du {debut} au {fin}',
    already_voted: 'Votre bulletin a été déposé le {date}. Merci pour votre participation.',
    ballot_reference: 'Référence anonyme de votre bulletin :',
    ballot_reference_hint: '— elle prouve le dépôt sans révéler votre choix.',
    one_ballot_only: 'Un seul bulletin est accepté par électeur : vous ne pouvez plus voter sur ce scrutin.',
    closed_notice:
      'Ce scrutin est {statut} : plus aucun bulletin n’est accepté. Les résultats sont affichés ci-dessous.',
    anonymous_notice:
      'Votre vote est anonyme : votre bulletin n’est jamais rattaché à votre nom. Seul le fait que vous ayez voté est conservé, pour empêcher un second bulletin. Le dépôt est définitif.',
    seats_to_fill: 'siège{plural} à pourvoir — retenez de 1 à {n} candidat{plural}.',
    selection_status: '{selected} retenu{selectedPlural}, {remaining} restant{remainingPlural}.',
    no_candidates: 'Aucun candidat n’est déclaré sur ce scrutin : le vote n’est pas encore possible.',
    select_candidate: 'Retenir {name}',
    candidate_number: 'N° {n}',
    select_at_least_one: 'Retenez au moins un candidat pour pouvoir déposer votre bulletin.',
    print_ballot: 'Imprimer un bulletin papier',
    print_ballot_tooltip: 'Bulletin vierge à imprimer pour le vote en salle (nouvel onglet)',
    submit_ballot: 'Déposer mon bulletin',
  },
  confirm_dialog: {
    title: 'Déposer mon bulletin',
    message:
      'Vous votez pour : {names}.  Le vote est définitif : une fois le bulletin déposé, il ne peut être ni modifié ni retiré, et vous ne pourrez plus voter sur ce scrutin. Votre choix est anonyme : seul le fait que vous ayez voté est conservé.',
    confirm: 'Déposer mon bulletin',
  },
  messages: {
    ballot_submitted: 'Bulletin déposé — merci pour votre participation.',
  },
  results: {
    loading: 'Chargement des résultats…',
    title: 'Résultats',
    summary: 'Bulletins déposés : {ballots} · voix exprimées : {votes} · sièges à pourvoir : {seats}',
    elected: 'Élu',
    votes_count: '{n} voix',
  },
};
