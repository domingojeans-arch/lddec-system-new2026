
"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductionTableProps {
  lots: any[];
  onUpdateStatus: (lotId: string, status: string) => void;
}

export function ProductionTable({ lots, onUpdateStatus }: ProductionTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xl">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-b border-border hover:bg-transparent">
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground py-5 pl-8">N° Ingreso</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Lote</TableHead>
            <TableHead className="text-[11px) font-black uppercase tracking-widest text-muted-foreground text-center">Prendas</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Cliente</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Días Restantes</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground text-right pr-8">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lots.map((lot, idx) => {
            const isExpired = lot.daysRemaining < 0;
            const isWarning = lot.daysRemaining >= 0 && lot.daysRemaining <= 2;
            const isInProcess = lot.status === "in_process";
            const isReady = lot.status === "ready";

            // Identidad Compuesta Única (Ingreso + Lote + Proceso + Índice)
            const rowKey = `${lot.entryNumber}-${lot.lotNumber}-${lot.process || 'lavado'}-${idx}`;

            return (
              <TableRow key={rowKey} className="border-b border-border hover:bg-muted/10 transition-colors group">
                <TableCell className="py-5 pl-8">
                  <span className="font-mono text-xs font-bold text-muted-foreground">{lot.entryNumber}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-black text-primary tracking-tight">{lot.lotNumber}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-lg font-black text-foreground">{lot.quantity}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-bold text-foreground uppercase">{lot.clientName}</span>
                </TableCell>
                <TableCell>
                  <span className={cn(
                    "text-[11px] font-black uppercase tracking-tighter px-2.5 py-1 rounded-md",
                    isExpired ? "bg-red-500/10 text-red-600 dark:text-red-400" : 
                    isWarning ? "bg-amber-500/10 text-amber-600" : 
                    "bg-emerald-500/10 text-emerald-600"
                  )}>
                    {lot.daysRemaining < 0 
                      ? `Vencido (${Math.abs(lot.daysRemaining)}d)` 
                      : `${lot.daysRemaining} días`}
                  </span>
                </TableCell>
                <TableCell className="text-right pr-8">
                  <div className="flex items-center justify-end gap-2">
                    {isReady ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-none font-black uppercase text-[9px] py-1.5 px-4 rounded-lg gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Lavado Finalizado
                      </Badge>
                    ) : (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          disabled={!isInProcess}
                          className={cn(
                            "h-8 border-border text-[10px] font-black uppercase tracking-widest",
                            isInProcess ? "hover:bg-muted" : "opacity-30"
                          )}
                          onClick={() => onUpdateStatus(lot.id, "pending")}
                        >
                          <Pause className="h-3 w-3 mr-1.5" />
                          Pausar
                        </Button>
                        <Button 
                          size="sm" 
                          className={cn(
                            "h-8 text-[10px] font-black uppercase tracking-widest px-4 shadow-sm transition-all",
                            isInProcess ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-primary hover:bg-primary/90 text-white"
                          )}
                          onClick={() => onUpdateStatus(lot.id, isInProcess ? "ready" : "in_process")}
                        >
                          {isInProcess ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1.5" /> Finalizar</>
                          ) : (
                            <><Play className="h-3 w-3 mr-1.5 fill-current" /> Iniciar</>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {lots.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-40 text-center opacity-20">
                <Clock className="h-12 w-12 mx-auto mb-2" />
                <p className="font-black text-xs uppercase tracking-widest">Sin lotes activos en el flujo</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
