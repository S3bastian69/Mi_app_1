const STYLE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="12"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="12"/><color rgb="FF111827"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="15"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3E8FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE0F2FE"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleMedium9"/>
</styleSheet>`;

function setCellStyle(cellTag, styleId) {
  if (/\s+s="/.test(cellTag)) return cellTag.replace(/\s+s="[^"]*"/, ` s="${styleId}"`);
  return cellTag.replace(/>$/, ` s="${styleId}">`);
}

function styleRowXml(rowXml, styleId) {
  return rowXml.replace(/<c\b[^>]*>/g, (cellTag) => setCellStyle(cellTag, styleId));
}

function styleWorksheet(sheetXml, rowStyles) {
  if (!rowStyles.size) return sheetXml;
  return sheetXml.replace(/<row\b([^>]*\sr="(\d+)"[^>]*)>([\s\S]*?)<\/row>/g, (match, _attrs, rowNumber) => {
    const styleId = rowStyles.get(Number(rowNumber));
    return styleId ? styleRowXml(match, styleId) : match;
  });
}

function structuredPlan(structuredRows) {
  const plan = new Map([[1, 1]]);
  const sectionStyles = new Map();
  let nextStyle = 2;
  structuredRows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (/total|subtotal/i.test(row.Tipo || "")) {
      plan.set(rowNumber, 4);
      return;
    }
    if (!sectionStyles.has(row.Seccion)) {
      sectionStyles.set(row.Seccion, nextStyle);
      nextStyle = nextStyle === 2 ? 3 : 2;
    }
    plan.set(rowNumber, sectionStyles.get(row.Seccion));
  });
  return plan;
}

function plannedRowStyles(rowStyles) {
  return new Map((rowStyles || []).map(([row, style]) => [Number(row), Number(style)]));
}

export async function styleWorkbook(xlsxData, { structuredRows = [], sheetPlans = [], zipLib = globalThis.JSZip } = {}) {
  if (!zipLib || (!structuredRows.length && !sheetPlans.length)) return xlsxData;
  const zip = await zipLib.loadAsync(xlsxData);
  zip.file("xl/styles.xml", STYLE_XML);
  if (sheetPlans.length) {
    for (let index = 0; index < sheetPlans.length; index += 1) {
      const sheetPath = `xl/worksheets/sheet${index + 1}.xml`;
      const sheet = zip.file(sheetPath);
      if (sheet) {
        const xml = await sheet.async("string");
        zip.file(sheetPath, styleWorksheet(xml, plannedRowStyles(sheetPlans[index].rowStyles)));
      }
    }
    return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  }
  const structuredSheetPath = "xl/worksheets/sheet1.xml";
  const structuredSheet = zip.file(structuredSheetPath);
  if (structuredSheet) {
    const xml = await structuredSheet.async("string");
    zip.file(structuredSheetPath, styleWorksheet(xml, structuredPlan(structuredRows)));
  }
  const rawSheetPath = "xl/worksheets/sheet2.xml";
  const rawSheet = zip.file(rawSheetPath);
  if (rawSheet) {
    const xml = await rawSheet.async("string");
    zip.file(rawSheetPath, styleWorksheet(xml, new Map([[1, 1]])));
  }
  const summarySheetPath = "xl/worksheets/sheet3.xml";
  const summarySheet = zip.file(summarySheetPath);
  if (summarySheet) {
    const xml = await summarySheet.async("string");
    zip.file(summarySheetPath, styleWorksheet(xml, new Map([[1, 1]])));
  }
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}
