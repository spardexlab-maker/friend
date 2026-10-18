package app.rafiq.personal;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(WearBridgePlugin.class);
        registerPlugin(UpdateBridgePlugin.class);
        registerPlugin(GoogleBridgePlugin.class);
        registerPlugin(HealthTotalsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
