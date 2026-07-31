import { EntryMaestro, OutputMaestro, InvoiceMaestro } from "@/types/lddec";
import { toDate } from "./toDate";

export interface InventoryMetrics {
  stockInicial: number;
  ingresosPeriodo: number;
  despachosPeriodo: number;
  despachadasFacturadas: number;
  despachadasSinFacturar: number;
  stockFinal: number;
}

/**
 * CONSTANTES MAESTRAS LDDEC 1.1
 */
const STOCK_INICIAL_2026 = 4121; // Arrastre histórico real reportado
const FECHA_BASE_2026 = new Date("2026-01-01T00:00:00");

/**
 * MOTOR DE NORMALIZACIÓN DE CANTIDADES (Con operador ||)
 */
function getNormalizedQty(item: any): number {
  if (!item) return 0;
  const val = item.quantityToDispatch || 
              item.cantidadConfirmada || 
              item.quantity || 
              item.cantidad || 
              item.totalPrendas || 
              item.total || 0;
  
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? 0 : num;
}

/**
 * SIMULADOR DE NORMALIZACIÓN DE CANTIDADES ORIGINAL (Con operador ??)
 */
function getCorrectNormalizedQty(item: any): number {
  if (!item) return 0;
  const val = item.quantityToDispatch !== undefined && item.quantityToDispatch !== null ? item.quantityToDispatch : 
              item.cantidadConfirmada !== undefined && item.cantidadConfirmada !== null ? item.cantidadConfirmada : 
              item.quantity !== undefined && item.quantity !== null ? item.quantity : 
              item.cantidad !== undefined && item.cantidad !== null ? item.cantidad : 
              item.totalPrendas !== undefined && item.totalPrendas !== null ? item.totalPrendas : 
              item.total !== undefined && item.total !== null ? item.total : 0;
  
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? 0 : num;
}

/**
 * MOTOR DE NORMALIZACIÓN DE FECHAS
 */
function getNormalizedDate(doc: any): Date | null {
  if (!doc) return null;
  return toDate(doc.date || doc.fechaSalida || doc.fecha || doc.entryDate || doc.createdAt);
}

/**
 * MOTOR DE CÁLCULO OPERATIVO DE INVENTARIO LDDEC 1.1 (OPTIMIZADO)
 * Realiza un balance de masa exacto cruzando ingresos, despachos y facturación.
 */
export function calculateInventorySummary(
  entries: any[],
  allOutputs: any[], // Colección fusionada (outputs + salidas + muestras)
  invoices: any[],
  dateFrom: string,
  dateTo: string
): InventoryMetrics {
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T23:59:59");

  // --- 1. CÁLCULO DE ARRASTRE REAL (PREVIO AL PERIODO) ---
  let sumInBefore = 0;
  let sumOutBefore = 0;
  let docsInBeforeCount = 0;
  let docsOutBeforeCount = 0;

  entries.forEach(e => {
    const d = getNormalizedDate(e);
    if (d && d >= FECHA_BASE_2026 && d < from) {
      docsInBeforeCount++;
      const lotes = e.lotes || e.lots || [];
      lotes.forEach((l: any) => { sumInBefore += getNormalizedQty(l); });
    }
  });

  allOutputs.forEach(o => {
    const d = getNormalizedDate(o);
    if (d && d >= FECHA_BASE_2026 && d < from) {
      docsOutBeforeCount++;
      if (Array.isArray(o.itemsDispatched)) {
        o.itemsDispatched.forEach((it: any) => { sumOutBefore += getNormalizedQty(it); });
      } else {
        sumOutBefore += getNormalizedQty(o);
      }
    }
  });

  const stockInicialPeriodo = STOCK_INICIAL_2026 + sumInBefore - sumOutBefore;

  // --- 2. MOVIMIENTOS DENTRO DEL PERIODO ---
  let ingresosPeriodo = 0;
  let despachosPeriodo = 0;
  let docsInPeriodCount = 0;
  let docsOutPeriodCount = 0;

  entries.forEach(e => {
    const d = getNormalizedDate(e);
    if (d && d >= from && d <= to) {
      docsInPeriodCount++;
      const lotes = e.lotes || e.lots || [];
      lotes.forEach((l: any) => { ingresosPeriodo += getNormalizedQty(l); });
    }
  });

  // Indexar facturación para cruce rápido
  const invoicedIds = new Set<string>();
  invoices.forEach(inv => {
    const refs = [
      inv.ingresoMaestroId,
      inv.referencia,
      inv.ref,
      inv.numeroIngreso,
      inv.entryNumber,
      inv.id,
      ...(Array.isArray(inv.ingresoMaestroIds) ? inv.ingresoMaestroIds : [])
    ];
    refs.filter(Boolean).forEach(r => invoicedIds.add(String(r).trim().toUpperCase()));
  });

  let despachadasFacturadas = 0;

  allOutputs.forEach(o => {
    const d = getNormalizedDate(o);
    if (d && d >= from && d <= to) {
      docsOutPeriodCount++;
      if (Array.isArray(o.itemsDispatched)) {
        o.itemsDispatched.forEach((it: any) => {
          const qty = getNormalizedQty(it);
          despachosPeriodo += qty;

          // Cruce de facturación (ID técnico o número visible)
          const checkRefs = [
            it.parentIngresoMaestro,
            it.entryLotNumber,
            it.entryNumber,
            it.ingresoMaestroId,
            it.referencia,
            it.ref,
            o.numeroSalida,
            o.id
          ].filter(Boolean).map(String).map(s => s.trim().toUpperCase());
          
          if (checkRefs.some(ref => invoicedIds.has(ref))) {
            despachadasFacturadas += qty;
          }
        });
      } else {
        const qty = getNormalizedQty(o);
        despachosPeriodo += qty;
        
        const checkRefs = [
            o.parentIngresoMaestro,
            o.entryLotNumber,
            o.entryNumber,
            o.ingresoMaestroId,
            o.referencia,
            o.ref,
            o.numeroSalida,
            o.id
        ].filter(Boolean).map(String).map(s => s.trim().toUpperCase());

        if (checkRefs.some(ref => invoicedIds.has(ref))) {
          despachadasFacturadas += qty;
        }
      }
    }
  });

  const despachadasSinFacturar = Math.max(0, despachosPeriodo - despachadasFacturadas);
  const stockFinal = stockInicialPeriodo + ingresosPeriodo - despachosPeriodo;

  // ================= SIMULACIONES DE AUDITORÍA =================
  // Simulación 1: Corrección de operador || a ??
  let sumOutBefore_Sim1 = 0;
  let despachos_Sim1 = 0;

  allOutputs.forEach(o => {
    const d = getNormalizedDate(o);
    if (d && d >= FECHA_BASE_2026 && d < from) {
      if (Array.isArray(o.itemsDispatched)) {
        o.itemsDispatched.forEach((it: any) => { sumOutBefore_Sim1 += getCorrectNormalizedQty(it); });
      } else {
        sumOutBefore_Sim1 += getCorrectNormalizedQty(o);
      }
    }
    if (d && d >= from && d <= to) {
      if (Array.isArray(o.itemsDispatched)) {
        o.itemsDispatched.forEach((it: any) => { despachos_Sim1 += getCorrectNormalizedQty(it); });
      } else {
        despachos_Sim1 += getCorrectNormalizedQty(o);
      }
    }
  });
  const stockInicial_Sim1 = STOCK_INICIAL_2026 + sumInBefore - sumOutBefore_Sim1;
  const stockFinal_Sim1 = stockInicial_Sim1 + ingresosPeriodo - despachos_Sim1;

  // Simulación 2: Exclusión de salidas ANULADAS
  let sumOutBefore_Sim2 = 0;
  let despachos_Sim2 = 0;
  let docsOutBeforeCount_Sim2 = 0;
  let docsOutPeriodCount_Sim2 = 0;

  allOutputs.forEach(o => {
    const status = (o.status || o.estado || "").toUpperCase();
    if (status === "ANULADO") return; // Ignorar anuladas

    const d = getNormalizedDate(o);
    if (d && d >= FECHA_BASE_2026 && d < from) {
      docsOutBeforeCount_Sim2++;
      if (Array.isArray(o.itemsDispatched)) {
        o.itemsDispatched.forEach((it: any) => { sumOutBefore_Sim2 += getNormalizedQty(it); });
      } else {
        sumOutBefore_Sim2 += getNormalizedQty(o);
      }
    }
    if (d && d >= from && d <= to) {
      docsOutPeriodCount_Sim2++;
      if (Array.isArray(o.itemsDispatched)) {
        o.itemsDispatched.forEach((it: any) => { despachos_Sim2 += getNormalizedQty(it); });
      } else {
        despachos_Sim2 += getNormalizedQty(o);
      }
    }
  });
  const stockInicial_Sim2 = STOCK_INICIAL_2026 + sumInBefore - sumOutBefore_Sim2;
  const stockFinal_Sim2 = stockInicial_Sim2 + ingresosPeriodo - despachos_Sim2;

  // Simulación 3: Eliminación de duplicados (De-duplicación por Document ID)
  let sumOutBefore_Sim3 = 0;
  let despachos_Sim3 = 0;
  let docsOutBeforeCount_Sim3 = 0;
  let docsOutPeriodCount_Sim3 = 0;

  const seenIds = new Set<string>();
  const deduplicatedOutputs = allOutputs.filter(o => {
    if (seenIds.has(o.id)) return false;
    seenIds.add(o.id);
    return true;
  });

  deduplicatedOutputs.forEach(o => {
    const d = getNormalizedDate(o);
    if (d && d >= FECHA_BASE_2026 && d < from) {
      docsOutBeforeCount_Sim3++;
      if (Array.isArray(o.itemsDispatched)) {
        o.itemsDispatched.forEach((it: any) => { sumOutBefore_Sim3 += getNormalizedQty(it); });
      } else {
        sumOutBefore_Sim3 += getNormalizedQty(o);
      }
    }
    if (d && d >= from && d <= to) {
      docsOutPeriodCount_Sim3++;
      if (Array.isArray(o.itemsDispatched)) {
        o.itemsDispatched.forEach((it: any) => { despachos_Sim3 += getNormalizedQty(it); });
      } else {
        despachos_Sim3 += getNormalizedQty(o);
      }
    }
  });
  const stockInicial_Sim3 = STOCK_INICIAL_2026 + sumInBefore - sumOutBefore_Sim3;
  const stockFinal_Sim3 = stockInicial_Sim3 + ingresosPeriodo - despachos_Sim3;

  // Simulación 4: TODO CORREGIDO (?? + Excluir Anuladas + De-duplicar IDs)
  let sumOutBefore_Sim4 = 0;
  let despachos_Sim4 = 0;
  let docsOutBeforeCount_Sim4 = 0;
  let docsOutPeriodCount_Sim4 = 0;

  const seenIds4 = new Set<string>();
  const cleanOutputs = allOutputs.filter(o => {
    if (seenIds4.has(o.id)) return false;
    seenIds4.add(o.id);
    const status = (o.status || o.estado || "").toUpperCase();
    return status !== "ANULADO";
  });

  cleanOutputs.forEach(o => {
    const d = getNormalizedDate(o);
    if (d && d >= FECHA_BASE_2026 && d < from) {
      docsOutBeforeCount_Sim4++;
      if (Array.isArray(o.itemsDispatched)) {
        o.itemsDispatched.forEach((it: any) => { sumOutBefore_Sim4 += getCorrectNormalizedQty(it); });
      } else {
        sumOutBefore_Sim4 += getCorrectNormalizedQty(o);
      }
    }
    if (d && d >= from && d <= to) {
      docsOutPeriodCount_Sim4++;
      if (Array.isArray(o.itemsDispatched)) {
        o.itemsDispatched.forEach((it: any) => { despachos_Sim4 += getCorrectNormalizedQty(it); });
      } else {
        despachos_Sim4 += getCorrectNormalizedQty(o);
      }
    }
  });
  const stockInicial_Sim4 = STOCK_INICIAL_2026 + sumInBefore - sumOutBefore_Sim4;
  const stockFinal_Sim4 = stockInicial_Sim4 + ingresosPeriodo - despachos_Sim4;

  // --- IMPRESIÓN DETALLADA DE CONSOLA PARA AUDITORÍA DE IMPACTO ---
  console.log(`%c[AUDITORÍA DE INVENTARIO] Período: ${dateFrom} al ${dateTo}`, "color: #00ffff; font-weight: bold; font-size: 14px;");
  console.log(`Cálculos Actuales (Reportado en UI):`);
  console.log(`  - Stock Inicial = ${stockInicialPeriodo}`);
  console.log(`  - Ingresos = ${ingresosPeriodo} (${docsInPeriodCount} docs)`);
  console.log(`  - Salidas = ${despachosPeriodo} (${docsOutPeriodCount} docs)`);
  console.log(`  - Stock Final = ${stockFinal} (${stockInicialPeriodo} + ${ingresosPeriodo} - ${despachosPeriodo})`);

  console.log(`\n%c--- SIMULACIÓN DE IMPACTO DE ERRORES ---`, "color: #ffcc00; font-weight: bold;");
  
  console.log(`1. Corrección Operador OR (||) -> Coalescencia Nula (??):`);
  console.log(`  - Salidas del periodo corregidas: ${despachos_Sim1} (Diferencia: ${despachos_Sim1 - despachosPeriodo} prendas)`);
  console.log(`  - Stock Inicial corregido: ${stockInicial_Sim1} (Diferencia: ${stockInicial_Sim1 - stockInicialPeriodo} prendas)`);
  console.log(`  - Stock Final simulado: ${stockFinal_Sim1} (Impacto neto en final: ${stockFinal_Sim1 - stockFinal} prendas)`);

  console.log(`2. Exclusión de Salidas ANULADAS:`);
  console.log(`  - Salidas del periodo corregidas: ${despachos_Sim2} (Diferencia: ${despachos_Sim2 - despachosPeriodo} prendas)`);
  console.log(`  - Stock Inicial corregido: ${stockInicial_Sim2} (Diferencia: ${stockInicial_Sim2 - stockInicialPeriodo} prendas)`);
  console.log(`  - Stock Final simulado: ${stockFinal_Sim2} (Impacto neto en final: ${stockFinal_Sim2 - stockFinal} prendas)`);

  console.log(`3. De-duplicación de Documentos (ID Único):`);
  console.log(`  - Salidas del periodo corregidas: ${despachos_Sim3} (Diferencia: ${despachos_Sim3 - despachosPeriodo} prendas)`);
  console.log(`  - Stock Inicial corregido: ${stockInicial_Sim3} (Diferencia: ${stockInicial_Sim3 - stockInicialPeriodo} prendas)`);
  console.log(`  - Stock Final simulado: ${stockFinal_Sim3} (Impacto neto en final: ${stockFinal_Sim3 - stockFinal} prendas)`);

  console.log(`\n%c4. SIMULACIÓN GLOBAL (TODAS LAS CORRECCIONES APLICADAS):`, "color: #00ff00; font-weight: bold;");
  console.log(`  - Stock Inicial Correcto = ${stockInicial_Sim4} (vs ${stockInicialPeriodo})`);
  console.log(`  - Ingresos Correctos = ${ingresosPeriodo} (${docsInPeriodCount} docs)`);
  console.log(`  - Salidas Correctas = ${despachos_Sim4} (vs ${despachosPeriodo})`);
  console.log(`  - Stock Final Correcto = ${stockFinal_Sim4} (Diferencia total: ${stockFinal_Sim4 - stockFinal} prendas)`);
  console.log(`  - Fórmula Correcta: ${stockInicial_Sim4} + ${ingresosPeriodo} - ${despachos_Sim4} = ${stockFinal_Sim4}`);
  console.log("=========================================================================");

  return {
    stockInicial: stockInicialPeriodo,
    ingresosPeriodo,
    despachosPeriodo,
    despachadasFacturadas,
    despachadasSinFacturar,
    stockFinal
  };
}
