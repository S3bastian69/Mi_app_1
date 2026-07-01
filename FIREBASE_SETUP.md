# Configurar Firebase

La nube es opcional. Si `firebase-config.js` queda vacío, App Converter continúa funcionando solo de forma local.

## 1. Crear el proyecto

1. Entra a [Firebase Console](https://console.firebase.google.com/).
2. Crea un proyecto y agrega una **aplicación web**.
3. Copia el objeto `firebaseConfig` mostrado por Firebase.
4. Abre `firebase-config.js` y reemplaza los valores vacíos:

```js
window.APP_FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

La configuración web de Firebase identifica el proyecto, pero no es una contraseña. La protección real depende de Authentication y de las reglas incluidas en este proyecto.

## 2. Activar servicios

### Authentication

1. Abre **Authentication > Sign-in method**.
2. Habilita **Email/Password**.
3. En **Settings > Authorized domains**, agrega el dominio donde publicarás la PWA.
4. Para pruebas locales agrega `localhost` y `127.0.0.1` si no aparecen.

### Firestore

1. Abre **Firestore Database** y crea una base de datos.
2. Elige una región cercana a tus usuarios.
3. Publica el contenido de `firestore.rules` en la pestaña **Rules**.

Cada historial se guarda en:

```text
users/{uid}/conversions/{conversionId}
```

### Storage

1. Abre **Storage** y crea el bucket.
2. Publica el contenido de `storage.rules` en la pestaña **Rules**.

Los archivos se guardan en:

```text
users/{uid}/conversions/{conversionId}/originals/
users/{uid}/conversions/{conversionId}/outputs/
```

Las reglas rechazan usuarios anónimos, impiden acceder a otro `uid`, limitan cada archivo a 100 MB y aceptan únicamente PDF, CSV y XLSX.

## 3. Probar localmente

1. Cierra cualquier servidor anterior.
2. Abre `iniciar_app.bat`.
3. Entra en `http://127.0.0.1:4174`.
4. Crea una cuenta desde **Iniciar sesión**.
5. Convierte un PDF marcando **PDF originales** y/o **Excel y CSV generados**.
6. Inicia sesión desde otro navegador o dispositivo con el mismo correo.

Para probar desde un teléfono necesitas publicar la PWA con HTTPS. `127.0.0.1` solo corresponde a la computadora que ejecuta el servidor.

## 4. Desplegar con Firebase CLI

Instala e inicia Firebase CLI:

```powershell
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only hosting,firestore:rules,storage
```

`firebase.json` ya incluye la configuración de Hosting y las rutas de reglas. Después del despliegue, agrega el dominio asignado por Firebase a **Authentication > Settings > Authorized domains**.

## 5. Validación de seguridad

Antes de usar estados de cuenta reales:

1. Comprueba que una cuenta no pueda leer documentos ni rutas Storage de otra cuenta.
2. Usa Firebase Rules Playground o Emulator Suite para probar accesos permitidos y denegados.
3. Activa Firebase App Check para reducir abuso desde clientes no autorizados.
4. Revisa presupuesto y alertas de uso de Storage/Firestore.

Documentación oficial: [Authentication](https://firebase.google.com/docs/auth/web/password-auth), [Firestore Rules](https://firebase.google.com/docs/firestore/security/get-started), [Storage Rules](https://firebase.google.com/docs/storage/security/start).
