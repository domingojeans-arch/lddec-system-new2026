"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, CheckCircle2, Zap, History, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { writeBatch, doc } from "firebase/firestore";
import { toDate } from "@/lib/toDate";

interface OperatorPayoutReportProps {
  manualWorks: any[];
  dateFrom: string;
  dateTo: string;
  selectedOperator: string;
}

export function OperatorPayoutReport({ manualWorks, dateFrom, dateTo, selectedOperator }: OperatorPayoutReportProps) {
  const [fechaGenerada, setFechaGenerada] = useState('');
  const [sortKey, setSortKey] = useState<string>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setFechaGenerada(new Date().toLocaleString('es-EC'));
  }, []);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const filteredData = useMemo(() => {
    const startStr = dateFrom;
    const endStr = dateTo;

    const filtered = manualWorks.filter(work => {
      // Uso de toDate para una comparación cronológica robusta
      const d = toDate(work.fecha || work.fechaStr || work.workDate || work.createdAt);
      if (!d) return false;
      
      const workDateStr = d.toISOString().split('T')[0];
      const matchesDate = workDateStr >= startStr && workDateStr <= endStr;
      
      const isApproved = String(work.estado || "").toLowerCase() === 'aprobado';
      const matchesOperator = selectedOperator === "all" || 
        String(work.operarioNombre || "").toUpperCase() === String(selectedOperator).toUpperCase();
      
      return matchesDate && isApproved && matchesOperator;
    });

    // MOTOR DE ORDENAMIENTO LDDEC 1.2 - CRONOLOGÍA ABSOLUTA
    return [...filtered].sort((a, b) => {
      if (sortKey === "fecha") {
        const timeA = toDate(a.fecha || a.fechaStr || a.workDate || a.createdAt)?.getTime() || 0;
        const timeB = toDate(b.fecha || b.fechaStr || b.workDate || b.createdAt)?.getTime() || 0;
        return sortDir === "asc" ? timeA - timeB : timeB - timeA;
      } 
      
      if (sortKey === "loteNumero") {
        const valA = String(a.loteNumero || "");
        const valB = String(b.loteNumero || "");
        return sortDir === "asc" 
          ? valA.localeCompare(valB, 'en', { numeric: true }) 
          : valB.localeCompare(valA, 'en', { numeric: true });
      }
      
      return 0;
    });
  }, [manualWorks, dateFrom, dateTo, selectedOperator, sortKey, sortDir]);

  const totalAmount = useMemo(() => filteredData.reduce((acc, curr) => acc + Number(curr.total || 0), 0), [filteredData]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 print:m-0 print:p-0">
      <style jsx global>{`
        @media print {
          @page { size: portrait; margin: 0; }
          body { margin: 0; padding: 0; background: white !important; }
          #operator-payout-report {
            width: 21cm;
            min-height: 29.7cm;
            padding: 1.5cm;
            position: relative;
            font-family: 'Inter', sans-serif;
            background: white !important;
            color: black !important;
            visibility: visible !important;
          }
          .print-hidden { display: none !important; }
          .header-logo { position: absolute; top: 1.5cm; right: 1.5cm; width: 2.2cm; height: 2.2cm; object-fit: contain; }
          .header-title { font-size: 16pt; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
          .header-subtitle { font-size: 13pt; font-weight: 700; color: #3b82f6 !important; text-transform: uppercase; margin-bottom: 10px; }
          .meta-info { font-size: 9pt; font-weight: 600; color: #64748b !important; text-transform: uppercase; margin-bottom: 15px; }
          table { border: 1.5pt solid black !important; border-collapse: collapse !important; width: 100% !important; }
          th { background: #f1f5f9 !important; border: 1pt solid black !important; color: black !important; font-weight: 900 !important; font-size: 8pt !important; padding: 4px 8px !important; }
          td { border: 1pt solid black !important; color: black !important; font-size: 8pt !important; padding: 3px 8px !important; line-height: 1.1; }
        }
      `}</style>

      <div className="flex items-center justify-between border-b border-border pb-4 print-hidden">
        <h2 className="text-xl font-black uppercase tracking-tight">Liquidación de Operarios</h2>
        <div className="flex gap-3">
          <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-8 rounded-xl gap-2 shadow-lg">
            <Printer className="h-4 w-4" /> Imprimir Nómina
          </Button>
        </div>
      </div>

      <div id="operator-payout-report">
        <img src="/logo-lddec.png" alt="Logo" className="hidden print:block header-logo" />
        
        <div className="hidden print:block">
          <div className="header-title">LABORATORIO DEL DENIM ECUADOR</div>
          <div className="header-subtitle">Liquidación de Pagos a Operarios</div>
          <div className="meta-info">
            <p>Periodo: {dateFrom} al {dateTo}</p>
            <p>Operario: {selectedOperator === 'all' ? 'TODOS' : selectedOperator.toUpperCase()}</p>
            <p>Generado el: {fechaGenerada}</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-2xl print:border-black print:rounded-none">
          <Table>
            <TableHeader className="bg-muted/50 print:bg-gray-100">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase py-5 pl-6 w-10">#</TableHead>
                <TableHead 
                  onClick={() => handleSort("fecha")}
                  className="text-[10px] font-black uppercase py-5 pl-4 cursor-pointer group hover:bg-muted/80 transition-colors"
                >
                  <div className="flex items-center">
                    Fecha <SortIcon colKey="fecha" />
                  </div>
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase">Cliente</TableHead>
                <TableHead 
                  onClick={() => handleSort("loteNumero")}
                  className="text-[10px] font-black uppercase cursor-pointer group hover:bg-muted/80 transition-colors"
                >
                  <div className="flex items-center">
                    Lote <SortIcon colKey="loteNumero" />
                  </div>
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase">Manualidad</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right">Costo</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center">Cant.</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right pr-8">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((w, idx) => {
                const date = toDate(w.fecha || w.fechaStr || w.workDate || w.createdAt);
                return (
                  <TableRow key={idx}>
                    <TableCell className="py-4 pl-6 text-[10px] font-black text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="py-4 pl-4 text-xs font-medium">{date ? date.toLocaleDateString('es-EC') : "---"}</TableCell>
                    <TableCell className="text-xs font-bold uppercase truncate max-w-[150px]">{w.clienteNombre || "Socio"}</TableCell>
                    <TableCell className="font-black text-blue-600 text-xs">{w.loteNumero}</TableCell>
                    <TableCell className="text-xs font-medium uppercase">{w.proceso}</TableCell>
                    <TableCell className="text-right font-bold text-xs text-muted-foreground">
                      {formatCurrency(w.precioUnitario || 0)}
                    </TableCell>
                    <TableCell className="text-center font-black text-foreground">{w.cantidad}</TableCell>
                    <TableCell className="text-right pr-8 font-black text-emerald-600">{formatCurrency(w.total)}</TableCell>
                  </TableRow>
                );
              })}
              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground italic uppercase text-[10px] font-bold">
                    No se encontraron registros
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter className="bg-muted/20 print:bg-white print:border-t-2 print:border-black">
              <TableRow>
                <TableCell colSpan={7} className="text-[10px] font-black uppercase pl-8 py-4">TOTAL A LIQUIDAR</TableCell>
                <TableCell className="text-right pr-8 font-black text-foreground text-lg">{formatCurrency(totalAmount)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
