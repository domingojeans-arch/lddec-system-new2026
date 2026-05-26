"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowDownCircle, Shirt, Package } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface EntriesDetailedReportProps {
  entries: any[];
  dateFrom: string;
  dateTo: string;
}

export function EntriesDetailedReport({ entries, dateFrom, dateTo }: EntriesDetailedReportProps) {
  const [fechaGenerada, setFechaGenerada] = useState('');

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString('es-EC'));
  }, []);

  const prodEntries = entries.filter(e => !e.isSample);
  const sampleEntries = entries.filter(e => e.isSample);

  const prodPrendas = prodEntries.reduce((acc, e) => {
    const rawLots = e.lotes || e.lots || [];
    return acc + rawLots.reduce((lotAcc: number, lot: any) => {
      const val = lot.cantidad || lot.quantity || lot.cantidadConfirmada || 0;
      return lotAcc + Number(val || 0);
    }, 0);
  }, 0);

  const samplePrendas = sampleEntries.reduce((acc, e) => {
    const rawLots = e.lotes || e.lots || [];
    return acc + rawLots.reduce((lotAcc: number, lot: any) => {
      const val = lot.cantidad || lot.quantity || lot.cantidadConfirmada || 0;
      return lotAcc + Number(val || 0);
    }, 0);
  }, 0);

  const formatNum = (val: number) => {
    return Math.floor(val).toLocaleString('es-ES');
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 print:m-0 print:p-0">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
          body { margin: 0; padding: 0; background: white !important; }
          #entries-report-area {
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print-hidden">
        <Card className="bg-card border-border shadow-sm rounded-[1.5rem]">
          <CardContent className="p-8">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-4">Prendas Producción</p>
            <div className="flex items-end justify-between">
              <span className="text-6xl font-black tracking-tighter text-foreground">{formatNum(prodPrendas)}</span>
              <Shirt className="h-10 w-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm rounded-[1.5rem]">
          <CardContent className="p-8">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-4">Prendas Muestras</p>
            <div className="flex items-end justify-between">
              <span className="text-6xl font-black tracking-tighter text-primary">{formatNum(samplePrendas)}</span>
              <Package className="h-10 w-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm rounded-[1.5rem]">
          <CardContent className="p-8">
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4">Total Ingresado</p>
            <div className="flex items-end justify-between">
              <span className="text-6xl font-black tracking-tighter text-emerald-600">{formatNum(prodPrendas + samplePrendas)}</span>
              <ArrowDownCircle className="h-10 w-10 text-emerald-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div id="entries-report-area">
        <img src="/logo-lddec.png" alt="Logo" className="hidden print:block header-logo" />
        
        <div className="hidden print:block">
          <div className="header-title">LABORATORIO DEL DENIM ECUADOR</div>
          <div className="header-subtitle">Informe Detallado de Ingresos</div>
          <div className="meta-info">
            <p>Periodo: {dateFrom} al {dateTo}</p>
            <p>Generado el: {fechaGenerada}</p>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight print:text-black px-2">Ingresos de Producción</h3>
            <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-2xl print:border-black print:rounded-none">
              <Table>
                <TableHeader className="bg-muted/50 print:bg-gray-100">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase py-5 pl-8">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">N° Ingreso</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Cliente</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">Lotes</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right pr-8">Prendas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prodEntries.length > 0 ? prodEntries.map((e) => {
                    const rawLots = e.lotes || e.lots || [];
                    const qty = rawLots.reduce((acc: number, l: any) => {
                      const val = l.cantidad || l.quantity || l.cantidadConfirmada || 0;
                      return acc + Number(val || 0);
                    }, 0);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="py-4 pl-8 text-xs font-medium">
                          {e.date?.toDate ? e.date.toDate().toLocaleDateString('es-EC') : (e.entryDate || 'S/F')}
                        </TableCell>
                        <TableCell className="font-bold text-xs">{e.id}</TableCell>
                        <TableCell className="text-xs font-medium uppercase truncate max-w-[200px]">{e.clientName || e.clienteNombre || "Socio"}</TableCell>
                        <TableCell className="text-center text-xs">{rawLots.length}</TableCell>
                        <TableCell className="text-right pr-8 font-black text-foreground">{formatNum(qty)}</TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground/30 uppercase text-[10px] font-bold">Sin ingresos de producción</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight print:text-black px-2">Ingresos de Muestras</h3>
            <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-2xl print:border-black print:rounded-none">
              <Table>
                <TableHeader className="bg-muted/50 print:bg-gray-100">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase py-5 pl-8">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">N° Ingreso</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Cliente</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">Lotes</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right pr-8">Prendas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleEntries.length > 0 ? sampleEntries.map((e) => {
                    const rawLots = e.lotes || e.lots || [];
                    const qty = rawLots.reduce((acc: number, l: any) => {
                      const val = l.cantidad || l.quantity || l.cantidadConfirmada || 0;
                      return acc + Number(val || 0);
                    }, 0);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="py-4 pl-8 text-xs font-medium">
                          {e.date?.toDate ? e.date.toDate().toLocaleDateString('es-EC') : (e.entryDate || 'S/F')}
                        </TableCell>
                        <TableCell className="font-bold text-xs">{e.id}</TableCell>
                        <TableCell className="text-xs font-medium uppercase truncate max-w-[200px]">{e.clientName || e.clienteNombre || "Socio"}</TableCell>
                        <TableCell className="text-center text-xs">{rawLots.length}</TableCell>
                        <TableCell className="text-right pr-8 font-black text-primary">{formatNum(qty)}</TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground/30 uppercase text-[10px] font-bold">Sin ingresos de muestras</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end print-hidden">
        <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] px-12 h-14 rounded-2xl shadow-xl shadow-primary/20">
          <Printer className="h-5 w-5 mr-3" /> Imprimir Reporte de Ingresos
        </Button>
      </div>
    </div>
  );
}
