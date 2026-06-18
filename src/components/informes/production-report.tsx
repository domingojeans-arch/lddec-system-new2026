
"use client";

import React from "react";
import { Entry } from "@/types/entry";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertCircle, Printer, Cog } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductionReportProps {
  entries: Entry[];
}

const statusMap = {
  pending: { label: "Pendiente", color: "bg-zinc-100 text-zinc-600" },
  in_process: { label: "En Proceso", color: "bg-amber-100 text-amber-700" },
  ready: { label: "Listo", color: "bg-emerald-100 text-emerald-700" },
};

export function ProductionReport({ entries }: ProductionReportProps) {
  const allLots = entries.flatMap(e => e.lots.map(l => ({ ...l, clientName: e.clientName, entryNumber: e.entryNumber })));
  const pendingLots = allLots.filter(l => l.status === 'pending').length;
  const inProcessLots = allLots.filter(l => l.status === 'in_process').length;
  const readyLots = allLots.filter(l => l.status === 'ready').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center print:hidden">
        <h3 className="text-lg font-black uppercase tracking-tight">Estado de Producción</h3>
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
        <h2 className="text-lg font-bold uppercase text-black">RESUMEN ANALÍTICO DE PRODUCCIÓN</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card p-6 rounded-2xl border border-muted/20 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Pendientes</p>
            <p className="text-2xl font-black">{pendingLots}</p>
          </div>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-muted/20 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">En Proceso</p>
            <p className="text-2xl font-black">{inProcessLots}</p>
          </div>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-muted/20 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Listos p/ Salida</p>
            <p className="text-2xl font-black">{readyLots}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-muted/20 bg-card overflow-hidden print:border-black print:rounded-none">
        <Table>
          <TableHeader className="bg-muted/30 print:bg-gray-100">
            <TableRow className="print:border-black">
              <TableHead className="py-4 pl-6 text-xs font-bold uppercase tracking-widest print:text-black">Lote</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Ingreso</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Socio</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Prenda</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Proceso</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-center print:text-black">Cantidad</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allLots.map((lot) => (
              <TableRow key={lot.id} className="hover:bg-muted/5 print:border-black">
                <TableCell className="font-bold pl-6 print:text-black">{lot.lotNumber}</TableCell>
                <TableCell className="text-sm font-medium print:text-black">{lot.entryNumber}</TableCell>
                <TableCell className="text-sm print:text-black">{lot.clientName}</TableCell>
                <TableCell className="text-sm text-muted-foreground print:text-black">{lot.garmentType}</TableCell>
                <TableCell className="text-sm font-medium print:text-black">{lot.process}</TableCell>
                <TableCell className="text-center font-black text-primary print:text-black">{(lot as any).cantidad || (lot as any).quantity || (lot as any).cantidadConfirmada || 0}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] uppercase font-black border-none print:text-black print:border-black ${(statusMap[lot.status as keyof typeof statusMap] || statusMap.pending).color}`}>
                    {(statusMap[lot.status as keyof typeof statusMap] || statusMap.pending).label}
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
