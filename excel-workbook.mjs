import { allHeaders } from "./converter-core.mjs";

const INVALID_SHEET_CHARS = /[\[\]:*?/\\]/g;
const MAX_SECTION_SHEETS = 14;
const FINAL_HEADERS = ["FECHA", "DESCRIPCION", "CARGOS", "ABONOS"];
const COMPACT_FIELD_ORDER = [
  "Folio fiscal (UUID)",
  "RFC emisor",
  "RFC receptor",
  "Nombre del emisor",
  "Nombre del receptor",
  "Fecha de emision",
  "Fecha de certificacion",
  "Version CFDI",
  "Serie",
  "Folio",
  "Tipo de comprobante",
  "Regimen fiscal emisor",
  "Regimen fiscal receptor",
  "Uso CFDI",
  "Lugar de expedicion",
  "Total",
  "Subtotal",
  "IVA",
  "ISR",
  "IEPS",
  "Descuento",
  "Moneda",
  "Tipo de cambio",
  "Forma de pago",
  "Metodo de pago",
  "Banco",
  "Cliente o titular",
  "Numero de cliente",
  "Numero de cuenta",
  "CLABE",
  "Tarjeta",
  "Periodo",
  "Fecha de corte",
  "Saldo inicial",
  "Saldo final",
  "Saldo promedio",
  "Limite de credito",
  "Pago minimo",
  "Pago para no generar intereses",
  "Fecha limite de pago",
  "Referencia",
  "Numero de operacion",
  "Numero de autorizacion",
  "Clave de rastreo",
  "SPEI",
  "Beneficiario",
  "Ordenante",
  "Banco ordenante",
  "Banco beneficiario",
  "Correo electronico",
  "Telefono",
  "Domicilio",
  "Codigo postal"
];

function valueOrBlank(value) {
  return value === undefined || value === null ? "" : value;
}

function cleanSheetName(name) {
  const cleaned = String(name || "Hoja")
    .replace(INVALID_SHEET_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "Hoja").slice(0, 31);
}

function uniqueSheetName(baseName, used) {
  const clean = cleanSheetName(baseName);
  let candidate = clean;
  let counter = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${counter}`;
    candidate = clean.slice(0, 31 - suffix.length) + suffix;
    counter += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function rowsToMatrix(rows, headers) {
  return [
    headers,
    ...rows.map((row) => headers.map((header) => valueOrBlank(row[header])))
  ];
}

function tableRowStyles(rows, startRow = 2) {
  const styles = [[1, 1]];
  const sectionStyles = new Map();
  let nextStyle = 2;
  rows.forEach((row, index) => {
    const rowNumber = startRow + index;
    if (/total|subtotal/i.test(row.Tipo || "")) {
      styles.push([rowNumber, 4]);
      return;
    }
    const section = row.Seccion || "General";
    if (!sectionStyles.has(section)) {
      sectionStyles.set(section, nextStyle);
      nextStyle = nextStyle === 2 ? 3 : 2;
    }
    styles.push([rowNumber, sectionStyles.get(section)]);
  });
  return styles;
}

function simpleTableStyles(rowCount) {
  const styles = [[1, 1]];
  for (let row = 2; row <= rowCount + 1; row += 1) {
    styles.push([row, row % 2 === 0 ? 2 : 3]);
  }
  return styles;
}

function overviewStyles(indexStartRow, indexRows) {
  const styles = [
    [1, 5],
    [4, 1],
    [5, 6],
    [6, 6],
    [7, 6],
    [8, 6],
    [9, 6],
    [11, 5],
    [16, 1]
  ];
  for (let row = indexStartRow; row < indexStartRow + indexRows; row += 1) {
    styles.push([row, row % 2 === 0 ? 2 : 3]);
  }
  return styles;
}

function sectionGroups(structuredRows) {
  const groups = new Map();
  for (const row of structuredRows) {
    const section = row.Seccion || "Sin seccion";
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(row);
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "es"));
}

function purposeText(sheet) {
  const labels = {
    cover: "Guia rapida para saber por donde empezar.",
    summary: "Estado de cada archivo procesado.",
    compact: "Vista compacta: una fila por archivo con los campos principales.",
    identified: "Campos importantes detectados con nombre, descripcion y referencia.",
    structured: "Todas las tablas detectadas en una sola vista.",
    section: "Solo los renglones de esta seccion.",
    raw: "Texto extraido directamente del PDF para auditoria."
  };
  return labels[sheet.role] || "Datos exportados.";
}

function appendSheet(model, usedNames, sheet) {
  const name = uniqueSheetName(sheet.name, usedNames);
  const finalSheet = { ...sheet, name };
  model.sheets.push(finalSheet);
  model.sheetPlans.push({ name, role: sheet.role, rowStyles: sheet.rowStyles || [] });
  return finalSheet;
}

function compactFieldRows(identifiedFields) {
  const byFile = new Map();
  const presentFields = new Set();
  identifiedFields.forEach((field) => {
    const file = field.Archivo || "archivo";
    if (!byFile.has(file)) byFile.set(file, { Archivo: file });
    const row = byFile.get(file);
    const current = row[field.Campo];
    const value = valueOrBlank(field.Valor);
    row[field.Campo] = current ? `${current} | ${value}` : value;
    presentFields.add(field.Campo);
  });
  const orderedFields = [
    ...COMPACT_FIELD_ORDER.filter((field) => presentFields.has(field)),
    ...[...presentFields].filter((field) => !COMPACT_FIELD_ORDER.includes(field)).sort((a, b) => a.localeCompare(b, "es"))
  ];
  const headers = ["Archivo", ...orderedFields];
  return { headers, rows: [...byFile.values()] };
}

function buildOverviewRows({ records, summary, structuredRows, identifiedFields, sections, sheetIndex }) {
  const firstRecommendation = identifiedFields.length
    ? "Abre Datos identificados para ver folio fiscal, RFC, fechas, importes y referencias con nombre."
    : structuredRows.length
      ? "Abre Resumen y despues una hoja de seccion para revisar solo una categoria."
      : "Abre Datos crudos; no se detectaron tablas ordenables en este PDF.";
  return [
    ["App Converter - Guia del Excel"],
    [`Generado: ${new Date().toLocaleString("es-MX")}`],
    [],
    ["Indicador", "Valor"],
    ["Archivos procesados", summary.length],
    ["Filas extraidas", records.length],
    ["Campos identificados", identifiedFields.length],
    ["Filas ordenadas", structuredRows.length],
    ["Secciones detectadas", sections.length],
    [],
    ["Como leer este archivo"],
    ["1", firstRecommendation],
    ["2", "Usa Tablas ordenadas cuando quieras ver todo junto."],
    ["3", "Usa Datos crudos solo si necesitas revisar el texto original extraido del PDF."],
    [],
    ["Indice de hojas", "Para que sirve"],
    ...sheetIndex.map((sheet) => [sheet.name, purposeText(sheet)])
  ];
}

function addHyperlinks(sheet, sheetIndex) {
  const firstIndexRow = 17;
  sheetIndex.forEach((target, index) => {
    const cellRef = `A${firstIndexRow + index}`;
    if (sheet[cellRef]) {
      sheet[cellRef].l = { Target: `#'${target.name}'!A1`, Tooltip: `Abrir ${target.name}` };
    }
  });
}

function setSheetBasics(sheet, { cols = [], autofilter = true } = {}) {
  if (cols.length) sheet["!cols"] = cols.map((wch) => ({ wch }));
  if (autofilter && sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
}

export function buildExcelWorkbookModel(records, summary, structuredRows = [], identifiedFields = [], finalRows = null) {
  const model = { sheets: [], sheetPlans: [] };
  const usedNames = new Set();
  if (Array.isArray(finalRows)) {
    appendSheet(model, usedNames, {
      name: "Movimientos",
      role: "final",
      data: rowsToMatrix(finalRows, FINAL_HEADERS),
      cols: [16, 58, 16, 16],
      rowStyles: simpleTableStyles(finalRows.length)
    });
    return model;
  }

  const groups = sectionGroups(structuredRows);
  const sections = groups.slice(0, MAX_SECTION_SHEETS);
  const periodHeaders = allHeaders(structuredRows).filter((header) => !["Archivo", "Pagina", "Fila", "Tabla", "Seccion", "Concepto", "Tipo"].includes(header));
  const friendlyHeaders = ["Seccion", "Concepto", "Tipo", ...periodHeaders, "Archivo", "Pagina"];
  const structuredFriendlyRows = structuredRows.map((row) => {
    const next = {
      Seccion: row.Seccion,
      Concepto: row.Concepto,
      Tipo: row.Tipo,
      Archivo: row.Archivo,
      Pagina: row.Pagina
    };
    periodHeaders.forEach((header) => { next[header] = row[header]; });
    return next;
  });

  const sheetIndex = [
    { name: "Resumen", role: "summary" },
    ...(identifiedFields.length ? [{ name: "Ficha compacta", role: "compact" }, { name: "Datos identificados", role: "identified" }] : []),
    ...(structuredRows.length ? [{ name: "Tablas ordenadas", role: "structured" }] : []),
    ...sections.map(([section]) => ({ name: cleanSheetName(section), role: "section" })),
    { name: "Datos crudos", role: "raw" }
  ];
  const overviewRows = buildOverviewRows({ records, summary, structuredRows, identifiedFields, sections, sheetIndex });
  appendSheet(model, usedNames, {
    name: "Inicio",
    role: "cover",
    data: overviewRows,
    cols: [28, 86],
    autofilter: false,
    rowStyles: overviewStyles(17, sheetIndex.length)
  });

  const fieldCounts = new Map();
  identifiedFields.forEach((field) => {
    const file = field.Archivo || "";
    fieldCounts.set(file, (fieldCounts.get(file) || 0) + 1);
  });
  const summaryRows = summary.map((row) => ({
    ...row,
    Campos_identificados: fieldCounts.get(row.Archivo || "") || 0
  }));
  const summaryHeaders = ["Archivo", "Estado", "Paginas", "Filas_extraidas", "Campos_identificados"];
  appendSheet(model, usedNames, {
    name: "Resumen",
    role: "summary",
    data: rowsToMatrix(summaryRows, summaryHeaders),
    cols: [34, 16, 12, 18, 22],
    rowStyles: simpleTableStyles(summaryRows.length)
  });

  if (identifiedFields.length) {
    const compact = compactFieldRows(identifiedFields);
    appendSheet(model, usedNames, {
      name: "Ficha compacta",
      role: "compact",
      data: rowsToMatrix(compact.rows, compact.headers),
      cols: compact.headers.map((header) => header === "Archivo" ? 32 : 22),
      rowStyles: simpleTableStyles(compact.rows.length)
    });

    const identifiedHeaders = ["Categoria", "Campo", "Valor", "Descripcion", "Referente", "Confianza", "Validacion", "Archivo", "Pagina", "Fila", "Texto_origen"];
    appendSheet(model, usedNames, {
      name: "Datos identificados",
      role: "identified",
      data: rowsToMatrix(identifiedFields, identifiedHeaders),
      cols: [28, 28, 34, 46, 30, 12, 34, 30, 10, 10, 72],
      rowStyles: simpleTableStyles(identifiedFields.length)
    });
  }

  if (structuredRows.length) {
    appendSheet(model, usedNames, {
      name: "Tablas ordenadas",
      role: "structured",
      data: rowsToMatrix(structuredFriendlyRows, friendlyHeaders),
      cols: [24, 36, 13, ...periodHeaders.map(() => 15), 30, 10],
      rowStyles: tableRowStyles(structuredFriendlyRows)
    });

    sections.forEach(([section, rows]) => {
      const sectionRows = rows.map((row) => {
        const next = { Concepto: row.Concepto, Tipo: row.Tipo, Archivo: row.Archivo, Pagina: row.Pagina, Seccion: row.Seccion };
        periodHeaders.forEach((header) => { next[header] = row[header]; });
        return next;
      });
      const headers = ["Concepto", "Tipo", ...periodHeaders, "Archivo", "Pagina"];
      appendSheet(model, usedNames, {
        name: section,
        role: "section",
        data: rowsToMatrix(sectionRows, headers),
        cols: [38, 13, ...periodHeaders.map(() => 15), 30, 10],
        rowStyles: tableRowStyles(sectionRows)
      });
    });
  }

  const rawHeaders = allHeaders(records);
  appendSheet(model, usedNames, {
    name: "Datos crudos",
    role: "raw",
    data: rowsToMatrix(records, rawHeaders),
    cols: rawHeaders.map((header) => header === "Archivo" ? 32 : 16),
    rowStyles: simpleTableStyles(records.length)
  });

  return model;
}

export function appendWorkbookModel(XLSX, workbook, model) {
  model.sheets.forEach((sheetModel) => {
    const sheet = XLSX.utils.aoa_to_sheet(sheetModel.data);
    setSheetBasics(sheet, sheetModel);
    if (sheetModel.role === "cover") addHyperlinks(sheet, model.sheets.filter((sheet) => sheet.role !== "cover"));
    XLSX.utils.book_append_sheet(workbook, sheet, sheetModel.name);
  });
}
