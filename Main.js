// main.js (o tu archivo principal)
import { initializeApp } from "firebase/app";
import { firebaseConfig } from "./firebase-config.js"; // Importamos la config que creamos antes

// Aquí inicializas la conexión
const app = initializeApp(firebaseConfig);

console.log("¡Firebase conectado correctamente!");