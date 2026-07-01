import { getAuth, onAuthStateChanged } from "firebase/auth";

const auth = getAuth();
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Usuario activo, mostrar pantalla principal
    console.log("Sesión activa para:", user.email);
  } else {
    // Usuario no logueado, mostrar pantalla de login
    console.log("No hay sesión iniciada");
  }
});
