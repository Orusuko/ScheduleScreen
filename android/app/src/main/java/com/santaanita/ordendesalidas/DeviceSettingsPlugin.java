package com.santaanita.ordendesalidas;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceSettings")
public class DeviceSettingsPlugin extends Plugin {
    @PluginMethod
    public void openBatteryOptimization(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Sin actividad");
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + activity.getPackageName()));
            activity.startActivity(intent);
        } catch (Exception ignored) {
            activity.startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        }
        call.resolve();
    }

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        PowerManager manager = (PowerManager) getContext().getSystemService(Activity.POWER_SERVICE);
        boolean ignoring = manager != null && manager.isIgnoringBatteryOptimizations(getContext().getPackageName());
        JSObject result = new JSObject();
        result.put("ignoring", ignoring);
        call.resolve(result);
    }
}
