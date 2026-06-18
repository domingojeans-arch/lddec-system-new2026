
"use client";

import React from "react";
import { Output } from "@/types/output";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpCircle, Truck, Package, AlertTriangle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OutputsReportProps {
  outputs: Output[];
}

export function OutputsReport({ outputs }: OutputsReportProps) {
  const totalDispatched = outputs.reduce((acc, o) => acc + (o.totalDispatched || 0), 0);
  const totalDamaged = outputs.reduce((acc, o) => acc + (o.totalDamaged || 0), 0);
  const totalIssues = outputs.filter(o => (o.totalDamaged || 0) > 0 || (o.totalMissing || 0) > 0).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center print:hidden">
        <h3 className="text-lg font-black uppercase tracking-tight">Análisis de Despachos</h3>
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
        <h2 className="text-lg font-bold uppercase text-black">RESUMEN ANALÍTICO DE DESPACHOS</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Despachos</p>
          <p className="text-2xl font-black">{outputs.length}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Prendas Despachadas</p>
          <p className="text-2xl font-black text-emerald-600">{totalDispatched}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Prendas con Novedades</p>
          <p className="text-2xl font-black text-destructive">{totalDamaged}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Guías con Alerta</p>
          <p className="text-2xl font-black text-amber-600">{totalIssues}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-muted/20 bg-card overflow-hidden print:border-black print:rounded-none">
        <Table>
          <TableHeader className="bg-muted/30 print:bg-gray-100">
            <TableRow className="print:border-black">
              <TableHead className="py-4 pl-6 text-xs font-bold uppercase tracking-widest print:text-black">Nro. Guía</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Socio</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Fecha</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-right print:text-black">Despachado</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-right print:text-black">Dañado/Faltante</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Transporte</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {outputs.map((output) => (
              <TableRow key={output.id} className="hover:bg-muted/5 print:border-black">
                <TableCell className="font-bold pl-6 print:text-black">{output.outputNumber}</TableCell>
                <TableCell className="text-sm font-medium print:text-black">{output.clientName}</TableCell>
                <TableCell className="text-sm text-muted-foreground print:text-black">{output.outputDate}</TableCell>
                <TableCell className="text-right font-black text-emerald-600 print:text-black">{output.totalDispatched}</TableCell>
                <TableCell className="text-right font-bold text-destructive print:text-black">{(output.totalDamaged || 0) + (output.totalMissing || 0)}</TableCell>
                <TableCell className="text-sm truncate max-w-[150px] print:text-black">{output.driver}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] uppercase font-black print:text-black print:border-black">
                    {output.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
