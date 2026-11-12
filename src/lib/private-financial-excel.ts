import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { PrivateMovement } from "@/types/private-financial";

export async function exportPrivateFinancialExcel(
  movements: PrivateMovement[], 
  periodLabel: string
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LDDEC - Control Financiero Privado";
  workbook.created = new Date();

  // Filtrar activos
  const activeMovements = movements.filter(m => m.status === "ACTIVO");
  const cobros = activeMovements.filter(m => m.type === "cobro_cliente");
  const pagos = activeMovements.filter(m => m.type === "pago_proveedor");
  const gastos = activeMovements.filter(m => m.type === "gasto_general");

  const totalCobros = cobros.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
  const totalPagos = pagos.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
  const totalGastos = gastos.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
  const totalSalidas = totalPagos + totalGastos;
  const balanceNeto = totalCobros - totalSalidas;

  // ESTILOS COMUNES
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" } // Slate 800
  };
  const headerFont: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 11
  };
  const titleFont: Partial<ExcelJS.Font> = {
    bold: true,
    size: 14,
    color: { argb: "FF0F172A" }
  };
  const totalFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" }
  };

  // ==========================================
  // HOJA 1: RESUMEN EJECUTIVO
  // ==========================================
  const wsResumen = workbook.addWorksheet("Resumen Ejecutivo");
  wsResumen.columns = [
    { width: 35 },
    { width: 25 },
    { width: 25 },
    { width: 25 }
  ];

  wsResumen.addRow(["LDDEC - LAVANDERÍA DEL DENIM DEL ECUADOR"]);
  wsResumen.getCell("A1").font = titleFont;

  wsResumen.addRow(["LIBRO DE CONTROL FINANCIERO PRIVADO"]);
  wsResumen.getCell("A2").font = { bold: true, size: 12, color: { argb: "FF475569" } };

  wsResumen.addRow([`Período: ${periodLabel} | Generado: ${new Date().toLocaleDateString("es-EC")}`]);
  wsResumen.addRow([]);

  // Tabla Resumen
  const rHeader = wsResumen.addRow(["CONCEPTO", "VALOR ($)", "% DE INGRESOS", "MOVIMIENTOS"]);
  rHeader.font = headerFont;
  rHeader.eachCell(cell => { cell.fill = headerFill; });

  const addResumenRow = (label: string, val: number, isNegative = false, count = 0) => {
    const pct = totalCobros > 0 ? (val / totalCobros) * 100 : 0;
    const row = wsResumen.addRow([
      label, 
      val, 
      totalCobros > 0 ? `${pct.toFixed(1)}%` : "N/A",
      count
    ]);
    row.getCell(2).numFmt = '"$"#,##0.00';
    if (isNegative) {
      row.getCell(2).font = { color: { argb: "FFDC2626" }, bold: true };
    } else {
      row.getCell(2).font = { color: { argb: "FF16A34A" }, bold: true };
    }
    return row;
  };

  addResumenRow("1. Total Cobros a Clientes (Ingresos)", totalCobros, false, cobros.length);
  addResumenRow("2. Total Pagos a Proveedores (Egresos)", totalPagos, true, pagos.length);
  addResumenRow("3. Total Gastos Generales (Egresos)", totalGastos, true, gastos.length);

  const rowTotalSalidas = wsResumen.addRow([
    "TOTAL SALIDAS DE DINERO (2 + 3)", 
    totalSalidas, 
    totalCobros > 0 ? `${((totalSalidas / totalCobros) * 100).toFixed(1)}%` : "N/A",
    pagos.length + gastos.length
  ]);
  rowTotalSalidas.font = { bold: true };
  rowTotalSalidas.getCell(2).numFmt = '"$"#,##0.00';
  rowTotalSalidas.getCell(2).font = { color: { argb: "FFDC2626" }, bold: true };
  rowTotalSalidas.eachCell(cell => { cell.fill = totalFill; });

  wsResumen.addRow([]);

  const rowBalance = wsResumen.addRow([
    "BALANCE NETO DISPONIBLE (Ingresos - Salidas)", 
    balanceNeto, 
    "", 
    activeMovements.length
  ]);
  rowBalance.font = { bold: true, size: 12 };
  rowBalance.getCell(2).numFmt = '"$"#,##0.00';
  rowBalance.getCell(2).font = { 
    bold: true, 
    size: 12, 
    color: { argb: balanceNeto >= 0 ? "FF16A34A" : "FFDC2626" } 
  };
  rowBalance.eachCell(cell => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: balanceNeto >= 0 ? "FFDCFCE7" : "FFFEE2E2" }
    };
  });

  // ==========================================
  // HOJA 2: COBROS A CLIENTES
  // ==========================================
  const wsCobros = workbook.addWorksheet("Cobros a Clientes");
  wsCobros.columns = [
    { header: "FECHA", key: "date", width: 14 },
    { header: "CLIENTE", key: "contact", width: 32 },
    { header: "CONCEPTO", key: "concept", width: 35 },
    { header: "VALOR ($)", key: "amount", width: 16 },
    { header: "FORMA DE COBRO", key: "method", width: 22 },
    { header: "BANCO", key: "bank", width: 22 },
    { header: "N° FACTURA / REF", key: "ref", width: 20 },
    { header: "OBSERVACIONES", key: "notes", width: 30 }
  ];

  const headerCobros = wsCobros.getRow(1);
  headerCobros.font = headerFont;
  headerCobros.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } }; });

  cobros.forEach(m => {
    const row = wsCobros.addRow({
      date: m.date,
      contact: m.contactName,
      concept: m.concept,
      amount: m.amount,
      method: m.paymentMethod,
      bank: m.bank || "-",
      ref: m.reference || "-",
      notes: m.notes || ""
    });
    row.getCell("amount").numFmt = '"$"#,##0.00';
  });

  const totCobrosRow = wsCobros.addRow(["TOTAL COBRADO", "", "", totalCobros, "", "", "", ""]);
  totCobrosRow.font = { bold: true };
  totCobrosRow.getCell(4).numFmt = '"$"#,##0.00';
  totCobrosRow.eachCell(c => { c.fill = totalFill; });

  // ==========================================
  // HOJA 3: PAGOS A PROVEEDORES
  // ==========================================
  const wsPagos = workbook.addWorksheet("Pagos a Proveedores");
  wsPagos.columns = [
    { header: "FECHA", key: "date", width: 14 },
    { header: "PROVEEDOR", key: "contact", width: 32 },
    { header: "CONCEPTO", key: "concept", width: 35 },
    { header: "VALOR ($)", key: "amount", width: 16 },
    { header: "FORMA DE PAGO", key: "method", width: 22 },
    { header: "BANCO", key: "bank", width: 22 },
    { header: "N° FACTURA / REF", key: "ref", width: 20 },
    { header: "OBSERVACIONES", key: "notes", width: 30 }
  ];

  const headerPagos = wsPagos.getRow(1);
  headerPagos.font = headerFont;
  headerPagos.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9A3412" } }; });

  pagos.forEach(m => {
    const row = wsPagos.addRow({
      date: m.date,
      contact: m.contactName,
      concept: m.concept,
      amount: m.amount,
      method: m.paymentMethod,
      bank: m.bank || "-",
      ref: m.reference || "-",
      notes: m.notes || ""
    });
    row.getCell("amount").numFmt = '"$"#,##0.00';
  });

  const totPagosRow = wsPagos.addRow(["TOTAL PAGADO A PROVEEDORES", "", "", totalPagos, "", "", "", ""]);
  totPagosRow.font = { bold: true };
  totPagosRow.getCell(4).numFmt = '"$"#,##0.00';
  totPagosRow.eachCell(c => { c.fill = totalFill; });

  // ==========================================
  // HOJA 4: GASTOS GENERALES
  // ==========================================
  const wsGastos = workbook.addWorksheet("Gastos Generales");
  wsGastos.columns = [
    { header: "FECHA", key: "date", width: 14 },
    { header: "CATEGORÍA", key: "category", width: 24 },
    { header: "BENEFICIARIO / ESTABLECIMIENTO", key: "contact", width: 32 },
    { header: "CONCEPTO", key: "concept", width: 35 },
    { header: "VALOR ($)", key: "amount", width: 16 },
    { header: "MÉTODO DE PAGO", key: "method", width: 22 },
    { header: "BANCO", key: "bank", width: 20 },
    { header: "N° FACTURA / REF", key: "ref", width: 20 },
    { header: "OBSERVACIONES", key: "notes", width: 30 }
  ];

  const headerGastos = wsGastos.getRow(1);
  headerGastos.font = headerFont;
  headerGastos.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } }; });

  gastos.forEach(m => {
    const row = wsGastos.addRow({
      date: m.date,
      category: m.category || "Otros",
      contact: m.contactName,
      concept: m.concept,
      amount: m.amount,
      method: m.paymentMethod,
      bank: m.bank || "-",
      ref: m.reference || "-",
      notes: m.notes || ""
    });
    row.getCell("amount").numFmt = '"$"#,##0.00';
  });

  const totGastosRow = wsGastos.addRow(["TOTAL GASTOS GENERALES", "", "", "", totalGastos, "", "", "", ""]);
  totGastosRow.font = { bold: true };
  totGastosRow.getCell(5).numFmt = '"$"#,##0.00';
  totGastosRow.eachCell(c => { c.fill = totalFill; });

  // ==========================================
  // HOJA 5: HISTORIAL COMPLETO
  // ==========================================
  const wsHistorial = workbook.addWorksheet("Historial Completo");
  wsHistorial.columns = [
    { header: "ESTADO", key: "status", width: 12 },
    { header: "TIPO", key: "type", width: 20 },
    { header: "FECHA", key: "date", width: 14 },
    { header: "BENEFICIARIO / CLIENTE", key: "contact", width: 30 },
    { header: "CATEGORÍA", key: "category", width: 20 },
    { header: "CONCEPTO", key: "concept", width: 35 },
    { header: "VALOR ($)", key: "amount", width: 16 },
    { header: "MÉTODO", key: "method", width: 20 },
    { header: "BANCO", key: "bank", width: 20 },
    { header: "REFERENCIA", key: "ref", width: 20 },
    { header: "REGISTRADO POR", key: "created", width: 25 },
    { header: "MOTIVO ANULACIÓN", key: "annulReason", width: 30 }
  ];

  const headerHist = wsHistorial.getRow(1);
  headerHist.font = headerFont;
  headerHist.eachCell(cell => { cell.fill = headerFill; });

  movements.forEach(m => {
    const typeLabel = 
      m.type === "cobro_cliente" ? "COBRO CLIENTE" :
      m.type === "pago_proveedor" ? "PAGO PROVEEDOR" : "GASTO GENERAL";

    const row = wsHistorial.addRow({
      status: m.status,
      type: typeLabel,
      date: m.date,
      contact: m.contactName,
      category: m.category || "-",
      concept: m.concept,
      amount: m.amount,
      method: m.paymentMethod,
      bank: m.bank || "-",
      ref: m.reference || "-",
      created: m.createdBy || "-",
      annulReason: m.annulReason || ""
    });
    row.getCell("amount").numFmt = '"$"#,##0.00';
    if (m.status === "ANULADO") {
      row.font = { strike: true, color: { argb: "FF94A3B8" } };
    }
  });

  // Guardar archivo
  const buffer = await workbook.xlsx.writeBuffer();
  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Control_Financiero_Privado_LDDEC_${safePeriod}.xlsx`;
  const blob = new Blob([buffer], { 
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
  });
  saveAs(blob, fileName);
}
