import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface ExportDataParams {
  invoices: any[];
  entriesRaw?: any[];
  manualidades: any[];
  salidas: any[];
  outputsRaw?: any[];
  clientes: any[];
  quimicosRaw?: any[];
  kardexRaw?: any[];
}

function getCleanLotNumber(lot: any): string {
  if (!lot) return "N/D";
  const candidates = [
    lot.lotNumber,
    lot.numeroLote,
    lot.entryLotNumber,
    lot.loteId,
    lot.lote,
    lot.loteNumero,
    lot.numLote,
    lot.id
  ];
  for (const val of candidates) {
    const s = String(val ?? "").trim();
    if (s && s.length < 25 && s !== "[object Object]" && s.toLowerCase() !== "undefined" && s.toLowerCase() !== "null" && s !== "S/L") {
      return s.toUpperCase();
    }
  }
  return "N/D";
}

function getCleanEntryNumber(item: any, docData: any): string {
  const candidates = [
    item?.entryNumber,
    item?.numeroIngreso,
    item?.ingreso,
    docData?.entryNumber,
    docData?.numeroIngreso
  ];
  for (const val of candidates) {
    const s = String(val ?? "").trim();
    if (s && s.length < 25 && s !== "[object Object]" && s.toLowerCase() !== "undefined" && s.toLowerCase() !== "null" && s !== "S/N") {
      return s.toUpperCase();
    }
  }
  return "N/D";
}

function toDateSafe(val: any): Date | null {
  if (!val) return null;
  if (typeof val.toDate === "function") return val.toDate();
  if (val && typeof val === "object" && "seconds" in val) return new Date(val.seconds * 1000);
  if (val instanceof Date) return val;
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function formatDateEC(val: any): string {
  const d = toDateSafe(val);
  if (!d) return "N/D";
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function generateStyledConsolidadoExcel({
  invoices,
  entriesRaw = [],
  manualidades,
  salidas,
  outputsRaw = [],
  clientes,
  quimicosRaw = [],
  kardexRaw = []
}: ExportDataParams) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LDDEC System";
  workbook.lastModifiedBy = "LDDEC System";
  workbook.created = new Date();

  const fechaGenStr = new Date().toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

  // Estilos Corporativos Sobrios
  const FONT_FAMILY = "Calibri";
  const COLOR_NAVY = "1E3A8A";
  const COLOR_HEADER_BG = "1E3A8A";
  const COLOR_HEADER_TEXT = "FFFFFF";
  const COLOR_BORDER = "CBD5E1";

  const styleSheetHeader = (ws: ExcelJS.Worksheet, sheetTitle: string) => {
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

  const styleTableHeader = (ws: ExcelJS.Worksheet, rowNumber: number, colCount: number) => {
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

  const autoFitColumns = (ws: ExcelJS.Worksheet, maxCol: number, minWidths: number[] = []) => {
    for (let colIdx = 1; colIdx <= maxCol; colIdx++) {
      let maxLen = minWidths[colIdx - 1] || 12;
      ws.getColumn(colIdx).eachCell({ includeEmpty: false }, (cell, rowNum) => {
        if (rowNum >= 5) {
          const valStr = cell.value ? cell.value.toString() : "";
          if (valStr.length > maxLen) {
            maxLen = valStr.length;
          }
        }
      });
      ws.getColumn(colIdx).width = Math.min(Math.max(maxLen + 4, 12), 45);
    }
  };

  // ----------------------------------------------------
  // HOJA 1: RESUMEN GENERAL (EJECUTIVO)
  // ----------------------------------------------------
  const wsResumen = workbook.addWorksheet("Resumen General", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 4 }]
  });
  styleSheetHeader(wsResumen, "RESUMEN GENERAL CONSOLIDADO - LDDEC");

  wsResumen.getRow(5).values = ["INDICADOR", "VALOR CONSOLIDADO"];
  styleTableHeader(wsResumen, 5, 2);

  const resumenRows = [
    { name: "Total Facturación", formula: "=SUM(Ingresos!F6:F10000)" },
    { name: "Total Liquidación Manualidades", formula: "=SUM(Manualidades!G6:G10000)" },
    { name: "Total Egresos (Salidas)", formula: "=SUM(Salidas!E6:E10000)" }
  ];

  resumenRows.forEach((r, idx) => {
    const rowNum = 6 + idx;
    const row = wsResumen.getRow(rowNum);
    row.getCell(1).value = r.name;
    row.getCell(1).font = { name: FONT_FAMILY, size: 11, bold: false };
    row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };

    row.getCell(2).value = { formula: r.formula, result: 0 };
    row.getCell(2).font = { name: FONT_FAMILY, size: 11, bold: true };
    row.getCell(2).numFmt = "$ #,##0.00";
    row.getCell(2).alignment = { vertical: "middle", horizontal: "right" };

    row.height = 20;
    row.eachCell((c) => {
      c.border = {
        bottom: { style: "thin", color: { argb: COLOR_BORDER } },
        left: { style: "thin", color: { argb: COLOR_BORDER } },
        right: { style: "thin", color: { argb: COLOR_BORDER } }
      };
    });
  });

  const rowNeto = wsResumen.getRow(9);
  rowNeto.getCell(1).value = "BALANCE OPERATIVO NETO";
  rowNeto.getCell(1).font = { name: FONT_FAMILY, size: 12, bold: true, color: { argb: COLOR_NAVY } };
  rowNeto.getCell(1).alignment = { vertical: "middle", horizontal: "left" };

  rowNeto.getCell(2).value = { formula: "=B6-B7-B8", result: 0 };
  rowNeto.getCell(2).font = { name: FONT_FAMILY, size: 12, bold: true, color: { argb: COLOR_NAVY } };
  rowNeto.getCell(2).numFmt = "$ #,##0.00";
  rowNeto.getCell(2).alignment = { vertical: "middle", horizontal: "right" };
  rowNeto.height = 26;

  [rowNeto.getCell(1), rowNeto.getCell(2)].forEach((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EFF6FF" } };
    c.border = {
      top: { style: "thin", color: { argb: COLOR_NAVY } },
      bottom: { style: "double", color: { argb: COLOR_NAVY } },
      left: { style: "thin", color: { argb: COLOR_BORDER } },
      right: { style: "thin", color: { argb: COLOR_BORDER } }
    };
  });

  wsResumen.getColumn(1).width = 38;
  wsResumen.getColumn(2).width = 25;

  // ----------------------------------------------------
  // HOJA 2: INGRESOS (FACTURACIÓN)
  // ----------------------------------------------------
  const wsIngresos = workbook.addWorksheet("Ingresos", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 5 }]
  });
  styleSheetHeader(wsIngresos, "INGRESOS / FACTURACIÓN");

  wsIngresos.getRow(5).values = [
    "Fecha",
    "Cliente",
    "Concepto / Documento",
    "Subtotal",
    "IVA",
    "Total",
    "Estado"
  ];
  styleTableHeader(wsIngresos, 5, 7);

  invoices.forEach((inv, idx) => {
    const rowNum = 6 + idx;
    const row = wsIngresos.getRow(rowNum);

    row.getCell(1).value = inv.Fecha || "";
    row.getCell(1).alignment = { horizontal: "center" };

    row.getCell(2).value = (inv.Cliente || "").toString().toUpperCase();
    row.getCell(2).alignment = { horizontal: "left" };

    row.getCell(3).value = inv["Concepto/Documento"] || "";
    row.getCell(3).alignment = { horizontal: "center" };

    row.getCell(4).value = Number(inv.Subtotal || 0);
    row.getCell(4).numFmt = "$ #,##0.00";
    row.getCell(4).alignment = { horizontal: "right" };

    row.getCell(5).value = Number(inv.IVA || 0);
    row.getCell(5).numFmt = "$ #,##0.00";
    row.getCell(5).alignment = { horizontal: "right" };

    row.getCell(6).value = Number(inv.Total || 0);
    row.getCell(6).numFmt = "$ #,##0.00";
    row.getCell(6).alignment = { horizontal: "right" };

    const estado = inv.Estado || "Pendiente";
    row.getCell(7).value = estado;
    row.getCell(7).alignment = { horizontal: "center" };
    row.getCell(7).font = { name: FONT_FAMILY, size: 10, bold: true };

    if (estado.toLowerCase().includes("pagad")) {
      row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DCFCE7" } };
      row.getCell(7).font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: "15803D" } };
    } else {
      row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
      row.getCell(7).font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: "B45309" } };
    }

    row.height = 20;
    row.eachCell({ includeEmpty: true }, (c) => {
      c.font = c.font || { name: FONT_FAMILY, size: 10 };
      c.border = { bottom: { style: "thin", color: { argb: COLOR_BORDER } } };
    });
  });

  const lastIngRow = 6 + invoices.length;
  const rowTotIng = wsIngresos.getRow(lastIngRow);
  rowTotIng.getCell(1).value = "TOTAL FACTURACIÓN";
  rowTotIng.getCell(1).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotIng.getCell(4).value = { formula: `=SUM(D6:D${lastIngRow - 1})`, result: 0 };
  rowTotIng.getCell(4).numFmt = "$ #,##0.00";
  rowTotIng.getCell(4).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotIng.getCell(5).value = { formula: `=SUM(E6:E${lastIngRow - 1})`, result: 0 };
  rowTotIng.getCell(5).numFmt = "$ #,##0.00";
  rowTotIng.getCell(5).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotIng.getCell(6).value = { formula: `=SUM(F6:F${lastIngRow - 1})`, result: 0 };
  rowTotIng.getCell(6).numFmt = "$ #,##0.00";
  rowTotIng.getCell(6).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotIng.height = 22;
  rowTotIng.eachCell({ includeEmpty: true }, (c) => {
    c.border = { top: { style: "thin" }, bottom: { style: "double" } };
  });

  wsIngresos.autoFilter = `A5:G${lastIngRow - 1}`;
  autoFitColumns(wsIngresos, 7, [14, 30, 20, 15, 15, 15, 15]);

  // ----------------------------------------------------
  // HOJA 3: DETALLE INGRESOS (RESPALDO EXACTO POR LOTE)
  // ----------------------------------------------------
  const wsDetalleIngresos = workbook.addWorksheet("Detalle Ingresos", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 5 }]
  });
  styleSheetHeader(wsDetalleIngresos, "DETALLE AUDITABLE DE INGRESOS Y LOTES");

  wsDetalleIngresos.getRow(5).values = [
    "Nº Ingreso",
    "Fecha",
    "Cliente",
    "Responsable",
    "Estado Maestro",
    "Nº Lote / Lote ID",
    "Prenda / Composición",
    "Cantidad Total del Lote",
    "Proceso Técnico",
    "Estado Lote",
    "Notas"
  ];
  styleTableHeader(wsDetalleIngresos, 5, 11);

  let currentDetIngRow = 6;
  entriesRaw.forEach((entryDoc) => {
    const data = entryDoc.data ? entryDoc.data() : entryDoc;
    const entryNum = (data.entryNumber || data.numeroIngreso || data.id || entryDoc.id || "N/D").toString().toUpperCase();
    const fechaStr = formatDateEC(data.date || data.entryDate || data.createdAt);
    const clienteName = (data.clientName || data.nombreCliente || data.nombre || "Socio").toString().toUpperCase();
    const responsable = data.responsible || data.responsable || "N/A";
    const estadoMaestro = data.status || data.estado || "Activo";
    const lotes = Array.isArray(data.lotes) ? data.lotes : (Array.isArray(data.lots) ? data.lots : []);

    if (lotes.length === 0) {
      const row = wsDetalleIngresos.getRow(currentDetIngRow);
      row.getCell(1).value = entryNum;
      row.getCell(2).value = fechaStr;
      row.getCell(3).value = clienteName;
      row.getCell(4).value = responsable;
      row.getCell(5).value = estadoMaestro;
      row.getCell(6).value = "N/D";
      row.getCell(7).value = "SIN PRENDAS";
      row.getCell(8).value = 0;
      row.getCell(8).numFmt = "#,##0";
      row.getCell(9).value = "N/A";
      row.getCell(10).value = "N/A";
      row.getCell(11).value = data.notes || "";
      row.height = 20;
      row.eachCell({ includeEmpty: true }, c => c.border = { bottom: { style: "thin", color: { argb: COLOR_BORDER } } });
      currentDetIngRow++;
    } else {
      lotes.forEach((lot: any) => {
        const lotId = getCleanLotNumber(lot);
        const garments = Array.isArray(lot?.garments) ? lot.garments : (Array.isArray(lot?.prendas) ? lot.prendas : []);
        
        let prendaComp = "";
        let cantTotalLote = 0;

        if (garments.length > 0) {
          prendaComp = garments.map((g: any) => {
            const t = g.garmentType || g.tipo || "Prenda";
            const q = Number(g.quantity || g.cantidad || g.cantidadConfirmada || 0);
            return `${t}: ${q}`;
          }).join(" | ");

          cantTotalLote = garments.reduce((acc: number, g: any) => {
            return acc + Number(g.quantity || g.cantidad || g.cantidadConfirmada || 0);
          }, 0);
        } else {
          prendaComp = lot.garmentType || lot.tipo || "Muestra/Lote";
          cantTotalLote = Number(lot.cantidadConfirmada || lot.quantity || lot.cantidad || lot.total || 0);
        }

        const proceso = lot.process || lot.proceso || lot.processType || lot.procesoTecnico || "General";
        const estadoLote = lot.status || lot.estado || "Activo";
        const notasLote = lot.notes || lot.observaciones || data.notes || "";

        const row = wsDetalleIngresos.getRow(currentDetIngRow);
        row.getCell(1).value = entryNum;
        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(2).value = fechaStr;
        row.getCell(2).alignment = { horizontal: "center" };
        row.getCell(3).value = clienteName;
        row.getCell(4).value = responsable;
        row.getCell(5).value = estadoMaestro;
        row.getCell(6).value = lotId;
        row.getCell(6).alignment = { horizontal: "center" };
        row.getCell(7).value = prendaComp;
        row.getCell(8).value = cantTotalLote;
        row.getCell(8).numFmt = "#,##0";
        row.getCell(8).alignment = { horizontal: "right" };
        row.getCell(8).font = { name: FONT_FAMILY, size: 10, bold: true };
        row.getCell(9).value = proceso;
        row.getCell(10).value = estadoLote;
        row.getCell(10).alignment = { horizontal: "center" };
        row.getCell(11).value = notasLote;

        row.height = 20;
        row.eachCell({ includeEmpty: true }, c => c.border = { bottom: { style: "thin", color: { argb: COLOR_BORDER } } });
        currentDetIngRow++;
      });
    }
  });

  const lastDetIngRow = currentDetIngRow;
  const rowTotDetIng = wsDetalleIngresos.getRow(lastDetIngRow);
  rowTotDetIng.getCell(1).value = "TOTAL PRENDAS INGRESADAS";
  rowTotDetIng.getCell(1).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotDetIng.getCell(8).value = { formula: `=SUM(H6:H${lastDetIngRow - 1})`, result: 0 };
  rowTotDetIng.getCell(8).numFmt = "#,##0";
  rowTotDetIng.getCell(8).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotDetIng.height = 22;
  rowTotDetIng.eachCell({ includeEmpty: true }, c => c.border = { top: { style: "thin" }, bottom: { style: "double" } });

  wsDetalleIngresos.autoFilter = `A5:K${lastDetIngRow - 1}`;
  autoFitColumns(wsDetalleIngresos, 11, [15, 14, 28, 18, 15, 16, 32, 18, 22, 14, 25]);

  // ----------------------------------------------------
  // HOJA 4: MANUALIDADES
  // ----------------------------------------------------
  const wsManualidades = workbook.addWorksheet("Manualidades", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 5 }]
  });
  styleSheetHeader(wsManualidades, "MANUALIDADES Y PROCESOS DE CONFECCIÓN");

  wsManualidades.getRow(5).values = [
    "Fecha",
    "Lote",
    "Operario",
    "Proceso / Manualidad",
    "Cantidad",
    "Tarifa Unit.",
    "Total a Pagar",
    "Estado"
  ];
  styleTableHeader(wsManualidades, 5, 8);

  manualidades.forEach((m, idx) => {
    const rowNum = 6 + idx;
    const row = wsManualidades.getRow(rowNum);

    row.getCell(1).value = m.Fecha || "";
    row.getCell(1).alignment = { horizontal: "center" };

    row.getCell(2).value = m.Lote || "";
    row.getCell(2).alignment = { horizontal: "center" };

    row.getCell(3).value = (m.Operario || "").toString().toUpperCase();
    row.getCell(3).alignment = { horizontal: "left" };

    row.getCell(4).value = m["Proceso/Manualidad"] || "";
    row.getCell(4).alignment = { horizontal: "left" };

    row.getCell(5).value = Number(m.Cantidad || 0);
    row.getCell(5).numFmt = "#,##0";
    row.getCell(5).alignment = { horizontal: "right" };

    row.getCell(6).value = Number(m["Tarifa Unit."] || 0);
    row.getCell(6).numFmt = "$ #,##0.0000";
    row.getCell(6).alignment = { horizontal: "right" };

    row.getCell(7).value = Number(m["Total a Pagar"] || 0);
    row.getCell(7).numFmt = "$ #,##0.00";
    row.getCell(7).alignment = { horizontal: "right" };

    row.getCell(8).value = m.Estado || "Pendiente";
    row.getCell(8).alignment = { horizontal: "center" };

    row.height = 20;
    row.eachCell({ includeEmpty: true }, (c) => {
      c.font = c.font || { name: FONT_FAMILY, size: 10 };
      c.border = { bottom: { style: "thin", color: { argb: COLOR_BORDER } } };
    });
  });

  const lastManRow = 6 + manualidades.length;
  const rowTotMan = wsManualidades.getRow(lastManRow);
  rowTotMan.getCell(1).value = "TOTAL MANUALIDADES";
  rowTotMan.getCell(1).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotMan.getCell(5).value = { formula: `=SUM(E6:E${lastManRow - 1})`, result: 0 };
  rowTotMan.getCell(5).numFmt = "#,##0";
  rowTotMan.getCell(5).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotMan.getCell(7).value = { formula: `=SUM(G6:G${lastManRow - 1})`, result: 0 };
  rowTotMan.getCell(7).numFmt = "$ #,##0.00";
  rowTotMan.getCell(7).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotMan.height = 22;
  rowTotMan.eachCell({ includeEmpty: true }, (c) => {
    c.border = { top: { style: "thin" }, bottom: { style: "double" } };
  });

  wsManualidades.autoFilter = `A5:H${lastManRow - 1}`;
  autoFitColumns(wsManualidades, 8, [14, 15, 25, 25, 14, 15, 16, 14]);

  // ----------------------------------------------------
  // HOJA 5: SALIDAS (EGRESOS DE CAJA / BANCOS)
  // ----------------------------------------------------
  const wsSalidas = workbook.addWorksheet("Salidas", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 5 }]
  });
  styleSheetHeader(wsSalidas, "SALIDAS / EGRESOS DE CAJA Y BANCOS");

  wsSalidas.getRow(5).values = [
    "Fecha",
    "Categoría de Gasto",
    "Descripción",
    "Proveedor",
    "Total Monto"
  ];
  styleTableHeader(wsSalidas, 5, 5);

  salidas.forEach((s, idx) => {
    const rowNum = 6 + idx;
    const row = wsSalidas.getRow(rowNum);

    row.getCell(1).value = s.Fecha || "";
    row.getCell(1).alignment = { horizontal: "center" };

    row.getCell(2).value = s["Categoría de Gasto"] || "";
    row.getCell(2).alignment = { horizontal: "left" };

    row.getCell(3).value = s["Descripción"] || "";
    row.getCell(3).alignment = { horizontal: "left" };

    row.getCell(4).value = s.Proveedor || "";
    row.getCell(4).alignment = { horizontal: "left" };

    row.getCell(5).value = Number(s["Total Monto"] || 0);
    row.getCell(5).numFmt = "$ #,##0.00";
    row.getCell(5).alignment = { horizontal: "right" };

    row.height = 20;
    row.eachCell({ includeEmpty: true }, (c) => {
      c.font = c.font || { name: FONT_FAMILY, size: 10 };
      c.border = { bottom: { style: "thin", color: { argb: COLOR_BORDER } } };
    });
  });

  const lastSalRow = 6 + salidas.length;
  const rowTotSal = wsSalidas.getRow(lastSalRow);
  rowTotSal.getCell(1).value = "TOTAL EGRESOS";
  rowTotSal.getCell(1).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotSal.getCell(5).value = { formula: `=SUM(E6:E${lastSalRow - 1})`, result: 0 };
  rowTotSal.getCell(5).numFmt = "$ #,##0.00";
  rowTotSal.getCell(5).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotSal.height = 22;
  rowTotSal.eachCell({ includeEmpty: true }, (c) => {
    c.border = { top: { style: "thin" }, bottom: { style: "double" } };
  });

  wsSalidas.autoFilter = `A5:E${lastSalRow - 1}`;
  autoFitColumns(wsSalidas, 5, [14, 22, 35, 25, 18]);

  // ----------------------------------------------------
  // HOJA 6: DETALLE SALIDAS (RESPALDO DE GUÍAS DE DESPACHO)
  // ----------------------------------------------------
  const wsDetalleSalidas = workbook.addWorksheet("Detalle Salidas", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 5 }]
  });
  styleSheetHeader(wsDetalleSalidas, "DETALLE AUDITABLE DE GUÍAS DE DESPACHO Y PRENDAS");

  wsDetalleSalidas.getRow(5).values = [
    "Nº Guía / Nº Salida",
    "Fecha Despacho",
    "Cliente / Socio",
    "Responsable Despacho",
    "Nº Ingreso de Origen",
    "Nº Lote Despachado",
    "Tipo de Prenda",
    "Proceso Aplicado",
    "Cantidad Despachada",
    "Notas"
  ];
  styleTableHeader(wsDetalleSalidas, 5, 10);

  let currentDetSalRow = 6;
  outputsRaw.forEach((outDoc) => {
    const data = outDoc.data ? outDoc.data() : outDoc;
    const guiaNum = (data.numeroSalida || data.numeroGuia || data.outputNumber || data.id || outDoc.id || "N/D").toString().toUpperCase();
    const fechaStr = formatDateEC(data.date || data.fechaSalida || data.fecha || data.createdAt);
    
    let clienteName = data.clienteNombre || data.cliente || data.clientName || "";
    if (!clienteName && Array.isArray(data.containedClientNames) && data.containedClientNames.length > 0) {
      clienteName = data.containedClientNames.join(", ");
    }
    clienteName = (clienteName || "Socio").toString().toUpperCase();
    const responsable = data.responsiblePerson || data.responsable || "N/A";
    const items = Array.isArray(data.itemsDispatched) ? data.itemsDispatched : (Array.isArray(data.items) ? data.items : []);

    if (items.length === 0) {
      const row = wsDetalleSalidas.getRow(currentDetSalRow);
      row.getCell(1).value = guiaNum;
      row.getCell(2).value = fechaStr;
      row.getCell(3).value = clienteName;
      row.getCell(4).value = responsable;
      row.getCell(5).value = getCleanEntryNumber(null, data);
      row.getCell(6).value = "N/D";
      row.getCell(7).value = "DESPACHO GENERAL";
      row.getCell(8).value = "N/A";
      row.getCell(9).value = Number(data.totalPrendas || data.total || 0);
      row.getCell(9).numFmt = "#,##0";
      row.getCell(10).value = data.notes || "";
      row.height = 20;
      row.eachCell({ includeEmpty: true }, c => c.border = { bottom: { style: "thin", color: { argb: COLOR_BORDER } } });
      currentDetSalRow++;
    } else {
      items.forEach((it: any) => {
        const ingOrigen = getCleanEntryNumber(it, data);
        const loteDesp = getCleanLotNumber(it);
        const tipoPrenda = it.garmentType || it.prenda || it.tipo || "Prenda";
        const proceso = it.process || it.proceso || "Lavado/Terminado";
        const cantDesp = Number(it.quantityToDispatch || it.cantidad || it.quantity || 0);
        const notasItem = it.notes || it.observaciones || data.notes || "";

        const row = wsDetalleSalidas.getRow(currentDetSalRow);
        row.getCell(1).value = guiaNum;
        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(2).value = fechaStr;
        row.getCell(2).alignment = { horizontal: "center" };
        row.getCell(3).value = clienteName;
        row.getCell(4).value = responsable;
        row.getCell(5).value = ingOrigen;
        row.getCell(5).alignment = { horizontal: "center" };
        row.getCell(6).value = loteDesp;
        row.getCell(6).alignment = { horizontal: "center" };
        row.getCell(7).value = tipoPrenda;
        row.getCell(8).value = proceso;
        row.getCell(9).value = cantDesp;
        row.getCell(9).numFmt = "#,##0";
        row.getCell(9).alignment = { horizontal: "right" };
        row.getCell(9).font = { name: FONT_FAMILY, size: 10, bold: true };
        row.getCell(10).value = notasItem;

        row.height = 20;
        row.eachCell({ includeEmpty: true }, c => c.border = { bottom: { style: "thin", color: { argb: COLOR_BORDER } } });
        currentDetSalRow++;
      });
    }
  });

  const lastDetSalRow = currentDetSalRow;
  const rowTotDetSal = wsDetalleSalidas.getRow(lastDetSalRow);
  rowTotDetSal.getCell(1).value = "TOTAL PRENDAS DESPACHADAS";
  rowTotDetSal.getCell(1).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotDetSal.getCell(9).value = { formula: `=SUM(I6:I${lastDetSalRow - 1})`, result: 0 };
  rowTotDetSal.getCell(9).numFmt = "#,##0";
  rowTotDetSal.getCell(9).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotDetSal.height = 22;
  rowTotDetSal.eachCell({ includeEmpty: true }, c => c.border = { top: { style: "thin" }, bottom: { style: "double" } });

  wsDetalleSalidas.autoFilter = `A5:J${lastDetSalRow - 1}`;
  autoFitColumns(wsDetalleSalidas, 10, [16, 14, 28, 18, 16, 16, 20, 22, 18, 25]);

  // ----------------------------------------------------
  // HOJA 7: QUÍMICOS (KÁRDEX BODEGA REAL)
  // ----------------------------------------------------
  const wsQuimicos = workbook.addWorksheet("Químicos", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 5 }]
  });
  styleSheetHeader(wsQuimicos, "INVENTARIO REAL DE BODEGA QUÍMICOS Y KÁRDEX");

  wsQuimicos.getRow(5).values = [
    "Código P.",
    "Nombre del Producto",
    "Categoría",
    "Saldo Inicial Mes (kg)",
    "Ingresos Mes (kg)",
    "Consumos Mes (kg)",
    "Stock Actual Disponible (kg)",
    "Unidad",
    "Costo Unitario",
    "Valor Inventario"
  ];
  styleTableHeader(wsQuimicos, 5, 10);

  const kardexByName: Record<string, any[]> = {};
  kardexRaw.forEach((kDoc) => {
    const kData = kDoc.data ? kDoc.data() : kDoc;
    const qName = (kData.quimico || "").toString().trim().toUpperCase();
    if (qName) {
      if (!kardexByName[qName]) kardexByName[qName] = [];
      kardexByName[qName].push(kData);
    }
  });

  let hasAnyCost = false;
  quimicosRaw.forEach((qDoc, idx) => {
    const qData = qDoc.data ? qDoc.data() : qDoc;
    const qId = qDoc.id || qData.id || `Q-${idx + 1}`;
    const name = (qData.chemicalName || qData.nombre || qData.name || qId).toString().trim().toUpperCase();
    const category = qData.category || qData.categoria || "Químicos";
    const unit = qData.unit || qData.unidad || "kg";

    const saldosMap = qData.saldosIniciales || {};
    const saldoInicialG = Number(saldosMap[currentMonthKey] || 0);

    const mList = kardexByName[name] || [];
    let ingresosG = 0;
    let consumosG = 0;

    mList.forEach((m) => {
      const val = Number(m.cant || 0);
      const valG = (m.unit === "kg" || m.unit === "kilogramos") ? val * 1000 : val;
      const tipo = (m.tipo || "").toString().toUpperCase();
      if (tipo.includes("INGRESO")) {
        ingresosG += valG;
      } else if (tipo.includes("SALIDA")) {
        consumosG += valG;
      }
    });

    const disponibleG = saldoInicialG + ingresosG - consumosG;

    const saldoInicialKg = saldoInicialG / 1000;
    const ingresosKg = ingresosG / 1000;
    const consumosKg = consumosG / 1000;
    const disponibleKg = disponibleG / 1000;

    const costRaw = qData.cost ?? qData.costoUnitario ?? qData.precio;
    const costNum = Number(costRaw);
    const hasValidCost = costRaw !== undefined && costRaw !== null && !isNaN(costNum) && costNum > 0;

    if (hasValidCost) hasAnyCost = true;

    const rowNum = 6 + idx;
    const row = wsQuimicos.getRow(rowNum);

    row.getCell(1).value = qId;
    row.getCell(1).alignment = { horizontal: "center" };

    row.getCell(2).value = name;
    row.getCell(2).alignment = { horizontal: "left" };

    row.getCell(3).value = category;
    row.getCell(3).alignment = { horizontal: "left" };

    row.getCell(4).value = Number(saldoInicialKg.toFixed(3));
    row.getCell(4).numFmt = "#,##0.00";
    row.getCell(4).alignment = { horizontal: "right" };

    row.getCell(5).value = Number(ingresosKg.toFixed(3));
    row.getCell(5).numFmt = "#,##0.00";
    row.getCell(5).alignment = { horizontal: "right" };

    row.getCell(6).value = Number(consumosKg.toFixed(3));
    row.getCell(6).numFmt = "#,##0.00";
    row.getCell(6).alignment = { horizontal: "right" };

    row.getCell(7).value = Number(disponibleKg.toFixed(3));
    row.getCell(7).numFmt = "#,##0.00";
    row.getCell(7).alignment = { horizontal: "right" };
    row.getCell(7).font = { name: FONT_FAMILY, size: 10, bold: true };

    row.getCell(8).value = unit;
    row.getCell(8).alignment = { horizontal: "center" };

    if (hasValidCost) {
      row.getCell(9).value = Number(costNum.toFixed(4));
      row.getCell(9).numFmt = "$ #,##0.0000";
      row.getCell(9).alignment = { horizontal: "right" };

      row.getCell(10).value = Number((disponibleKg * costNum).toFixed(2));
      row.getCell(10).numFmt = "$ #,##0.00";
      row.getCell(10).alignment = { horizontal: "right" };
    } else {
      row.getCell(9).value = "N/D";
      row.getCell(9).alignment = { horizontal: "center" };
      row.getCell(9).font = { name: FONT_FAMILY, size: 10, italic: true, color: { argb: "94A3B8" } };

      row.getCell(10).value = "N/D";
      row.getCell(10).alignment = { horizontal: "center" };
      row.getCell(10).font = { name: FONT_FAMILY, size: 10, italic: true, color: { argb: "94A3B8" } };
    }

    row.height = 20;
    row.eachCell({ includeEmpty: true }, (c) => {
      c.font = c.font || { name: FONT_FAMILY, size: 10 };
      c.border = { bottom: { style: "thin", color: { argb: COLOR_BORDER } } };
    });
  });

  const lastQuiRow = 6 + quimicosRaw.length;
  const rowTotQui = wsQuimicos.getRow(lastQuiRow);
  rowTotQui.getCell(1).value = "TOTAL DISPONIBLE BODEGA";
  rowTotQui.getCell(1).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotQui.getCell(7).value = { formula: `=SUM(G6:G${lastQuiRow - 1})`, result: 0 };
  rowTotQui.getCell(7).numFmt = "#,##0.00";
  rowTotQui.getCell(7).font = { name: FONT_FAMILY, size: 11, bold: true };

  if (hasAnyCost) {
    rowTotQui.getCell(10).value = { formula: `=SUM(J6:J${lastQuiRow - 1})`, result: 0 };
    rowTotQui.getCell(10).numFmt = "$ #,##0.00";
    rowTotQui.getCell(10).font = { name: FONT_FAMILY, size: 11, bold: true };
  } else {
    rowTotQui.getCell(10).value = "N/D";
    rowTotQui.getCell(10).alignment = { horizontal: "center" };
    rowTotQui.getCell(10).font = { name: FONT_FAMILY, size: 10, italic: true, color: { argb: "94A3B8" } };
  }

  rowTotQui.height = 22;
  rowTotQui.eachCell({ includeEmpty: true }, (c) => {
    c.border = { top: { style: "thin" }, bottom: { style: "double" } };
  });

  wsQuimicos.autoFilter = `A5:J${lastQuiRow - 1}`;
  autoFitColumns(wsQuimicos, 10, [15, 32, 18, 16, 16, 16, 18, 10, 15, 18]);

  // ----------------------------------------------------
  // HOJA 8: CLIENTES
  // ----------------------------------------------------
  const wsClientes = workbook.addWorksheet("Clientes", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 5 }]
  });
  styleSheetHeader(wsClientes, "DIRECTORIO DE CLIENTES Y SALDOS DE CARTERA");

  wsClientes.getRow(5).values = [
    "Código",
    "Nombre del Cliente",
    "Tipo",
    "Teléfono",
    "Saldo Inicial",
    "Saldo Actual"
  ];
  styleTableHeader(wsClientes, 5, 6);

  clientes.forEach((c, idx) => {
    const rowNum = 6 + idx;
    const row = wsClientes.getRow(rowNum);

    row.getCell(1).value = c["Código"] || "";
    row.getCell(1).alignment = { horizontal: "center" };

    row.getCell(2).value = (c["Nombre del Cliente"] || "").toString().toUpperCase();
    row.getCell(2).alignment = { horizontal: "left" };

    row.getCell(3).value = c["Tipo"] || "Nacional";
    row.getCell(3).alignment = { horizontal: "center" };

    row.getCell(4).value = c["Teléfono"] || "-";
    row.getCell(4).alignment = { horizontal: "center" };

    row.getCell(5).value = Number(c["Saldo Inicial"] || 0);
    row.getCell(5).numFmt = "$ #,##0.00";
    row.getCell(5).alignment = { horizontal: "right" };

    row.getCell(6).value = Number(c["Saldo Actual"] || 0);
    row.getCell(6).numFmt = "$ #,##0.00";
    row.getCell(6).alignment = { horizontal: "right" };

    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = cell.font || { name: FONT_FAMILY, size: 10 };
      cell.border = { bottom: { style: "thin", color: { argb: COLOR_BORDER } } };
    });
  });

  const lastCliRow = 6 + clientes.length;
  const rowTotCli = wsClientes.getRow(lastCliRow);
  rowTotCli.getCell(1).value = "TOTAL CARTERA";
  rowTotCli.getCell(1).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotCli.getCell(5).value = { formula: `=SUM(E6:E${lastCliRow - 1})`, result: 0 };
  rowTotCli.getCell(5).numFmt = "$ #,##0.00";
  rowTotCli.getCell(5).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotCli.getCell(6).value = { formula: `=SUM(F6:F${lastCliRow - 1})`, result: 0 };
  rowTotCli.getCell(6).numFmt = "$ #,##0.00";
  rowTotCli.getCell(6).font = { name: FONT_FAMILY, size: 11, bold: true };

  rowTotCli.height = 22;
  rowTotCli.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = { top: { style: "thin" }, bottom: { style: "double" } };
  });

  wsClientes.autoFilter = `A5:F${lastCliRow - 1}`;
  autoFitColumns(wsClientes, 6, [15, 35, 14, 16, 18, 18]);

  // Save File
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  saveAs(blob, `LDDEC_EXPORT_CONSOLIDADO_${new Date().getFullYear()}.xlsx`);
}
