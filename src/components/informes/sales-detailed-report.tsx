"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, Receipt, FileSpreadsheet, TrendingUp, DollarSign, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { toDate } from "@/lib/toDate";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

interface SalesDetailedReportProps {
  invoices: any[];
  dateFrom: string;
  dateTo: string;
}

export function SalesDetailedReport({ invoices, dateFrom, dateTo }: SalesDetailedReportProps) {
  const [fechaGenerada, setFechaGenerada] = useState('');

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString('es-EC'));
  }, []);

  // MOTOR DE PROCESAMIENTO DE VENTAS LDDEC 1.1
  const reportData = useMemo(() => {
    return invoices.map(inv => {
      const subtotal = Number(inv.subtotal || 0);
      const iva = Number(inv.iva || 0);
      const total = Number(inv.totalFactura || inv.total || (subtotal + iva));
      const fecha = toDate(inv.fechaFactura || inv.date);
      const tipo = inv.tipoComprobante || (iva > 0 ? "Factura" : "Nota de Venta");

      return {
        id: inv.id,
        fecha: fecha ? fecha.toLocaleDateString('es-EC') : "S/F",
        numero: inv.numeroFactura || inv.numero || inv.id,
        cliente: (inv.clienteNombre || inv.clientName || "Socio").toUpperCase(),
        tipo,
        subtotal,
        iva,
        total,
        ingresoRef: inv.ingresoMaestroId || "S/R"
      };
    }).sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
  }, [invoices]);

  const totals = useMemo(() => {
    return reportData.reduce((acc, curr) => ({
      subtotal: acc.subtotal + curr.subtotal,
      iva: acc.iva + curr.iva,
      total: acc.total + curr.total
    }), { subtotal: 0, iva: 0, total: 0 });
  }, [reportData]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const handleExportExcel = () => {
    const dataForExcel = reportData.map(r => ({
      "Fecha Factura": r.fecha,
      "Nro. Comprobante": r.numero,
      "Tipo": r.tipo,
      "Socio Industrial": r.cliente,
      "Ref. Ingreso": r.ingresoRef,
      "Subtotal": r.subtotal,
      "IVA": r.iva,
      "Total Facturado": r.total
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Libro de Ventas");

    const summaryData = [
      { Métrica: "Periodo", Valor: `${dateFrom} al ${dateTo}` },
      { Métrica: "Total Subtotal", Valor: totals.subtotal },
      { Métrica: "Total IVA", Valor: totals.iva },
      { Métrica: "Total Facturación", Valor: totals.total }
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");

    XLSX.writeFile(workbook, `LDDEC_Libro_Ventas_${dateFrom}_al_${dateTo}.xlsx`);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 print:m-0 print:p-0">
      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 6mm 8mm 6mm 8mm; }
          body { margin: 0; padding: 0; background: white !important; }
          #sales-report-area {
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

      <div className="flex items-center justify-between border-b border-border pb-4 print-hidden">
        <h2 className="text-xl font-black uppercase tracking-tight">Reporte de Ventas Industriales</h2>
        <div className="flex gap-3">
          <Button onClick={handleExportExcel} variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 font-bold h-11 px-6 rounded-xl gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Exportar a Excel
          </Button>
          <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-8 rounded-xl gap-2 shadow-lg">
            <Printer className="h-4 w-4" /> Imprimir Libro de Ventas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print-hidden">
        <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-8">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Total Subtotal Bruto</p>
            <div className="flex items-end justify-between">
              <span className="text-4xl font-black tracking-tighter text-foreground">{formatCurrency(totals.subtotal)}</span>
              <TrendingUp className="h-10 w-10 text-primary/10" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-8">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">IVA Recaudado (15%)</p>
            <div className="flex items-end justify-between">
              <span className="text-4xl font-black tracking-tighter text-amber-600">{formatCurrency(totals.iva)}</span>
              <DollarSign className="h-10 w-10 text-amber-500/10" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-8">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">Ventas Netas Totales</p>
            <div className="flex items-end justify-between">
              <span className="text-5xl font-black tracking-tighter text-primary">{formatCurrency(totals.total)}</span>
              <Receipt className="h-10 w-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div id="sales-report-area">
        <img src="/logo-lddec.png" alt="Logo" className="hidden print:block header-logo" />
        
        <div className="hidden print:block">
          <div className="header-title">LABORATORIO DEL DENIM ECUADOR</div>
          <div className="header-subtitle">Libro Auxiliar de Ventas</div>
          <div className="meta-info">
            <p>Periodo: {dateFrom} al {dateTo}</p>
            <p>Generado el: {fechaGenerada}</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-2xl print:border-black print:rounded-none">
          <Table>
            <TableHeader className="bg-muted/50 print:bg-gray-100">
              <TableRow>
                <TableHead className="text-[9px] font-black uppercase py-5 pl-6">Fecha</TableHead>
                <TableHead className="text-[9px] font-black uppercase">N° Comprobante</TableHead>
                <TableHead className="text-[9px] font-black uppercase">Socio Industrial</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-center">Tipo</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-right">Subtotal</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-right">IVA</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-right pr-6">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((row, idx) => (
                <TableRow key={idx} className="border-border print:border-black hover:bg-muted/5 transition-colors">
                  <TableCell className="py-4 pl-6 text-xs font-medium">{row.fecha}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs">{row.numero}</span>
                      <span className="text-[8px] font-bold text-primary uppercase">ING: {row.ingresoRef}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-medium uppercase truncate max-w-[200px]">{row.cliente}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={cn(
                      "text-[8px] font-black uppercase border-none px-2 h-5 rounded-full",
                      row.tipo === "Factura" ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"
                    )}>
                      {row.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold text-muted-foreground">{formatCurrency(row.subtotal)}</TableCell>
                  <TableCell className="text-right text-xs font-bold text-amber-600">{formatCurrency(row.iva)}</TableCell>
                  <TableCell className="text-right pr-6 font-black text-foreground text-sm">{formatCurrency(row.total)}</TableCell>
                </TableRow>
              ))}
              {reportData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-muted-foreground/30 uppercase text-[10px] font-bold">
                    Sin registros de facturación para el periodo seleccionado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter className="bg-muted/20 print:bg-white print:border-t-2 print:border-black">
              <TableRow>
                <TableCell colSpan={4} className="text-[10px] font-black uppercase pl-6 py-5">TOTALES LIBRO DE VENTAS</TableCell>
                <TableCell className="text-right font-black text-foreground">{formatCurrency(totals.subtotal)}</TableCell>
                <TableCell className="text-right font-black text-amber-600">{formatCurrency(totals.iva)}</TableCell>
                <TableCell className="text-right pr-6 font-black text-foreground text-lg">{formatCurrency(totals.total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
