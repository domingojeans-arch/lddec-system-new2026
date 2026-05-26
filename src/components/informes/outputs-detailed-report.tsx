
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, TrendingUp, ArrowUpCircle, Package } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface OutputsDetailedReportProps {
  prodOutputs: any[];
  sampleOutputs: any[];
  totals: {
    prodPrendas: number;
    samplePrendas: number;
    totalGeneral: number;
  };
  dateFrom: string;
  dateTo: string;
}

function getGuiaVisible(item: any): string {
  const candidates = [item?.numeroSalida, item?.numeroGuia, item?.outputNumber, item?.id];
  for (const val of candidates) {
    if (val && String(val).length < 18) return String(val).toUpperCase();
  }
  return "GUÍA S/N";
}

export function cleanClientNames(nameStr: string): string {
  if (!nameStr) return "";
  const parts = nameStr.split(",").map(p => p.trim()).filter(Boolean);
  const seenSignatures = new Set<string>();
  const uniqueParts: string[] = [];

  for (const part of parts) {
    const words = part.split(/\s+/).filter(Boolean);
    const cleanWords: string[] = [];
    for (let i = 0; i < words.length; i++) {
      if (i === 0 || words[i].toUpperCase() !== words[i - 1].toUpperCase()) {
        cleanWords.push(words[i]);
      }
    }
    const cleanPart = cleanWords.join(" ");
    const signature = cleanWords
      .map(w => w.toUpperCase())
      .sort()
      .join(" ");

    if (signature && !seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      uniqueParts.push(cleanPart);
    }
  }

  const result = uniqueParts.join(", ");
  const finalWords = result.split(/\s+/).filter(Boolean);
  const finalCleanWords: string[] = [];
  for (let i = 0; i < finalWords.length; i++) {
    const currentWordClean = finalWords[i].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toUpperCase();
    const prevWordClean = i > 0 ? finalWords[i - 1].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toUpperCase() : "";
    if (i === 0 || currentWordClean !== prevWordClean) {
      finalCleanWords.push(finalWords[i]);
    }
  }
  
  let finalStr = finalCleanWords.join(" ");
  finalStr = finalStr.replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim();
  return finalStr;
}

function getClientVisible(item: any): string {
  let rawClient = item?.clienteNombre || item?.cliente || item?.clientName || "";
  if (!rawClient) {
    const clientNamesArray = Array.isArray(item?.containedClientNames) ? item.containedClientNames : [];
    rawClient = clientNamesArray.length > 0 ? clientNamesArray.join(", ") : "S/D";
  }
  return cleanClientNames(rawClient.toString().toUpperCase());
}

function getFechaVisible(item: any): string {
  const raw = item?.date || item?.fechaSalida || item?.createdAt;
  if (!raw) return "---";
  let d: Date;
  if (typeof raw.toDate === "function") d = raw.toDate();
  else d = new Date(raw);
  if (isNaN(d.getTime())) return "---";
  return d.toLocaleDateString('es-EC');
}

export function OutputsDetailedReport({ prodOutputs, sampleOutputs, dateFrom, dateTo }: OutputsDetailedReportProps) {
  const [fechaGenerada, setFechaGenerada] = useState('');

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString('es-EC'));
  }, []);

  // RECALCULAR TOTALES DINÁMICOS BASADOS EN EL FILTRO RECIBIDO
  const calculatedTotals = useMemo(() => {
    const prodPrendas = prodOutputs.reduce((acc, out) => {
      const items = Array.isArray(out.itemsDispatched) ? out.itemsDispatched : (Array.isArray(out.lotes) ? out.lotes : []);
      return acc + items.reduce((itAcc: number, it: any) => itAcc + (Number(it.quantityToDispatch || it.cantidad || it.quantity || 0)), 0);
    }, 0);

    const samplePrendas = sampleOutputs.reduce((acc, out) => {
      const items = Array.isArray(out.itemsDispatched) ? out.itemsDispatched : (Array.isArray(out.lotes) ? out.lotes : []);
      return acc + items.reduce((itAcc: number, it: any) => itAcc + (Number(it.quantityToDispatch || it.cantidad || it.quantity || 0)), 0);
    }, 0);

    return {
      prodPrendas,
      samplePrendas,
      totalGeneral: prodPrendas + samplePrendas
    };
  }, [prodOutputs, sampleOutputs]);

  const formatNum = (val: number) => Math.floor(val).toLocaleString('es-ES');

  return (
    <div className="space-y-10 print:m-0 print:p-0">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
          body { margin: 0; padding: 0; background: white !important; }
          #outputs-report-area {
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
              <span className="text-6xl font-black tracking-tighter text-foreground">{formatNum(calculatedTotals.prodPrendas)}</span>
              <TrendingUp className="h-10 w-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm rounded-[1.5rem]">
          <CardContent className="p-8">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-4">Prendas Muestras</p>
            <div className="flex items-end justify-between">
              <span className="text-6xl font-black tracking-tighter text-primary">{formatNum(calculatedTotals.samplePrendas)}</span>
              <Package className="h-10 w-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm rounded-[1.5rem]">
          <CardContent className="p-8">
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4">Total Despachado</p>
            <div className="flex items-end justify-between">
              <span className="text-6xl font-black tracking-tighter text-emerald-600">{formatNum(calculatedTotals.totalGeneral)}</span>
              <ArrowUpCircle className="h-10 w-10 text-emerald-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div id="outputs-report-area">
        <img src="/logo-lddec.png" alt="Logo" className="hidden print:block header-logo" />
        
        <div className="hidden print:block">
          <div className="header-title">LABORATORIO DEL DENIM ECUADOR</div>
          <div className="header-subtitle">Informe Detallado de Salidas</div>
          <div className="meta-info">
            <p>Periodo: {dateFrom} al {dateTo}</p>
            <p>Generado el: {fechaGenerada}</p>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight print:text-black px-2">Despachos de Producción</h3>
            <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-2xl print:border-black print:rounded-none">
              <Table>
                <TableHeader className="bg-muted/50 print:bg-gray-100">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase py-5 pl-8">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Guía</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Cliente</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">Lotes</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right pr-8">Prendas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prodOutputs.length > 0 ? prodOutputs.map((out) => {
                    const items = Array.isArray(out.itemsDispatched) ? out.itemsDispatched : (Array.isArray(out.lotes) ? out.lotes : []);
                    const prendas = items.reduce((acc: number, it: any) => acc + (Number(it.quantityToDispatch || it.cantidad || it.quantity || 0)), 0);
                    return (
                      <TableRow key={out.id}>
                        <TableCell className="py-4 pl-8 text-xs font-medium">{getFechaVisible(out)}</TableCell>
                        <TableCell className="font-bold text-blue-600 text-xs">{getGuiaVisible(out)}</TableCell>
                        <TableCell className="text-xs font-medium uppercase truncate max-w-[250px]">{getClientVisible(out)}</TableCell>
                        <TableCell className="text-center text-xs">{items.length}</TableCell>
                        <TableCell className="text-right pr-8 font-black text-foreground">{formatNum(prendas)}</TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground/30 font-bold uppercase text-[10px]">Sin despachos de producción</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight print:text-black px-2">Despachos de Muestras</h3>
            <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-2xl print:border-black print:rounded-none">
              <Table>
                <TableHeader className="bg-muted/50 print:bg-gray-100">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase py-5 pl-8">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Guía</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Cliente</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">Lotes</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right pr-8">Prendas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleOutputs.length > 0 ? sampleOutputs.map((out) => {
                    const items = Array.isArray(out.itemsDispatched) ? out.itemsDispatched : (Array.isArray(out.lotes) ? out.lotes : []);
                    const prendas = items.reduce((acc: number, it: any) => acc + (Number(it.quantityToDispatch || it.cantidad || it.quantity || 0)), 0);
                    return (
                      <TableRow key={out.id}>
                        <TableCell className="py-4 pl-8 text-xs font-medium">{getFechaVisible(out)}</TableCell>
                        <TableCell className="font-bold text-blue-600 text-xs">{getGuiaVisible(out)}</TableCell>
                        <TableCell className="text-xs font-medium uppercase truncate max-w-[250px]">{getClientVisible(out)}</TableCell>
                        <TableCell className="text-center text-xs">{items.length}</TableCell>
                        <TableCell className="text-right pr-8 font-black text-primary">{formatNum(prendas)}</TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground/30 font-bold uppercase text-[10px]">Sin despachos de muestras</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end print-hidden">
        <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] px-12 h-14 rounded-2xl shadow-xl shadow-primary/20">
          <Printer className="h-5 w-5 mr-3" /> Imprimir Reporte de Salidas
        </Button>
      </div>
    </div>
  );
}
