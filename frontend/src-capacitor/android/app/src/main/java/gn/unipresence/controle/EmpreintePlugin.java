package gn.unipresence.controle;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.Executor;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Pont entre l'interface web et le lecteur d'empreintes de l'appareil.
 *
 * Deux choses très différentes vivent ici, et il ne faut jamais les confondre :
 *
 *   — le LECTEUR EXTERNE (Mantra MFS100 en USB-OTG) sert à faire attester un
 *     ENSEIGNANT devant le contrôleur. C'est le seul capteur capable de
 *     comparer le doigt d'un tiers ;
 *   — le CAPTEUR DU TÉLÉPHONE ne reconnaît que le propriétaire de l'appareil.
 *     Il ne sert donc qu'à déverrouiller la session du contrôleur, jamais à
 *     attester la présence d'un enseignant. Android n'expose de toute façon
 *     aucun gabarit.
 *
 * Les résultats de lecture sont signés avec la clé propre à cet appareil,
 * remise par le serveur à l'enrôlement et conservée dans le coffre chiffré
 * d'Android. Sans cette signature, n'importe quel client pourrait prétendre
 * qu'une empreinte a été reconnue.
 */
@CapacitorPlugin(name = "Empreinte")
public class EmpreintePlugin extends Plugin {

    private static final String TAG = "UniPresence.Empreinte";
    private static final String COFFRE = "unipresence_appareil";
    private static final String CLE_ID = "appareil_id";
    private static final String CLE_SECRET = "appareil_secret";

    private LecteurEmpreinte lecteur;

    // ------------------------------------------------------------ coffre

    private SharedPreferences coffre() throws Exception {
        Context contexte = getContext();
        MasterKey cle = new MasterKey.Builder(contexte)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build();

        return EncryptedSharedPreferences.create(
                contexte,
                COFFRE,
                cle,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM);
    }

    /** L'application dépose ici la clé remise par le serveur, une seule fois. */
    @PluginMethod
    public void enregistrerAppareil(PluginCall appel) {
        String id = appel.getString("appareilId");
        String secret = appel.getString("secret");
        if (id == null || secret == null) {
            appel.reject("appareilId et secret sont requis");
            return;
        }

        try {
            coffre().edit().putString(CLE_ID, id).putString(CLE_SECRET, secret).apply();
            lecteur = null; // le lecteur simulé dépend de l'identifiant
            appel.resolve(new JSObject().put("enregistre", true));
        } catch (Exception e) {
            appel.reject("Coffre de l'appareil inaccessible : " + e.getMessage(), e);
        }
    }

    private String appareilId() throws Exception {
        return coffre().getString(CLE_ID, null);
    }

    private String secret() throws Exception {
        return coffre().getString(CLE_SECRET, null);
    }

    // ------------------------------------------------------------ lecteur

    private LecteurEmpreinte lecteur() throws Exception {
        if (lecteur != null) return lecteur;

        LecteurMantra mantra = new LecteurMantra(getContext());
        lecteur = mantra.disponible() ? mantra : new LecteurSimule(appareilId());
        return lecteur;
    }

    @PluginMethod
    public void etat(PluginCall appel) {
        try {
            LecteurEmpreinte l = lecteur();
            JSObject res = new JSObject();
            res.put("disponible", l.disponible());
            res.put("lecteur", l.nom());
            res.put("simule", l instanceof LecteurSimule);
            res.put("appareilEnrole", appareilId() != null);
            res.put("sdkPresent", LecteurMantra.sdkPresent());
            appel.resolve(res);
        } catch (Exception e) {
            appel.reject("État du lecteur indisponible : " + e.getMessage(), e);
        }
    }

    /** Capture pour enrôlement : renvoie le gabarit et sa signature. */
    @PluginMethod
    public void enroler(PluginCall appel) {
        String enseignantId = appel.getString("enseignantId");
        if (enseignantId == null) {
            appel.reject("enseignantId est requis");
            return;
        }

        try {
            LecteurEmpreinte.Capture capture = lecteur().capturer();
            String horodatage = maintenant();
            String appareil = appareilId();

            JSObject res = new JSObject();
            res.put("template", capture.gabarit);
            res.put("qualite", capture.qualite);
            res.put("horodatage", horodatage);
            res.put("appareilId", appareil);
            res.put("signature", signer(
                    "enrolement|" + appareil + "|" + enseignantId + "|" + capture.gabarit + "|" + horodatage));
            appel.resolve(res);
        } catch (Exception e) {
            Log.w(TAG, "enrôlement", e);
            appel.reject(e.getMessage(), e);
        }
    }

    /**
     * Vérification en salle. La signature couvre l'appareil, l'enseignant, le
     * gabarit comparé et le score : rien de tout cela ne peut être changé en
     * route sans invalider la preuve.
     */
    @PluginMethod
    public void verifier(PluginCall appel) {
        String enseignantId = appel.getString("enseignantId");
        String gabarit = appel.getString("gabarit");
        if (enseignantId == null || gabarit == null) {
            appel.reject("enseignantId et gabarit sont requis");
            return;
        }

        try {
            int score = lecteur().comparer(gabarit);
            String horodatage = maintenant();
            String appareil = appareilId();
            String condense = sha256(gabarit);

            JSObject res = new JSObject();
            res.put("score", score);
            res.put("horodatage", horodatage);
            res.put("appareilId", appareil);
            res.put("signature", signer(
                    "verification|" + appareil + "|" + enseignantId + "|" + condense + "|" + score + "|" + horodatage));
            appel.resolve(res);
        } catch (Exception e) {
            Log.w(TAG, "vérification", e);
            appel.reject(e.getMessage(), e);
        }
    }

    @PluginMethod
    public void fermer(PluginCall appel) {
        if (lecteur != null) lecteur.fermer();
        appel.resolve();
    }

    // --------------------------------------------- verrouillage de session

    /**
     * Déverrouillage de l'application par le capteur du téléphone. Cela
     * n'atteste la présence de personne : cela vérifie seulement que le
     * téléphone est bien entre les mains de son porteur habituel.
     */
    @PluginMethod
    public void deverrouiller(PluginCall appel) {
        BiometricManager gestionnaire = BiometricManager.from(getContext());
        int etat = gestionnaire.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK
                | BiometricManager.Authenticators.DEVICE_CREDENTIAL);

        if (etat != BiometricManager.BIOMETRIC_SUCCESS) {
            appel.resolve(new JSObject().put("possible", false).put("ouvert", false));
            return;
        }

        Executor executeur = ContextCompat.getMainExecutor(getContext());
        FragmentActivity activite = (FragmentActivity) getActivity();

        activite.runOnUiThread(() -> {
            BiometricPrompt invite = new BiometricPrompt(activite, executeur,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult resultat) {
                            appel.resolve(new JSObject().put("possible", true).put("ouvert", true));
                        }

                        @Override
                        public void onAuthenticationError(int code, CharSequence message) {
                            appel.resolve(new JSObject()
                                    .put("possible", true)
                                    .put("ouvert", false)
                                    .put("motif", String.valueOf(message)));
                        }
                    });

            invite.authenticate(new BiometricPrompt.PromptInfo.Builder()
                    .setTitle("UniPrésence")
                    .setSubtitle("Déverrouillez votre tournée")
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK
                            | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                    .build());
        });
    }

    // ------------------------------------------------------------ signature

    private String signer(String charge) throws Exception {
        String secret = secret();
        if (secret == null) {
            throw new IllegalStateException(
                    "Cet appareil n'a pas encore reçu sa clé : ouvrez une session pour l'enrôler.");
        }

        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes("UTF-8"), "HmacSHA256"));
        return hexa(mac.doFinal(charge.getBytes("UTF-8")));
    }

    private static String sha256(String valeur) throws Exception {
        return hexa(java.security.MessageDigest.getInstance("SHA-256").digest(valeur.getBytes("UTF-8")));
    }

    private static String hexa(byte[] octets) {
        StringBuilder sortie = new StringBuilder();
        for (byte o : octets) sortie.append(String.format("%02x", o));
        return sortie.toString();
    }

    /** Horodatage ISO en UTC : le serveur refuse un résultat trop ancien. */
    private static String maintenant() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.FRANCE);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }
}
