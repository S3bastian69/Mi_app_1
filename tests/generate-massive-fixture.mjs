import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFourColumnRows, buildIdentifiedFields } from "../converter-core.mjs";

const require = createRequire(import.meta.url);
const XLSX = require("../vendor/xlsx.full.min.js");

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, "../outputs/app-converter-massive-test");
const outputPath = resolve(outputDir, "datos_masivos_movimientos.xlsx");
const summaryPath = resolve(outputDir, "datos_masivos_resumen.json");
const monthCodes = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const banks = ["BBVA", "BANORTE", "SANTANDER", "INBURSA", "STP", "HSBC"];
const people = [
  "SERVICIOS CONTABLES DEL CENTRO SA DE CV",
  "PSH ABOGADOS SA DE CV",
  "MARIA LOPEZ",
  "JUAN PEREZ",
  "COMERCIALIZADORA NORTE SA DE CV",
  "MARIO G"
];

function money(value) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function movementDate(index) {
  const day = String((index % 28) + 1).padStart(2, "0");
  return `${day}/${monthCodes[index % monthCodes.length]}`;
}

function amountFor(index) {
  return Number((80 + ((index * 37) % 7900) + ((index % 97) / 100)).toFixed(2));
}

function buildMassiveRawRecords(totalMovements = 10000) {
  const records = [
    { Archivo: "masivo-sintetico.pdf", Pagina: 1, Fila: 1, Columna_1: "Detalle de Movimientos" },
    { Archivo: "masivo-sintetico.pdf", Pagina: 1, Fila: 2, Columna_1: "FECHA FECHA CONCEPTO CARGOS ABONOS" }
  ];
  let page = 1;
  let row = 3;
  for (let index = 1; index <= totalMovements; index += 1) {
    if (row > 85) {
      page += 1;
      row = 1;
      records.push({ Archivo: "masivo-sintetico.pdf", Pagina: page, Fila: row++, Columna_1: "Continuacion de Movimientos" });
    }
    const date = movementDate(index);
    const isAbono = index % 2 === 0;
    const bank = banks[index % banks.length];
    const amount = amountFor(index);
    const reference = String(9000000000 + index).padStart(10, "0");
    const tracking = isAbono
      ? `${String(index).padStart(6, "0")}PAGO SERVICIO`
      : `${String(index).padStart(7, "0")}nd`;
    const x = isAbono ? 431.8 : 391.4;
    const description = isAbono ? `SPEI RECIBIDO${bank}` : "SPEI ENVIADO STP";

    records.push({
      Archivo: "masivo-sintetico.pdf",
      Pagina: page,
      Fila: row++,
      Columna_1: `${date} ${date} ${description}`,
      Columna_2: money(amount),
      __x_2: x
    });
    records.push({
      Archivo: "masivo-sintetico.pdf",
      Pagina: page,
      Fila: row++,
      Columna_1: tracking,
      Columna_2: `Referencia ${reference} ${String(index % 999).padStart(3, "0")}`
    });
    records.push({
      Archivo: "masivo-sintetico.pdf",
      Pagina: page,
      Fila: row++,
      Columna_1: isAbono ? `036INBU${String(150520260000000000 + index)}` : `MBAN0100260520${String(1000000000 + index)}`
    });
    records.push({
      Archivo: "masivo-sintetico.pdf",
      Pagina: page,
      Fila: row++,
      Columna_1: people[index % people.length]
    });
    if (index % 1000 === 0) {
      records.push({ Archivo: "masivo-sintetico.pdf", Pagina: page, Fila: row++, Columna_1: "Total de Movimientos" });
      records.push({ Archivo: "masivo-sintetico.pdf", Pagina: page, Fila: row++, Columna_1: "Glosario ADMON ADMINISTRACION DEVU DEVUELTO" });
    }
  }
  return records;
}

const rawRecords = buildMassiveRawRecords();
const finalRows = buildFourColumnRows(rawRecords, buildIdentifiedFields(rawRecords));
const cargos = finalRows.reduce((sum, row) => sum + (Number(row.CARGOS) || 0), 0);
const abonos = finalRows.reduce((sum, row) => sum + (Number(row.ABONOS) || 0), 0);
const missingDates = finalRows.filter((row) => !row.FECHA).length;
const unlabeledDetails = finalRows.filter((row) => /\| (?!Concepto:|Referencia:|Clave:|Tercero:)/.test(row.DESCRIPCION)).length;
const noisyRows = finalRows.filter((row) => /glosario|total de movimientos|estado de cuenta|advertencia|proteccion y defensa/i.test(row.DESCRIPCION)).length;

if (finalRows.length !== 10000) throw new Error(`Se esperaban 10000 movimientos y se obtuvieron ${finalRows.length}`);
if (missingDates > 0) throw new Error(`Hay ${missingDates} movimientos sin fecha`);
if (unlabeledDetails > 0) throw new Error(`Hay ${unlabeledDetails} descripciones con detalles sin etiqueta`);
if (noisyRows > 0) throw new Error(`Hay ${noisyRows} filas de ruido en el resultado`);

await mkdir(outputDir, { recursive: true });
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(finalRows, { header: ["FECHA", "DESCRIPCION", "CARGOS", "ABONOS"] });
worksheet["!cols"] = [{ wch: 12 }, { wch: 95 }, { wch: 14 }, { wch: 14 }];
XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos");
const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
await writeFile(outputPath, buffer);

const summary = {
  archivo: outputPath,
  movimientos: finalRows.length,
  cargos_count: finalRows.filter((row) => row.CARGOS !== "").length,
  abonos_count: finalRows.filter((row) => row.ABONOS !== "").length,
  cargos_total: Number(cargos.toFixed(2)),
  abonos_total: Number(abonos.toFixed(2)),
  filas_sin_fecha: missingDates,
  detalles_sin_etiqueta: unlabeledDetails,
  filas_ruido: noisyRows,
  bytes: buffer.length
};
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
