"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { toDate } from "@/lib/toDate";
import { formatClientName } from "@/lib/format-name";

interface CollectionsDetailedReportProps {
  collections: any[];
  dateFrom: string;
  dateTo: string;
  client?: any;
}

export function CollectionsDetailedReport({ collections, dateFrom, dateTo, client }: CollectionsDetailedReportProps) {
  const [fechaGenerada, setFechaGenerada] = useState('');

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString('es-EC'));
  }, []);

  const reportLines = useMemo(() => {
    const from = new Date(dateFrom + "T00:00:00");
    const to = new Date(dateTo + "T23:59:59");
    const safeCollections = Array.isArray(collections) ? collections : [];
    
    // Usaremos un Map para evitar duplicados entre cobros globales y cobros embebidos
    const uniqueLines = new Map<string, any>();
    
    safeCollections.forEach(col => {
      if (!col) return;

      // Filtrar por cliente si se seleccionó uno específico
      if (client && client.id && col.clientId !== client.id && col.clienteId !== client.id) {
        return;
      }

      // Comprobar si tiene estructura anidada (por ejemplo, si es una factura o un documento legacy con sub-pagos)
      const hasNested = (Array.isArray(col.pagosYajustes) && col.pagosYajustes.length > 0) || (Array.isArray(col.pagosAjustes) && col.pagosAjustes.length > 0);

      if (hasNested) {
        const movimientos = Array.isArray(col.pagosYajustes) ? col.pagosYajustes : (Array.isArray(col.pagosAjustes) ? col.pagosAjustes : []);
        movimientos.forEach((p: any) => {
          if (!p || p.anulado) return;

          // Obtener y validar la fecha del pago individual
          const pDate = toDate(p.fechaTransaccion || p.fecha || col.fechaFactura || col.date);
          if (!pDate || pDate < from || pDate > to) return; // FILTRAR ESTRICTAMENTE POR FECHA DE COBRO

          const normalizedTipo = String(p.tipoTransaccion || p.tipo || "PAGO").trim().toUpperCase();
          const normalizedMetodo = String(p.metodoPago || "S/D").trim().toUpperCase();
          const montoVal = Number(p.monto || 0);
          const timeVal = pDate.getTime();
          
          // Generar una clave de deduplicación segura basada en datos transaccionales clave
          const key = `${normalizedTipo}-${montoVal}-${timeVal}-${normalizedMetodo}`;
          
          if (!uniqueLines.has(key)) {
            uniqueLines.set(key, {
              fecha: pDate,
              cliente: formatClientName(col.clienteNombre || col.clientName || col.cliente || "Socio"),
              documento: `FACT: ${col.numeroFactura || col.numero || col.id}`,
              tipo: p.tipoTransaccion || "PAGO",
              metodo: p.metodoPago || "S/D",
              monto: montoVal
            });
          }
        });
      } else {
        // Estructura plana (pago individual de la colección 'payments')
        if (col.anulado) return;

        const pDate = toDate(col.fechaTransaccion || col.fecha || col.createdAt || col.date);
        if (!pDate || pDate < from || pDate > to) return; // FILTRAR ESTRICTAMENTE POR FECHA DE COBRO

        const normalizedTipo = String(col.tipoTransaccion || col.tipo || "PAGO").trim().toUpperCase();
        const normalizedMetodo = String(col.metodoPago || "S/D").trim().toUpperCase();
        const montoVal = Number(col.monto || 0);
        const timeVal = pDate.getTime();

        // Generar una clave de deduplicación segura basada en datos transaccionales clave
        const key = `${normalizedTipo}-${montoVal}-${timeVal}-${normalizedMetodo}`;

        if (!uniqueLines.has(key)) {
          uniqueLines.set(key, {
            fecha: pDate,
            cliente: formatClientName(col.clienteNombre || col.clientName || col.cliente || "Socio"),
            documento: col.numeroFactura ? `FACT: ${col.numeroFactura}` : (col.facturaId ? `FACT ID: ${col.facturaId}` : "S/D"),
            tipo: col.tipoTransaccion || "PAGO",
            metodo: col.metodoPago || "S/D",
            monto: montoVal
          });
        }
      }
    });
    
    const lines = Array.from(uniqueLines.values());
    
    return lines.sort((a, b) => {
      const dateA = toDate(a.fecha);
      const dateB = toDate(b.fecha);
      return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
    });
  }, [collections, client, dateFrom, dateTo]);

  const metrics = useMemo(() => {
    const recaudacionEfectiva = reportLines
      .filter(l => l.tipo === "Pago" || l.tipo === "Descuento Pronto Pago" || l.tipo === "PAGO")
      .reduce((acc, curr) => acc + curr.monto, 0);
    const ajustesContables = reportLines
      .filter(l => l.tipo === "Retención" || l.tipo === "Nota de Crédito" || l.tipo === "RETENCION")
      .reduce((acc, curr) => acc + curr.monto, 0);
    const totalTransaccionado = reportLines.reduce((acc, curr) => acc + curr.monto, 0);
    return { recaudacionEfectiva, ajustesContables, totalTransaccionado };
  }, [reportLines]);

  const formatDateShort = (val: any) => {
    const d = toDate(val);
    if (!d) return "---";
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const formatNum = (val: number) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 print:m-0 print:p-0">
      <style jsx global>{`
        /* ESTILOS DE VISTA PREVIA E IMPRESIÓN (INTER & TABULAR NUMS) */
        #statement-report {
          font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
          color: #0f172a !important;
          background: #ffffff !important;
          opacity: 1 !important;
          filter: none !important;
        }
        #statement-report table {
          border: 1pt solid #1e293b !important;
          font-variant-numeric: tabular-nums !important;
        }
        #statement-report th, #statement-report td {
          border: 0.5pt solid #334155 !important;
          color: #0f172a !important;
          opacity: 1 !important;
          font-variant-numeric: tabular-nums !important;
        }
        #statement-report .text-black-solid {
          color: #0f172a !important;
          font-weight: 700;
        }

        @media print {
          @page { size: A4 portrait; margin: 6mm 8mm 6mm 8mm; }
          body, #statement-report { font-family: 'Inter', system-ui, -apple-system, sans-serif !important; background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
          .print-hidden { display: none !important; }
          #statement-report { padding: 0 !important; width: 100% !important; max-width: 100% !important; border: none !important; box-shadow: none !important; display: block !important; }
          table { width: 100% !important; max-width: 100% !important; border: 0.5pt solid black !important; border-collapse: collapse !important; font-variant-numeric: tabular-nums !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          th { border: 0.5pt solid black !important; font-size: 9pt !important; padding: 3px 5px !important; background: #f1f5f9 !important; color: black !important; font-weight: 600 !important; }
          td { border: 0.5pt solid black !important; font-size: 9pt !important; padding: 3px 5px !important; color: black !important; font-variant-numeric: tabular-nums !important; }
          .font-black { font-weight: 700 !important; }
        }
      `}</style>

      {/* --- BOTONES Y ENCABEZADO UI --- */}
      <div className="flex items-center justify-between border-b border-border pb-4 print-hidden">
        <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900">Detalle de Cobranzas</h2>
        <Button onClick={() => window.print()} className="bg-slate-900 hover:bg-slate-800 text-white font-semibold h-11 px-8 rounded-xl gap-2 shadow-lg">
          <Printer className="h-4 w-4" /> EJECUTAR IMPRESIÓN
        </Button>
      </div>

      {/* --- TABLA HTML (UI NORMAL) --- */}
      <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-2xl print-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-[10px] font-bold uppercase py-5 pl-8">Fecha</TableHead>
              <TableHead className="text-[10px] font-bold uppercase">Cliente</TableHead>
              <TableHead className="text-[10px] font-bold uppercase">Documento</TableHead>
              <TableHead className="text-[10px] font-bold uppercase">Tipo / Método</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-right pr-8">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="tabular-nums">
            {reportLines.map((row, idx) => (
              <TableRow key={`ui-${idx}`}>
                <TableCell className="py-4 pl-8 text-xs font-medium">{formatDateShort(row.fecha)}</TableCell>
                <TableCell className="text-xs font-bold uppercase truncate block max-w-[220px]">{row.cliente}</TableCell>
                <TableCell className="text-xs font-medium uppercase">{row.documento}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase text-slate-900">{row.tipo}</span>
                    <span className="text-[9px] font-medium text-slate-500">{row.metodo}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right pr-8 font-bold text-emerald-600 text-xs tabular-nums">{formatCurrency(row.monto)}</TableCell>
              </TableRow>
            ))}
            {reportLines.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center text-xs italic text-zinc-500">Sin cobranzas en el periodo</TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter className="bg-muted/20">
            <TableRow>
              <TableCell colSpan={4} className="text-[10px] font-bold uppercase pl-8 py-4">TOTAL RECAUDACIÓN PERÍODO</TableCell>
              <TableCell className="text-right pr-8 font-bold text-foreground text-lg tabular-nums">{formatCurrency(metrics.totalTransaccionado)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* --- PREVIEW IMPRIMIBLE (FORMATO CONTABLE) --- */}
      <div className="pt-10 print-hidden">
        <h3 className="text-lg font-bold uppercase text-primary mb-4 tracking-tight">Previsualización del Documento</h3>
      </div>

      <div id="statement-report" className="font-sans text-slate-900 bg-white p-4 min-w-[800px] border border-zinc-200 shadow-lg print:border-none print:shadow-none report-font tabular-nums">
        {/* 1. ENCABEZADO */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div className="space-y-1">
            <h1 className="text-lg font-bold leading-none tracking-tight text-slate-900">LABORATORIO DEL DENIM ECUADOR LDDEC CÍA LTDA</h1>
            <h2 className="text-md font-bold uppercase text-black">Informe Detallado de Cobranzas</h2>
            <div className="text-[10px] font-bold flex gap-4 uppercase text-black">
              <span>DESDE: {dateFrom}</span>
              <span>HASTA: {dateTo}</span>
            </div>
          </div>
          <div className="text-right space-y-1 text-black">
            <p className="text-[10px] font-bold uppercase">Fecha Gen: {fechaGenerada}</p>
            <p className="text-[10px] font-bold uppercase">Página: 1 de 1</p>
          </div>
        </div>

        {/* 2. DATOS DEL CLIENTE */}
        <div className="flex justify-between items-end mb-6 text-[11px] text-black">
          <div className="space-y-1">
            {client ? (
              <>
                <p><span className="font-bold">Cliente:</span> {formatClientName(client.name || client.clienteNombre || "S/D")}</p>
                <p><span className="font-bold">Zona:</span> {client.zona || "GENERAL"}</p>
                <p><span className="font-bold">Vendedor:</span> MATRIZ AMBATO</p>
                <p><span className="font-bold">Teléfono:</span> {client.phone || "S/D"}</p>
              </>
            ) : (
              <p className="font-bold text-sm uppercase">REPORTE GENERAL DE COBRANZAS (TODOS LOS CLIENTES)</p>
            )}
          </div>
          <div className="text-right space-y-1 font-bold">
            <p className="text-lg font-black">Total Periodo: ${formatNum(metrics.totalTransaccionado)}</p>
          </div>
        </div>

        {/* 3. TABLA PRINCIPAL */}
        <div className="border border-black overflow-hidden bg-white">
          <Table className="border-collapse w-full">
            <TableHeader>
              <TableRow className="bg-zinc-100 border-b border-black">
                <TableHead className="h-8 text-black font-bold p-1 text-[10px] uppercase border-r border-black">Fecha</TableHead>
                <TableHead className="h-8 text-black font-bold p-1 text-[10px] uppercase border-r border-black">Cliente</TableHead>
                <TableHead className="h-8 text-black font-bold p-1 text-[10px] uppercase border-r border-black">Documento</TableHead>
                <TableHead className="h-8 text-black font-bold p-1 text-[10px] uppercase border-r border-black">Tipo / Método</TableHead>
                <TableHead className="h-8 text-black font-bold p-1 text-[10px] uppercase text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportLines.map((row, idx) => (
                <TableRow key={`print-${idx}`} className="border-b border-black last:border-0">
                  <TableCell className="p-1 text-[10px] border-r border-black text-black">{formatDateShort(row.fecha)}</TableCell>
                  <TableCell className="p-1 text-[10px] border-r border-black font-bold uppercase truncate max-w-[200px] text-black">{row.cliente}</TableCell>
                  <TableCell className="p-1 text-[10px] border-r border-black text-black">{row.documento}</TableCell>
                  <TableCell className="p-1 text-[10px] border-r border-black text-black">
                    <span className="font-bold block leading-none">{row.tipo}</span>
                    <span className="text-[9px] block leading-none mt-1">{row.metodo}</span>
                  </TableCell>
                  <TableCell className="p-1 text-[11px] font-black text-right text-black">${formatNum(row.monto)}</TableCell>
                </TableRow>
              ))}
              {reportLines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-xs italic text-zinc-500 bg-white">Sin cobranzas en el periodo</TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter className="bg-zinc-50 font-bold border-t border-black">
              <TableRow>
                <TableCell colSpan={4} className="p-2 text-[11px] uppercase text-right border-r border-black text-black">TOTAL RECAUDACIÓN PERÍODO:</TableCell>
                <TableCell className="p-2 text-[12px] text-right font-black text-black">${formatNum(metrics.totalTransaccionado)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* 6. FIRMAS */}
        <div className="mt-20 flex justify-between px-10 text-[10px] font-bold uppercase text-black">
          <div className="border-t border-black pt-2 w-48 text-center">Elaborado por</div>
          <div className="border-t border-black pt-2 w-48 text-center">Autorizado por</div>
          <div className="border-t border-black pt-2 w-48 text-center">Recibí Conforme</div>
        </div>
      </div>
    </div>
  );
}
