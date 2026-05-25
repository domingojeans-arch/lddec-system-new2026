"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, FileText } from "lucide-react";
import { toDate } from "@/lib/toDate";

interface StatementOfAccountsDetailedProps {
  client: any;
  invoices: any[];
  dateFrom: string;
  dateTo: string;
}

/**
 * REPORTE: SALDOS DOCUMENTOS AGRUPADOS POR CLIENTE (LDDEC 1.1)
 * Formato Contable Industrial - Blanco y Negro - Líneas Finas
 * Optimizado para máxima legibilidad tanto en pantalla (Preview) como en papel.
 */
export function StatementOfAccountsDetailed({ client, invoices, dateFrom, dateTo }: StatementOfAccountsDetailedProps) {
  const [fechaGenerada, setFechaGenerada] = useState('');
  const saldoAnterior = Number(client?.baseDebt || client?.saldoInicial || 0);

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString('es-EC'));
  }, []);

  const reportRows = useMemo(() => {
    const today = new Date();
    const from = new Date(dateFrom + "T00:00:00");
    const to = new Date(dateTo + "T23:59:59");

    return invoices
      .filter(inv => {
        const d = toDate(inv.fechaFactura || inv.date);
        const belongsToClient = !client?.id || inv.clientId === client.id || inv.clienteId === client.id;
        return d && d >= from && d <= to && belongsToClient;
      })
      .map(inv => {
        const totalFactura = Number(inv.totalFactura || inv.total || 0);
        const movimientos = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : [];
        
        const totalHaber = movimientos.reduce((acc: number, p: any) => {
          if (p.anulado) return acc;
          return p.tipoTransaccion === 'Reverso' ? acc - Number(p.monto || 0) : acc + Number(p.monto || 0);
        }, 0);

        const saldo = Math.max(0, totalFactura - totalHaber);
        const emissionDate = toDate(inv.fechaFactura || inv.date) || new Date();
        
        // Cálculo de Días Vencidos (Hoy - Fecha Emisión según requerimiento)
        const diffTime = today.getTime() - emissionDate.getTime();
        const diasVencidos = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return {
          tipDoc: inv.tipoComprobante === "Nota de Venta" ? "NV" : "FC",
          documento: inv.numeroFactura || inv.numero || inv.id,
          emision: emissionDate.toLocaleDateString('es-EC'),
          vence: emissionDate.toLocaleDateString('es-EC'), // CAMPO PENDIENTE EN BD (Vencimiento específico)
          vend: "00001", // CAMPO PENDIENTE EN BD (Código Vendedor)
          fac: "1",
          diasV: Math.max(0, diasVencidos),
          debe: totalFactura,
          haber: totalHaber,
          saldo: saldo,
          retencion: "" // CAMPO PENDIENTE EN BD (Número de Retención asociado)
        };
      })
      .sort((a, b) => a.documento.localeCompare(b.documento));
  }, [invoices, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const debe = reportRows.reduce((acc, curr) => acc + curr.debe, 0);
    const haber = reportRows.reduce((acc, curr) => acc + curr.haber, 0);
    const saldoAnteriorVal = Number(client?.baseDebt || client?.saldoInicial || 0);
    const saldoFinal = (saldoAnteriorVal + debe) - haber;
    return { debe, haber, saldo: saldoFinal };
  }, [reportRows, client]);

  const portfolioSummary = useMemo(() => {
    const vencido = reportRows.reduce((acc, curr) => curr.diasV > 30 ? acc + curr.saldo : acc, 0);
    const alDia = Math.max(0, totals.saldo - vencido);
    const pctVencido = totals.saldo > 0 ? (vencido / totals.saldo) * 100 : 0;
    
    return { vencido, alDia, pctVencido };
  }, [reportRows, totals]);

  const formatNum = (val: number) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 bg-white p-6 rounded-xl border border-zinc-200 shadow-lg overflow-x-auto" style={{ isolation: 'isolate' }}>
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
          #statement-report { padding: 0 !important; width: 100% !important; border: none !important; box-shadow: none !important; }
          table { border: 0.5pt solid black !important; border-collapse: collapse !important; width: 100% !important; }
          th { border: 0.5pt solid black !important; font-size: 8pt !important; padding: 2px 4px !important; background: #eee !important; color: black !important; font-weight: bold !important; }
          td { border: 0.5pt solid black !important; font-size: 8pt !important; padding: 2px 4px !important; color: black !important; }
          .font-black { font-weight: 900 !important; }
        }
      `}</style>

      <div className="flex justify-between items-center print:hidden border-b border-zinc-200 pb-4">
        <h3 className="text-lg font-black uppercase text-primary">Previsualización del Documento</h3>
        <Button onClick={() => window.print()} className="bg-black text-white hover:bg-zinc-800 font-bold h-12 px-10 rounded-none gap-2 shadow-xl">
          <Printer className="h-5 w-5" /> EJECUTAR IMPRESIÓN
        </Button>
      </div>

      <div id="statement-report" className="font-mono text-black bg-white p-2 min-w-[800px]">
        {/* 1. ENCABEZADO */}
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
          <div className="space-y-1">
            <h1 className="text-lg font-black leading-none text-black-solid">LABORATORIO DEL DENIM ECUADOR LDDEC CÍA LTDA</h1>
            <h2 className="text-md font-bold uppercase text-black">Saldos Documentos Agrupados x Cliente</h2>
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
            <p><span className="font-bold">Cliente:</span> {(client?.name || client?.clienteNombre || "S/D").toUpperCase()}</p>
            <p><span className="font-bold">Zona:</span> {client?.zona || "GENERAL"}</p>
            <p><span className="font-bold">Vendedor:</span> MATRIZ AMBATO</p>
            <p><span className="font-bold">Teléfono:</span> {client?.phone || "S/D"}</p>
          </div>
          <div className="text-right space-y-1 font-bold">
            <p>Saldo sin sustento: 0.00</p>
            <p className="text-lg font-black">Saldo con sustento: {formatNum(totals.saldo)}</p>
          </div>
        </div>

        {/* LÍNEA INFORMATIVA DE SALDO ANTERIOR */}
        <div className="mb-4 text-xs font-bold text-black border-l-4 border-black pl-3 py-1 uppercase tracking-wider">
          Saldo Anterior Arrastrado: ${formatNum(saldoAnterior)}
        </div>

        {/* 3. TABLA PRINCIPAL */}
        <div className="border border-black overflow-x-auto bg-white">
          <Table className="border-collapse w-full">
            <TableHeader>
              <TableRow className="bg-zinc-100 hover:bg-zinc-100 border-b border-black">
                <TableHead className="h-8 text-black font-bold p-1 text-[9px] uppercase border-r border-black">TipDoc</TableHead>
                <TableHead className="h-8 text-black font-bold p-1 text-[9px] uppercase border-r border-black">Documento</TableHead>
                <TableHead className="h-8 text-black font-bold p-1 text-[9px] uppercase border-r border-black">Emisión</TableHead>
                <TableHead className="h-8 text-black font-bold p-1 text-[9px] uppercase border-r border-black">Vence</TableHead>
                <TableHead className="h-8 text-black font-bold p-1 text-[9px] uppercase border-r border-black text-center">Vend</TableHead>
                <TableHead className="h-8 text-black font-bold p-1 text-[9px] uppercase border-r border-black text-center">FAC</TableHead>
                <TableHead className="h-8 text-black font-bold p-1 text-[9px] uppercase border-r border-black text-center">Días V.</TableHead>
                <TableHead className="h-8 text-black font-bold p-1 text-[9px] uppercase border-r border-black text-right">Debe</TableHead>
                <TableHead className="h-8 text-black font-bold p-1 text-[9px] uppercase border-r border-black text-right">Haber</TableHead>
                <TableHead className="h-8 text-black font-bold p-1 text-[9px] uppercase border-r border-black text-right">Saldo</TableHead>
                <TableHead className="h-8 text-black font-bold p-1 text-[9px] uppercase">No. Reten</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportRows.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-zinc-50 border-b border-black last:border-0">
                  <TableCell className="p-1 text-[10px] border-r border-black text-black">{row.tipDoc}</TableCell>
                  <TableCell className="p-1 text-[10px] border-r border-black font-bold text-black">{row.documento}</TableCell>
                  <TableCell className="p-1 text-[10px] border-r border-black text-black">{row.emision}</TableCell>
                  <TableCell className="p-1 text-[10px] border-r border-black text-black">{row.vence}</TableCell>
                  <TableCell className="p-1 text-[10px] border-r border-black text-center text-black">{row.vend}</TableCell>
                  <TableCell className="p-1 text-[10px] border-r border-black text-center text-black">{row.fac}</TableCell>
                  <TableCell className="p-1 text-[10px] border-r border-black text-center text-black">{row.diasV}</TableCell>
                  <TableCell className="p-1 text-[10px] border-r border-black text-right font-bold text-black">{formatNum(row.debe)}</TableCell>
                  <TableCell className="p-1 text-[10px] border-r border-black text-right text-black">{formatNum(row.haber)}</TableCell>
                  <TableCell className="p-1 text-[10px] border-r border-black text-right font-black text-black">{formatNum(row.saldo)}</TableCell>
                  <TableCell className="p-1 text-[10px] text-black">{row.retencion}</TableCell>
                </TableRow>
              ))}
              {reportRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="h-20 text-center text-xs italic text-zinc-500 bg-white">Sin documentos en el rango seleccionado</TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter className="bg-zinc-50 font-bold border-t border-black">
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="p-2 text-[10px] uppercase text-right border-r border-black text-black">Totales General:</TableCell>
                <TableCell className="p-2 text-[10px] text-right border-r border-black text-black">{formatNum(totals.debe)}</TableCell>
                <TableCell className="p-2 text-[10px] text-right border-r border-black text-black">{formatNum(totals.haber)}</TableCell>
                <TableCell className="p-2 text-[10px] text-right font-black text-black">{formatNum(totals.saldo)}</TableCell>
                <TableCell className="p-2"></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* 7. RESUMEN DE CARTERA */}
        <div className="mt-8 flex justify-end">
          <div className="w-[300px] border-2 border-black p-4 space-y-2 text-[11px] text-black bg-white">
            <h4 className="font-black border-b border-black pb-1 uppercase mb-2">Resumen de Cartera</h4>
            <div className="flex justify-between"><span>Vencido:</span><span className="font-bold">{formatNum(portfolioSummary.vencido)}</span></div>
            <div className="flex justify-between"><span>Al día:</span><span className="font-bold">{formatNum(portfolioSummary.alDia)}</span></div>
            <div className="flex justify-between border-t border-black pt-1"><span>% Vencido:</span><span className="font-bold">{portfolioSummary.pctVencido.toFixed(2)}%</span></div>
            <div className="flex justify-between"><span>% Cartera:</span><span className="font-bold">100.00%</span></div>
          </div>
        </div>

        <div className="mt-20 flex justify-between px-10 text-[10px] font-bold uppercase text-black">
          <div className="border-t border-black pt-2 w-48 text-center">Elaborado por</div>
          <div className="border-t border-black pt-2 w-48 text-center">Autorizado por</div>
          <div className="border-t border-black pt-2 w-48 text-center">Recibí Conforme</div>
        </div>
      </div>
    </div>
  );
}
