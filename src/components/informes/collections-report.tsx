
"use client";

import React from "react";
import { Collection } from "@/types/collection";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/reports-helpers";
import { Printer, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CollectionsReportProps {
  collections: Collection[];
}

export function CollectionsReport({ collections }: CollectionsReportProps) {
  const totalReceived = collections.reduce((acc, c) => acc + c.totalReceived, 0);
  const totalApplied = collections.reduce((acc, c) => acc + c.totalApplied, 0);
  const totalDiscounts = collections.reduce((acc, c) => acc + c.totalPromptPaymentDiscount + c.totalDamagedDiscount + c.totalDiscount, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center print:hidden">
        <h3 className="text-lg font-black uppercase tracking-tight">Análisis de Cobranzas</h3>
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
        <h2 className="text-lg font-bold uppercase text-black">RESUMEN ANALÍTICO DE COBRANZAS</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Efectivo Recibido</p>
          <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Aplicado</p>
          <p className="text-2xl font-black text-primary">{formatCurrency(totalApplied)}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Descuentos/Ret</p>
          <p className="text-2xl font-black text-amber-600">{formatCurrency(totalDiscounts)}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Nro. Operaciones</p>
          <p className="text-2xl font-black">{collections.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-muted/20 bg-card overflow-hidden print:border-black print:rounded-none">
        <Table>
          <TableHeader className="bg-muted/30 print:bg-gray-100">
            <TableRow className="print:border-black">
              <TableHead className="py-4 pl-6 text-xs font-bold uppercase tracking-widest print:text-black">Recibo</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Socio</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Fecha</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Método</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-right print:text-black">Recibido</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-right print:text-black">Aplicado</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Responsable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {collections.map((col) => (
              <TableRow key={col.id} className="hover:bg-muted/5 print:border-black">
                <TableCell className="font-bold pl-6 print:text-black">{col.collectionNumber}</TableCell>
                <TableCell className="text-sm font-medium print:text-black">{col.clientName}</TableCell>
                <TableCell className="text-sm text-muted-foreground print:text-black">{col.collectionDate}</TableCell>
                <TableCell className="text-sm print:text-black">{col.paymentMethod}</TableCell>
                <TableCell className="text-right font-bold text-emerald-600 print:text-black">{formatCurrency(col.totalReceived)}</TableCell>
                <TableCell className="text-right font-black text-primary print:text-black">{formatCurrency(col.totalApplied)}</TableCell>
                <TableCell className="text-sm print:text-black">{col.responsible}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
