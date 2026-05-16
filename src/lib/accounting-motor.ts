import { toDate } from "./toDate";

export interface AccountingMetrics {
  saldoAnterior: number;
  facturacion: number;
  nd: number;
  nc: number;
  retencion: number;
  cobro: number;
  saldoActual: number;
}

const FECHA_BASE_2026 = new Date("2026-01-01T00:00:00");

/**
 * MOTOR CONTABLE CENTRAL LDDEC 1.1 - OPTIMIZADO
 * Calcula métricas contables consistentes para un cliente en un rango de fechas.
 * El saldo inicial 2026 es el ancla de toda la contabilidad.
 */
export function calculateClientAccountingMetrics(
  baseDebt: number,
  dateFrom: string,
  dateTo: string,
  invoices: any[],
  payments: any[],
  clientData?: any
): AccountingMetrics {
  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T23:59:59");

  // ASEGURAR QUE EL FILTRO "DESDE" NUNCA SEA ANTERIOR A 2026 PARA ESTA LÓGICA
  const effectiveFrom = from < FECHA_BASE_2026 ? FECHA_BASE_2026 : from;

  let previousBilling = 0;
  let previousMovementsNet = 0; 

  let periodBilling = 0;
  let periodND = 0;
  let periodNC = 0;
  let periodRetencion = 0;
  let periodCobro = 0;

  // 1. Procesar Facturación (Solo 2026+)
  invoices.forEach(inv => {
    const d = toDate(inv.fechaFactura || inv.date || inv.createdAt);
    if (!d || d < FECHA_BASE_2026) return;

    const monto = Number(inv.totalFactura || inv.total || 0);

    if (d < effectiveFrom) {
      previousBilling += monto;
    } else if (d <= to) {
      periodBilling += monto;
    }
  });

  // 2. Procesar Movimientos de Facturas (Payments)
  payments.forEach(p => {
    const d = toDate(p.fechaTransaccion || p.fecha || p.createdAt);
    if (!d || d < FECHA_BASE_2026) return;

    const monto = Number(p.monto || 0);
    const tipo = (p.tipoTransaccion || "").toString();

    let impact = 0;
    let category: 'nd' | 'nc' | 'ret' | 'cobro' | 'none' = 'cobro';

    if (tipo === 'Pago' || tipo === 'PAGO' || tipo.includes('Cruce') || tipo === 'PAGO_INICIAL') {
      impact = -monto;
      category = 'cobro';
    } else if (tipo.includes('Retención')) {
      impact = -monto;
      category = 'ret';
    } else if (tipo.includes('Crédito') || tipo.includes('Descuento')) {
      impact = -monto;
      category = 'nc';
    } else if (tipo.includes('Débito') || tipo === 'Saldo Inicial') {
      impact = monto;
      category = 'nd';
    } else if (tipo.includes('Reverso')) {
      impact = monto; 
      category = 'cobro';
    }

    if (d < effectiveFrom) {
      previousMovementsNet += impact;
    } else if (d <= to) {
      if (category === 'cobro') {
        if (tipo.includes('Reverso')) periodCobro -= monto;
        else periodCobro += monto;
      }
      else if (category === 'ret') periodRetencion += monto;
      else if (category === 'nc') periodNC += monto;
      else if (category === 'nd') periodND += monto;
    }
  });

  // 3. PROCESAR PAGOS DE SALDO INICIAL ESPECÍFICOS DEL CLIENTE (Solo 2026+)
  const pagosInicial = clientData?.pagosSaldoInicial || [];
  let siPaymentsBeforeFrom = 0;
  let siPaymentsDuringPeriod = 0;

  pagosInicial.forEach((p: any) => {
    if (p.anulado) return;
    const d = toDate(p.fechaTransaccion || p.fecha);
    if (!d || d < FECHA_BASE_2026) return;

    const monto = Number(p.monto || 0);
    if (d < effectiveFrom) {
      siPaymentsBeforeFrom += monto;
    } else if (d <= to) {
      siPaymentsDuringPeriod += monto;
    }
  });

  // Saldo Anterior = (Deuda Base 2026 - Pagos SI previos) + (Ventas previas - Pagos Facturas previos)
  const saldoAnteriorCalculado = baseDebt - siPaymentsBeforeFrom + previousBilling + previousMovementsNet;
  
  // Ajustar cobro del periodo con los pagos al saldo inicial que ocurrieron en el rango
  const finalPeriodCobro = periodCobro + siPaymentsDuringPeriod;

  const saldoActual = saldoAnteriorCalculado + periodBilling + periodND - periodNC - periodRetencion - finalPeriodCobro;

  return {
    saldoAnterior: saldoAnteriorCalculado,
    facturacion: periodBilling,
    nd: periodND,
    nc: periodNC,
    retencion: periodRetencion,
    cobro: finalPeriodCobro,
    saldoActual
  };
}
