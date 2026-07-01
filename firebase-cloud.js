(() => {
  const elements = {
    authButton: document.querySelector("#authButton"),
    logoutButton: document.querySelector("#logoutButton"),
    syncStatus: document.querySelector("#syncStatus"),
    authDialog: document.querySelector("#authDialog"),
    authForm: document.querySelector("#authForm"),
    authEmail: document.querySelector("#authEmail"),
    authPassword: document.querySelector("#authPassword"),
    authError: document.querySelector("#authError"),
    authCancel: document.querySelector("#authCancel"),
    registerButton: document.querySelector("#registerButton"),
    resetPasswordButton: document.querySelector("#resetPasswordButton"),
    cloudOptions: document.querySelector("#cloudOptions"),
    historySection: document.querySelector("#historySection"),
    historyStatus: document.querySelector("#historyStatus"),
    historyList: document.querySelector("#historyList"),
    refreshHistory: document.querySelector("#refreshHistory")
  };

  const config = window.APP_FIREBASE_CONFIG || {};
  const configured = ["apiKey", "authDomain", "projectId", "storageBucket", "appId"]
    .every((key) => typeof config[key] === "string" && config[key].trim());
  let auth;
  let database;
  let storage;
  let currentUser = null;

  function friendlyError(error) {
    const messages = {
      "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
      "auth/invalid-email": "El correo electrónico no es válido.",
      "auth/invalid-credential": "El correo o la contraseña no son correctos.",
      "auth/user-not-found": "No existe una cuenta con ese correo.",
      "auth/wrong-password": "La contraseña no es correcta.",
      "auth/weak-password": "Usa una contraseña de al menos 6 caracteres.",
      "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
      "auth/network-request-failed": "No hay conexión con Firebase. Revisa internet."
    };
    return messages[error?.code] || error?.message || "No se pudo completar la operación.";
  }

  function setAuthError(message = "") {
    elements.authError.textContent = message;
    elements.authError.classList.toggle("hidden", !message);
  }

  function openAuth() {
    setAuthError();
    elements.authPassword.value = "";
    elements.authDialog.showModal();
    elements.authEmail.focus();
  }

  function safeName(name) {
    return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "archivo";
  }

  async function upload(path, blob, contentType) {
    const reference = storage.ref(path);
    await reference.put(blob, { contentType });
    return path;
  }

  async function saveConversion({ sourceFiles, outputFiles, rowCount, saveOriginals, saveOutputs }) {
    if (!currentUser) throw new Error("Inicia sesión para guardar en la nube.");
    const documentRef = database.collection("users").doc(currentUser.uid).collection("conversions").doc();
    const basePath = `users/${currentUser.uid}/conversions/${documentRef.id}`;
    const sources = [];
    const outputs = [];

    for (const [index, file] of sourceFiles.entries()) {
      const path = saveOriginals ? `${basePath}/originals/${index + 1}_${safeName(file.name)}` : null;
      if (path) await upload(path, file, file.type || "application/pdf");
      sources.push({ name: file.name, size: file.size, storagePath: path });
    }
    for (const [index, file] of outputFiles.entries()) {
      const path = saveOutputs ? `${basePath}/outputs/${index + 1}_${safeName(file.name)}` : null;
      if (path) await upload(path, file.blob, file.type);
      outputs.push({ name: file.name, size: file.blob.size, type: file.type, storagePath: path });
    }

    await documentRef.set({
      userId: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      rowCount,
      sourceFiles: sources,
      outputs,
      savedOriginals: Boolean(saveOriginals),
      savedOutputs: Boolean(saveOutputs)
    });
    await loadHistory();
    return documentRef.id;
  }

  async function downloadCloudFile(path, name) {
    try {
      elements.historyStatus.textContent = `Preparando ${name}...`;
      const token = await currentUser.getIdToken();
      const objectName = encodeURIComponent(path);
      const endpoint = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(config.storageBucket)}/o/${objectName}?alt=media`;
      const response = await fetch(endpoint, { headers: { Authorization: `Firebase ${token}` } });
      if (!response.ok) throw new Error("No se pudo descargar el archivo privado.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.rel = "noopener";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      elements.historyStatus.textContent = "Descarga iniciada.";
    } catch (error) {
      elements.historyStatus.textContent = friendlyError(error);
    }
  }

  function addFileButtons(container, files) {
    files.filter((file) => file.storagePath).forEach((file) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cloud-file-button";
      button.textContent = `Descargar ${file.name}`;
      button.addEventListener("click", () => downloadCloudFile(file.storagePath, file.name));
      container.append(button);
    });
  }

  async function loadHistory() {
    if (!currentUser) return;
    elements.historyStatus.textContent = "Cargando historial...";
    try {
      const snapshot = await database.collection("users").doc(currentUser.uid)
        .collection("conversions").orderBy("createdAt", "desc").limit(50).get();
      elements.historyList.replaceChildren();
      snapshot.forEach((documentSnapshot) => {
        const data = documentSnapshot.data();
        const item = document.createElement("li");
        item.className = "history-item";
        const header = document.createElement("div");
        header.className = "history-item-header";
        const title = document.createElement("strong");
        const sources = data.sourceFiles || [];
        title.textContent = sources.map((file) => file.name).join(", ") || "Conversión";
        const date = document.createElement("time");
        const dateValue = data.createdAt?.toDate?.();
        date.textContent = dateValue ? dateValue.toLocaleString("es-MX") : "Sincronizando...";
        header.append(title, date);
        const detail = document.createElement("div");
        detail.textContent = `${Number(data.rowCount || 0).toLocaleString("es-MX")} filas extraídas`;
        const files = document.createElement("div");
        files.className = "history-files";
        addFileButtons(files, [...sources, ...(data.outputs || [])]);
        item.append(header, detail, files);
        elements.historyList.append(item);
      });
      elements.historyStatus.textContent = snapshot.empty ? "Todavía no tienes conversiones guardadas." : `${snapshot.size} conversiones guardadas.`;
    } catch (error) {
      elements.historyStatus.textContent = friendlyError(error);
    }
  }

  window.AppCloud = {
    configured,
    isSignedIn: () => Boolean(currentUser),
    saveConversion,
    loadHistory
  };

  if (!configured || !window.firebase) {
    elements.syncStatus.textContent = "Nube no configurada";
    elements.authButton.textContent = "Configurar nube";
    elements.authButton.addEventListener("click", () => alert("Configura firebase-config.js siguiendo FIREBASE_SETUP.md."));
    return;
  }

  firebase.initializeApp(config);
  auth = firebase.auth();
  database = firebase.firestore();
  storage = firebase.storage();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

  elements.authButton.addEventListener("click", openAuth);
  elements.authCancel.addEventListener("click", () => elements.authDialog.close());
  elements.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthError();
    try {
      await auth.signInWithEmailAndPassword(elements.authEmail.value.trim(), elements.authPassword.value);
      elements.authDialog.close();
    } catch (error) {
      setAuthError(friendlyError(error));
    }
  });
  elements.registerButton.addEventListener("click", async () => {
    setAuthError();
    try {
      await auth.createUserWithEmailAndPassword(elements.authEmail.value.trim(), elements.authPassword.value);
      elements.authDialog.close();
    } catch (error) {
      setAuthError(friendlyError(error));
    }
  });
  elements.resetPasswordButton.addEventListener("click", async () => {
    const email = elements.authEmail.value.trim();
    if (!email) {
      setAuthError("Escribe tu correo para enviar la recuperación.");
      return;
    }
    try {
      await auth.sendPasswordResetEmail(email);
      setAuthError("Revisa tu correo para restablecer la contraseña.");
    } catch (error) {
      setAuthError(friendlyError(error));
    }
  });
  elements.logoutButton.addEventListener("click", () => auth.signOut());
  elements.refreshHistory.addEventListener("click", loadHistory);

  auth.onAuthStateChanged((user) => {
    currentUser = user;
    elements.authButton.classList.toggle("hidden", Boolean(user));
    elements.logoutButton.classList.toggle("hidden", !user);
    elements.cloudOptions.classList.toggle("hidden", !user);
    elements.historySection.classList.toggle("hidden", !user);
    elements.syncStatus.textContent = user ? user.email : "Modo local";
    if (user) loadHistory();
    else {
      elements.historyList.replaceChildren();
      elements.historyStatus.textContent = "";
    }
    window.dispatchEvent(new CustomEvent("app-auth-changed", { detail: { signedIn: Boolean(user) } }));
  });
})();
