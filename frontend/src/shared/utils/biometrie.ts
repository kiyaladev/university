/** Adresse de la passerelle biométrique locale (poste du contrôleur). */
export const CLE_PASSERELLE = 'unipresence_biometrie_url';
export const PASSERELLE_DEFAUT = 'http://127.0.0.1:5044';

export const urlPasserelle = () => localStorage.getItem(CLE_PASSERELLE) || PASSERELLE_DEFAUT;

/**
 * Le poste a-t-il un lecteur déclaré ? Un navigateur en HTTPS refuse d'appeler
 * une adresse de bouclage tant que l'opérateur ne l'a pas configurée : on ne
 * sonde donc que si une adresse a été enregistrée sur cet appareil.
 */
export const passerelleConfiguree = () => !!localStorage.getItem(CLE_PASSERELLE) || location.protocol === 'http:';
