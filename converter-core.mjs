export function groupItemsIntoRows(items) {
  const textItems = items
    .filter((item) => item.str?.trim())
    .map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5], width: item.width || 0 }))
    .sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);

  const lines = [];
  for (const item of textItems) {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const sorted = line.items.sort((a, b) => a.x - b.x);
      const cells = [];
      for (const item of sorted) {
        const previous = cells.at(-1);
        const gap = previous ? item.x - previous.end : Infinity;
        if (previous && gap < 14) {
          previous.text = `${previous.text} ${item.text}`.trim();
          previous.end = Math.max(previous.end, item.x + item.width);
        } else {
          cells.push({ text: item.text, x: item.x, end: item.x + item.width });
        }
      }
      const row = cells.map((cell) => cell.text);
      Object.defineProperty(row, "__cellMeta", {
        value: cells.map((cell) => ({ text: cell.text, end: cell.end, x: cell.x ?? null })),
        enumerable: false
      });
      return row;
    })
    .filter((row) => row.some(Boolean));
}

export function allHeaders(records) {
  const preferred = ["Archivo", "Pagina", "Fila", "Tabla", "Seccion", "Concepto", "Tipo", "Categoria", "Campo", "Valor", "Descripcion", "Referente", "Confianza", "Validacion", "Texto_origen"];
  const seen = new Set();
  const dynamic = [];
  records.forEach((record) => Object.keys(record).forEach((key) => {
    if (!preferred.includes(key) && !seen.has(key)) {
      seen.add(key);
      dynamic.push(key);
    }
  }));
  const fixed = preferred.filter((key) => records.some((record) => key in record));
  dynamic.sort((a, b) => {
    const aColumn = /^Columna_(\d+)$/.exec(a);
    const bColumn = /^Columna_(\d+)$/.exec(b);
    if (aColumn && bColumn) return Number(aColumn[1]) - Number(bColumn[1]);
    if (aColumn) return -1;
    if (bColumn) return 1;
    return 0;
  });
  return [...fixed, ...dynamic];
}

export function csvFromRecords(records) {
  const headers = allHeaders(records);
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = records.map((record) => headers.map((header) => escape(record[header])).join(","));
  return `\ufeff${headers.map(escape).join(",")}\r\n${rows.join("\r\n")}`;
}

const AMOUNT_PATTERN = /^[+-]?\(?\$?\s*[+-]?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?-?\)?$|^[+-]?\(?\$?\s*[+-]?\d+(?:[.,]\d+)?-?\)?$/;
const MONEY_TOKEN_PATTERN = /[+-]?\(?\$?\s*[+-]?(?:\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2}))\)?-?|[+-]?\(?\$\s*[+-]?\d+\)?-?/g;
const DATE_PATTERN = /\b\d{1,2}[/-]\d{1,2}[/-](?:\d{2,4}|20X\d)\b/i;
const MONTH_DATE_PATTERN = /\b\d{1,2}\s+(?:ene|enero|feb|febrero|mar|marzo|abr|abril|may|mayo|jun|junio|jul|julio|ago|agosto|sep|sept|septiembre|oct|octubre|nov|noviembre|dic|diciembre)\.?(?:\s+\d{2,4})?\b|\b\d{1,2}[/-](?:ene|enero|feb|febrero|mar|marzo|abr|abril|may|mayo|jun|junio|jul|julio|ago|agosto|sep|sept|septiembre|oct|octubre|nov|noviembre|dic|diciembre)(?:[/-]\d{2,4})?\b/i;
const BANK_MOVEMENT_ROW_PATTERN = /^\s*(\d{1,2}[/-](?:ene|enero|feb|febrero|mar|marzo|abr|abril|may|mayo|jun|junio|jul|julio|ago|agosto|sep|sept|septiembre|oct|octubre|nov|noviembre|dic|diciembre)(?:[/-]\d{2,4})?)\s+(\d{1,2}[/-](?:ene|enero|feb|febrero|mar|marzo|abr|abril|may|mayo|jun|junio|jul|julio|ago|agosto|sep|sept|septiembre|oct|octubre|nov|noviembre|dic|diciembre)(?:[/-]\d{2,4})?)\s+(.+)$/i;
const DATE_TIME_PATTERN = /\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\b/i;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const RFC_PATTERN = /\b[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}\b/i;
const CERTIFICATE_PATTERN = /\b\d{20}\b/;
const CLABE_PATTERN = /\b\d{18}\b/;
const ACCOUNT_PATTERN = /\b\d{8,20}\b/;
const CARD_PATTERN = /\b(?:\d{4}[-\s]?){3}\d{4}\b|\*{2,}\d{4}\b/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /\b(?:\+?52\s*)?(?:\(?\d{2,3}\)?[\s.-]*)?\d{3,4}[\s.-]?\d{4}\b/;
const ZIP_PATTERN = /\b\d{5}\b/;
const PERCENT_PATTERN = /\b\d+(?:\.\d+)?\s*%/;
const TRACKING_PATTERN = /\b[A-Z0-9]{8,40}\b/i;
const DOCUMENT_CONTEXT_PATTERN = /\b(folio\s*fiscal|uuid|cfdi|rfc|sat|certificado|sello|timbrado|comprobante|banco|cuenta|clabe|tarjeta|saldo|estado\s+de\s+cuenta|periodo|referencia|autorizaci[oó]n|operaci[oó]n|movimiento|dep[oó]sito|retiro|cargo|abono|transferencia|sucursal|cliente|titular|spei|rastreo|beneficiario|ordenante|telefono|tel[eé]fono|correo|email|domicilio|direcci[oó]n)\b/i;
const SECTION_WORDS = /^(activo|pasivo|patrimonio|capital|ingresos|ventas|costos|gastos|utilidad|flujo|efectivo)/i;

const FIELD_DEFINITIONS = [
  {
    campo: "Folio fiscal (UUID)",
    categoria: "CFDI / Identificacion fiscal",
    descripcion: "Identificador unico del comprobante fiscal digital.",
    referente: "SAT: UUID del CFDI",
    aliases: [/\bfolio\s*fiscal\b/i, /\buuid\b/i, /\bfolio\s+sat\b/i],
    pattern: UUID_PATTERN,
    inferPattern: true
  },
  {
    campo: "Banco",
    categoria: "Estado de cuenta / Institucion",
    descripcion: "Nombre de la institucion financiera o banco.",
    referente: "Banco emisor del documento",
    aliases: [/\bbanco\b/i, /\binstituci[oó]n\s+financiera\b/i]
  },
  {
    campo: "Cliente o titular",
    categoria: "Estado de cuenta / Titular",
    descripcion: "Nombre de la persona o empresa titular del producto financiero.",
    referente: "Titular de la cuenta",
    aliases: [/\bcliente\b/i, /\btitular\b/i, /\bnombre\s+del\s+cliente\b/i, /\bnombre\s+del\s+titular\b/i]
  },
  {
    campo: "Numero de cliente",
    categoria: "Estado de cuenta / Titular",
    descripcion: "Identificador interno del cliente dentro del banco.",
    referente: "Numero de cliente",
    aliases: [/\bn[uú]mero\s+de\s+cliente\b/i, /\bno\.?\s+cliente\b/i, /\bid\s+cliente\b/i],
    pattern: ACCOUNT_PATTERN
  },
  {
    campo: "Numero de cuenta",
    categoria: "Estado de cuenta / Cuenta",
    descripcion: "Numero de cuenta bancaria detectado en el documento.",
    referente: "Cuenta bancaria",
    aliases: [/\bn[uú]mero\s+de\s+cuenta\b/i, /\bno\.?\s+cuenta\b/i, /\bcuenta\b/i],
    pattern: ACCOUNT_PATTERN,
    reject: /\bclabe\b|\btarjeta\b/i
  },
  {
    campo: "CLABE",
    categoria: "Estado de cuenta / Cuenta",
    descripcion: "Clave Bancaria Estandarizada de 18 digitos.",
    referente: "CLABE interbancaria",
    aliases: [/\bclabe\b/i, /\bclabe\s+interbancaria\b/i],
    pattern: CLABE_PATTERN,
    inferPattern: true
  },
  {
    campo: "Tarjeta",
    categoria: "Estado de cuenta / Cuenta",
    descripcion: "Numero de tarjeta completo o enmascarado.",
    referente: "Tarjeta asociada",
    aliases: [/\btarjeta\b/i, /\bn[uú]mero\s+de\s+tarjeta\b/i],
    pattern: CARD_PATTERN
  },
  {
    campo: "Periodo",
    categoria: "Estado de cuenta / Periodo",
    descripcion: "Periodo cubierto por el estado de cuenta o comprobante.",
    referente: "Periodo del documento",
    aliases: [/\bperiodo\b/i, /\bperiodo\s+del\s+estado\s+de\s+cuenta\b/i]
  },
  {
    campo: "Fecha de corte",
    categoria: "Estado de cuenta / Periodo",
    descripcion: "Fecha de corte informada por el banco.",
    referente: "Fecha de corte",
    aliases: [/\bfecha\s+de\s+corte\b/i, /\bcorte\s+al\b/i],
    pattern: DATE_TIME_PATTERN
  },
  {
    campo: "Saldo inicial",
    categoria: "Estado de cuenta / Saldos",
    descripcion: "Saldo al inicio del periodo.",
    referente: "Saldo inicial",
    aliases: [/\bsaldo\s+inicial\b/i, /\bsaldo\s+anterior\b/i],
    amount: true
  },
  {
    campo: "Saldo final",
    categoria: "Estado de cuenta / Saldos",
    descripcion: "Saldo al final del periodo.",
    referente: "Saldo final",
    aliases: [/\bsaldo\s+final\b/i, /\bsaldo\s+actual\b/i, /\bsaldo\s+al\s+corte\b/i],
    amount: true
  },
  {
    campo: "Saldo promedio",
    categoria: "Estado de cuenta / Saldos",
    descripcion: "Saldo promedio informado para el periodo.",
    referente: "Saldo promedio",
    aliases: [/\bsaldo\s+promedio\b/i],
    amount: true
  },
  {
    campo: "Referencia",
    categoria: "Comprobante / Referencias",
    descripcion: "Referencia bancaria, fiscal o interna asociada al movimiento o comprobante.",
    referente: "Referencia del documento",
    aliases: [/\breferencia\b/i, /\bref\.\b/i]
  },
  {
    campo: "Numero de operacion",
    categoria: "Comprobante / Referencias",
    descripcion: "Identificador de operacion o transaccion.",
    referente: "Numero de operacion",
    aliases: [/\bn[uú]mero\s+de\s+operaci[oó]n\b/i, /\bno\.?\s+operaci[oó]n\b/i, /\boperaci[oó]n\b/i]
  },
  {
    campo: "Numero de autorizacion",
    categoria: "Comprobante / Referencias",
    descripcion: "Codigo de autorizacion del pago, cargo o transferencia.",
    referente: "Autorizacion de operacion",
    aliases: [/\bn[uú]mero\s+de\s+autorizaci[oó]n\b/i, /\bno\.?\s+autorizaci[oó]n\b/i, /\bautorizaci[oó]n\b/i]
  },
  {
    campo: "Sucursal",
    categoria: "Estado de cuenta / Institucion",
    descripcion: "Sucursal o plaza asociada al documento.",
    referente: "Sucursal bancaria",
    aliases: [/\bsucursal\b/i, /\bplaza\b/i]
  },
  {
    campo: "Cuenta de cargo",
    categoria: "Comprobante / Cuentas",
    descripcion: "Cuenta desde la que sale el dinero.",
    referente: "Cuenta origen o cargo",
    aliases: [/\bcuenta\s+de\s+cargo\b/i, /\bcuenta\s+origen\b/i],
    pattern: ACCOUNT_PATTERN
  },
  {
    campo: "Cuenta de abono",
    categoria: "Comprobante / Cuentas",
    descripcion: "Cuenta a la que entra el dinero.",
    referente: "Cuenta destino o abono",
    aliases: [/\bcuenta\s+de\s+abono\b/i, /\bcuenta\s+destino\b/i],
    pattern: ACCOUNT_PATTERN
  },
  {
    campo: "RFC emisor",
    categoria: "CFDI / Partes del comprobante",
    descripcion: "Registro Federal de Contribuyentes de quien emite el comprobante.",
    referente: "Emisor del CFDI",
    aliases: [/\brfc\s+(?:del\s+)?emisor\b/i, /\bemisor\b.*\brfc\b/i],
    pattern: RFC_PATTERN
  },
  {
    campo: "RFC receptor",
    categoria: "CFDI / Partes del comprobante",
    descripcion: "Registro Federal de Contribuyentes de quien recibe el comprobante.",
    referente: "Receptor del CFDI",
    aliases: [/\brfc\s+(?:del\s+)?receptor\b/i, /\breceptor\b.*\brfc\b/i],
    pattern: RFC_PATTERN
  },
  {
    campo: "RFC identificado",
    categoria: "CFDI / Partes del comprobante",
    descripcion: "RFC detectado sin contexto suficiente para saber si es emisor o receptor.",
    referente: "RFC encontrado en el texto",
    aliases: [/\brfc\b/i],
    pattern: RFC_PATTERN,
    reject: /\bemisor\b|\breceptor\b/i,
    inferPattern: true
  },
  {
    campo: "Nombre del emisor",
    categoria: "CFDI / Partes del comprobante",
    descripcion: "Nombre o razon social de quien emite el comprobante.",
    referente: "Emisor del CFDI",
    aliases: [/\bnombre\s+(?:del\s+)?emisor\b/i, /\braz[oó]n\s+social\s+(?:del\s+)?emisor\b/i, /\bemisor\b/i],
    reject: /\brfc\b/i
  },
  {
    campo: "Nombre del receptor",
    categoria: "CFDI / Partes del comprobante",
    descripcion: "Nombre o razon social de quien recibe el comprobante.",
    referente: "Receptor del CFDI",
    aliases: [/\bnombre\s+(?:del\s+)?receptor\b/i, /\braz[oó]n\s+social\s+(?:del\s+)?receptor\b/i, /\breceptor\b/i],
    reject: /\brfc\b/i
  },
  {
    campo: "Fecha de emision",
    categoria: "CFDI / Fechas",
    descripcion: "Fecha en que se emitio el comprobante.",
    referente: "Fecha del CFDI",
    aliases: [/\bfecha\s+de\s+emisi[oó]n\b/i, /\bfecha\s+emisi[oó]n\b/i, /\bemitido\b/i],
    pattern: DATE_TIME_PATTERN
  },
  {
    campo: "Fecha de certificacion",
    categoria: "CFDI / Fechas",
    descripcion: "Fecha en que el comprobante fue timbrado o certificado por el SAT.",
    referente: "Timbrado SAT",
    aliases: [/\bfecha\s+de\s+certificaci[oó]n\b/i, /\bfecha\s+certificaci[oó]n\b/i, /\bfecha\s+timbrado\b/i],
    pattern: DATE_TIME_PATTERN
  },
  {
    campo: "Certificado SAT",
    categoria: "CFDI / Sellos y certificacion",
    descripcion: "Numero de certificado usado por el SAT para timbrar el comprobante.",
    referente: "No. certificado SAT",
    aliases: [/\bcertificado\s+sat\b/i, /\bno\.?\s*certificado\s+sat\b/i],
    pattern: CERTIFICATE_PATTERN
  },
  {
    campo: "Certificado emisor",
    categoria: "CFDI / Sellos y certificacion",
    descripcion: "Numero de certificado digital del emisor.",
    referente: "No. certificado del emisor",
    aliases: [/\bno\.?\s*(?:de\s+)?certificado\b/i, /\bcertificado\s+(?:del\s+)?emisor\b/i],
    pattern: CERTIFICATE_PATTERN,
    reject: /\bsat\b/i
  },
  {
    campo: "Serie",
    categoria: "CFDI / Identificacion fiscal",
    descripcion: "Serie interna del comprobante cuando el emisor la incluye.",
    referente: "Serie del comprobante",
    aliases: [/\bserie\b/i]
  },
  {
    campo: "Folio",
    categoria: "CFDI / Identificacion fiscal",
    descripcion: "Folio interno del comprobante. No es el folio fiscal UUID.",
    referente: "Folio interno del emisor",
    aliases: [/\bfolio\b/i],
    reject: /\bfiscal\b|\buuid\b/i
  },
  {
    campo: "Regimen fiscal",
    categoria: "CFDI / Regimen y uso",
    descripcion: "Regimen fiscal informado en el comprobante.",
    referente: "Regimen fiscal CFDI",
    aliases: [/\br[eé]gimen\s+fiscal\b/i]
  },
  {
    campo: "Uso CFDI",
    categoria: "CFDI / Regimen y uso",
    descripcion: "Clave o descripcion del uso fiscal declarado para el receptor.",
    referente: "Uso CFDI",
    aliases: [/\buso\s+cfdi\b/i]
  },
  {
    campo: "Lugar de expedicion",
    categoria: "CFDI / Ubicacion",
    descripcion: "Codigo postal o lugar donde se expidio el comprobante.",
    referente: "Lugar de expedicion CFDI",
    aliases: [/\blugar\s+de\s+expedici[oó]n\b/i, /\bexpedido\s+en\b/i]
  },
  {
    campo: "Tipo de comprobante",
    categoria: "CFDI / Regimen y uso",
    descripcion: "Tipo del comprobante, por ejemplo Ingreso, Egreso, Pago o Traslado.",
    referente: "Tipo de comprobante CFDI",
    aliases: [/\btipo\s+de\s+comprobante\b/i]
  },
  {
    campo: "Forma de pago",
    categoria: "CFDI / Pago e importes",
    descripcion: "Forma en que se realizo el pago, por ejemplo efectivo o transferencia.",
    referente: "Forma de pago CFDI",
    aliases: [/\bforma\s+de\s+pago\b/i]
  },
  {
    campo: "Metodo de pago",
    categoria: "CFDI / Pago e importes",
    descripcion: "Metodo de pago declarado, por ejemplo PUE o PPD.",
    referente: "Metodo de pago CFDI",
    aliases: [/\bm[eé]todo\s+de\s+pago\b/i]
  },
  {
    campo: "Moneda",
    categoria: "CFDI / Pago e importes",
    descripcion: "Moneda usada en el comprobante.",
    referente: "Moneda CFDI",
    aliases: [/\bmoneda\b/i]
  },
  {
    campo: "Subtotal",
    categoria: "CFDI / Pago e importes",
    descripcion: "Importe antes de impuestos o descuentos.",
    referente: "Subtotal del comprobante",
    aliases: [/\bsubtotal\b/i],
    amount: true
  },
  {
    campo: "IVA",
    categoria: "CFDI / Pago e importes",
    descripcion: "Impuesto al Valor Agregado detectado en el comprobante.",
    referente: "IVA trasladado o retenido",
    aliases: [/\biva\b/i],
    amount: true,
    reject: /\bsin\s+iva\b/i
  },
  {
    campo: "Total",
    categoria: "CFDI / Pago e importes",
    descripcion: "Importe total del comprobante.",
    referente: "Total del comprobante",
    aliases: [/\btotal\b/i],
    amount: true,
    reject: /\bsubtotal\b/i
  },
  {
    campo: "Sello digital CFDI",
    categoria: "CFDI / Sellos y certificacion",
    descripcion: "Sello digital incluido por el emisor.",
    referente: "Sello CFDI",
    aliases: [/\bsello\s+digital\b/i, /\bsello\s+cfdi\b/i],
    minLength: 25
  },
  {
    campo: "Sello SAT",
    categoria: "CFDI / Sellos y certificacion",
    descripcion: "Sello digital del SAT.",
    referente: "Sello SAT",
    aliases: [/\bsello\s+sat\b/i],
    minLength: 25
  },
  {
    campo: "Cadena original",
    categoria: "CFDI / Sellos y certificacion",
    descripcion: "Cadena original del complemento de certificacion.",
    referente: "Cadena original SAT",
    aliases: [/\bcadena\s+original\b/i],
    minLength: 20
  }
];

FIELD_DEFINITIONS.push(
  {
    campo: "Version CFDI",
    categoria: "CFDI / Identificacion fiscal",
    descripcion: "Version del comprobante fiscal digital.",
    referente: "Version CFDI",
    aliases: [/\bversi[oó]n\s+cfdi\b/i, /\bversi[oó]n\b/i]
  },
  {
    campo: "Exportacion",
    categoria: "CFDI / Regimen y uso",
    descripcion: "Clave de exportacion declarada en el CFDI.",
    referente: "Exportacion CFDI",
    aliases: [/\bexportaci[oó]n\b/i]
  },
  {
    campo: "Domicilio fiscal receptor",
    categoria: "CFDI / Partes del comprobante",
    descripcion: "Codigo postal o domicilio fiscal del receptor.",
    referente: "Domicilio fiscal receptor",
    aliases: [/\bdomicilio\s+fiscal\s+(?:del\s+)?receptor\b/i, /\bcp\s+(?:del\s+)?receptor\b/i, /\bc[oó]digo\s+postal\s+(?:del\s+)?receptor\b/i]
  },
  {
    campo: "Regimen fiscal receptor",
    categoria: "CFDI / Regimen y uso",
    descripcion: "Regimen fiscal del receptor.",
    referente: "Regimen fiscal receptor",
    aliases: [/\br[eé]gimen\s+fiscal\s+(?:del\s+)?receptor\b/i]
  },
  {
    campo: "Regimen fiscal emisor",
    categoria: "CFDI / Regimen y uso",
    descripcion: "Regimen fiscal del emisor.",
    referente: "Regimen fiscal emisor",
    aliases: [/\br[eé]gimen\s+fiscal\s+(?:del\s+)?emisor\b/i]
  },
  {
    campo: "Tipo de relacion",
    categoria: "CFDI / Relacionados",
    descripcion: "Tipo de relacion con otros CFDI.",
    referente: "Tipo relacion CFDI",
    aliases: [/\btipo\s+de\s+relaci[oó]n\b/i, /\btipo\s+relaci[oó]n\b/i]
  },
  {
    campo: "CFDI relacionado",
    categoria: "CFDI / Relacionados",
    descripcion: "UUID de un CFDI relacionado.",
    referente: "CFDI relacionado",
    aliases: [/\bcfdi\s+relacionado\b/i, /\buuid\s+relacionado\b/i],
    pattern: UUID_PATTERN
  },
  {
    campo: "RFC PAC",
    categoria: "CFDI / Sellos y certificacion",
    descripcion: "RFC del proveedor autorizado de certificacion.",
    referente: "PAC certificador",
    aliases: [/\brfc\s+(?:del\s+)?pac\b/i, /\brfc\s+proveedor\s+certificaci[oó]n\b/i],
    pattern: RFC_PATTERN
  },
  {
    campo: "PAC certificador",
    categoria: "CFDI / Sellos y certificacion",
    descripcion: "Proveedor autorizado de certificacion que timbro el comprobante.",
    referente: "PAC certificador",
    aliases: [/\bpac\s+certificador\b/i, /\bproveedor\s+de\s+certificaci[oó]n\b/i]
  },
  {
    campo: "No. pedimento",
    categoria: "CFDI / Comercio exterior",
    descripcion: "Numero de pedimento aduanal cuando el comprobante lo incluye.",
    referente: "Pedimento",
    aliases: [/\bno\.?\s+pedimento\b/i, /\bn[uú]mero\s+de\s+pedimento\b/i, /\bpedimento\b/i]
  },
  {
    campo: "Cuenta predial",
    categoria: "CFDI / Complementos",
    descripcion: "Cuenta predial relacionada con el concepto facturado.",
    referente: "Cuenta predial",
    aliases: [/\bcuenta\s+predial\b/i]
  },
  {
    campo: "Condiciones de pago",
    categoria: "CFDI / Pago e importes",
    descripcion: "Condiciones comerciales de pago indicadas en el CFDI.",
    referente: "Condiciones de pago",
    aliases: [/\bcondiciones\s+de\s+pago\b/i]
  },
  {
    campo: "Tipo de cambio",
    categoria: "CFDI / Pago e importes",
    descripcion: "Tipo de cambio usado cuando la moneda no es MXN o se informa conversion.",
    referente: "Tipo de cambio",
    aliases: [/\btipo\s+de\s+cambio\b/i],
    amount: true
  },
  {
    campo: "Descuento",
    categoria: "CFDI / Pago e importes",
    descripcion: "Descuento aplicado al comprobante o concepto.",
    referente: "Descuento",
    aliases: [/\bdescuento\b/i],
    amount: true
  },
  {
    campo: "Base impuesto",
    categoria: "CFDI / Impuestos",
    descripcion: "Base usada para calcular impuestos.",
    referente: "Base de impuesto",
    aliases: [/\bbase\s+(?:del\s+)?impuesto\b/i, /\bbase\b/i],
    amount: true
  },
  {
    campo: "Tasa o cuota",
    categoria: "CFDI / Impuestos",
    descripcion: "Tasa, cuota o porcentaje usado para calcular impuestos.",
    referente: "Tasa o cuota",
    aliases: [/\btasa\s+o\s+cuota\b/i, /\btasa\b/i, /\bcuota\b/i],
    pattern: PERCENT_PATTERN
  },
  {
    campo: "ISR",
    categoria: "CFDI / Impuestos",
    descripcion: "Impuesto Sobre la Renta detectado.",
    referente: "ISR trasladado o retenido",
    aliases: [/\bisr\b/i],
    amount: true
  },
  {
    campo: "IEPS",
    categoria: "CFDI / Impuestos",
    descripcion: "Impuesto Especial sobre Produccion y Servicios detectado.",
    referente: "IEPS",
    aliases: [/\bieps\b/i],
    amount: true
  },
  {
    campo: "Impuestos retenidos",
    categoria: "CFDI / Impuestos",
    descripcion: "Total de impuestos retenidos.",
    referente: "Impuestos retenidos",
    aliases: [/\bimpuestos\s+retenidos\b/i, /\bretenciones\b/i],
    amount: true
  },
  {
    campo: "Impuestos trasladados",
    categoria: "CFDI / Impuestos",
    descripcion: "Total de impuestos trasladados.",
    referente: "Impuestos trasladados",
    aliases: [/\bimpuestos\s+trasladados\b/i, /\btraslados\b/i],
    amount: true
  },
  {
    campo: "Clave producto servicio",
    categoria: "CFDI / Conceptos",
    descripcion: "Clave SAT del producto o servicio facturado.",
    referente: "ClaveProdServ",
    aliases: [/\bclave\s+prod(?:ucto)?\s*serv(?:icio)?\b/i, /\bclaveprodserv\b/i, /\bproducto\s+servicio\b/i]
  },
  {
    campo: "Clave unidad",
    categoria: "CFDI / Conceptos",
    descripcion: "Clave de unidad SAT del concepto.",
    referente: "Clave unidad",
    aliases: [/\bclave\s+unidad\b/i, /\bclaveunidad\b/i]
  },
  {
    campo: "Unidad",
    categoria: "CFDI / Conceptos",
    descripcion: "Unidad del producto o servicio facturado.",
    referente: "Unidad",
    aliases: [/\bunidad\b/i]
  },
  {
    campo: "Cantidad",
    categoria: "CFDI / Conceptos",
    descripcion: "Cantidad del producto o servicio.",
    referente: "Cantidad",
    aliases: [/\bcantidad\b/i],
    amount: true
  },
  {
    campo: "Valor unitario",
    categoria: "CFDI / Conceptos",
    descripcion: "Precio unitario del concepto.",
    referente: "Valor unitario",
    aliases: [/\bvalor\s+unitario\b/i, /\bprecio\s+unitario\b/i],
    amount: true
  },
  {
    campo: "Importe",
    categoria: "CFDI / Pago e importes",
    descripcion: "Importe detectado en comprobante, concepto o movimiento.",
    referente: "Importe",
    aliases: [/\bimporte\b/i, /\bmonto\b/i],
    amount: true
  },
  {
    campo: "Objeto impuesto",
    categoria: "CFDI / Impuestos",
    descripcion: "Clave que indica si el concepto es objeto de impuesto.",
    referente: "Objeto impuesto",
    aliases: [/\bobjeto\s+impuesto\b/i, /\bobjetoimp\b/i]
  },
  {
    campo: "Descripcion del concepto",
    categoria: "CFDI / Conceptos",
    descripcion: "Descripcion del bien, servicio o movimiento.",
    referente: "Descripcion",
    aliases: [/\bdescripci[oó]n\s+(?:del\s+)?concepto\b/i, /\bconcepto\b/i, /\bdescripci[oó]n\b/i]
  },
  {
    campo: "Fecha de operacion",
    categoria: "Estado de cuenta / Movimientos",
    descripcion: "Fecha en que se realizo la operacion bancaria.",
    referente: "Fecha de operacion",
    aliases: [/\bfecha\s+de\s+operaci[oó]n\b/i, /\bfecha\s+operaci[oó]n\b/i, /\bfecha\s+movimiento\b/i],
    pattern: DATE_TIME_PATTERN
  },
  {
    campo: "Fecha valor",
    categoria: "Estado de cuenta / Movimientos",
    descripcion: "Fecha valor o fecha contable del movimiento.",
    referente: "Fecha valor",
    aliases: [/\bfecha\s+valor\b/i, /\bfecha\s+contable\b/i],
    pattern: DATE_TIME_PATTERN
  },
  {
    campo: "Deposito o abono",
    categoria: "Estado de cuenta / Movimientos",
    descripcion: "Ingreso, deposito o abono detectado.",
    referente: "Deposito/abono",
    aliases: [/\bdep[oó]sito\b/i, /\babono\b/i, /\bingreso\b/i],
    amount: true
  },
  {
    campo: "Retiro o cargo",
    categoria: "Estado de cuenta / Movimientos",
    descripcion: "Salida, retiro o cargo detectado.",
    referente: "Retiro/cargo",
    aliases: [/\bretiro\b/i, /\bcargo\b/i, /\begreso\b/i],
    amount: true
  },
  {
    campo: "Comision",
    categoria: "Estado de cuenta / Comisiones",
    descripcion: "Comision cobrada por el banco o servicio.",
    referente: "Comision",
    aliases: [/\bcomisi[oó]n\b/i, /\bcomisiones\b/i],
    amount: true
  },
  {
    campo: "Intereses",
    categoria: "Estado de cuenta / Rendimientos",
    descripcion: "Intereses cobrados o pagados.",
    referente: "Intereses",
    aliases: [/\binter[eé]s\b/i, /\bintereses\b/i],
    amount: true
  },
  {
    campo: "GAT nominal",
    categoria: "Estado de cuenta / Rendimientos",
    descripcion: "Ganancia Anual Total nominal.",
    referente: "GAT nominal",
    aliases: [/\bgat\s+nominal\b/i],
    pattern: PERCENT_PATTERN
  },
  {
    campo: "GAT real",
    categoria: "Estado de cuenta / Rendimientos",
    descripcion: "Ganancia Anual Total real.",
    referente: "GAT real",
    aliases: [/\bgat\s+real\b/i],
    pattern: PERCENT_PATTERN
  },
  {
    campo: "CAT",
    categoria: "Estado de cuenta / Costo financiero",
    descripcion: "Costo Anual Total informado.",
    referente: "CAT",
    aliases: [/\bcat\b/i],
    pattern: PERCENT_PATTERN
  },
  {
    campo: "Limite de credito",
    categoria: "Estado de cuenta / Credito",
    descripcion: "Limite de credito disponible o autorizado.",
    referente: "Limite de credito",
    aliases: [/\bl[ií]mite\s+de\s+cr[eé]dito\b/i, /\bl[ií]nea\s+de\s+cr[eé]dito\b/i],
    amount: true
  },
  {
    campo: "Pago minimo",
    categoria: "Estado de cuenta / Credito",
    descripcion: "Pago minimo requerido.",
    referente: "Pago minimo",
    aliases: [/\bpago\s+m[ií]nimo\b/i],
    amount: true
  },
  {
    campo: "Pago para no generar intereses",
    categoria: "Estado de cuenta / Credito",
    descripcion: "Importe para no generar intereses.",
    referente: "Pago para no generar intereses",
    aliases: [/\bpago\s+para\s+no\s+generar\s+intereses\b/i],
    amount: true
  },
  {
    campo: "Fecha limite de pago",
    categoria: "Estado de cuenta / Credito",
    descripcion: "Fecha limite para realizar el pago.",
    referente: "Fecha limite de pago",
    aliases: [/\bfecha\s+l[ií]mite\s+de\s+pago\b/i, /\bl[ií]mite\s+de\s+pago\b/i],
    pattern: DATE_TIME_PATTERN
  },
  {
    campo: "Beneficiario",
    categoria: "Comprobante / Partes",
    descripcion: "Persona o entidad beneficiaria de la operacion.",
    referente: "Beneficiario",
    aliases: [/\bbeneficiario\b/i, /\bdestinatario\b/i]
  },
  {
    campo: "Ordenante",
    categoria: "Comprobante / Partes",
    descripcion: "Persona o entidad que ordena la operacion.",
    referente: "Ordenante",
    aliases: [/\bordenante\b/i, /\bremitente\b/i]
  },
  {
    campo: "Banco ordenante",
    categoria: "Comprobante / Bancos",
    descripcion: "Banco de origen de la operacion.",
    referente: "Banco ordenante",
    aliases: [/\bbanco\s+ordenante\b/i, /\bbanco\s+origen\b/i]
  },
  {
    campo: "Banco beneficiario",
    categoria: "Comprobante / Bancos",
    descripcion: "Banco destino o beneficiario de la operacion.",
    referente: "Banco beneficiario",
    aliases: [/\bbanco\s+beneficiario\b/i, /\bbanco\s+destino\b/i]
  },
  {
    campo: "Clave de rastreo",
    categoria: "Comprobante / Referencias",
    descripcion: "Clave de rastreo, normalmente usada en SPEI o transferencias.",
    referente: "Clave de rastreo",
    aliases: [/\bclave\s+de\s+rastreo\b/i, /\brastreo\b/i],
    pattern: TRACKING_PATTERN
  },
  {
    campo: "SPEI",
    categoria: "Comprobante / Referencias",
    descripcion: "Identificador o referencia de operacion SPEI.",
    referente: "SPEI",
    aliases: [/\bspei\b/i, /\bcep\b/i]
  },
  {
    campo: "Correo electronico",
    categoria: "Contacto / Identificacion",
    descripcion: "Correo electronico detectado en el documento.",
    referente: "Email",
    aliases: [/\bcorreo\s+electr[oó]nico\b/i, /\bemail\b/i, /\be-mail\b/i],
    pattern: EMAIL_PATTERN,
    inferPattern: true
  },
  {
    campo: "Telefono",
    categoria: "Contacto / Identificacion",
    descripcion: "Telefono detectado en el documento.",
    referente: "Telefono",
    aliases: [/\btel[eé]fono\b/i, /\btel\b/i, /\bcelular\b/i],
    pattern: PHONE_PATTERN
  },
  {
    campo: "Codigo postal",
    categoria: "Direccion / Ubicacion",
    descripcion: "Codigo postal detectado.",
    referente: "Codigo postal",
    aliases: [/\bc[oó]digo\s+postal\b/i, /\bc\.?p\.?\b/i, /\bcp\b/i],
    pattern: ZIP_PATTERN
  },
  {
    campo: "Domicilio",
    categoria: "Direccion / Ubicacion",
    descripcion: "Domicilio o direccion detectada.",
    referente: "Domicilio",
    aliases: [/\bdomicilio\b/i, /\bdirecci[oó]n\b/i]
  },
  {
    campo: "Ciudad",
    categoria: "Direccion / Ubicacion",
    descripcion: "Ciudad o municipio detectado.",
    referente: "Ciudad",
    aliases: [/\bciudad\b/i, /\bmunicipio\b/i, /\blocalidad\b/i]
  },
  {
    campo: "Estado",
    categoria: "Direccion / Ubicacion",
    descripcion: "Estado o entidad federativa detectada.",
    referente: "Estado",
    aliases: [/\bestado\b/i, /\bentidad\b/i],
    reject: /\bestado\s+de\s+cuenta\b/i
  }
);

function orderedCells(record) {
  return Object.keys(record)
    .filter((key) => key.startsWith("Columna_"))
    .sort((a, b) => Number(a.split("_")[1]) - Number(b.split("_")[1]))
    .map((key) => String(record[key] ?? "").trim())
    .filter(Boolean);
}

function orderedCellDetails(record) {
  const meta = record.__cellMeta;
  return Object.keys(record)
    .filter((key) => key.startsWith("Columna_"))
    .sort((a, b) => Number(a.split("_")[1]) - Number(b.split("_")[1]))
    .map((key, index) => ({
      text: String(record[key] ?? "").trim(),
      x: meta?.[index]?.x ?? record[`__x_${index + 1}`] ?? null,
      end: meta?.[index]?.end ?? null
    }))
    .filter((item) => item.text);
}

function parseAmount(value) {
  const text = String(value ?? "").trim();
  if (!AMOUNT_PATTERN.test(text)) return null;
  const negative = text.startsWith("(") && text.endsWith(")") || text.includes("-");
  let cleaned = text.replace(/[$+()\s-]/g, "");
  if (!/\d/.test(cleaned)) return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    cleaned = cleaned.replaceAll(thousandsSeparator, "");
    if (decimalSeparator === ",") cleaned = cleaned.replace(",", ".");
  } else if (lastComma >= 0) {
    const decimals = cleaned.length - lastComma - 1;
    cleaned = decimals === 2 ? cleaned.replace(",", ".") : cleaned.replaceAll(",", "");
  } else if (lastDot >= 0) {
    const decimals = cleaned.length - lastDot - 1;
    if (decimals !== 2 && /^\d{1,3}(?:\.\d{3})+$/.test(cleaned)) cleaned = cleaned.replaceAll(".", "");
  }
  const number = Number(cleaned);
  if (!Number.isFinite(number)) return null;
  return negative ? -number : number;
}

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeSearchText(value) {
  return compactText(value)
    .replace(/\u00c3\u00a1/gi, "a")
    .replace(/\u00c3\u00a9/gi, "e")
    .replace(/\u00c3\u00ad/gi, "i")
    .replace(/\u00c3\u00b3/gi, "o")
    .replace(/\u00c3\u00ba/gi, "u")
    .replace(/\u00c3\u00bc/gi, "u")
    .replace(/\u00c3\u00b1/gi, "n")
    .replace(/\ufffd/g, "e")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\?/g, "e")
    .toLowerCase();
}

function afterLabel(text, alias) {
  const match = alias.exec(text);
  if (!match) return "";
  return compactText(text.slice(match.index + match[0].length).replace(/^[\s:;=\-|–—]+/, ""));
}

function parseAmountInside(text) {
  const matches = [...compactText(text).matchAll(MONEY_TOKEN_PATTERN)];
  for (const match of matches) {
    const value = parseAmount(match[0]);
    if (value !== null) return value;
  }
  return null;
}

function valueForDefinition(text, definition) {
  const clean = compactText(text);
  if (!clean) return null;
  if (definition.amount) return parseAmountInside(clean);
  if (definition.pattern) {
    const match = clean.match(definition.pattern);
    return match ? match[0] : null;
  }
  if (definition.minLength && clean.length < definition.minLength) return null;
  return clean.replace(/^[\s:;=\-|–—]+/, "").trim() || null;
}

function validationForDefinition(definition, value, generic = false) {
  if (generic) return "Etiqueta original conservada; revisar si requiere regla especifica.";
  if (definition.amount) return Number.isFinite(value) ? "Importe convertido a numero." : "Importe por revisar.";
  if (definition.pattern) return definition.pattern.test(String(value)) ? "Formato reconocido." : "Formato por revisar.";
  return "Etiqueta reconocida por diccionario.";
}

function extractLabeledValue(cells, rowText, nextRowText, definition) {
  if (definition.reject?.test(rowText)) return null;
  for (const alias of definition.aliases) {
    if (!alias.test(rowText)) continue;

    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index];
      if (!alias.test(cell)) continue;
      const sameCellValue = valueForDefinition(afterLabel(cell, alias), definition);
      if (sameCellValue !== null) return { value: sameCellValue, confidence: "Alta", validation: validationForDefinition(definition, sameCellValue), sourceText: rowText };

      const nextCellValue = valueForDefinition(cells[index + 1], definition);
      if (nextCellValue !== null) return { value: nextCellValue, confidence: "Alta", validation: validationForDefinition(definition, nextCellValue), sourceText: rowText };

      const rightSide = compactText(cells.slice(index + 1).join(" "));
      const rightSideValue = valueForDefinition(rightSide, definition);
      if (rightSideValue !== null) return { value: rightSideValue, confidence: "Alta", validation: validationForDefinition(definition, rightSideValue), sourceText: rowText };
    }

    const rowValue = valueForDefinition(afterLabel(rowText, alias), definition);
    if (rowValue !== null) return { value: rowValue, confidence: "Alta", validation: validationForDefinition(definition, rowValue), sourceText: rowText };

    const nextRowValue = valueForDefinition(nextRowText, definition);
    if (nextRowValue !== null) {
      return { value: nextRowValue, confidence: "Media", validation: validationForDefinition(definition, nextRowValue), sourceText: `${rowText} | ${nextRowText}` };
    }
  }
  return null;
}

function normalizeGenericLabel(label) {
  return compactText(label)
    .replace(/^[\s:;=\-|–—]+|[\s:;=\-|–—]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function looksLikeLabel(text) {
  const label = normalizeGenericLabel(text);
  if (label.length < 3 || label.length > 60) return false;
  if (AMOUNT_PATTERN.test(label) || DATE_TIME_PATTERN.test(label) || UUID_PATTERN.test(label)) return false;
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(label)) return false;
  const words = label.split(/\s+/);
  return words.length <= 8;
}

function looksLikeStandaloneValue(text) {
  const value = compactText(text);
  if (!value || value.length > 180) return false;
  if (/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/.test(value) === false) return false;
  return true;
}

function genericDefinition(label) {
  const cleanLabel = normalizeGenericLabel(label);
  return {
    campo: cleanLabel,
    categoria: "Dato detectado / Etiqueta original",
    descripcion: "Campo detectado desde una etiqueta visible en el PDF. La app conserva el nombre original para evitar inventar una descripcion incorrecta.",
    referente: `Etiqueta original: ${cleanLabel}`
  };
}

function extractGenericLabeledValue(cells, rowText, nextRowText) {
  for (const cell of cells) {
    const parts = cell.split(/\s*[:=]\s*/);
    if (parts.length >= 2) {
      const label = normalizeGenericLabel(parts.shift());
      const value = compactText(parts.join(":"));
      if (looksLikeLabel(label) && looksLikeStandaloneValue(value)) {
        return {
          definition: genericDefinition(label),
          detected: {
            value,
            confidence: "Media",
            validation: "Etiqueta y valor detectados en la misma celda.",
            sourceText: rowText
          }
        };
      }
    }
  }

  if (cells.length >= 2) {
    const label = normalizeGenericLabel(cells[0]);
    const value = compactText(cells.slice(1).join(" "));
    if (looksLikeLabel(label) && looksLikeStandaloneValue(value)) {
      return {
        definition: genericDefinition(label),
        detected: {
          value,
          confidence: "Media",
          validation: "Etiqueta detectada en una celda y valor a la derecha.",
          sourceText: rowText
        }
      };
    }
  }

  const rowMatch = rowText.match(/^(.{3,60}?)(?:\s*[:=|–—-]\s+|\s+[:=|–—-]\s*)(.{1,180})$/);
  if (rowMatch) {
    const label = normalizeGenericLabel(rowMatch[1]);
    const value = compactText(rowMatch[2]);
    if (looksLikeLabel(label) && looksLikeStandaloneValue(value)) {
      return {
        definition: genericDefinition(label),
        detected: {
          value,
          confidence: "Media",
          validation: "Etiqueta y valor detectados en la misma linea.",
          sourceText: rowText
        }
      };
    }
  }

  if (cells.length === 1 && looksLikeLabel(cells[0]) && looksLikeStandaloneValue(nextRowText)) {
    return {
      definition: genericDefinition(cells[0]),
      detected: {
        value: compactText(nextRowText),
        confidence: "Baja",
        validation: "Valor tomado de la siguiente linea; revisar.",
        sourceText: `${rowText} | ${nextRowText}`
      }
    };
  }

  return null;
}

function extractGenericLabeledValues(cells, rowText, nextRowText) {
  const found = [];
  const seenLabels = new Set();
  const add = (label, value, confidence, validation, sourceText) => {
    const cleanLabel = normalizeGenericLabel(label);
    const cleanValue = compactText(value);
    const key = `${cleanLabel.toLowerCase()}|${cleanValue.toLowerCase()}`;
    if (!looksLikeLabel(cleanLabel) || !looksLikeStandaloneValue(cleanValue) || seenLabels.has(key)) return;
    seenLabels.add(key);
    found.push({
      definition: genericDefinition(cleanLabel),
      detected: { value: cleanValue, confidence, validation, sourceText }
    });
  };

  for (const cell of cells) {
    const parts = cell.split(/\s*[:=]\s*/);
    if (parts.length >= 2) add(parts.shift(), parts.join(":"), "Media", "Etiqueta y valor detectados en la misma celda.", rowText);
  }

  for (let index = 0; index < cells.length - 1; index += 1) {
    const label = cells[index];
    const value = cells[index + 1];
    if (looksLikeLabel(label) && !looksLikeLabel(value)) {
      add(label, value, "Media", "Etiqueta detectada en una celda y valor a la derecha.", rowText);
      index += 1;
    }
  }

  const rowMatch = rowText.match(/^(.{3,60}?)(?:\s*[:=|–—-]\s+|\s+[:=|–—-]\s*)(.{1,180})$/);
  if (rowMatch) add(rowMatch[1], rowMatch[2], "Media", "Etiqueta y valor detectados en la misma linea.", rowText);

  if (!found.length && cells.length === 1 && looksLikeLabel(cells[0]) && looksLikeStandaloneValue(nextRowText)) {
    add(cells[0], nextRowText, "Baja", "Valor tomado de la siguiente linea; revisar.", `${rowText} | ${nextRowText}`);
  }

  return found;
}

function unclassifiedDefinition(record) {
  const field = `Texto pagina ${record.Pagina || 1} fila ${record.Fila || ""}`.trim();
  return {
    campo: field,
    categoria: "Dato detectado / Pendiente de clasificar",
    descripcion: "Texto conservado porque pertenece a una pagina con contexto fiscal o bancario, pero no trae una etiqueta clara.",
    referente: "Texto original pendiente de clasificar"
  };
}

function fieldRecord(record, definition, detected) {
  return {
    Archivo: record.Archivo,
    Pagina: record.Pagina,
    Fila: record.Fila,
    Categoria: definition.categoria,
    Campo: definition.campo,
    Valor: detected.value,
    Descripcion: definition.descripcion,
    Referente: definition.referente,
    Confianza: detected.confidence,
    Validacion: detected.validation || validationForDefinition(definition, detected.value),
    Texto_origen: compactText(detected.sourceText).slice(0, 500)
  };
}

function pushField(fields, seen, record, definition, detected) {
  const key = `${record.Archivo || ""}|${definition.campo}|${String(detected.value).toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  fields.push(fieldRecord(record, definition, detected));
}

function isDateLike(value) {
  return DATE_PATTERN.test(String(value ?? ""));
}

function normalizeHeader(cells, amountCount) {
  const dates = cells.filter(isDateLike).map((cell) => cell.match(DATE_PATTERN)[0]);
  if (dates.length >= 2) return dates;
  return Array.from({ length: amountCount }, (_, index) => `Periodo_${index + 1}`);
}

function rowType(label) {
  if (/^total\b/i.test(label)) return "Total";
  if (/subtotal/i.test(label)) return "Subtotal";
  return "Detalle";
}

function tableName(section, archivo, pagina) {
  const base = section || `Pagina ${pagina}`;
  return `${base} - ${archivo}`.slice(0, 80);
}

export function buildIdentifiedFields(records) {
  const orderedRecords = [...records].sort((a, b) => {
    const fileCompare = String(a.Archivo || "").localeCompare(String(b.Archivo || ""), "es");
    if (fileCompare) return fileCompare;
    return Number(a.Pagina || 0) - Number(b.Pagina || 0) || Number(a.Fila || 0) - Number(b.Fila || 0);
  });
  const fields = [];
  const seen = new Set();
  const pageTexts = new Map();

  orderedRecords.forEach((record) => {
    const key = `${record.Archivo || "archivo"}::${record.Pagina || 1}`;
    const rowText = compactText(orderedCells(record).join(" "));
    pageTexts.set(key, compactText(`${pageTexts.get(key) || ""} ${rowText}`));
  });

  orderedRecords.forEach((record, index) => {
    const cells = orderedCells(record);
    const rowText = compactText(cells.join(" "));
    if (!rowText) return;
    const pageKey = `${record.Archivo || "archivo"}::${record.Pagina || 1}`;
    if (!DOCUMENT_CONTEXT_PATTERN.test(pageTexts.get(pageKey) || rowText)) return;
    const nextRecord = orderedRecords[index + 1];
    const nextRowText = nextRecord?.Archivo === record.Archivo && nextRecord?.Pagina === record.Pagina
      ? compactText(orderedCells(nextRecord).join(" "))
      : "";

    let matchedKnownField = false;
    for (const definition of FIELD_DEFINITIONS) {
      const detected = extractLabeledValue(cells, rowText, nextRowText, definition);
      if (detected) {
        pushField(fields, seen, record, definition, detected);
        matchedKnownField = true;
        continue;
      }
      if (definition.inferPattern && !definition.reject?.test(rowText)) {
        const value = valueForDefinition(rowText, definition);
        if (value !== null) {
          pushField(fields, seen, record, definition, {
            value,
            confidence: "Media",
            validation: validationForDefinition(definition, value),
            sourceText: rowText
          });
          matchedKnownField = true;
        }
      }
    }
    if (!matchedKnownField) {
      const generics = extractGenericLabeledValues(cells, rowText, nextRowText);
      generics.forEach((generic) => pushField(fields, seen, record, generic.definition, generic.detected));
      if (!generics.length && rowText.length >= 3) {
        pushField(fields, seen, record, unclassifiedDefinition(record), {
          value: rowText,
          confidence: "Baja",
          validation: "Texto conservado sin clasificacion automatica; revisar.",
          sourceText: rowText
        });
      }
    }
  });

  return fields;
}

function recordKey(record) {
  return `${record.Archivo || ""}::${record.Pagina || ""}::${record.Fila || ""}`;
}

function rowText(record) {
  return compactText(orderedCells(record).join(" "));
}

function extractDate(text) {
  const match = compactText(text).match(DATE_TIME_PATTERN) || compactText(text).match(DATE_PATTERN) || compactText(text).match(MONTH_DATE_PATTERN);
  return match ? match[0] : "";
}

function isTableHeader(text) {
  const normalized = normalizeSearchText(text);
  const hasDateHeader = /\b(fecha|dia|operacion|movimiento)\b/i.test(normalized);
  const hasDescriptionHeader = /\b(descripcion|concepto|detalle|nombre|movimiento|operacion)\b/i.test(normalized)
      || /\b(transaccion|autorizacion|aplicacion)\b/i.test(normalized);
  const hasAmountHeader = /\b(cargos?|retiros?|abonos?|depositos?|creditos?|debitos?|importe|monto|tasa|compra|parcialidad|saldo|balance)\b/i.test(normalized);
  return hasDateHeader && hasDescriptionHeader && hasAmountHeader;
}

function columnRole(cell) {
  const normalized = normalizeSearchText(cell);
  if (/\b(fecha|dia|f\.\s*operacion|operacion|aplicacion|fecha\s+valor|transaccion)\b/i.test(normalized)) return "fecha";
  if (/\b(descripcion|concepto|detalle|movimiento|operacion|nombre|comercio|establecimiento)\b/i.test(normalized)) return "descripcion";
  if (/\b(abono|abonos|deposito|depositos|credito|creditos|haber|ingreso|ingresos|entrada|entradas)\b/i.test(normalized)) return "abono";
  if (/\b(cargo|cargos|retiro|retiros|debito|debitos|debe|egreso|egresos|salida|salidas|compra|compras|disposicion|disposiciones)\b/i.test(normalized)) return "cargo";
  if (/\b(saldo|balance|saldo\s+actual|saldo\s+final)\b/i.test(normalized)) return "saldo";
  if (/\b(importe|monto|cantidad|valor)\b/i.test(normalized)) return "importe";
  if (/\b(referencia|autorizacion|folio|rastreo)\b/i.test(normalized)) return "referencia";
  return "";
}

function movementHeaderContext(record) {
  const cells = orderedCells(record);
  const text = compactText(cells.join(" "));
  if (!isTableHeader(text)) return null;
  const roles = cells.map(columnRole);
  const hasDate = roles.includes("fecha") || /\bfecha\b/i.test(normalizeSearchText(text));
  const hasDescription = roles.includes("descripcion") || /\b(concepto|descripcion|detalle|movimiento)\b/i.test(normalizeSearchText(text));
  const hasMovementAmount = roles.some((role) => ["cargo", "abono", "importe"].includes(role));
  if (!hasDate || !hasDescription || !hasMovementAmount) return null;
  return {
    roles,
    hasSaldo: roles.includes("saldo") || /\bsaldo|balance\b/i.test(normalizeSearchText(text)),
    lastDate: ""
  };
}

function amountCellIndexes(cells) {
  return cells
    .map((cell, index) => ({ index, value: parseAmount(cell), text: cell }))
    .filter((item) => item.value !== null);
}

function amountItemsForRow(cells, text) {
  const directAmounts = amountCellIndexes(cells);
  if (directAmounts.length) return directAmounts;
  const found = [];
  for (const match of compactText(text).matchAll(MONEY_TOKEN_PATTERN)) {
    const value = parseAmount(match[0]);
    if (value !== null) found.push({ index: -1, value, text: match[0] });
  }
  return found;
}

function roleForCell(cells, context, index) {
  const roles = context?.roles || [];
  const firstCellHasDateAndText = roles[0] === "fecha"
    && roles[1] === "descripcion"
    && extractDate(cells[0] || "")
    && sanitizeFinalDescription(cells[0] || "") !== "Movimiento";
  const secondCellStartsAmounts = parseAmount(cells[1] || "") !== null;
  if (firstCellHasDateAndText && secondCellStartsAmounts) {
    if (index === 0) return "descripcion";
    return roles[index + 1] || roles[index] || "";
  }
  return roles[index] || "";
}

function movementAmountFromContext(amounts, context, text, cells = []) {
  if (!amounts.length) return null;
  const candidates = amounts.map((item, order) => ({
    ...item,
    order,
    role: item.index >= 0 ? roleForCell(cells, context, item.index) : ""
  }));
  const explicit = candidates.find((item) => item.role === "cargo" || item.role === "abono");
  if (explicit) return explicit;
  const nonSaldo = candidates.filter((item) => item.role !== "saldo");
  const usable = context?.hasSaldo && nonSaldo.length > 1 ? nonSaldo.slice(0, -1) : nonSaldo;
  return usable[0] || nonSaldo[0] || candidates[0];
}

function amountText(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Math.abs(number);
}

function movementKind(text) {
  const clean = normalizeSearchText(text);
  if (/\b(abono|deposito|ingreso|nomina|recibido\w*|reembolso|devolucion|bonificacion|cashback|rendimiento|intereses?\s+ganad[oa]s?|pago\s+(?:tdc|tarjeta|recibido)|bmovil\.?pago|credito\s+disponible|saldo\s+a\s+favor|generados)\b/i.test(clean)) return "abono";
  if (/\b(cargo|retiro|egreso|compra|cobro|comision|interes|iva|impuesto|saldo|compras|disposiciones|pago\s+minimo|pago\s+para\s+no\s+generar|pago(?!\s+(?:tdc|tarjeta|recibido))|spei\s+enviado\w*|transferencia\s+enviada|enviado\w*|domiciliacion|cajero|atm|debito|cheque|servicio|utilizados|vencidos|limite\s+de\s+credito)\b/i.test(clean)) return "cargo";
  return "";
}

const NON_FINANCIAL_FINAL_PATTERN = /\b(folio\s*fiscal|uuid|rfc|cliente|titular|tarjeta|cuenta\s+clabe|clabe|n[uú]mero\s+de\s+cuenta|numero\s+de\s+cuenta|banco\b|sucursal|domicilio|direcci[oó]n|correo|email|tel[eé]fono|ciudad|estado|certificado|sello|cadena\s+original|beneficiario|ordenante|referencia|autorizaci[oó]n|rastreo|spei)\b/i;
const FINANCIAL_FINAL_PATTERN = /\b(fecha\s+de\s+corte|fecha\s+l[ií]mite|cr[eé]dito\s+disponible|l[ií]mite\s+de\s+cr[eé]dito|saldo|cargos?|abonos?|inter[eé]s|intereses|comisi[oó]n|comisiones|iva|impuesto|pago\s+m[ií]nimo|pago\s+para\s+no\s+generar|pago\s+tdc|pagos?:|compras?|compra|retiro|dep[oó]sito|deposito|disposiciones|parcialidad|capital|cat|gat|tasa|total|subtotal|importe|monto|rendimiento|sobregiro|saldo\s+a\s+favor|generados|utilizados|vencidos)\b/i;
const NON_FINANCIAL_FINAL_NORMALIZED_PATTERN = /\b(folio\s*fiscal|uuid|rfc|cliente|titular|tarjeta|cuenta\s+clabe|clabe|numero\s+de\s+cuenta|banco\b|sucursal|domicilio|direccion|correo|email|telefono|ciudad|estado|cfdi|certificado|certificacion|timbrado|sat\b|sello|cadena\s+original|beneficiario|ordenante|referencia|autorizacion|rastreo|spei)\b/i;
const FINANCIAL_FINAL_NORMALIZED_PATTERN = /\b(fecha\s+de\s+corte|fecha\s+limite|credito\s+disponible|limite\s+de\s+credito|saldo|cargos?|abonos?|interes|intereses|comision|comisiones|iva|impuesto|pago\s+minimo|pago\s+para\s+no\s+generar|pago\s+tdc|pagos?:|compras?|compra|retiro|deposito|disposiciones|parcialidad|capital|cat|gat|tasa|total|subtotal|importe|monto|rendimiento|sobregiro|saldo\s+a\s+favor|generados|utilizados|vencidos)\b/i;
const FINAL_NOISE_NORMALIZED_PATTERN = /\b(tiene\s+\d+\s+dias\s+naturales|comision\s+nacional|proteccion\s+y\s+defensa|usuarios|condusef|une\b|unidad\s+especializada|ipab\b|buro\s+de\s+credito|aclaraciones?|reclamaciones?|atencion\s+a\s+clientes|mensaje\s+importante|aviso\s+(?:importante|legal)|terminos\s+y\s+condiciones|contrato|glosario\s+de\s+abreviaturas|cuadro\s+resumen|grafico\s+de\s+movimientos|estado\s+de\s+cuenta\s+de\s+apartados|apartados\s+vigentes|concepto\s+cantidad\s+porcentaje|en\s+caso\s+de\s+que|dia\s+inhabil|pagos?\s+mensuales|considerando\s+que|no\s+se\s+realicen|hechos\s+que\s+generan|leyendas?\s+de\s+advertencia|beneficios?\s+(financieros|de\s+seguridad)|seguro\s+de|sin\s+costo|para\s+mayor\s+informacion|consulta\s+www|www\.|pueden\s+aumentar|incumplir\s+tus\s+obligaciones|contratar\s+creditos|pagar\s+solo\s+el\s+minimo|registro\s+federal\s+de\s+contribuyentes|impuesto\s+al\s+valor\s+agregado|clave\s+bancaria\s+estandarizada|compra\s+digital|compra\s+con\s+tarjeta\s+fisica|tasa\s+de\s+interes\s+interbancaria|costo\s+anual\s+total|plan\s+de\s+pagos\s+fijos|programa\s+de\s+recompensas|informe\s+de\s+puntos|puntos\s+bbva|saldo\s+anterior\s+\d+\s+generados|total\s+de\s+movimientos|totales\s+de\s+sus\s+cargos|total\s+importe|total\s+movimientos|total\s+de\s+cargos|total\s+cargos|total\s+de\s+abonos|total\s+abonos|total\s+importes|total\s+de\s+interes\s+total\s+de\s+parcialidades|total\s+saldo\s+actual|incluido\s+en|resumen\s+de\s+sus\s+cargos|fecha\s+nombre\s+de\s+la\s+tasa|transaccion\s+promocion\s+interes|promocion\s+interes\s+inicial)\b/i;
const FINAL_METRIC_NORMALIZED_PATTERN = /\b(cat|gat|tasa)\b.*\d+(?:\.\d+)?\s*%/i;

function isFinalNoiseText(text) {
  const normalized = normalizeSearchText(text);
  if (!normalized) return false;
  if (UUID_PATTERN.test(text) || /\|/.test(text)) return true;
  if (FINAL_NOISE_NORMALIZED_PATTERN.test(normalized)) return true;
  return normalized.split(/\s+/).length > 18
    && /\b(puede|puedes|consulta|condiciones|considerando|obligaciones|adheriste|recordamos)\b/i.test(normalized)
    && !DATE_PATTERN.test(text)
    && amountCellIndexes([text]).length === 0;
}

function isFinancialFinalText(text) {
  const clean = compactText(text);
  const normalized = normalizeSearchText(clean);
  if (!clean) return false;
  if (isFinalNoiseText(clean)) return false;
  if ((NON_FINANCIAL_FINAL_PATTERN.test(clean) || NON_FINANCIAL_FINAL_NORMALIZED_PATTERN.test(normalized))
    && !(FINANCIAL_FINAL_PATTERN.test(clean) || FINANCIAL_FINAL_NORMALIZED_PATTERN.test(normalized))) return false;
  return FINANCIAL_FINAL_PATTERN.test(clean)
    || FINANCIAL_FINAL_NORMALIZED_PATTERN.test(normalized)
    || (extractDate(clean) && parseAmountInside(clean) !== null);
}

function isFinancialFinalField(field) {
  const text = `${field.Campo || ""} ${field.Categoria || ""} ${field.Referente || ""} ${field.Texto_origen || ""}`;
  const normalized = normalizeSearchText(text);
  if (isFinalNoiseText(text)) return false;
  if ((NON_FINANCIAL_FINAL_PATTERN.test(text) || NON_FINANCIAL_FINAL_NORMALIZED_PATTERN.test(normalized))
    && !(FINANCIAL_FINAL_PATTERN.test(text) || FINANCIAL_FINAL_NORMALIZED_PATTERN.test(normalized))) return false;
  return FINANCIAL_FINAL_PATTERN.test(text) || FINANCIAL_FINAL_NORMALIZED_PATTERN.test(normalized);
}

function hasFinalMoney(row) {
  return row.CARGOS !== "" || row.ABONOS !== "";
}

function isFinalMetricRow(row, sourceText = "") {
  return FINAL_METRIC_NORMALIZED_PATTERN.test(normalizeSearchText(`${row.DESCRIPCION || ""} ${sourceText}`));
}

function shouldKeepFourColumnRow(row, sourceText = "") {
  if (!row) return false;
  const text = `${row.DESCRIPCION || ""} ${sourceText || ""}`;
  if (isFinalNoiseText(text)) return false;
  return hasFinalMoney(row) || isFinalMetricRow(row, sourceText);
}

function amountSide(text, value, rawAmount = "") {
  const kind = movementKind(text);
  if (kind === "abono") return "abono";
  if (kind === "cargo") return "cargo";
  const raw = String(rawAmount || "");
  if (/^\s*\+|\+\s*\$/.test(raw) || /\bcr(?:edito)?\b/i.test(raw)) return "abono";
  if (/^\s*-|-\s*\$|-\s*$|\bdb|debito\b/i.test(raw)) return "cargo";
  return Number(value) < 0 ? "cargo" : "cargo";
}

function amountSideFromPdfX(x) {
  const position = Number(x);
  if (!Number.isFinite(position)) return "";
  if (position >= 410 && position < 520) return "abono";
  if (position >= 340 && position < 410) return "cargo";
  return "";
}

function movementLineMatch(text) {
  const match = compactText(text).match(BANK_MOVEMENT_ROW_PATTERN);
  if (!match) return null;
  const description = formatMovementBaseDescription(sanitizeFinalDescription(match[3]));
  if (!description || description === "Movimiento") return null;
  return { date: match[1], liquidDate: match[2], description };
}

function formatMovementBaseDescription(description) {
  return compactText(description)
    .replace(/\b(SPEI\s+RECIBIDO)(?=[A-ZÁÉÍÓÚÑ])/gi, "$1 ")
    .replace(/\b(SPEI\s+ENVIADO)(?=[A-ZÁÉÍÓÚÑ])/gi, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeFinalDescription(description) {
  const cleaned = compactText(description)
    .replace(DATE_TIME_PATTERN, " ")
    .replace(DATE_PATTERN, " ")
    .replace(MONTH_DATE_PATTERN, " ")
    .replace(CARD_PATTERN, " ")
    .replace(/\*{2,}\d{3,4}/g, " ")
    .replace(/\b(?:ref(?:erencia)?|aut(?:orizacion)?|num(?:ero)?\s+autorizacion)\s*[:#-]?\s*[A-Z0-9*-]*\d[A-Z0-9*-]{3,}\b/gi, " ")
    .replace(/\b(?:rfc|clabe|cuenta|tarjeta)\s*[:#-]?\s*[A-Z0-9*-]*\d[A-Z0-9*-]{3,}\b/gi, " ")
    .replace(/\b(?:saldo|balance)(?:\s+(?:actual|final|disponible|nuevo))?\s*$/i, " ")
    .replace(MONEY_TOKEN_PATTERN, " ")
    .replace(/\$+/g, " ")
    .replace(/(^|\s)[+-](?=\s|$)/g, " ")
    .replace(/\s*[-|:;]+\s*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Movimiento";
}

function cleanDescription(cells, omittedIndexes, fallback) {
  const description = cells
    .filter((_, index) => !omittedIndexes.has(index))
    .join(" ")
    .replace(DATE_TIME_PATTERN, "")
    .replace(DATE_PATTERN, "")
    .replace(MONTH_DATE_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
  return sanitizeFinalDescription(description || fallback || "Dato extraido");
}

function descriptionFromHeaderContext(cells, context, text) {
  const descriptionCells = [];
  cells.forEach((cell, index) => {
    const role = roleForCell(cells, context, index);
    if (["fecha", "cargo", "abono", "importe", "saldo", "referencia"].includes(role)) return;
    if (parseAmount(cell) !== null || extractDate(cell)) return;
    descriptionCells.push(cell);
  });
  return sanitizeFinalDescription(descriptionCells.join(" ") || text);
}

function rowToFourColumnsWithContext(record, context) {
  if (!context) return null;
  const cells = orderedCells(record);
  const text = compactText(cells.join(" "));
  if (!text || isTableHeader(text) || isFinalNoiseText(text)) return null;

  const amounts = amountItemsForRow(cells, text);
  const movementAmount = movementAmountFromContext(amounts, context, text, cells);
  if (!movementAmount) return null;

  const currentDate = extractDate(text);
  const normalized = normalizeSearchText(text);
  const isLikelySummary = /\b(total|subtotal|resumen|saldo\s+(?:inicial|final|actual|anterior|promedio)|intereses?\s+efectivamente|comisiones?\s+efectivamente|pago\s+minimo|pago\s+para\s+no\s+generar)\b/i.test(normalized);
  if (!currentDate && isLikelySummary) return null;
  const date = currentDate || context.lastDate || "";
  let cargo = "";
  let abono = "";
  let side = movementAmount.role === "cargo" || movementAmount.role === "abono"
    ? movementAmount.role
    : amountSide(text, movementAmount.value, movementAmount.text);
  if (movementKind(text) === "abono") side = "abono";
  if (movementKind(text) === "cargo") side = "cargo";
  if (side === "abono") abono = amountText(movementAmount.value);
  else cargo = amountText(movementAmount.value);

  let description = descriptionFromHeaderContext(cells, context, text);
  amounts.forEach((item) => {
    description = sanitizeFinalDescription(description.replace(item.text, " "));
  });

  const row = {
    FECHA: date,
    DESCRIPCION: description,
    CARGOS: cargo,
    ABONOS: abono
  };
  return shouldKeepFourColumnRow(row, text) ? row : null;
}

function bankMovementRowToFourColumns(record) {
  const details = orderedCellDetails(record);
  const cells = details.map((cell) => cell.text);
  const text = compactText(cells.join(" "));
  if (!text || isFinalNoiseText(text)) return null;
  const movement = movementLineMatch(cells[0] || text);
  if (!movement) return null;
  const amounts = details.slice(1)
    .map((cell, index) => ({ index: index + 1, value: parseAmount(cell.text), text: cell.text, x: cell.x }))
    .filter((item) => item.value !== null);
  const amount = amounts[0];
  if (!amount) return null;

  const side = amountSideFromPdfX(amount.x) || amountSide(`${movement.description} ${text}`, amount.value, amount.text);
  const row = {
    FECHA: movement.date,
    DESCRIPCION: movement.description,
    CARGOS: side === "abono" ? "" : amountText(amount.value),
    ABONOS: side === "abono" ? amountText(amount.value) : ""
  };
  return shouldKeepFourColumnRow(row, text) ? row : null;
}

const MOVEMENT_DETAIL_NOISE_PATTERN = /\b(estado\s+de\s+cuenta|libret\s*o\s*n|pagina\s+\d+|no\.\s+de\s+(?:cuenta|cliente)|informacion\s+financiera|detalle\s+de\s+movimientos|total\s+de\s+movimientos|la\s+gat\s+real|bbva\s+mexico|grupo\s+financiero|paseo\s+de\s+la\s+reforma|regimen\s+fiscal|este\s+documento\s+es\s+una\s+representacion|estimado\s+cliente|le\s+informamos|folio\s+nombre\s+apartado|sello\s+(?:digital|sat)|cadena\s+original|glosario|abreviaturas)\b/i;
const MOVEMENT_DETAIL_ALLOWED_PATTERN = /\b(referencia|folio|bnet|mban|acusecep|cep\d|cpo\d|inbu|transfer\s+to|mercado\*pago)\b/i;

function movementDetailText(record, previousDetailCount = 0) {
  const cells = orderedCells(record);
  const text = compactText(cells.join(" "));
  if (!text) return "";
  if (movementLineMatch(cells[0] || text) || isTableHeader(text) || movementHeaderContext(record)) return "";
  const normalized = normalizeSearchText(text);
  if (MOVEMENT_DETAIL_NOISE_PATTERN.test(normalized) || isFinalNoiseText(text)) return "";
  if (/^\$?\s*\d+(?:[.,]\d+)?\s*$/.test(text)) return "";
  if (MOVEMENT_DETAIL_ALLOWED_PATTERN.test(normalized)) return text;
  if (MONEY_TOKEN_PATTERN.test(text)) {
    MONEY_TOKEN_PATTERN.lastIndex = 0;
    return "";
  }
  MONEY_TOKEN_PATTERN.lastIndex = 0;
  if (previousDetailCount > 0 && /^\d{12,22}$/.test(text)) return text;
  if (previousDetailCount > 0 && /^[A-Z0-9X]{10,45}$/i.test(text) && /\d/.test(text)) return text;
  const words = text.split(/\s+/).filter(Boolean);
  const hasCompanySuffix = /\b(?:S\.?A\.?|SA|C\.?V\.?|CV)\b/i.test(text);
  const shortWords = words.filter((word) => normalizeSearchText(word).length <= 3).length;
  const looksLikeName = previousDetailCount > 0
    && (words.length >= 2 || /^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+$/.test(text))
    && words.length <= 5
    && (hasCompanySuffix || shortWords <= 1 || /[a-záéíóúüñ]/.test(text))
    && !/\d|[:=|/@]/.test(text)
    && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(text);
  if (looksLikeName) return text;
  return "";
}

function labelMovementDetail(detail) {
  const clean = compactText(detail)
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  if (/^(?:concepto|referencia|clave|tercero):/i.test(clean)) return clean;

  const referenceMatch = clean.match(/^(.*?)(?:\s+Referencia\s+(.+))$/i);
  if (referenceMatch) {
    const concept = compactText(referenceMatch[1]);
    const reference = compactText(referenceMatch[2]);
    return [
      concept ? `Concepto: ${concept}` : "",
      reference ? `Referencia: ${reference}` : ""
    ].filter(Boolean).join(" | ");
  }

  if (/^(?:MBAN|ACUSECEP|CEP|CPO|INBU)[A-Z0-9]*$/i.test(clean)) return `Clave: ${clean}`;
  if (/^(?:\d{12,22}|[A-Z0-9X]{10,45})$/i.test(clean) && /\d/.test(clean)) return `Clave: ${clean}`;
  if (/^(?:BNET|MAY\d|JUN\d|JUL\d|AGO\d|SEP\d|OCT\d|NOV\d|DIC\d|ENE\d|FEB\d|MAR\d|ABR\d|\d{5,}\w*)\b/i.test(clean)) {
    return `Concepto: ${clean}`;
  }
  return `Tercero: ${clean}`;
}

function appendMovementDetail(row, detail) {
  if (!row || !detail) return;
  const clean = labelMovementDetail(detail);
  if (!clean) return;
  const segments = clean.split(/\s+\|\s+/).map((segment) => segment.trim()).filter(Boolean);
  for (const segment of segments) {
    if (!row.DESCRIPCION.includes(segment)) {
      row.DESCRIPCION = `${row.DESCRIPCION} | ${segment}`;
    }
  }
}

function isMovementSectionBoundary(record) {
  const text = normalizeSearchText(rowText(record));
  return /\b(total\s+de\s+movimientos|total\s+importe|total\s+movimientos|estado\s+de\s+cuenta\s+de\s+apartados|cuadro\s+resumen|grafico\s+de\s+movimientos|glosario\s+de\s+abreviaturas|nombre\s+del\s+receptor|folio\s+fiscal|sello\s+digital|sello\s+sat|cadena\s+original|aviso\s+de\s+privacidad)\b/i.test(text);
}

function rawRecordToFourColumns(record) {
  const cells = orderedCells(record);
  const text = compactText(cells.join(" "));
  if (!text || isTableHeader(text)) return null;
  if (!isFinancialFinalText(text)) return null;

  const amounts = amountItemsForRow(cells, text);
  const omitted = new Set(amounts.filter((item) => item.index >= 0).map((item) => item.index));
  const date = extractDate(text);
  let cargo = "";
  let abono = "";

  if (amounts.length) {
    const side = amountSide(text, amounts[0].value, amounts[0].text);
    if (side === "cargo") {
      cargo = amountText(amounts[0].value);
    } else if (side === "abono") {
      abono = amountText(amounts[0].value);
    } else if (amounts.length >= 2) {
      cargo = amountText(amounts[0].value);
      abono = amountText(amounts[1].value);
    }
  }

  let description = cleanDescription(cells, omitted, text);
  amounts.filter((item) => item.index < 0).forEach((item) => {
    description = sanitizeFinalDescription(description.replace(item.text, " "));
  });
  if (!cargo && !abono && amounts.length) {
    description = `${description} | Importe: ${amounts.map((item) => item.text).join(" | ")}`;
  }

  const row = {
    FECHA: date,
    DESCRIPCION: description,
    CARGOS: cargo,
    ABONOS: abono
  };
  return shouldKeepFourColumnRow(row, text) ? row : null;
}

function fieldToFourColumns(field) {
  if (/^Dato detectado \//.test(field.Categoria || "")) return null;
  if (!isFinancialFinalField(field)) return null;
  const text = `${field.Campo || ""} ${field.Categoria || ""} ${field.Referente || ""} ${field.Texto_origen || ""}`;
  const value = typeof field.Valor === "number" ? field.Valor : parseAmount(String(field.Valor ?? ""));
  let cargo = "";
  let abono = "";
  let description = `${field.Campo}: ${field.Valor ?? ""}`.trim();

  if (value !== null) {
    const side = amountSide(text, value, String(field.Valor ?? ""));
    if (side === "cargo") cargo = amountText(value);
    if (side === "abono") abono = amountText(value);
    description = field.Campo;
  }

  const row = {
    FECHA: /^fecha\b/i.test(field.Campo || "") ? String(field.Valor ?? "") : extractDate(field.Texto_origen || ""),
    DESCRIPCION: description,
    CARGOS: cargo,
    ABONOS: abono
  };
  return shouldKeepFourColumnRow(row, field.Texto_origen || text) ? row : null;
}

export function buildFourColumnRows(records, identifiedFields = []) {
  const fieldsByRecord = new Map();
  identifiedFields.forEach((field) => {
    const key = recordKey(field);
    if (!fieldsByRecord.has(key)) fieldsByRecord.set(key, []);
    fieldsByRecord.get(key).push(field);
  });

  const rows = [];
  const contexts = new Map();
  let lastMovementRow = null;
  let lastMovementDetailCount = 0;
  const sortedRecords = [...records].sort((a, b) => {
    const fileCompare = String(a.Archivo || "").localeCompare(String(b.Archivo || ""), "es");
    if (fileCompare) return fileCompare;
    return Number(a.Pagina || 0) - Number(b.Pagina || 0) || Number(a.Fila || 0) - Number(b.Fila || 0);
  });
  const movementMode = sortedRecords.some((record) => {
    const cells = orderedCells(record);
    const text = compactText(cells.join(" "));
    return Boolean(movementLineMatch(cells[0] || text) || movementHeaderContext(record));
  });

  sortedRecords.forEach((record) => {
    const pageKey = `${record.Archivo || ""}::${record.Pagina || ""}`;
    const fileKey = `${record.Archivo || ""}::*`;
    const headerContext = movementHeaderContext(record);
    if (headerContext) {
      contexts.set(pageKey, headerContext);
      contexts.set(fileKey, headerContext);
      return;
    }

    const directMovementRow = bankMovementRowToFourColumns(record);
    if (directMovementRow) {
      rows.push(directMovementRow);
      lastMovementRow = directMovementRow;
      lastMovementDetailCount = 0;
      return;
    }

    const context = contexts.get(pageKey) || contexts.get(fileKey);
    const contextualRow = rowToFourColumnsWithContext(record, context);
    if (contextualRow) {
      if (context && contextualRow.FECHA) context.lastDate = contextualRow.FECHA;
      rows.push(contextualRow);
      lastMovementRow = contextualRow;
      lastMovementDetailCount = 0;
      return;
    }

    if (movementMode) {
      if (isMovementSectionBoundary(record)) {
        lastMovementRow = null;
        lastMovementDetailCount = 0;
        return;
      }
      if (lastMovementRow && lastMovementDetailCount < 4) {
        const detail = movementDetailText(record, lastMovementDetailCount);
        if (detail) {
          appendMovementDetail(lastMovementRow, detail);
          lastMovementDetailCount += 1;
        }
      }
      return;
    }

    const fields = fieldsByRecord.get(recordKey(record));
    if (fields?.length) {
      const fieldRows = fields.map((field) => fieldToFourColumns(field)).filter(Boolean);
      if (fieldRows.length) {
        rows.push(...fieldRows);
        return;
      }
    }
    const row = rawRecordToFourColumns(record);
    if (row) rows.push(row);
  });

  return rows.filter((row) => row.FECHA || row.DESCRIPCION || row.CARGOS || row.ABONOS);
}

export function buildStructuredTables(records) {
  const groups = new Map();
  for (const record of records) {
    const key = `${record.Archivo || "archivo"}::${record.Pagina || 1}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  const structured = [];
  for (const pageRows of groups.values()) {
    pageRows.sort((a, b) => Number(a.Fila || 0) - Number(b.Fila || 0));
    let currentSection = "Sin seccion";
    let periods = [];

    for (const record of pageRows) {
      const cells = orderedCells(record);
      if (!cells.length) continue;
      const amounts = cells.map(parseAmount);
      const amountValues = amounts.filter((value) => value !== null);
      const nonAmountCells = cells.filter((cell, index) => amounts[index] === null);
      const joined = nonAmountCells.join(" ").replace(/\s+/g, " ").trim();

      if (cells.filter(isDateLike).length >= 2 || (/^al$/i.test(cells[0]) && cells.some(isDateLike))) {
        periods = normalizeHeader(cells, Math.max(periods.length, amountValues.length));
        continue;
      }

      if (!amountValues.length) {
        const maybeSection = joined || cells.join(" ");
        if (SECTION_WORDS.test(maybeSection) || maybeSection.length <= 60) {
          currentSection = maybeSection;
        }
        continue;
      }

      if (periods.length < amountValues.length) {
        periods = normalizeHeader(cells, amountValues.length);
      }

      const label = joined || `Renglon ${record.Fila || structured.length + 1}`;
      const row = {
        Archivo: record.Archivo,
        Pagina: record.Pagina,
        Tabla: tableName(currentSection, record.Archivo || "archivo", record.Pagina || 1),
        Seccion: currentSection,
        Concepto: label,
        Tipo: rowType(label)
      };
      amountValues.forEach((amount, index) => {
        row[periods[index] || `Periodo_${index + 1}`] = amount;
      });
      structured.push(row);
    }
  }

  return structured;
}
