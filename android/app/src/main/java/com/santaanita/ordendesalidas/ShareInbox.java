package com.santaanita.ordendesalidas;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/** Guarda el PDF recibido por compartir o abrir hasta que la interfaz lo consuma. */
public final class ShareInbox {
    public static final class Payload {
        public final String base64;
        public final String name;

        Payload(String base64, String name) {
            this.base64 = base64;
            this.name = name;
        }
    }

    private static volatile Payload pending;

    private ShareInbox() {}

    public static void capture(Context context, Intent intent) {
        if (intent == null) return;
        Uri uri = null;
        String action = intent.getAction();
        if (Intent.ACTION_SEND.equals(action)) {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        } else if (Intent.ACTION_VIEW.equals(action)) {
            uri = intent.getData();
        }
        if (uri == null) return;
        try (InputStream input = context.getContentResolver().openInputStream(uri)) {
            if (input == null) return;
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int read;
            while ((read = input.read(chunk)) != -1) buffer.write(chunk, 0, read);
            String name = uri.getLastPathSegment() == null ? "reporte.pdf" : uri.getLastPathSegment();
            pending = new Payload(Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP), name);
        } catch (Exception ignored) {
            // Un URI que no se puede leer no debe tumbar el arranque.
        }
    }

    public static boolean hasPending() {
        return pending != null;
    }

    public static Payload take() {
        Payload value = pending;
        pending = null;
        return value;
    }
}
