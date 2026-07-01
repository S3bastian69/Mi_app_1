import { readFile } from "node:fs/promises";
import * as pdfjsLib from "../vendor/pdf.min.mjs";
import { buildFourColumnRows, buildIdentifiedFields, groupItemsIntoRows } from "../converter-core.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.min.mjs", import.meta.url).href;

const pdfPath = new URL("../outputs/app-converter-massive-test/datos_masivos_estado_cuenta.pdf", import.meta.url);
const data = new Uint8Array(await readFile(pdfPath));
const pdf = await pdfjsLib.getDocument({ data }).promise;
const records = [];

for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const rows = groupItemsIntoRows(content.items);
  rows.forEach((cells, index) => {
    const record = { Archivo: "datos_masivos_estado_cuenta.pdf", Pagina: pageNumber, Fila: index + 1 };
    if (cells.__cellMeta) {
      Object.defineProperty(record, "__cellMeta", { value: cells.__cellMeta, enumerable: false });
    }
    cells.forEach((cell, cellIndex) => {
      record[`Columna_${cellIndex + 1}`] = cell;
    });
    records.push(record);
  });
}

const finalRows = buildFourColumnRows(records, buildIdentifiedFields(records));
const cargos = finalRows.filter((row) => row.CARGOS !== "").length;
const abonos = finalRows.filter((row) => row.ABONOS !== "").length;
const missingDates = finalRows.filter((row) => !row.FECHA).length;

await pdf.destroy();

if (finalRows.length !== 10000) throw new Error(`Se esperaban 10000 movimientos y se obtuvieron ${finalRows.length}`);
if (cargos !== 5000) throw new Error(`Se esperaban 5000 cargos y se obtuvieron ${cargos}`);
if (abonos !== 5000) throw new Error(`Se esperaban 5000 abonos y se obtuvieron ${abonos}`);
if (missingDates !== 0) throw new Error(`Hay ${missingDates} movimientos sin fecha`);

console.log(JSON.stringify({
  archivo: pdfPath.pathname,
  paginas: pdf.numPages,
  movimientos: finalRows.length,
  cargos,
  abonos,
  filas_sin_fecha: missingDates
}, null, 2));
