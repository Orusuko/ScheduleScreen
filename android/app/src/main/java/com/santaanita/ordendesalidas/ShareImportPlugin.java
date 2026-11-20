package com.santaanita.ordendesalidas;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

@CapacitorPlugin(name = "ShareImport")
public class ShareImportPlugin extends Plugin {
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (ShareInbox.hasPending()) notifyListeners("pdfReceived", new JSObject());
    }

    @PluginMethod
    public void consume(PluginCall call) {
        ShareInbox.Payload payload = ShareInbox.take();
        JSObject result = new JSObject();
        if (payload == null) {
            result.put("base64", JSONObject.NULL);
            result.put("name", JSONObject.NULL);
        } else {
            result.put("base64", payload.base64);
            result.put("name", payload.name);
        }
        call.resolve(result);
    }
}
