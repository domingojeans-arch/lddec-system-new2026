"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { toDate } from "@/lib/toDate";

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
    const lines: any[] = [];
    
    collections.forEach(col => {
      // Filtrar por cliente si se seleccionó uno específico
      if (client && client.id && col.clientId !== client.id && col.clienteId !== client.id) {
        return;
      }

      const movimientos = Array.isArray(col.pagosYajustes) ? col.pagosYajustes : (Array.isArray(col.pagosAjustes) ? col.pagosAjustes : []);
      movimientos.forEach((p: any) => {
        if (p.anulado) return;

        lines.push({
          fecha: p.fechaTransaccion || p.fecha || col.fechaFactura || col.date,
          cliente: col.clienteNombre || col.clientName || col.cliente || "Socio",
          documento: `FACT: ${col.numeroFactura || col.numero || col.id}`,
          tipo: p.tipoTransaccion || "PAGO",
          metodo: p.metodoPago || "S/D",
          monto: Number(p.monto || 0)
        });
      });
    });
    
    return lines.sort((a, b) => {
      const dateA = toDate(a.fecha);
      const dateB = toDate(b.fecha);
      return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
    });
  }, [collections, client]);

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
        /* ESTILOS DE VISTA PREVIA (PANTALLA) */
        #statement-report {
          color: #000000 !important;
          background: #ffffff !important;
          opacity: 1 !important;
          filter: none !important;
        }
        #statement-report table {
          border: 1pt solid #000000 !important;
        }
        #statement-report th, #statement-report td {
          border: 0.5pt solid #000000 !important;
          color: #000000 !important;
          opacity: 1 !important;
        }
        #statement-report .text-black-solid {
          color: #000000 !important;
          font-weight: 700;
        }

        @media print {
          @page { size: portrait; margin: 1cm; }
          body { background: white !important; color: black !important; }
          .print-hidden { display: none !important; }
          #statement-report { padding: 0 !important; width: 100% !important; border: none !important; box-shadow: none !important; display: block !important; }
          table { border: 0.5pt solid black !important; border-collapse: collapse !important; width: 100% !important; }
          th { border: 0.5pt solid black !important; font-size: 8pt !important; padding: 2px 4px !important; background: #eee !important; color: black !important; font-weight: bold !important; }
          td { border: 0.5pt solid black !important; font-size: 8pt !important; padding: 2px 4px !important; color: black !important; }
          .font-black { font-weight: 900 !important; }
        }
      `}</style>

      {/* --- BOTONES Y ENCABEZADO UI --- */}
      <div className="flex items-center justify-between border-b border-border pb-4 print-hidden">
        <h2 className="text-xl font-black uppercase tracking-tight">Detalle de Cobranzas</h2>
        <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-8 rounded-xl gap-2 shadow-lg">
          <Printer className="h-4 w-4" /> EJECUTAR IMPRESIÓN
        </Button>
      </div>

      {/* --- TABLA HTML (UI NORMAL) --- */}
      <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-2xl print-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase py-5 pl-8">Fecha</TableHead>
              <TableHead className="text-[10px] font-black uppercase">Cliente</TableHead>
              <TableHead className="text-[10px] font-black uppercase">Documento</TableHead>
              <TableHead className="text-[10px] font-black uppercase">Tipo / Método</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-right pr-8">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportLines.map((row, idx) => (
              <TableRow key={`ui-${idx}`}>
                <TableCell className="py-4 pl-8 text-xs font-medium">{formatDateShort(row.fecha)}</TableCell>
                <TableCell className="text-xs font-bold uppercase truncate block max-w-[220px]">{row.cliente}</TableCell>
                <TableCell className="text-xs font-medium uppercase">{row.documento}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase">{row.tipo}</span>
                    <span className="text-[9px] font-medium text-muted-foreground">{row.metodo}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right pr-8 font-black text-emerald-600">{formatCurrency(row.monto)}</TableCell>
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
              <TableCell colSpan={4} className="text-[10px] font-black uppercase pl-8 py-4">TOTAL RECAUDACIÓN PERÍODO</TableCell>
              <TableCell className="text-right pr-8 font-black text-foreground text-lg">{formatCurrency(metrics.totalTransaccionado)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* --- PREVIEW IMPRIMIBLE (FORMATO CONTABLE) --- */}
      <div className="pt-10 print-hidden">
        <h3 className="text-lg font-black uppercase text-primary mb-4">Previsualización del Documento</h3>
      </div>

      <div id="statement-report" className="font-mono text-black bg-white p-2 min-w-[800px] border border-zinc-200 shadow-lg print:border-none print:shadow-none">
        {/* 1. ENCABEZADO */}
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
          <div className="space-y-1">
            <h1 className="text-lg font-black leading-none text-black-solid">LABORATORIO DEL DENIM ECUADOR LDDEC CÍA LTDA</h1>
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
                <p><span className="font-bold">Cliente:</span> {(client.name || client.clienteNombre || "S/D").toUpperCase()}</p>
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
