package gn.unipresence.controle;

/**
 * Ce que l'application attend d'un lecteur d'empreintes, quel qu'il soit.
 *
 * Le reste de l'application ne connaît que cette interface : brancher un autre
 * modèle de lecteur revient à écrire une classe de plus, sans toucher ni au
 * plugin, ni à l'interface web, ni au protocole de signature.
 */
public interface LecteurEmpreinte {

    /** Nom affiché au contrôleur quand il cherche pourquoi rien ne se passe. */
    String nom();

    /** Le lecteur est-il branché et utilisable maintenant ? */
    boolean disponible();

    /**
     * Capture une empreinte et renvoie son gabarit, sous une forme que le
     * même lecteur saura comparer plus tard. Jamais l'image du doigt.
     */
    Capture capturer() throws Exception;

    /**
     * Compare le doigt posé au gabarit enrôlé et renvoie un score sur 100.
     * La comparaison se fait ici, sur l'appareil : le gabarit ne circule pas
     * plus loin que nécessaire.
     */
    int comparer(String gabarit) throws Exception;

    /** Libère le lecteur (USB relâché) — appelé quand l'écran se ferme. */
    void fermer();

    /** Résultat d'une capture : le gabarit et sa qualité, telle que jugée par le lecteur. */
    class Capture {
        public final String gabarit;
        public final int qualite;

        public Capture(String gabarit, int qualite) {
            this.gabarit = gabarit;
            this.qualite = qualite;
        }
    }
}
