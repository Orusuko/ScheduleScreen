package com.santaanita.ordendesalidas;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.JSArray;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Programa cada aviso con setAlarmClock.
 * setExactAndAllowWhileIdle solo puede disparar una vez cada varios minutos en Doze,
 * y aquí dos salas pueden salir con un minuto de diferencia.
 */
public final class AlertScheduler {
    private static final String PREFS = "exact_alerts";
    private static final String KEY = "payload";

    private AlertScheduler() {}

    public static int replace(Context context, JSArray alerts) throws Exception {
        JSONArray previous = load(context);
        for (int i = 0; i < previous.length(); i++) cancel(context, previous.getJSONObject(i).getInt("id"));
        JSONArray next = new JSONArray();
        int scheduled = 0;
        long now = System.currentTimeMillis();
        for (int i = 0; i < alerts.length(); i++) {
            JSONObject item = alerts.getJSONObject(i);
            next.put(item);
            if (item.getLong("at") > now && schedule(context, item)) scheduled++;
        }
        save(context, next);
        return scheduled;
    }

    public static void rescheduleStored(Context context) {
        try {
            JSONArray stored = load(context);
            JSONArray future = new JSONArray();
            long now = System.currentTimeMillis();
            for (int i = 0; i < stored.length(); i++) {
                JSONObject item = stored.getJSONObject(i);
                if (item.getLong("at") <= now) continue;
                future.put(item);
                schedule(context, item);
            }
            save(context, future);
        } catch (Exception ignored) {
            // Si el almacenamiento aún no está disponible tras el arranque, el siguiente
            // inicio de la app vuelve a escribir el plan.
        }
    }

    public static void removeStored(Context context, int id) {
        try {
            JSONArray stored = load(context);
            JSONArray kept = new JSONArray();
            for (int i = 0; i < stored.length(); i++) {
                JSONObject item = stored.getJSONObject(i);
                if (item.getInt("id") != id) kept.put(item);
            }
            save(context, kept);
        } catch (Exception ignored) {
        }
    }

    private static boolean schedule(Context context, JSONObject item) throws Exception {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) return false;
        int id = item.getInt("id");
        long at = item.getLong("at");
        PendingIntent fire = fireIntent(context, id, item.getString("title"), item.getString("body"));
        Intent show = new Intent(context, MainActivity.class);
        show.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent showIntent = PendingIntent.getActivity(
            context,
            id,
            show,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        manager.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showIntent), fire);
        return true;
    }

    private static void cancel(Context context, int id) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        manager.cancel(fireIntent(context, id, "", ""));
    }

    private static PendingIntent fireIntent(Context context, int id, String title, String body) {
        Intent intent = new Intent(context, AlertReceiver.class);
        intent.setAction(AlertReceiver.ACTION_FIRE);
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        return PendingIntent.getBroadcast(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static JSONArray load(Context context) throws Exception {
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]");
        return new JSONArray(raw == null ? "[]" : raw);
    }

    private static void save(Context context, JSONArray alerts) {
        SharedPreferences.Editor editor = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        editor.putString(KEY, alerts.toString());
        editor.apply();
    }
}
