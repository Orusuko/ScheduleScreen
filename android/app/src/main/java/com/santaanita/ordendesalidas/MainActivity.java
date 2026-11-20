package com.santaanita.ordendesalidas;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExactAlertsPlugin.class);
        registerPlugin(DeviceSettingsPlugin.class);
        registerPlugin(ShareImportPlugin.class);
        // Antes del puente, para que el PDF compartido ya esté disponible al arrancar.
        ShareInbox.capture(this, getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        ShareInbox.capture(this, intent);
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
