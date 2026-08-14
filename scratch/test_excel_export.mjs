import ExcelJS from "exceljs";
import fs from "fs";

async function runTestExport() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LDDEC System";
  workbook.lastModifiedBy = "LDDEC System";
  workbook.created = new Date();

  const fechaGenStr = "14/08/2026";
  const FONT_FAMILY = "Calibri";
  const COLOR_NAVY = "1E3A8A";
  const COLOR_HEADER_BG = "1E3A8A";
  const COLOR_HEADER_TEXT = "FFFFFF";
  const COLOR_BORDER = "CBD5E1";

  const styleSheetHeader = (ws, sheetTitle) => {
    const r1 = ws.getRow(1);
    r1.getCell(1).value = "LABORATORIO DEL DENIM ECUADOR – LDDEC";
    r1.getCell(1).font = { name: FONT_FAMILY, size: 14, bold: true, color: { argb: COLOR_NAVY } };
    r1.height = 24;

    const r2 = ws.getRow(2);
    r2.getCell(1).value = sheetTitle.toUpperCase();
    r2.getCell(1).font = { name: FONT_FAMILY, size: 11, bold: true, color: { argb: "334155" } };
    r2.height = 18;

    const r3 = ws.getRow(3);
    r3.getCell(1).value = `Fecha de generación: ${fechaGenStr}`;
    r3.getCell(1).font = { name: FONT_FAMILY, size: 9, italic: true, color: { argb: "64748B" } };
    r3.height = 16;

    ws.getRow(4).height = 10;
  };

  const styleTableHeader = (ws, rowNumber, colCount) => {
    const row = ws.getRow(rowNumber);
    row.height = 24;
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.font = { name: FONT_FAMILY, size: 11, bold: true, color: { argb: COLOR_HEADER_TEXT } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER_BG } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: COLOR_HEADER_BG } },
        left: { style: "thin", color: { argb: "3B82F6" } },
        bottom: { style: "medium", color: { argb: COLOR_HEADER_BG } },
        right: { style: "thin", color: { argb: "3B82F6" } }
      };
    }
  };

  // 1. Resumen General
  const wsResumen = workbook.addWorksheet("Resumen General", { views: [{ state: "frozen", xSplit: 0, ySplit: 4 }] });
  styleSheetHeader(wsResumen, "RESUMEN GENERAL CONSOLIDADO - LDDEC");
  wsResumen.getRow(5).values = ["INDICADOR", "VALOR CONSOLIDADO"];
  styleTableHeader(wsResumen, 5, 2);

  const resumenRows = [
    { name: "Total Facturación", formula: "=SUM(Ingresos!F6:F1000)" },
    { name: "Total Liquidación Manualidades", formula: "=SUM(Manualidades!G6:G1000)" },
    { name: "Total Egresos (Salidas)", formula: "=SUM(Salidas!E6:E1000)" }
  ];

  resumenRows.forEach((r, idx) => {
    const row = wsResumen.getRow(6 + idx);
    row.getCell(1).value = r.name;
    row.getCell(1).font = { name: FONT_FAMILY, size: 11 };
    row.getCell(2).value = { formula: r.formula, result: 0 };
    row.getCell(2).font = { name: FONT_FAMILY, size: 11, bold: true };
    row.getCell(2).numFmt = "$ #,##0.00";
    row.eachCell(c => c.border = { bottom: { style: "thin", color: { argb: COLOR_BORDER } } });
  });

  const rowNeto = wsResumen.getRow(9);
  rowNeto.getCell(1).value = "BALANCE OPERATIVO NETO";
  rowNeto.getCell(1).font = { name: FONT_FAMILY, size: 12, bold: true, color: { argb: COLOR_NAVY } };
  rowNeto.getCell(2).value = { formula: "=B6-B7-B8", result: 0 };
  rowNeto.getCell(2).font = { name: FONT_FAMILY, size: 12, bold: true, color: { argb: COLOR_NAVY } };
  rowNeto.getCell(2).numFmt = "$ #,##0.00";
  [rowNeto.getCell(1), rowNeto.getCell(2)].forEach(c => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EFF6FF" } };
    c.border = { top: { style: "thin", color: { argb: COLOR_NAVY } }, bottom: { style: "double", color: { argb: COLOR_NAVY } } };
  });
  wsResumen.getColumn(1).width = 38;
  wsResumen.getColumn(2).width = 25;

  // 2. Ingresos
  const wsIngresos = workbook.addWorksheet("Ingresos", { views: [{ state: "frozen", xSplit: 0, ySplit: 5 }] });
  styleSheetHeader(wsIngresos, "INGRESOS / FACTURACIÓN");
  wsIngresos.getRow(5).values = ["Fecha", "Cliente", "Concepto / Documento", "Subtotal", "IVA", "Total", "Estado"];
  styleTableHeader(wsIngresos, 5, 7);

  const sampleIngresos = [
    { Fecha: "01/08/2026", Cliente: "ALVARADO SANCHEZ LOURDES", Documento: "FAC-00124", Subtotal: 500, IVA: 75, Total: 575, Estado: "Pagada" },
    { Fecha: "05/08/2026", Cliente: "CONFECCIONES EL TRIUNFO", Documento: "FAC-00125", Subtotal: 1200, IVA: 180, Total: 1380, Estado: "Por Cobrar" }
  ];

  sampleIngresos.forEach((inv, idx) => {
    const row = wsIngresos.getRow(6 + idx);
    row.getCell(1).value = inv.Fecha;
    row.getCell(2).value = inv.Cliente;
    row.getCell(3).value = inv.Documento;
    row.getCell(4).value = inv.Subtotal;
    row.getCell(4).numFmt = "$ #,##0.00";
    row.getCell(5).value = inv.IVA;
    row.getCell(5).numFmt = "$ #,##0.00";
    row.getCell(6).value = inv.Total;
    row.getCell(6).numFmt = "$ #,##0.00";
    row.getCell(7).value = inv.Estado;
    if (inv.Estado === "Pagada") {
      row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DCFCE7" } };
      row.getCell(7).font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: "15803D" } };
    } else {
      row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
      row.getCell(7).font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: "B45309" } };
    }
  });

  wsIngresos.autoFilter = "A5:G7";
  [14, 30, 20, 15, 15, 15, 15].forEach((w, colIdx) => wsIngresos.getColumn(colIdx + 1).width = w);

  // Write file
  const buffer = await workbook.xlsx.writeBuffer();
  fs.writeFileSync("./LDDEC_EXPORT_CONSOLIDADO_TEST_2026.xlsx", buffer);
  console.log("SUCCESS: LDDEC_EXPORT_CONSOLIDADO_TEST_2026.xlsx generated successfully! Size:", buffer.byteLength, "bytes");
}

runTestExport().catch(console.error);
