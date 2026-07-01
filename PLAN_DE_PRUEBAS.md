# Plan de pruebas - App Converter 1.0

## Preparacion

1. En Windows, abre `iniciar_app.bat`.
2. Entra a `http://127.0.0.1:4174`.
3. Usa primero `tests/fixtures/estado_cuenta_prueba.pdf`.
4. Para probar contraseña usa `tests/fixtures/estado_cuenta_encriptado.pdf`; su contraseña es `Banco2026`.
5. Para probar en un telefono, publica la carpeta en un alojamiento HTTPS; `127.0.0.1` solo funciona en la computadora.

## Pruebas funcionales

| ID | Prueba | Resultado esperado |
| --- | --- | --- |
| F-01 | Abrir la aplicacion | Se muestra la pantalla de carga sin errores. |
| F-02 | Seleccionar un PDF | Aparece el nombre, tamano y boton para quitarlo. |
| F-03 | Seleccionar el mismo PDF dos veces | Solo aparece una vez. |
| F-04 | Arrastrar varios PDF | Todos los PDF validos aparecen en la lista. |
| F-05 | Convertir a Excel | Se habilita `Descargar Excel` y el libro contiene `Datos crudos` y `Resumen`. |
| F-05a | Abrir el Excel | Debe contener `Tablas ordenadas`, `Datos crudos` y `Resumen` cuando detecte montos por periodo. |
| F-06 | Convertir a CSV | Se habilita `Descargar CSV` y conserva acentos al abrirlo en Excel. |
| F-07 | Elegir Ambos | Se generan las dos descargas. |
| F-08 | PDF protegido o danado | El lote continua y muestra una advertencia para ese archivo. |
| F-08a | PDF protegido con contraseña correcta | Solicita la contraseña, abre el PDF y genera el resultado. |
| F-08b | Contraseña incorrecta | Informa que es incorrecta y permite volver a escribirla. |
| F-08c | Omitir PDF protegido | Omite solo ese archivo y continúa con los demás. |
| F-09 | PDF escaneado sin texto | Se informa que necesita OCR; la aplicacion no se bloquea. |
| F-10 | Archivo mayor de 50 MB | Se omite y aparece el aviso correspondiente. |

## Dispositivos

| ID | Plataforma | Prueba |
| --- | --- | --- |
| D-01 | Windows/macOS/Linux | Instalar desde Chrome o Edge, cerrar y volver a abrir. |
| D-02 | Android | Instalar desde Chrome y convertir un PDF desde Archivos. |
| D-03 | iPhone/iPad | Safari > Compartir > Agregar a pantalla de inicio; convertir un PDF desde Archivos. |
| D-04 | Pantalla pequena | Confirmar que no hay texto cortado ni desplazamiento horizontal general. |
| D-05 | Teclado | Recorrer controles con Tab y convertir con Ctrl+Enter. |

## Privacidad y modo sin conexion

1. Instala y abre la aplicacion una vez con conexion.
2. Activa modo avion o desconecta la red.
3. Vuelve a abrirla y convierte el PDF de prueba.
4. Confirma que la conversion y las descargas siguen funcionando.

## Criterio para aprobar la version

- Todas las pruebas F-01 a F-10 pasan o tienen una incidencia documentada.
- D-01, D-02 y D-03 pasan al menos en un dispositivo real de cada plataforma.
- No se pierde ningun PDF valido si otro archivo del lote falla.
- Los documentos no aparecen en solicitudes de red externas.
