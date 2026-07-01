# App Converter Universal

Aplicacion web progresiva (PWA) para Android, iOS, Windows, macOS y Linux. Lee los PDF y crea Excel/CSV dentro del dispositivo; no envia documentos a un servidor.

Para conocer el paso a paso de construccion de la pagina web, consulta [DOCUMENTACION_CREACION_PWA.md](DOCUMENTACION_CREACION_PWA.md).

Firebase es opcional. Al configurarlo, agrega inicio de sesion, historial por usuario y almacenamiento privado de originales y resultados. Consulta [FIREBASE_SETUP.md](FIREBASE_SETUP.md).

La exportacion crea dos niveles de datos:

- `Tablas ordenadas`: secciones, conceptos, totales y columnas de periodo detectadas automaticamente.
- `Datos crudos`: texto extraido tal como viene del PDF, util para auditar o corregir casos dificiles.

## Probar en la computadora

En Windows, abre `iniciar_app.bat`. También puedes ejecutar:

```powershell
python server.py
```

Abre `http://127.0.0.1:4174`. No abras `index.html` directamente: los navegadores requieren HTTP/HTTPS para los modulos y el modo instalable.

## Publicar sin ZIP

Publica el contenido de esta carpeta en un alojamiento estatico con HTTPS (Cloudflare Pages, GitHub Pages, Netlify, Firebase Hosting o equivalente). Los usuarios entran a una URL:

- Android y computadoras: usan el boton **Instalar aplicacion** del navegador.
- iPhone/iPad: en Safari, eligen **Compartir > Agregar a pantalla de inicio**.
- Tambien puede utilizarse sin instalar.

## Ejecutar pruebas

Con Node.js 20 o posterior, abre `probar_app.bat` o ejecuta:

```powershell
node tests/run-tests.mjs
```

La suite valida lectura de un PDF real, generacion y reapertura de Excel, CSV, servidor, recursos sin conexion y manifiesto instalable.

Para las pruebas en dispositivos reales, sigue [PLAN_DE_PRUEBAS.md](PLAN_DE_PRUEBAS.md).

## Arquitectura

- `index.html` y `styles.css`: interfaz adaptable y accesible.
- `app.js`: lectura, conversion, vista previa y descargas.
- `converter-core.mjs`: agrupacion de texto y estructuracion de tablas financieras.
- `pdf.js`: lectura local del contenido de los PDF.
- `SheetJS`: creacion local de libros Excel.
- `service-worker.js` y `manifest.webmanifest`: instalacion y funcionamiento sin conexion.
- `firebase-cloud.js`: autenticacion, sincronizacion e historial por usuario.
- `firestore.rules` y `storage.rules`: aislamiento de datos por `uid`.

## Limitacion actual

La primera version extrae texto digital y agrupa cada renglon en columnas. Un estado de cuenta escaneado como imagen necesita OCR, que se agregara en una etapa posterior.
