package com.santaanita.ordendesalidas;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class AlertReceiver extends BroadcastReceiver {
    public static final String ACTION_FIRE = "com.santaanita.ordendesalidas.ALERT";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
            || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(intent.getAction())
            || "android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            AlertScheduler.rescheduleStored(context);
            return;
        }
        if (!ACTION_FIRE.equals(intent.getAction())) return;
        int id = intent.getIntExtra("id", 0);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        if (title == null) return;
        AlertNotifier.show(context, id, title, body == null ? "" : body);
        AlertScheduler.removeStored(context, id);
    }
}
