"use client";

import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Wallet, Receipt } from "lucide-react";

interface FacturaPendienteRowProps {
  invoice: any;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export function FacturaPendienteRow({ invoice, isSelected, onToggle }: FacturaPendienteRowProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
  };

  const numero = invoice._normalizedNumero || invoice.numeroFactura || invoice.numero || invoice.id;
  const saldo = invoice._normalizedSaldo !== undefined ? invoice._normalizedSaldo : invoice.saldoPendiente;
  const total = invoice._normalizedTotal !== undefined ? invoice._normalizedTotal : invoice.totalFactura;
  const fecha = invoice._normalizedDate ? invoice._normalizedDate.toLocaleDateString('es-EC') : 'S/F';

  return (
    <TableRow 
      className={cn(
        "border-border hover:bg-muted/10 cursor-pointer transition-colors",
        isSelected && "bg-primary/5",
        invoice.isInitialBalance && "bg-amber-50/20"
      )}
      onClick={() => onToggle(invoice.id)}
    >
      <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
        <Checkbox 
          checked={isSelected} 
          onCheckedChange={() => onToggle(invoice.id)}
          className="border-border data-[state=checked]:bg-primary"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          {invoice.isInitialBalance ? (
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-primary/5 text-primary flex items-center justify-center">
              <Receipt className="h-4 w-4" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-black text-foreground text-sm uppercase">{numero}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
              {invoice.isInitialBalance ? "Apertura Período 2026" : (invoice.ingresoMaestroId ? `Ingreso: ${invoice.ingresoMaestroId}` : "Referencia")}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-xs font-medium text-muted-foreground">{fecha}</span>
      </TableCell>
      <TableCell className="text-right">
        <span className="font-bold text-xs">{formatCurrency(total)}</span>
      </TableCell>
      <TableCell className="text-right">
        <span className={cn(
          "font-black text-sm",
          invoice.isInitialBalance ? "text-amber-600" : "text-red-500"
        )}>{formatCurrency(saldo)}</span>
      </TableCell>
      <TableCell className="text-right pr-6">
        <Badge variant="outline" className={cn(
          "text-[9px] px-3 py-1 rounded-full font-black uppercase border-none",
          invoice.estadoCobranza === 'Pagada' ? "bg-emerald-500/10 text-emerald-600" :
          invoice.estadoCobranza === 'Parcialmente Cobrada' ? "bg-blue-500/10 text-blue-600" :
          "bg-amber-500/10 text-amber-600"
        )}>
          {invoice.estadoCobranza || "Por Cobrar"}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
