
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
 * MOTOR DE NORMALIZACIÓN DE CANTIDADES
 * Extrae el valor numérico válido de múltiples esquemas posibles.
 */
function getNormalizedQty(item: any): number {
  if (!item) return 0;
  const val = item.quantityToDispatch ?? 
              item.cantidadConfirmada ?? 
              item.quantity ?? 
              item.cantidad ?? 
              item.totalPrendas ?? 
              item.total ?? 0;
  
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

  // --- 1. CÁLCULO DE ARRASTRE (PREVIO AL PERIODO) ---
  let sumInBefore = 0;
  let sumOutBefore = 0;

  entries.forEach(e => {
    const d = getNormalizedDate(e);
    if (d && d >= FECHA_BASE_2026 && d < from) {
      const lotes = e.lotes || e.lots || [];
      lotes.forEach((l: any) => { sumInBefore += getNormalizedQty(l); });
    }
  });

  allOutputs.forEach(o => {
    const d = getNormalizedDate(o);
    if (d && d >= FECHA_BASE_2026 && d < from) {
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

  entries.forEach(e => {
    const d = getNormalizedDate(e);
    if (d && d >= from && d <= to) {
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

  return {
    stockInicial: stockInicialPeriodo,
    ingresosPeriodo,
    despachosPeriodo,
    despachadasFacturadas,
    despachadasSinFacturar,
    stockFinal
  };
}
