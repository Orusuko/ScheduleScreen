package com.santaanita.ordendesalidas;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ExactAlerts")
public class ExactAlertsPlugin extends Plugin {
    @PluginMethod
    public void replace(PluginCall call) {
        JSArray alerts = call.getArray("alerts", new JSArray());
        try {
            int scheduled = AlertScheduler.replace(getContext(), alerts);
            JSObject result = new JSObject();
            result.put("scheduled", scheduled);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudieron programar las alarmas", error);
        }
    }

    @PluginMethod
    public void ping(PluginCall call) {
        AlertNotifier.show(
            getContext(),
            990001,
            "Sala 10 sale en 20 min · margen de limpieza 20 min",
            "La Venganza Del Charro Negro"
        );
        call.resolve();
    }
}
