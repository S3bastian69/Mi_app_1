import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import * as pdfjsLib from "../vendor/pdf.min.mjs";
import { allHeaders, buildFourColumnRows, buildIdentifiedFields, buildStructuredTables, csvFromRecords, groupItemsIntoRows } from "../converter-core.mjs";
import { appendWorkbookModel, buildExcelWorkbookModel } from "../excel-workbook.mjs";
import { styleWorkbook } from "../excel-style.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.min.mjs", import.meta.url).href;
const samplePath = new URL("./fixtures/estado_cuenta_prueba.pdf", import.meta.url);
const data = new Uint8Array(await readFile(samplePath));
const pdf = await pdfjsLib.getDocument({ data }).promise;
assert.equal(pdf.numPages, 1);

const page = await pdf.getPage(1);
const content = await page.getTextContent();
const rows = groupItemsIntoRows(content.items);
assert.ok(rows.length >= 7, "Debe extraer encabezados y movimientos");
assert.ok(rows.flat().some((cell) => cell.includes("supermercado")));

const records = rows.map((cells, index) => {
  const record = { Archivo: "estado_cuenta_prueba.pdf", Pagina: 1, Fila: index + 1 };
  cells.forEach((cell, cellIndex) => { record[`Columna_${cellIndex + 1}`] = cell; });
  return record;
});
assert.deepEqual(allHeaders(records).slice(0, 3), ["Archivo", "Pagina", "Fila"]);
assert.ok(csvFromRecords(records).includes("Compra supermercado"));

const balanceRecords = [
  { Archivo: "balance.pdf", Pagina: 1, Fila: 1, Columna_1: "al", Columna_2: "al", Columna_3: "al" },
  { Archivo: "balance.pdf", Pagina: 1, Fila: 2, Columna_1: "31/12/20X3", Columna_2: "31/12/20X2", Columna_3: "31/12/20X1" },
  { Archivo: "balance.pdf", Pagina: 1, Fila: 3, Columna_1: "Activo circulante" },
  { Archivo: "balance.pdf", Pagina: 1, Fila: 4, Columna_1: "Efectivo", Columna_2: "$1,200,000", Columna_3: "$900,000", Columna_4: "$750,000" },
  { Archivo: "balance.pdf", Pagina: 1, Fila: 5, Columna_1: "Cuentas por cobrar", Columna_2: "4,800,000", Columna_3: "3,600,000", Columna_4: "3,000,000" },
  { Archivo: "balance.pdf", Pagina: 1, Fila: 6, Columna_1: "Total activo circulante", Columna_2: "$9,600,000", Columna_3: "$7,200,000", Columna_4: "$6,050,000" },
  { Archivo: "balance.pdf", Pagina: 1, Fila: 7, Columna_1: "Pasivo circulante" },
  { Archivo: "balance.pdf", Pagina: 1, Fila: 8, Columna_1: "Cuentas por pagar", Columna_2: "$2,400,000", Columna_3: "$1,800,000", Columna_4: "$1,500,000" }
];
const structured = buildStructuredTables(balanceRecords);
assert.equal(structured.length, 4);
assert.equal(structured[0].Tabla, "Activo circulante - balance.pdf");
assert.equal(structured[0].Concepto, "Efectivo");
assert.equal(structured[0]["31/12/20X3"], 1200000);
assert.equal(structured[2].Tipo, "Total");
assert.equal(structured[3].Seccion, "Pasivo circulante");
assert.ok(csvFromRecords(structured).includes("Tablas ordenadas") === false);
assert.equal(buildIdentifiedFields(balanceRecords).length, 0, "Una tabla financiera sin contexto CFDI no debe generar campos fiscales");

const fiscalRecords = [
  { Archivo: "factura.pdf", Pagina: 1, Fila: 1, Columna_1: "Folio Fiscal:", Columna_2: "550e8400-e29b-41d4-a716-446655440000" },
  { Archivo: "factura.pdf", Pagina: 1, Fila: 2, Columna_1: "RFC Emisor", Columna_2: "AAA010101AAA" },
  { Archivo: "factura.pdf", Pagina: 1, Fila: 3, Columna_1: "RFC Receptor", Columna_2: "XAXX010101000" },
  { Archivo: "factura.pdf", Pagina: 1, Fila: 4, Columna_1: "Fecha de certificacion", Columna_2: "2026-06-26T12:15:00" },
  { Archivo: "factura.pdf", Pagina: 1, Fila: 5, Columna_1: "No. Certificado SAT", Columna_2: "00001000000504465028" },
  { Archivo: "factura.pdf", Pagina: 1, Fila: 6, Columna_1: "Forma de pago", Columna_2: "03 Transferencia electronica" },
  { Archivo: "factura.pdf", Pagina: 1, Fila: 7, Columna_1: "Total", Columna_2: "$1,234.56" },
  { Archivo: "factura.pdf", Pagina: 1, Fila: 8, Columna_1: "Clave de rastreo", Columna_2: "ABC123XYZ987" }
];
const identifiedFields = buildIdentifiedFields(fiscalRecords);
assert.ok(identifiedFields.length >= 7);
assert.equal(identifiedFields.find((field) => field.Campo === "Folio fiscal (UUID)")?.Valor, "550e8400-e29b-41d4-a716-446655440000");
assert.equal(identifiedFields.find((field) => field.Campo === "RFC emisor")?.Valor, "AAA010101AAA");
assert.equal(identifiedFields.find((field) => field.Campo === "RFC receptor")?.Valor, "XAXX010101000");
assert.equal(identifiedFields.find((field) => field.Campo === "Total")?.Valor, 1234.56);
assert.equal(identifiedFields.find((field) => field.Campo === "Clave de rastreo")?.Valor, "ABC123XYZ987");
assert.ok(identifiedFields.every((field) => field.Descripcion && field.Referente && field.Validacion && field.Texto_origen));
const fiscalFourColumns = buildFourColumnRows(fiscalRecords, identifiedFields);
assert.deepEqual(Object.keys(fiscalFourColumns[0]), ["FECHA", "DESCRIPCION", "CARGOS", "ABONOS"]);
assert.ok(fiscalFourColumns.some((row) => row.DESCRIPCION === "Total" && row.CARGOS === 1234.56));
assert.ok(!fiscalFourColumns.some((row) => row.DESCRIPCION.includes("Folio fiscal")));

const bankRecords = [
  { Archivo: "banco.pdf", Pagina: 1, Fila: 1, Columna_1: "Banco Demo" },
  { Archivo: "banco.pdf", Pagina: 1, Fila: 2, Columna_1: "Numero de cuenta", Columna_2: "12345678901" },
  { Archivo: "banco.pdf", Pagina: 1, Fila: 3, Columna_1: "CLABE", Columna_2: "012345678901234567" },
  { Archivo: "banco.pdf", Pagina: 1, Fila: 4, Columna_1: "Saldo final", Columna_2: "$2,500.25" },
  { Archivo: "banco.pdf", Pagina: 1, Fila: 5, Columna_1: "Sucursal", Columna_2: "001", Columna_3: "Referencia", Columna_4: "REF-7788" },
  { Archivo: "banco.pdf", Pagina: 1, Fila: 6, Columna_1: "Linea importante sin etiqueta clara" }
];
const bankFields = buildIdentifiedFields(bankRecords);
assert.equal(bankFields.find((field) => field.Campo === "Banco")?.Valor, "Demo");
assert.equal(bankFields.find((field) => field.Campo === "Numero de cuenta")?.Valor, "12345678901");
assert.equal(bankFields.find((field) => field.Campo === "CLABE")?.Valor, "012345678901234567");
assert.equal(bankFields.find((field) => field.Campo === "Saldo final")?.Valor, 2500.25);
assert.equal(bankFields.find((field) => field.Campo === "Sucursal")?.Valor, "001");
assert.equal(bankFields.find((field) => field.Campo === "Referencia")?.Valor, "REF-7788");
assert.ok(bankFields.some((field) => field.Texto_origen.includes("Linea importante sin etiqueta clara")));
const bankFourColumns = buildFourColumnRows(bankRecords, bankFields);
assert.deepEqual(Object.keys(bankFourColumns[0]), ["FECHA", "DESCRIPCION", "CARGOS", "ABONOS"]);
assert.ok(bankFourColumns.some((row) => row.DESCRIPCION === "Saldo final" && row.CARGOS === 2500.25));
assert.ok(!bankFourColumns.some((row) => row.DESCRIPCION.includes("Numero de cuenta")));
assert.ok(!bankFourColumns.some((row) => row.DESCRIPCION.includes("Referencia")));

const bbvaRecords = [
  { Archivo: "bbva.pdf", Pagina: 1, Fila: 1, Columna_1: "No. de Tarjeta", Columna_2: "4772 1330 4865 3023" },
  { Archivo: "bbva.pdf", Pagina: 1, Fila: 2, Columna_1: "R.F.C.", Columna_2: "POCS011213HC9" },
  { Archivo: "bbva.pdf", Pagina: 1, Fila: 3, Columna_1: "Cuenta CLABE", Columna_2: "012975174235200365" },
  { Archivo: "bbva.pdf", Pagina: 1, Fila: 4, Columna_1: "CAT Actual de su Tarjeta sin IVA", Columna_2: "61.4 %" },
  { Archivo: "bbva.pdf", Pagina: 1, Fila: 5, Columna_1: "Intereses efectivamente pagados", Columna_2: "$", Columna_3: "281.43" },
  { Archivo: "bbva.pdf", Pagina: 1, Fila: 6, Columna_1: "Comisiones efectivamente cargadas", Columna_2: "$", Columna_3: "418.00" },
  { Archivo: "bbva.pdf", Pagina: 1, Fila: 7, Columna_1: "Crédito Disponible", Columna_2: "$", Columna_3: "13,518.52" },
  { Archivo: "bbva.pdf", Pagina: 1, Fila: 8, Columna_1: "Fecha de Corte", Columna_2: "23/05/23" },
  { Archivo: "bbva.pdf", Pagina: 2, Fila: 1, Columna_1: "03/05/23", Columna_2: "03/05/23", Columna_3: "09 DE 36 EFECTIVO INMEDIATO 36", Columna_4: "******4490", Columna_5: "$", Columna_6: "197.11" },
  { Archivo: "bbva.pdf", Pagina: 2, Fila: 2, Columna_1: "16/05/23", Columna_2: "17/05/23", Columna_3: "BMOVIL.PAGO TDC", Columna_4: "******0296", Columna_5: "$", Columna_6: "419.44-" }
];
const bbvaFields = buildIdentifiedFields(bbvaRecords);
const bbvaFourColumns = buildFourColumnRows(bbvaRecords, bbvaFields);
assert.ok(bbvaFourColumns.some((row) => row.DESCRIPCION === "CAT: 61.4 %" && row.CARGOS === "" && row.ABONOS === ""));
assert.ok(bbvaFourColumns.some((row) => row.DESCRIPCION === "Intereses" && row.CARGOS === 281.43));
assert.ok(bbvaFourColumns.some((row) => row.DESCRIPCION === "Comision" || row.DESCRIPCION === "Comision: 418.00" || row.DESCRIPCION === "Comisiones efectivamente cargadas"));
assert.ok(bbvaFourColumns.some((row) => row.DESCRIPCION.includes("EFECTIVO INMEDIATO") && row.CARGOS === 197.11));
assert.ok(bbvaFourColumns.some((row) => row.DESCRIPCION.includes("BMOVIL.PAGO TDC") && row.ABONOS === 419.44));
assert.ok(!bbvaFourColumns.some((row) => /tarjeta|r\.f\.c|clabe/i.test(row.DESCRIPCION)));

const noisyBbvaRecords = [
  { Archivo: "bbva.pdf", Pagina: 4, Fila: 1, Columna_1: "Tiene 90 dias naturales contados a partir de la fecha de corte o de la fecha" },
  { Archivo: "bbva.pdf", Pagina: 4, Fila: 2, Columna_1: "COMISION NACIONAL PARA LA PROTECCION Y DEFENSA DE LOS USUARIOS" },
  { Archivo: "bbva.pdf", Pagina: 4, Fila: 3, Columna_1: "pagos mensuales de *$1,710.07, considerando que no se realicen consumos" },
  { Archivo: "bbva.pdf", Pagina: 4, Fila: 4, Columna_1: "HECHOS QUE GENERAN LAS COMISIONES" },
  { Archivo: "bbva.pdf", Pagina: 4, Fila: 5, Columna_1: "TIIE : Tasa de Interes Interbancaria de Equilibrio CAT : Costo Anual Total" },
  { Archivo: "bbva.pdf", Pagina: 4, Fila: 6, Columna_1: "R.F.C : Registro Federal de Contribuyentes I.V.A. : Impuesto al Valor Agregado" },
  { Archivo: "bbva.pdf", Pagina: 4, Fila: 7, Columna_1: "CLABE: Clave Bancaria Estandarizada CD: Compra Digital" },
  { Archivo: "bbva.pdf", Pagina: 4, Fila: 8, Columna_1: "2023-05-24T07:34:4 ||1.1|670CCEA1-3587-4D50-98C9-1C46AB506C74||W4c3e3A01UNU0F" },
  { Archivo: "bbva.pdf", Pagina: 5, Fila: 1, Columna_1: "Totales de sus Cargos con Intereses" },
  { Archivo: "bbva.pdf", Pagina: 5, Fila: 2, Columna_1: "Total de Interes Total de Parcialidades Total Saldo Actual" },
  { Archivo: "bbva.pdf", Pagina: 5, Fila: 3, Columna_1: "Incluido en Incluido en su Incluido en Saldo" },
  { Archivo: "bbva.pdf", Pagina: 5, Fila: 4, Columna_1: "Anualidad diferida a 3 meses sin intereses Seguro de Compra Protegida" },
  { Archivo: "bbva.pdf", Pagina: 5, Fila: 5, Columna_1: "Al ser tu credito de tasa variable, los intereses pueden aumentar." },
  { Archivo: "bbva.pdf", Pagina: 5, Fila: 6, Columna_1: "Resumen de sus Cargos con Intereses Efectivo Inmediato" },
  { Archivo: "bbva.pdf", Pagina: 5, Fila: 7, Columna_1: "FECHA NOMBRE DE LA TASA DE COMPRA PARCIALIDAD FALTAN SALDO" },
  { Archivo: "bbva.pdf", Pagina: 5, Fila: 8, Columna_1: "TRANSACCION PROMOCION INTERES INICIAL EFI QUE SE" },
  { Archivo: "bbva.pdf", Pagina: 6, Fila: 1, Columna_1: "Intereses efectivamente pagados", Columna_2: "$", Columna_3: "281.43" }
];
const noisyBbvaRows = buildFourColumnRows(noisyBbvaRecords, buildIdentifiedFields(noisyBbvaRecords));
assert.deepEqual(noisyBbvaRows, [{ FECHA: "", DESCRIPCION: "Intereses efectivamente pagados", CARGOS: 281.43, ABONOS: "" }]);

const multiBankRecords = [
  { Archivo: "multi-banco.pdf", Pagina: 1, Fila: 1, Columna_1: "FECHA", Columna_2: "DESCRIPCION", Columna_3: "CARGOS", Columna_4: "ABONOS", Columna_5: "SALDO" },
  { Archivo: "multi-banco.pdf", Pagina: 1, Fila: 2, Columna_1: "01/02/2026 SPEI RECIBIDO NOMINA EMPRESA +$12,500.00 Saldo $15,000.00" },
  { Archivo: "multi-banco.pdf", Pagina: 1, Fila: 3, Columna_1: "02/02/2026 PAGO SERVICIO CFE -$850.25 $14,149.75" },
  { Archivo: "multi-banco.pdf", Pagina: 1, Fila: 4, Columna_1: "03 MAR Compra comercio 250.00 13,899.75" },
  { Archivo: "multi-banco.pdf", Pagina: 1, Fila: 5, Columna_1: "04/03/26 Transferencia enviada a Juan", Columna_2: "1.234,56", Columna_3: "12.665,19" },
  { Archivo: "multi-banco.pdf", Pagina: 1, Fila: 6, Columna_1: "05/03/2026 DEPOSITO EN EFECTIVO 3,000 15,665" },
  { Archivo: "multi-banco.pdf", Pagina: 1, Fila: 7, Columna_1: "Estimado cliente, para aclaraciones llama a UNE o consulta www.banco.mx" }
];
const multiBankRows = buildFourColumnRows(multiBankRecords, buildIdentifiedFields(multiBankRecords));
assert.deepEqual(multiBankRows, [
  { FECHA: "01/02/2026", DESCRIPCION: "SPEI RECIBIDO NOMINA EMPRESA", CARGOS: "", ABONOS: 12500 },
  { FECHA: "02/02/2026", DESCRIPCION: "PAGO SERVICIO CFE", CARGOS: 850.25, ABONOS: "" },
  { FECHA: "03 MAR", DESCRIPCION: "Compra comercio", CARGOS: 250, ABONOS: "" },
  { FECHA: "04/03/26", DESCRIPCION: "Transferencia enviada a Juan", CARGOS: 1234.56, ABONOS: "" },
  { FECHA: "05/03/2026", DESCRIPCION: "DEPOSITO EN EFECTIVO", CARGOS: "", ABONOS: 3000 }
]);

const shiftedHeaderRecords = [
  { Archivo: "estado-con-encabezado.pdf", Pagina: 1, Fila: 1, Columna_1: "Fecha", Columna_2: "Concepto", Columna_3: "Cargo", Columna_4: "Abono", Columna_5: "Saldo" },
  { Archivo: "estado-con-encabezado.pdf", Pagina: 1, Fila: 2, Columna_1: "01/06/2026", Columna_2: "Compra tarjeta supermercado", Columna_3: "$450.50", Columna_4: "$9,549.50" },
  { Archivo: "estado-con-encabezado.pdf", Pagina: 1, Fila: 3, Columna_1: "02/06/2026", Columna_2: "Deposito nomina empresa", Columna_3: "$7,000.00", Columna_4: "$16,549.50" },
  { Archivo: "estado-con-encabezado.pdf", Pagina: 2, Fila: 1, Columna_1: "03/06/2026", Columna_2: "Transferencia enviada Juan", Columna_3: "$1,200.00", Columna_4: "$15,349.50" },
  { Archivo: "estado-con-encabezado.pdf", Pagina: 2, Fila: 2, Columna_1: "Total de cargos", Columna_2: "$1,650.50" }
];
const shiftedHeaderRows = buildFourColumnRows(shiftedHeaderRecords, buildIdentifiedFields(shiftedHeaderRecords));
assert.deepEqual(shiftedHeaderRows, [
  { FECHA: "01/06/2026", DESCRIPCION: "Compra tarjeta supermercado", CARGOS: 450.5, ABONOS: "" },
  { FECHA: "02/06/2026", DESCRIPCION: "Deposito nomina empresa", CARGOS: "", ABONOS: 7000 },
  { FECHA: "03/06/2026", DESCRIPCION: "Transferencia enviada Juan", CARGOS: 1200, ABONOS: "" }
]);

const bbvaPositionRecords = [
  { Archivo: "bbva-posicion.pdf", Pagina: 1, Fila: 1, Columna_1: "15/MAY 15/MAY PAGO CUENTA DE TERCERO", Columna_2: "500.00", __x_2: 431.8 },
  { Archivo: "bbva-posicion.pdf", Pagina: 1, Fila: 2, Columna_1: "BNET 1571968968 reparacion envy", Columna_2: "Referencia 0040854928" },
  { Archivo: "bbva-posicion.pdf", Pagina: 1, Fila: 3, Columna_1: "15/MAY 15/MAY SPEI ENVIADO STP", Columna_2: "500.00", __x_2: 391.4 },
  { Archivo: "bbva-posicion.pdf", Pagina: 1, Fila: 4, Columna_1: "0805260nd", Columna_2: "Referencia 0055483147 646" },
  { Archivo: "bbva-posicion.pdf", Pagina: 1, Fila: 5, Columna_1: "MBAN01002605200055483147" },
  { Archivo: "bbva-posicion.pdf", Pagina: 1, Fila: 6, Columna_1: "Mario G" },
  { Archivo: "bbva-posicion.pdf", Pagina: 1, Fila: 7, Columna_1: "Total de Movimientos" },
  { Archivo: "bbva-posicion.pdf", Pagina: 1, Fila: 8, Columna_1: "ADMON ADMINISTRACION DEVU DEVUELTO PAGO" },
  { Archivo: "bbva-posicion.pdf", Pagina: 1, Fila: 9, Columna_1: "16/MAY 16/MAY SPEI RECIBIDOSTP", Columna_2: "700.00", __x_2: 431.8 }
];
const bbvaPositionRows = buildFourColumnRows(bbvaPositionRecords, buildIdentifiedFields(bbvaPositionRecords));
assert.deepEqual(bbvaPositionRows, [
  { FECHA: "15/MAY", DESCRIPCION: "PAGO CUENTA DE TERCERO | Concepto: BNET 1571968968 reparacion envy | Referencia: 0040854928", CARGOS: "", ABONOS: 500 },
  { FECHA: "15/MAY", DESCRIPCION: "SPEI ENVIADO STP | Concepto: 0805260nd | Referencia: 0055483147 646 | Clave: MBAN01002605200055483147 | Tercero: Mario G", CARGOS: 500, ABONOS: "" },
  { FECHA: "16/MAY", DESCRIPCION: "SPEI RECIBIDO STP", CARGOS: "", ABONOS: 700 }
]);

const require = createRequire(import.meta.url);
const XLSX = require("../vendor/xlsx.full.min.js");
const JSZip = require("../vendor/jszip.min.js");
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(records), "Movimientos");
const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
const restored = XLSX.read(bytes, { type: "buffer" });
assert.equal(restored.SheetNames[0], "Movimientos");
assert.ok(bytes.length > 1000);

const styledWorkbook = XLSX.utils.book_new();
const finalRows = buildFourColumnRows(fiscalRecords, identifiedFields);
const workbookModel = buildExcelWorkbookModel(balanceRecords, [{ Archivo: "balance.pdf", Paginas: 1, Filas_extraidas: balanceRecords.length, Estado: "Procesado" }], structured, identifiedFields, finalRows);
appendWorkbookModel(XLSX, styledWorkbook, workbookModel);
const styledBytes = XLSX.write(styledWorkbook, { bookType: "xlsx", type: "buffer" });
const workbookCheck = XLSX.read(styledBytes, { type: "buffer" });
assert.deepEqual(workbookCheck.SheetNames, ["Movimientos"]);
assert.equal(workbookCheck.Sheets.Movimientos.A1.v, "FECHA");
assert.equal(workbookCheck.Sheets.Movimientos.B1.v, "DESCRIPCION");
assert.equal(workbookCheck.Sheets.Movimientos.C1.v, "CARGOS");
assert.equal(workbookCheck.Sheets.Movimientos.D1.v, "ABONOS");
assert.equal(workbookCheck.Sheets.Movimientos.B2.v, "Total");
assert.equal(workbookCheck.Sheets.Movimientos.C2.v, 1234.56);
const styledZip = await JSZip.loadAsync(await styleWorkbook(styledBytes, { structuredRows: structured, sheetPlans: workbookModel.sheetPlans, zipLib: JSZip }));
const stylesXml = await styledZip.file("xl/styles.xml").async("string");
const movementSheetXml = await styledZip.file("xl/worksheets/sheet1.xml").async("string");
assert.ok(stylesXml.includes("FF0F172A"), "Debe incluir encabezado oscuro para Excel");
assert.ok(stylesXml.includes("FFDBEAFE"), "Debe incluir color de seccion azul");
assert.ok(stylesXml.includes("FFF3E8FF"), "Debe incluir color de seccion violeta");
assert.ok(stylesXml.includes("FFFEF3C7"), "Debe incluir color de totales");
assert.ok(stylesXml.includes("FFE0F2FE"), "Debe incluir tarjetas de portada");
assert.match(movementSheetXml, /<row[^>]*r="1"[^>]*>[\s\S]*s="1"/);
assert.equal(styledZip.file(/xl\/worksheets\/sheet\d+\.xml/).length, 1);

await pdf.destroy();

const encryptedData = new Uint8Array(await readFile(new URL("./fixtures/estado_cuenta_encriptado.pdf", import.meta.url)));
const encryptedTask = pdfjsLib.getDocument({ data: encryptedData });
let passwordRequests = 0;
encryptedTask.onPassword = (updatePassword, reason) => {
  passwordRequests += 1;
  assert.equal(reason, pdfjsLib.PasswordResponses.NEED_PASSWORD);
  updatePassword("Banco2026");
};
const encryptedPdf = await encryptedTask.promise;
const encryptedText = await (await encryptedPdf.getPage(1)).getTextContent();
assert.ok(encryptedText.items.some((item) => item.str.includes("Banco Demo")));
assert.equal(passwordRequests, 1);
await encryptedPdf.destroy();

console.log(`OK: PDF normal y cifrado extraidos; ${rows.length} filas; Excel de ${bytes.length} bytes validado.`);
