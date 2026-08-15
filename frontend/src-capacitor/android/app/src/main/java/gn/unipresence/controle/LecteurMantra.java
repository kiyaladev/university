package gn.unipresence.controle;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.util.Base64;
import android.util.Log;

import java.lang.reflect.Method;
import java.util.Map;

/**
 * Lecteur Mantra MFS100 branché en USB-OTG sur le téléphone du contrôleur.
 *
 * Le SDK MFS100 est distribué par Mantra sous licence : son .aar n'est pas dans
 * ce dépôt et ne peut pas y être. Le pont est donc fait par réflexion, ce qui a
 * deux conséquences voulues :
 *
 *   — l'application compile et s'installe sans le SDK, et se rabat proprement
 *     sur le lecteur simulé, ce qui permet de tester toute la chaîne ;
 *   — le jour où l'on dépose « mfs100.aar » dans app/libs/, ce lecteur devient
 *     actif tout seul, sans rien changer d'autre.
 *
 * Les noms de méthodes suivent le SDK MFS100 v… (Init, AutoCapture, ExtractISOTemplate,
 * MatchISO, Uninit). S'ils changent d'une version à l'autre, c'est ici, et
 * seulement ici, qu'il faut les corriger.
 */
public class LecteurMantra implements LecteurEmpreinte {

    private static final String TAG = "UniPresence.Mantra";
    private static final String CLASSE_SDK = "com.mantra.mfs100.MFS100";

    /** Identifiants USB des lecteurs Mantra (vendor id Mantra Softech). */
    private static final int VENDOR_MANTRA = 0x1fba;

    private final Context contexte;
    private Object sdk;

    public LecteurMantra(Context contexte) {
        this.contexte = contexte;
    }

    /** Le SDK est-il présent dans l'APK ? */
    public static boolean sdkPresent() {
        try {
            Class.forName(CLASSE_SDK);
            return true;
        } catch (ClassNotFoundException e) {
            return false;
        }
    }

    @Override
    public String nom() {
        return "Mantra MFS100";
    }

    /** Le lecteur est branché si un périphérique Mantra est visible sur l'USB. */
    @Override
    public boolean disponible() {
        if (!sdkPresent()) return false;

        UsbManager usb = (UsbManager) contexte.getSystemService(Context.USB_SERVICE);
        if (usb == null) return false;

        Map<String, UsbDevice> peripheriques = usb.getDeviceList();
        for (UsbDevice d : peripheriques.values()) {
            if (d.getVendorId() == VENDOR_MANTRA) return true;
        }
        return false;
    }

    private Object sdk() throws Exception {
        if (sdk != null) return sdk;

        Class<?> classe = Class.forName(CLASSE_SDK);
        sdk = classe.getConstructor(Context.class).newInstance(contexte);

        Method init = classe.getMethod("Init");
        int code = (int) init.invoke(sdk);
        if (code != 0) {
            sdk = null;
            throw new IllegalStateException("Lecteur Mantra : initialisation refusée (code " + code + ")");
        }
        return sdk;
    }

    @Override
    public Capture capturer() throws Exception {
        Object m = sdk();
        Class<?> classe = m.getClass();

        // FingerData reçoit le résultat de la capture ; le SDK le remplit.
        Class<?> classeDonnees = Class.forName("com.mantra.mfs100.FingerData");
        Object donnees = classeDonnees.getConstructor().newInstance();

        Method autoCapture = classe.getMethod("AutoCapture", classeDonnees, int.class, boolean.class);
        int code = (int) autoCapture.invoke(m, donnees, 10000, false);
        if (code != 0) {
            throw new IllegalStateException("Capture impossible (code " + code + ")");
        }

        byte[] gabarit = (byte[]) classeDonnees.getMethod("ISOTemplate").invoke(donnees);
        int qualite = (int) classeDonnees.getMethod("Quality").invoke(donnees);

        return new Capture(Base64.encodeToString(gabarit, Base64.NO_WRAP), qualite);
    }

    @Override
    public int comparer(String gabarit) throws Exception {
        Object m = sdk();
        Class<?> classe = m.getClass();

        Class<?> classeDonnees = Class.forName("com.mantra.mfs100.FingerData");
        Object donnees = classeDonnees.getConstructor().newInstance();

        Method autoCapture = classe.getMethod("AutoCapture", classeDonnees, int.class, boolean.class);
        int code = (int) autoCapture.invoke(m, donnees, 10000, false);
        if (code != 0) {
            throw new IllegalStateException("Lecture impossible (code " + code + ")");
        }

        byte[] pose = (byte[]) classeDonnees.getMethod("ISOTemplate").invoke(donnees);
        byte[] enrole = Base64.decode(gabarit, Base64.NO_WRAP);

        // MatchISO renvoie un score ; négatif = erreur.
        Method match = classe.getMethod("MatchISO", byte[].class, byte[].class);
        int score = (int) match.invoke(m, enrole, pose);
        if (score < 0) {
            throw new IllegalStateException("Comparaison impossible (code " + score + ")");
        }
        return Math.min(100, score);
    }

    @Override
    public void fermer() {
        if (sdk == null) return;
        try {
            sdk.getClass().getMethod("Uninit").invoke(sdk);
        } catch (Exception e) {
            Log.w(TAG, "Fermeture du lecteur : " + e.getMessage());
        } finally {
            sdk = null;
        }
    }
}
