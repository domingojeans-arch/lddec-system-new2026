
"use client";

import React from "react";
import { Entry } from "@/types/entry";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shirt, ArrowDownCircle, Calendar, User, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EntriesReportProps {
  entries: Entry[];
}

export function EntriesReport({ entries }: EntriesReportProps) {
  const totalGarments = entries.reduce((acc, e) => acc + e.totalGarments, 0);
  const totalLots = entries.reduce((acc, e) => acc + e.lots.length, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center print:hidden">
        <h3 className="text-lg font-black uppercase tracking-tight">Análisis de Ingresos</h3>
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
        <h2 className="text-lg font-bold uppercase text-black">RESUMEN ANALÍTICO DE INGRESOS</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Ingresos</p>
          <p className="text-2xl font-black">{entries.length}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Prendas Ingresadas</p>
          <p className="text-2xl font-black text-primary">{totalGarments}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Lotes Totales</p>
          <p className="text-2xl font-black text-accent">{totalLots}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Promedio Prendas/Ingreso</p>
          <p className="text-2xl font-black">{(totalGarments / (entries.length || 1)).toFixed(0)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-muted/20 bg-card overflow-hidden print:border-black print:rounded-none">
        <Table>
          <TableHeader className="bg-muted/30 print:bg-gray-100">
            <TableRow className="print:border-black">
              <TableHead className="py-4 pl-6 text-xs font-bold uppercase tracking-widest print:text-black">Nro. Ingreso</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Socio</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Fecha</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-center print:text-black">Prendas</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-center print:text-black">Lotes</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Responsable</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id} className="hover:bg-muted/5 print:border-black">
                <TableCell className="font-bold pl-6 print:text-black">{entry.entryNumber}</TableCell>
                <TableCell className="text-sm font-medium print:text-black">{entry.clientName}</TableCell>
                <TableCell className="text-sm text-muted-foreground print:text-black">{entry.entryDate}</TableCell>
                <TableCell className="text-center font-black text-primary print:text-black">{entry.totalGarments}</TableCell>
                <TableCell className="text-center font-medium print:text-black">{entry.lots.length}</TableCell>
                <TableCell className="text-sm print:text-black">{entry.responsible}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] uppercase font-black print:text-black print:border-black">
                    {entry.status}
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
