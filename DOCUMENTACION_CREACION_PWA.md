# Documentacion de creacion de la PWA

Esta guia explica el paso a paso seguido para construir **App Converter Universal**, una pagina web instalable como PWA para convertir estados de cuenta PDF a Excel o CSV.

No incluye configuracion ni documentacion de Firebase.

## 1. Objetivo inicial

Se partio de una aplicacion local en Python y se replanteo como una aplicacion web progresiva para que una persona normal pudiera usarla desde:

- Computadora Windows, macOS o Linux.
- Telefono Android.
- iPhone o iPad.

La decision tecnica fue crear una **PWA estatica** con HTML, CSS y JavaScript. Asi la app puede publicarse en una URL, instalarse desde el navegador y funcionar sin entregar archivos ZIP.

## 2. Estructura creada

Se creo la carpeta principal:

```text
app-converter-universal/
```

Los archivos base quedaron organizados asi:

```text
app-converter-universal/
  index.html
  styles.css
  app.js
  converter-core.mjs
  manifest.webmanifest
  service-worker.js
  startup-check.js
  server.py
  iniciar_app.bat
  probar_app.bat
  package.json
  README.md
  PLAN_DE_PRUEBAS.md
  icons/
  tests/
  vendor/
```

La aplicacion se diseno para funcionar sin servidor de backend. El servidor local solo sirve los archivos durante pruebas.

## 3. Interfaz HTML

El archivo `index.html` contiene la estructura visible de la app.

Se agregaron estas secciones:

1. Encabezado con marca e instalacion de la PWA.
2. Hero o introduccion de la app.
3. Zona de carga de archivos PDF.
4. Opciones de formato de salida: Excel, CSV o ambos.
5. Barra de progreso.
6. Resultados y botones de descarga.
7. Vista previa de datos.
8. Mensajes de advertencia.
9. Dialogo para contrasenas de PDF protegidos.

Tambien se agrego una politica de seguridad con `Content-Security-Policy` para limitar recursos externos y reducir riesgos.

## 4. Estilos responsivos

El archivo `styles.css` define la apariencia visual.

Se construyo una interfaz:

- Adaptable a pantallas pequenas.
- Usable en telefono y escritorio.
- Con botones grandes para tactil.
- Con estados visibles para errores, progreso y advertencias.
- Con tablas desplazables horizontalmente cuando los datos son anchos.

Tambien se agregaron estilos para:

- Zona de arrastre.
- Lista de archivos.
- Tarjetas de opciones.
- Resultados.
- Dialogos.
- Historial visual de pruebas y descargas.

## 5. Carga de archivos

La carga de archivos se implemento en `app.js`.

Primero se agrego un input:

```html
<input id="fileInput" type="file" accept="application/pdf,.pdf" multiple />
```

Despues se conecto a:

- Boton `Elige archivos PDF`.
- Area completa de carga.
- Arrastrar y soltar.

Se agregaron validaciones:

- Solo archivos PDF.
- Maximo 20 archivos por lote.
- Maximo 50 MB por archivo.
- Evitar duplicados.

Cuando un archivo se agrega correctamente, aparece en la lista con nombre, tamano y boton para quitarlo.

## 6. Lectura local de PDF

Para leer PDF en el navegador se agrego PDF.js dentro de `vendor/`:

```text
vendor/pdf.min.mjs
vendor/pdf.worker.min.mjs
```

La lectura ocurre localmente en el dispositivo. El flujo es:

1. El usuario selecciona un PDF.
2. JavaScript lee el archivo con `file.arrayBuffer()`.
3. PDF.js abre el documento.
4. Se extrae el texto de cada pagina.
5. Los fragmentos se agrupan en renglones.

La funcion principal de agrupacion esta en `converter-core.mjs`:

```js
groupItemsIntoRows(items)
```

Esta funcion toma los textos detectados por PDF.js y los ordena por posicion vertical y horizontal.

## 7. Manejo de PDF protegidos

Se agrego soporte para estados de cuenta protegidos con contrasena.

Cuando PDF.js detecta que el archivo requiere contrasena:

1. La app abre un dialogo.
2. El usuario escribe la contrasena del banco.
3. La contrasena se usa solo en memoria.
4. Si es correcta, el PDF se procesa.
5. Si es incorrecta, la app permite reintentar.
6. Si el usuario cancela, solo se omite ese archivo y el lote continua.

Esto no rompe el cifrado del banco. Solo abre el PDF cuando el usuario conoce la contrasena.

## 8. Datos crudos

Al principio la app exportaba los datos casi tal como salian del PDF.

Cada renglon se guardaba con esta forma:

```text
Archivo
Pagina
Fila
Columna_1
Columna_2
Columna_3
...
```

Esto se conserva en Excel como hoja:

```text
Datos crudos
```

Esta hoja sirve para auditar el texto original extraido del PDF.

## 9. Tablas ordenadas

Despues se agrego una capa para evitar que el resultado quedara "planchado".

En `converter-core.mjs` se creo:

```js
buildStructuredTables(records)
```

Esta funcion intenta detectar:

- Encabezados de periodos o fechas.
- Secciones, por ejemplo `Activo circulante`.
- Conceptos, por ejemplo `Efectivo`.
- Totales.
- Montos.

El resultado usa columnas mas utiles:

```text
Archivo
Pagina
Tabla
Seccion
Concepto
Tipo
Periodo_1 / fecha detectada
Periodo_2 / fecha detectada
Periodo_3 / fecha detectada
```

Cuando se detectan montos por periodo, Excel agrega la hoja:

```text
Tablas ordenadas
```

Esto permite obtener una salida parecida a tablas financieras como balance general, estado de resultados o reportes por periodo.

## 10. Generacion de Excel y CSV

Para crear Excel se agrego SheetJS dentro de `vendor/`:

```text
vendor/xlsx.full.min.js
```

La app genera:

- Excel `.xlsx`.
- CSV `.csv`.
- Ambos si el usuario lo elige.

El Excel contiene:

```text
Tablas ordenadas
Datos crudos
Resumen
```

La hoja `Tablas ordenadas` aparece cuando la app detecta una estructura tabular con montos. Si no logra detectar esa estructura, exporta los datos crudos.

La hoja `Resumen` incluye informacion por archivo procesado.

## 11. Vista previa

Antes o despues de descargar, la app muestra una vista previa en pantalla.

La vista previa:

- Muestra hasta 100 filas.
- Usa la version ordenada si existe.
- Usa datos crudos si no se detectaron tablas.

Esto permite revisar rapidamente si la conversion tiene sentido antes de abrir Excel.

## 12. PWA instalable

Para que la pagina se comporte como app instalable se agregaron:

```text
manifest.webmanifest
service-worker.js
icons/
```

El manifiesto define:

- Nombre de la app.
- Nombre corto.
- Colores.
- Iconos.
- Modo `standalone`.

El service worker permite:

- Cachear archivos de la app.
- Abrir la aplicacion sin conexion despues de instalarla.
- Actualizar archivos principales cuando cambia el codigo.

Tambien se crearon iconos PNG y SVG para compatibilidad con Android, iOS y escritorio.

## 13. Servidor local

Al inicio se intento usar:

```powershell
python -m http.server
```

Pero aparecio un problema: algunos archivos `.mjs` se entregaban como `text/plain`, y el navegador bloqueaba los modulos JavaScript.

Para corregirlo se creo:

```text
server.py
```

Este servidor entrega:

```text
.js  -> text/javascript
.mjs -> text/javascript
.webmanifest -> application/manifest+json
.svg -> image/svg+xml
```

El archivo `iniciar_app.bat` abre este servidor en:

```text
http://127.0.0.1:4174
```

No se debe abrir `index.html` directamente porque los modulos web y el modo instalable necesitan HTTP o HTTPS.

## 14. Pruebas automaticas

Se creo una carpeta:

```text
tests/
```

Incluye:

```text
tests/converter.test.mjs
tests/run-tests.mjs
tests/fixtures/estado_cuenta_prueba.pdf
tests/fixtures/estado_cuenta_encriptado.pdf
```

Las pruebas validan:

- Lectura de PDF normal.
- Lectura de PDF cifrado con contrasena.
- Extraccion de texto.
- Generacion de Excel.
- Reapertura del Excel generado.
- Generacion de CSV.
- Recursos PWA disponibles.
- Manifiesto instalable.
- Deteccion de tablas ordenadas tipo balance general.

Para ejecutarlas:

```powershell
node tests/run-tests.mjs
```

O en Windows:

```text
probar_app.bat
```

## 15. Plan de pruebas manuales

Se creo:

```text
PLAN_DE_PRUEBAS.md
```

Este documento contiene pruebas para:

- Seleccion de PDF.
- Arrastrar y soltar.
- Duplicados.
- Excel.
- CSV.
- PDF protegido.
- Contrasena incorrecta.
- PDF escaneado.
- Pantallas pequenas.
- Instalacion en Android, iOS y escritorio.
- Funcionamiento sin conexion.

## 16. Problemas corregidos durante el desarrollo

Durante la construccion aparecieron varios errores y se corrigieron asi:

### El archivo no se agregaba

Causa: el motor principal no terminaba de cargar en algunos navegadores.

Solucion:

- Se agrego `startup-check.js`.
- Se movio la carga de PDF.js para que ocurra al convertir, no al iniciar.
- Se agrego un boton explicito para abrir el selector de archivos.

### Error de modulos `.mjs`

Causa: el servidor local entregaba `.mjs` como `text/plain`.

Solucion:

- Se creo `server.py`.
- Se actualizo `iniciar_app.bat` para usar ese servidor.

### Resultado demasiado plano

Causa: el primer motor solo exportaba renglones y columnas genericas.

Solucion:

- Se agrego `buildStructuredTables()`.
- Se creo la hoja `Tablas ordenadas`.
- Se conservaron los datos originales en `Datos crudos`.

### PDF protegido

Causa: algunos estados de cuenta bancarios vienen cifrados.

Solucion:

- Se agrego dialogo de contrasena.
- Se permitio reintentar u omitir solo ese archivo.

## 17. Flujo completo de uso

El flujo final de la aplicacion es:

1. El usuario abre `iniciar_app.bat`.
2. Se abre `http://127.0.0.1:4174`.
3. Selecciona uno o varios PDF.
4. Elige Excel, CSV o ambos.
5. La app procesa los PDF localmente.
6. Si un PDF pide contrasena, la solicita.
7. Extrae texto y renglones.
8. Genera datos crudos.
9. Intenta estructurar tablas financieras.
10. Crea Excel/CSV.
11. Muestra vista previa.
12. Permite descargar el resultado.

## 18. Limitaciones actuales

La app funciona mejor con PDF que tienen texto digital.

Limitaciones conocidas:

- PDF escaneados como imagen necesitan OCR.
- Algunos bancos usan formatos muy distintos.
- La deteccion de secciones y totales es heuristica.
- Puede requerir reglas especificas para bancos concretos.

## 19. Siguientes mejoras sugeridas

Para mejorar la calidad de salida se recomienda:

1. Agregar OCR para PDF escaneados.
2. Crear perfiles por banco.
3. Permitir editar nombres de columnas antes de exportar.
4. Agregar vista previa por tabla detectada.
5. Permitir combinar o separar tablas manualmente.
6. Agregar validaciones de saldos, cargos y abonos.
7. Crear plantillas para balance general, estado de resultados y movimientos bancarios.

