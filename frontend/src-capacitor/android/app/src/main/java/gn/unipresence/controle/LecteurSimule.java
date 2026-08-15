package gn.unipresence.controle;

import java.security.MessageDigest;

/**
 * Lecteur de démonstration, utilisé quand aucun lecteur réel n'est branché.
 *
 * Il permet d'installer l'application et de dérouler toute la chaîne — capture,
 * enrôlement, comparaison, signature, envoi — sans matériel. Il ne prouve
 * évidemment rien : le score qu'il renvoie dit seulement si le gabarit
 * présenté est celui qui a été enrôlé. L'interface l'annonce clairement au
 * contrôleur, pour qu'une démonstration ne soit jamais prise pour un contrôle.
 */
public class LecteurSimule implements LecteurEmpreinte {

    private final String appareilId;

    public LecteurSimule(String appareilId) {
        this.appareilId = appareilId == null ? "demo" : appareilId;
    }

    @Override
    public String nom() {
        return "Lecteur simulé (démonstration)";
    }

    @Override
    public boolean disponible() {
        return true;
    }

    @Override
    public Capture capturer() throws Exception {
        return new Capture("SIMU-" + empreinteDe(appareilId), 78);
    }

    @Override
    public int comparer(String gabarit) {
        // Le doigt « posé » est toujours celui de cet appareil : on ne reconnaît
        // donc que ce que cet appareil a lui-même enrôlé.
        try {
            return gabarit != null && gabarit.equals("SIMU-" + empreinteDe(appareilId)) ? 82 : 12;
        } catch (Exception e) {
            return 0;
        }
    }

    @Override
    public void fermer() {
        // rien à libérer
    }

    private static String empreinteDe(String source) throws Exception {
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        byte[] condense = sha.digest(source.getBytes("UTF-8"));
        StringBuilder hexa = new StringBuilder();
        for (int i = 0; i < 8; i++) hexa.append(String.format("%02x", condense[i]));
        return hexa.toString();
    }
}
