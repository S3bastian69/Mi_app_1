import { allHeaders, buildFourColumnRows, buildIdentifiedFields, buildStructuredTables, csvFromRecords, groupItemsIntoRows } from "./converter-core.mjs";
import { appendWorkbookModel, buildExcelWorkbookModel } from "./excel-workbook.mjs";
import { styleWorkbook } from "./excel-style.mjs";

let pdfEnginePromise;

async function loadPdfEngine() {
  if (!pdfEnginePromise) {
    pdfEnginePromise = import("./vendor/pdf.min.mjs").then((engine) => {
      engine.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", import.meta.url).href;
      return engine;
    });
  }
  return pdfEnginePromise;
}

const elements = {
  fileInput: document.querySelector("#fileInput"),
  selectButton: document.querySelector("#selectButton"),
  dropZone: document.querySelector("#dropZone"),
  fileSection: document.querySelector("#fileSection"),
  fileList: document.querySelector("#fileList"),
  clearButton: document.querySelector("#clearButton"),
  convertButton: document.querySelector("#convertButton"),
  progressSection: document.querySelector("#progressSection"),
  progressBar: document.querySelector("#progressBar"),
  progressPercent: document.querySelector("#progressPercent"),
  statusMessage: document.querySelector("#statusMessage"),
  resultSection: document.querySelector("#resultSection"),
  resultSummary: document.querySelector("#resultSummary"),
  downloadButtons: document.querySelector("#downloadButtons"),
  previewTable: document.querySelector("#previewTable"),
  warnings: document.querySelector("#warnings"),
  installButton: document.querySelector("#installButton"),
  installHelp: document.querySelector("#installHelp"),
  passwordDialog: document.querySelector("#passwordDialog"),
  passwordForm: document.querySelector("#passwordForm"),
  passwordInput: document.querySelector("#passwordInput"),
  passwordMessage: document.querySelector("#passwordMessage"),
  passwordCancel: document.querySelector("#passwordCancel"),
  saveOriginal: document.querySelector("#saveOriginal"),
  saveResults: document.querySelector("#saveResults")
};

let selectedFiles = [];
let installPrompt = null;
let downloadUrls = [];
const MAX_FILES = 20;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function fileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function addFiles(files) {
  const existing = new Set(selectedFiles.map(fileKey));
  const candidates = Array.from(files);
  const pdfFiles = candidates.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  const valid = pdfFiles.filter((file) => file.size <= MAX_FILE_SIZE);
  valid.forEach((file) => {
    if (!existing.has(fileKey(file)) && selectedFiles.length < MAX_FILES) {
      selectedFiles.push(file);
      existing.add(fileKey(file));
    }
  });
  renderFiles();
  const messages = [];
  if (!pdfFiles.length && candidates.length) messages.push("Selecciona archivos con extensión PDF.");
  if (pdfFiles.some((file) => file.size > MAX_FILE_SIZE)) messages.push("Se omitieron archivos mayores de 50 MB.");
  if (selectedFiles.length === MAX_FILES && valid.length) messages.push("Solo se pueden procesar 20 archivos por lote.");
  if (messages.length) alert(messages.join("\n"));
}

function renderFiles() {
  elements.fileList.replaceChildren();
  selectedFiles.forEach((file, index) => {
    const item = document.createElement("li");
    item.className = "file-item";
    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = file.name;
    name.title = file.name;
    const size = document.createElement("span");
    size.className = "file-size";
    size.textContent = formatBytes(file.size);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Quitar ${file.name}`);
    remove.addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      renderFiles();
    });
    item.append(name, size, remove);
    elements.fileList.append(item);
  });
  elements.fileSection.classList.toggle("hidden", selectedFiles.length === 0);
  elements.convertButton.disabled = selectedFiles.length === 0;
}

function setProgress(done, total, message) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  elements.progressBar.value = percent;
  elements.progressBar.textContent = `${percent}%`;
  elements.progressPercent.textContent = `${percent}%`;
  elements.statusMessage.textContent = message;
}

function requestPdfPassword(fileName, incorrect = false) {
  return new Promise((resolve) => {
    elements.passwordMessage.textContent = incorrect
      ? `La contraseña de ${fileName} no es correcta. Inténtalo de nuevo.`
      : `${fileName} está protegido. Escribe la contraseña proporcionada por tu banco.`;
    elements.passwordInput.value = "";

    const finish = (password) => {
      elements.passwordForm.removeEventListener("submit", submit);
      elements.passwordCancel.removeEventListener("click", cancel);
      elements.passwordDialog.removeEventListener("cancel", cancel);
      if (elements.passwordDialog.open) elements.passwordDialog.close();
      elements.passwordInput.value = "";
      resolve(password);
    };
    const submit = (event) => {
      event.preventDefault();
      finish(elements.passwordInput.value);
    };
    const cancel = (event) => {
      event.preventDefault();
      finish(null);
    };

    elements.passwordForm.addEventListener("submit", submit);
    elements.passwordCancel.addEventListener("click", cancel);
    elements.passwordDialog.addEventListener("cancel", cancel);
    elements.passwordDialog.showModal();
    elements.passwordInput.focus();
  });
}

async function extractPdf(file, onPage) {
  const pdfjsLib = await loadPdfEngine();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const task = pdfjsLib.getDocument({ data: bytes, useSystemFonts: true });
  let passwordCancelled = false;
  task.onPassword = async (updatePassword, reason) => {
    const incorrect = reason === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD;
    const password = await requestPdfPassword(file.name, incorrect);
    if (password === null) {
      passwordCancelled = true;
      await task.destroy();
      return;
    }
    updatePassword(password);
  };

  let document;
  try {
    document = await task.promise;
  } catch (error) {
    if (passwordCancelled) throw new Error("se omitió porque no se proporcionó la contraseña");
    throw error;
  }
  const records = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = groupItemsIntoRows(content.items);
    rows.forEach((cells, rowIndex) => {
      const record = { Archivo: file.name, Pagina: pageNumber, Fila: rowIndex + 1 };
      if (cells.__cellMeta) {
        Object.defineProperty(record, "__cellMeta", { value: cells.__cellMeta, enumerable: false });
      }
      cells.forEach((cell, cellIndex) => { record[`Columna_${cellIndex + 1}`] = cell; });
      records.push(record);
    });
    onPage(pageNumber, document.numPages);
  }
  await document.destroy();
  return records;
}

async function excelFromRecords(records, summary, structuredRows = [], identifiedFields = [], finalRows = []) {
  if (!window.XLSX) throw new Error("No se pudo cargar el módulo de Excel.");
  const workbook = window.XLSX.utils.book_new();
  const workbookModel = buildExcelWorkbookModel(records, summary, structuredRows, identifiedFields, finalRows);
  appendWorkbookModel(window.XLSX, workbook, workbookModel);
  const xlsxData = window.XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return styleWorkbook(xlsxData, { structuredRows, sheetPlans: workbookModel.sheetPlans });
}

function safeBaseName() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toTimeString().slice(0, 8).replaceAll(":", "");
  return `estados_cuenta_${date}_${time}`;
}

function addDownload(blob, filename, label) {
  const url = URL.createObjectURL(blob);
  downloadUrls.push(url);
  const link = document.createElement("a");
  link.className = "button button-primary";
  link.href = url;
  link.download = filename;
  link.textContent = label;
  elements.downloadButtons.append(link);
}

function renderPreview(records) {
  const preview = records.slice(0, 100);
  const headers = allHeaders(preview);
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headers.forEach((header) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = header.replace("_", " ");
    headerRow.append(cell);
  });
  head.append(headerRow);
  const body = document.createElement("tbody");
  preview.forEach((record) => {
    const row = document.createElement("tr");
    headers.forEach((header) => {
      const cell = document.createElement("td");
      cell.textContent = record[header] ?? "";
      row.append(cell);
    });
    body.append(row);
  });
  elements.previewTable.replaceChildren(head, body);
}

async function convertFiles() {
  if (!selectedFiles.length) return;
  const format = document.querySelector('input[name="format"]:checked').value;
  elements.convertButton.disabled = true;
  elements.resultSection.classList.add("hidden");
  elements.progressSection.classList.remove("hidden");
  elements.warnings.classList.add("hidden");
  elements.downloadButtons.replaceChildren();
  downloadUrls.forEach(URL.revokeObjectURL);
  downloadUrls = [];
  setProgress(0, selectedFiles.length, "Preparando la conversión...");

  const records = [];
  const summary = [];
  const warnings = [];
  for (let index = 0; index < selectedFiles.length; index += 1) {
    const file = selectedFiles[index];
    try {
      const fileRecords = await extractPdf(file, (page, pages) => {
        elements.statusMessage.textContent = `Procesando ${file.name}, página ${page} de ${pages}`;
      });
      records.push(...fileRecords);
      summary.push({ Archivo: file.name, Paginas: Math.max(0, ...fileRecords.map((row) => row.Pagina)), Filas_extraidas: fileRecords.length, Estado: fileRecords.length ? "Procesado" : "Sin texto" });
      if (!fileRecords.length) warnings.push(`${file.name}: no contiene texto extraíble. Puede ser un PDF escaneado.`);
    } catch (error) {
      summary.push({ Archivo: file.name, Paginas: 0, Filas_extraidas: 0, Estado: "Error" });
      warnings.push(`${file.name}: ${error.message || "no se pudo leer"}`);
    }
    setProgress(index + 1, selectedFiles.length, `Completado ${file.name}`);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (!records.length) {
    elements.convertButton.disabled = false;
    elements.statusMessage.textContent = "No se encontró texto que pudiera convertirse.";
    elements.warnings.textContent = warnings.join(" ") || "Los PDF podrían contener únicamente imágenes.";
    elements.warnings.classList.remove("hidden");
    return;
  }

  try {
    const base = safeBaseName();
    const outputFiles = [];
    const identifiedFields = buildIdentifiedFields(records);
    const structuredRows = buildStructuredTables(records);
    const exportRows = buildFourColumnRows(records, identifiedFields);
    if (!exportRows.length) {
      warnings.push("No se detectaron movimientos financieros exportables. Revisa si el PDF es escaneado, si el banco usa un formato nuevo o si el texto extraido no contiene cargos/abonos claros.");
    }
    if (format === "csv" || format === "both") {
      const csv = exportRows.length ? csvFromRecords(exportRows) : '\ufeff"FECHA","DESCRIPCION","CARGOS","ABONOS"\r\n';
      const blob = new Blob([csv], { type: "text/csv" });
      const name = `${base}.csv`;
      outputFiles.push({ blob, name, type: "text/csv" });
      addDownload(blob, name, "Descargar CSV");
    }
    if (format === "xlsx" || format === "both") {
      const excel = await excelFromRecords(records, summary, structuredRows, identifiedFields, exportRows);
      const type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const blob = new Blob([excel], { type });
      const name = `${base}.xlsx`;
      outputFiles.push({ blob, name, type });
      addDownload(blob, name, "Descargar Excel");
    }
    renderPreview(exportRows);
    elements.resultSummary.textContent = `${exportRows.length.toLocaleString("es-MX")} filas listas en formato FECHA, DESCRIPCION, CARGOS y ABONOS.`;
    if (warnings.length) {
      elements.warnings.textContent = warnings.join(" ");
      elements.warnings.classList.remove("hidden");
    }
    elements.resultSection.classList.remove("hidden");
    elements.resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.resultSection.focus?.();

    if (window.AppCloud?.isSignedIn()) {
      try {
        elements.statusMessage.textContent = "Sincronizando historial con Firebase...";
        await window.AppCloud.saveConversion({
          sourceFiles: selectedFiles,
          outputFiles,
          rowCount: records.length,
          saveOriginals: elements.saveOriginal.checked,
          saveOutputs: elements.saveResults.checked
        });
        elements.statusMessage.textContent = "Conversión terminada y sincronizada.";
        elements.resultSummary.textContent += " Historial sincronizado con tu cuenta.";
      } catch (cloudError) {
        warnings.push(`No se pudo sincronizar con Firebase: ${cloudError.message}`);
        elements.warnings.textContent = warnings.join(" ");
        elements.warnings.classList.remove("hidden");
        elements.statusMessage.textContent = "Conversión local terminada; sincronización pendiente.";
      }
    }
  } catch (error) {
    elements.statusMessage.textContent = `No se pudo generar el resultado: ${error.message}`;
  } finally {
    elements.convertButton.disabled = false;
  }
}

elements.fileInput.addEventListener("change", (event) => {
  addFiles(event.target.files);
  event.target.value = "";
});
elements.selectButton.addEventListener("click", () => elements.fileInput.click());
elements.dropZone.addEventListener("click", (event) => {
  if (event.target !== elements.selectButton) elements.fileInput.click();
});
elements.clearButton.addEventListener("click", () => { selectedFiles = []; renderFiles(); });
elements.convertButton.addEventListener("click", convertFiles);
["dragenter", "dragover"].forEach((name) => elements.dropZone.addEventListener(name, (event) => {
  event.preventDefault();
  elements.dropZone.classList.add("dragging");
}));
["dragleave", "drop"].forEach((name) => elements.dropZone.addEventListener(name, (event) => {
  event.preventDefault();
  elements.dropZone.classList.remove("dragging");
}));
elements.dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !elements.convertButton.disabled) convertFiles();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  elements.installButton.classList.remove("hidden");
});
elements.installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null;
  elements.installButton.classList.add("hidden");
});
window.addEventListener("appinstalled", () => elements.installButton.classList.add("hidden"));

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (isIos && !isStandalone) elements.installHelp.classList.remove("hidden");
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
window.__APP_CONVERTER_READY__ = true;
