
"use client";

import React from "react";
import { Invoice } from "@/types/invoice";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/reports-helpers";
import { Printer, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InvoicesReportProps {
  invoices: Invoice[];
}

export function InvoicesReport({ invoices }: InvoicesReportProps) {
  const totalAmount = invoices.reduce((acc, i) => acc + i.total!, 0);
  const totalPending = invoices.reduce((acc, i) => acc + i.balancePending!, 0);
  const paidCount = invoices.filter(i => i.status === 'paid').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center print:hidden">
        <h3 className="text-lg font-black uppercase tracking-tight">Análisis de Facturación</h3>
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
        <h2 className="text-lg font-bold uppercase text-black">RESUMEN ANALÍTICO DE FACTURACIÓN</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Facturado</p>
          <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Saldo por Cobrar</p>
          <p className="text-2xl font-black text-amber-600">{formatCurrency(totalPending)}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Facturas Emitidas</p>
          <p className="text-2xl font-black">{invoices.length}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Comprobantes Pagados</p>
          <p className="text-2xl font-black text-primary">{paidCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-muted/20 bg-card overflow-hidden print:border-black print:rounded-none">
        <Table>
          <TableHeader className="bg-muted/30 print:bg-gray-100">
            <TableRow className="print:border-black">
              <TableHead className="py-4 pl-6 text-xs font-bold uppercase tracking-widest print:text-black">Factura</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Socio</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Emisión</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Vence</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-right print:text-black">Total</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest text-right print:text-black">Pendiente</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id} className="hover:bg-muted/5 print:border-black">
                <TableCell className="font-bold pl-6 print:text-black">{inv.invoiceNumber}</TableCell>
                <TableCell className="text-sm font-medium print:text-black">{inv.clientName}</TableCell>
                <TableCell className="text-sm text-muted-foreground print:text-black">{inv.invoiceDate}</TableCell>
                <TableCell className="text-sm text-muted-foreground print:text-black">{inv.dueDate}</TableCell>
                <TableCell className="text-right font-bold print:text-black">{formatCurrency(inv.total!)}</TableCell>
                <TableCell className="text-right font-black text-amber-600 print:text-black">{formatCurrency(inv.balancePending!)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] uppercase font-black print:text-black print:border-black">
                    {inv.status}
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
