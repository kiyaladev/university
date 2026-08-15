package gn.unipresence.controle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle etat) {
        // Le lecteur d'empreintes est branché avant que la page ne se charge :
        // l'interface doit pouvoir l'interroger dès son premier affichage.
        registerPlugin(EmpreintePlugin.class);
        super.onCreate(etat);
    }
}
