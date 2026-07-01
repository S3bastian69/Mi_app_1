import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const auth = getAuth();
signInWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    // El usuario ha iniciado sesión
    const user = userCredential.user;
    console.log("Usuario sincronizado:", user.uid);
  })
  .catch((error) => {
    console.error("Error al iniciar sesión:", error);
  });