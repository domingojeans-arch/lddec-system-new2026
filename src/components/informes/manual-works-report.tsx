
"use client";

import React from "react";
import { ManualWork } from "@/types/manual-work";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/reports-helpers";
import { manualWorkTypes } from "@/data/manual-work-types";
import { Printer, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ManualWorksReportProps {
  works: ManualWork[];
}

export function ManualWorksReport({ works }: ManualWorksReportProps) {
  const totalCost = works.reduce((acc, w) => acc + w.totalCost, 0);
  const totalGarments = works.reduce((acc, w) => acc + w.quantity, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center print:hidden">
        <h3 className="text-lg font-black uppercase tracking-tight">Análisis de Manualidades</h3>
        <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 rounded-xl gap-2 shadow-lg">
          <Printer className="h-4 w-4" /> Imprimir Resumen
        </Button>
      </div>

      <div className="hidden print:block text-center mb-10 space-y-2">
        <img 
          src="/logo-lddec.png" 
          alt="Logo" 
          style={{ width: '2.5cm', height: '2.5cm', objectFit: 'contain', margin: '0 auto 10px auto', display: 'block' }} 
        />
        <h1 className="text-2xl font-black uppercase text-black">LAVANDERÍA DE DECORACIONES (LDDEC)</h1>
        <h2 className="text-lg font-bold uppercase text-black">RESUMEN ANALÍTICO DE MANUALIDADES</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Costo Manualidades</p>
          <p className="text-2xl font-black text-accent">{formatCurrency(totalCost)}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Prendas Intervenidas</p>
          <p className="text-2xl font-black">{totalGarments}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Promedio por Prenda</p>
          <p className="text-2xl font-black text-muted-foreground">{formatCurrency(totalCost / (totalGarments || 1))}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Trabajos</p>
          <p className="text-2xl font-black">{works.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-muted/20 bg-card overflow-hidden print:border-black print:rounded-none">
        <Table>
          <TableHeader className="bg-muted/30 print:bg-gray-100">
            <TableRow className="print:border-black">
              <TableHead className="py-4 pl-6 text-xs font-bold uppercase tracking-widest print:text-black">Manualidad</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Lote</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-center print:text-black">Cant.</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-right print:text-black">C. Unit</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-right print:text-black">C. Total</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Operario</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {works.map((w) => {
              const typeLabel = manualWorkTypes.find(t => t.id === w.manualWorkType)?.label || w.manualWorkType;
              return (
                <TableRow key={w.id} className="hover:bg-muted/5 print:border-black">
                  <TableCell className="font-bold pl-6 text-accent print:text-black">{typeLabel}</TableCell>
                  <TableCell className="text-sm font-medium print:text-black">{w.lotNumber}</TableCell>
                  <TableCell className="text-center font-bold print:text-black">{w.quantity}</TableCell>
                  <TableCell className="text-right text-muted-foreground print:text-black">{formatCurrency(w.unitCost)}</TableCell>
                  <TableCell className="text-right font-black text-emerald-600 print:text-black">{formatCurrency(w.totalCost)}</TableCell>
                  <TableCell className="text-sm print:text-black">{w.operatorName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase font-black print:text-black print:border-black">
                      {w.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
