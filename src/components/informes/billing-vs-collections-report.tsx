"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";

interface BillingVsCollectionsReportProps {
  invoices: any[];
  collections?: any[]; // optional, not used currently
  dateFrom: string;
  dateTo: string;
}

export function BillingVsCollectionsReport({ invoices, dateFrom, dateTo }: BillingVsCollectionsReportProps) {
  const [fechaGenerada, setFechaGenerada] = useState('');

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString('es-EC'));
  }, []);

  const reportData = useMemo(() => {
    const from = new Date(dateFrom + "T00:00:00");
    const to = new Date(dateTo + "T23:59:59");

    return invoices.filter(inv => {
      // Prefer stored Timestamp, fallback to rawDate or generic date fields
      const d = inv.fechaFactura?.toDate ? inv.fechaFactura.toDate()
        : inv.rawDate instanceof Date ? inv.rawDate
        : new Date(inv.fechaFactura || inv.date || inv.createdAt || inv.timestamp);
      return d && d >= from && d <= to;
    }).map(inv => {
      const movimientos = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : (Array.isArray((inv as any).pagosAjustes) ? (inv as any).pagosAjustes : []);
      const totalCobrado = movimientos.reduce((acc: number, p: any) => {
        if (p.anulado) return acc;
        return p.tipoTransaccion === 'Reverso' ? acc - Number(p.monto || 0) : acc + Number(p.monto || 0);
      }, 0);

      const totalFactura = Number(inv.totalFactura || inv.total || 0);
      const saldo = Math.max(0, totalFactura - totalCobrado);
      
      let estado = "Por Cobrar";
      if (saldo <= 0.01) estado = "Pagada";
      else if (totalCobrado > 0) estado = "Parcialmente Cobrada";

      return {
        id: inv.id,
        fecha: inv.fechaFactura?.toDate ? inv.fechaFactura.toDate().toLocaleDateString('es-EC') : 'S/F',
        numero: inv.numeroFactura || inv.numero || inv.id,
        cliente: inv.clienteNombre || inv.clientName || inv.cliente || "Socio",
        total: totalFactura,
        cobrado: totalCobrado,
        saldo: saldo,
        estado: estado
      };
    }).sort((a, b) => b.id.localeCompare(a.id));
  }, [invoices, dateFrom, dateTo]);

  const totals = useMemo(() => {
    return reportData.reduce((acc, curr) => ({
      total: acc.total + curr.total,
      cobrado: acc.cobrado + curr.cobrado,
      saldo: acc.saldo + curr.saldo
    }), { total: 0, cobrado: 0, saldo: 0 });
  }, [reportData]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  if (reportData.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No se encontraron facturas para el rango y filtro seleccionado.
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 print:m-0 print:p-0">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
          body { margin: 0; padding: 0; background: white !important; }
          #billing-report-area {
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            position: relative;
            font-family: 'Inter', sans-serif;
            background: white !important;
            color: black !important;
            visibility: visible !important;
          }
          .print-hidden { display: none !important; }
          .header-logo { position: absolute; top: 0; right: 0; width: 2.2cm; height: 2.2cm; object-fit: contain; }
          .header-title { font-size: 16pt; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
          .header-subtitle { font-size: 13pt; font-weight: 700; color: #3b82f6 !important; text-transform: uppercase; margin-bottom: 10px; }
          .meta-info { font-size: 9pt; font-weight: 600; color: #64748b !important; text-transform: uppercase; margin-bottom: 15px; }
          table { width: 100% !important; max-width: 100% !important; border: 1.5pt solid black !important; border-collapse: collapse !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          th { background: #f1f5f9 !important; border: 1pt solid black !important; color: black !important; font-weight: 900 !important; font-size: 8pt !important; padding: 4px 8px !important; }
          td { border: 1pt solid black !important; color: black !important; font-size: 8pt !important; padding: 3px 8px !important; line-height: 1.1; }
        }
      `}</style>

      <div className="flex justify-end gap-3 print-hidden">
        <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-8 rounded-xl gap-2 shadow-lg">
          <Printer className="h-4 w-4" /> Imprimir Informe
        </Button>
      </div>

      <div id="billing-report-area">
        <img src="/logo-lddec.png" alt="Logo" className="hidden print:block header-logo" />
        
        <div className="hidden print:block">
          <div className="header-title">LABORATORIO DEL DENIM ECUADOR</div>
          <div className="header-subtitle">Informe Facturación vs Cobranzas</div>
          <div className="meta-info">
            <p>Periodo: {dateFrom} al {dateTo}</p>
            <p>Generado el: {fechaGenerada}</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-2xl print:border-black print:rounded-none">
          <Table>
            <TableHeader className="bg-muted/50 print:bg-gray-100">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase py-5 pl-8">Fecha</TableHead>
                <TableHead className="text-[10px] font-black uppercase">N° Factura</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Cliente</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right">Total</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right">Cobrado</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right">Saldo</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center pr-8">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="py-4 pl-8 text-xs font-medium">{row.fecha}</TableCell>
                  <TableCell className="font-bold text-xs">{row.numero}</TableCell>
                  <TableCell className="text-xs font-medium uppercase">{row.cliente}</TableCell>
                  <TableCell className="text-right text-xs font-bold">{formatCurrency(row.total)}</TableCell>
                  <TableCell className="text-right text-xs font-black text-emerald-600">{formatCurrency(row.cobrado)}</TableCell>
                  <TableCell className="text-right text-xs font-black text-red-500">{formatCurrency(row.saldo)}</TableCell>
                  <TableCell className="text-center pr-8">
                    <Badge variant="outline" className={cn(
                      "text-[9px] font-black uppercase border-none px-2 py-0.5 rounded-full",
                      row.estado === "Pagada" ? "bg-emerald-500/10 text-emerald-600" : 
                      row.estado === "Parcialmente Cobrada" ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"
                    )}>
                      {row.estado}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-muted/20 print:bg-white print:border-t-2 print:border-black">
              <TableRow>
                <TableCell colSpan={3} className="text-[10px] font-black uppercase pl-8 py-4">TOTALES AUDITORÍA</TableCell>
                <TableCell className="text-right font-black text-foreground">{formatCurrency(totals.total)}</TableCell>
                <TableCell className="text-right font-black text-emerald-600">{formatCurrency(totals.cobrado)}</TableCell>
                <TableCell className="text-right font-black text-red-500">{formatCurrency(totals.saldo)}</TableCell>
                <TableCell className="pr-8"></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
