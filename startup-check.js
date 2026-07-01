(() => {
  const showError = (message) => {
    const container = document.querySelector("#startupError");
    if (!container) return;
    container.textContent = message;
    container.classList.remove("hidden");
  };

  if (window.location.protocol === "file:") {
    showError("La aplicación no funciona abriendo index.html directamente. Cierra esta página y abre iniciar_app.bat.");
    return;
  }

  window.setTimeout(() => {
    if (!window.__APP_CONVERTER_READY__) {
      showError("No se pudo iniciar el convertidor. Actualiza la página o vuelve a abrir iniciar_app.bat.");
    }
  }, 2500);
})();
