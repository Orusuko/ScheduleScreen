# Orden de Salidas

Aplicación Android, sin servidor, para el personal de C. Santa Anita VIP. Importa el PDF de Vista (**Session by Finish Time** o **Session by Start Time**), muestra las salidas del día operativo y el margen de limpieza de cada sala.

Eslogan: Planifica · Limpia · Repite.

## Decisiones

- El público entra al **Start**. El margen de seguridad queda en 0 y se puede subir en Ajustes; se resta solo a la etiqueta de margen, no a la cuenta regresiva.
- **Ajustado** es menos de 20 min, **Justo** de 20 a 30 inclusive, **Holgado** más de 30. Los dos umbrales se pueden cambiar.
- Un solo aviso, en Finish menos el anticipo (15, 20 o 30 min). No hay un segundo aviso cuando la siguiente función está por entrar: la tarjeta pasa a rojo y dice «Ya inició la siguiente función».
- Si Vista mueve el inicio y en esa sala hay una sola función con el mismo título, se conserva la marca de limpia. Si hay dos iguales, no se transfiere sola: la vista previa pregunta.
- Una función cuyo Finish es anterior a la hora de generación del reporte nuevo no se propone como desaparecida.
- Las alarmas usan `AlarmManager.setAlarmClock`, no el cupo de Doze de `setExactAndAllowWhileIdle`, porque dos salas pueden salir con un minuto de diferencia. El APK se instala directo, así que el manifiesto declara `USE_EXACT_ALARM`.
- pdf.js queda fijado en **4.10.38**, build legacy, con el worker dentro de la app.

## Desarrollo en el navegador

```bash
npm install
npm run dev
```

Abre la dirección que imprime Vite. La lista, la importación, la limpieza y los temas funcionan ahí. Los avisos con la pantalla bloqueada solo existen en el teléfono; el botón **Probar notificación** usa el aviso del navegador.

## Pruebas

```bash
npm test
```

El PDF real está en `fixtures/2026-11-18-session-by-finish-time.pdf`. La prueba exige 31 funciones, la salida de las 0:03 AM el 19/11/2026 y los márgenes de referencia.

## Instalar en el teléfono, sin computadora

El archivo listo está en `descargas/Orden-de-Salidas.apk` (unos 5 MB). En el teléfono, ábrelo con Chrome:

https://github.com/Orusuko/ScheduleScreen/raw/cursor/orden-de-salidas-2668/descargas/Orden-de-Salidas.apk

1. Se descarga un archivo `.apk`.
2. Si Chrome dice que puede ser dañino, elige **Descargar de todas formas**. No viene de Play Store; es la app de este repositorio.
3. Abre la descarga. Android pide permiso para instalar desde Chrome: acéptalo.
4. Instala y abre **Orden de Salidas**.

Sirve en Android 7 o posterior. El PDF de prueba también se puede bajar y luego elegirlo dentro de la app:

https://github.com/Orusuko/ScheduleScreen/raw/cursor/orden-de-salidas-2668/fixtures/2026-11-18-session-by-finish-time.pdf

## Generar el APK otra vez

Hace falta el SDK de Android (compileSdk 36).

```bash
npm run cap:sync
cd android && ./gradlew assembleDebug
```

El resultado queda en `android/app/build/outputs/apk/debug/app-debug.apk`. Cópialo a `descargas/Orden-de-Salidas.apk` si vas a volver a publicarlo. Si la firma cambia, en el teléfono hay que desinstalar la versión anterior antes de instalar la nueva.

Para compartir un PDF hacia la app, el sistema debe ofrecerle «Orden de Salidas» al enviar un `application/pdf`. Si el administrador de archivos manda otro tipo MIME, usa **Elegir PDF de Vista**.

## Prueba manual

1. Instala el APK y abre la app. La primera pantalla explica notificaciones, alarmas exactas y batería. Continúa aunque no concedas nada.
2. Importa el PDF de muestra. La vista previa debe decir 31 funciones, día 18/11/2026 y reporte de las 12:28 PM. No aparece la Sala 6.
3. Guarda. Cierra la app y ábrela: las funciones siguen ahí.
4. Importa el mismo PDF otra vez. No debe duplicar, y una sala marcada limpia sigue limpia.
5. En Actuales, una sala ya salida y sin marcar queda arriba. Márcala: pasa a verde y, si ya salió, a Pasadas. Otro toque quita la marca.
6. Pasadas muestra «Sin marcar» en las que salieron hace más de 60 minutos y nadie marcó.
7. Una función de las 0:03 AM se lee como 12:03 AM del día siguiente. La última de cada sala dice que no hay siguiente función.
8. Sala 10 a las 2:55 PM muestra margen 20 min · Justo, siguiente 3:15 PM. Sala 8 a las 4:12 PM muestra 18 min · Ajustado.
9. En Ajustes, prueba claro, oscuro y automático. El aviso de prueba llega. Cambia el anticipo a 15 min.
10. Activa el modo avión: importar, marcar y reabrir siguen funcionando.
11. Con la pantalla bloqueada y la app cerrada, un aviso programado para dentro de un par de minutos debe llegar con un minuto de tolerancia. Reinicia el teléfono y confirma que el aviso pendiente sigue programado.
