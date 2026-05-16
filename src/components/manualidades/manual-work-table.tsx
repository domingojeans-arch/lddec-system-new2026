"use client";

import React from "react";
import { ManualWork } from "@/types/manual-work";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, User, Calendar, Eye, Edit3, DollarSign, Zap } from "lucide-react";
import { manualWorkTypes } from "@/data/manual-work-types";

interface ManualWorkTableProps {
  works: ManualWork[];
  onView: (work: ManualWork) => void;
  onEdit: (work: ManualWork) => void;
}

const statusMap = {
  pending: { label: "Pendiente", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "En Proceso", color: "bg-amber-500/10 text-amber-600" },
  completed: { label: "Completado", color: "bg-emerald-500/10 text-emerald-600" },
  cancelled: { label: "Cancelado", color: "bg-destructive/10 text-destructive" },
};

export function ManualWorkTable({ works, onView, onEdit }: ManualWorkTableProps) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-b border-border">
            <TableHead className="py-5 pl-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">Manualidad / Lote</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Operario</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-center text-muted-foreground">Cantidad</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-right text-muted-foreground">Costo Total</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Estado</TableHead>
            <TableHead className="text-right pr-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {works.map((work) => {
            const workType = manualWorkTypes.find(t => t.id === work.manualWorkType);
            return (
              <TableRow key={work.id} className="group hover:bg-muted/10 transition-all duration-200 border-b border-border">
                <TableCell className="py-5 pl-8">
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-accent/5 flex items-center justify-center shrink-0 border border-accent/5">
                      <Zap className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <div className="font-bold text-base text-foreground group-hover:text-accent transition-colors">
                        {workType?.label}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                          {work.lotNumber}
                        </span>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="text-[10px] text-muted-foreground/70 font-medium">
                          {work.clientName}
                        </span>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                    <User className="h-3 w-3 text-muted-foreground" />
                    {work.operatorName}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="font-bold text-primary">
                    {work.quantity} <span className="text-[10px] font-normal text-muted-foreground">unds</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="font-black text-emerald-600">
                    ${work.totalCost.toFixed(2)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline"
                    className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-[0.1em] border-none ${statusMap[work.status].color}`}
                  >
                    {statusMap[work.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right pr-8">
                  <div className="flex items-center justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-accent hover:bg-accent/5"
                      onClick={() => onView(work)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-accent hover:bg-accent/5"
                      onClick={() => onEdit(work)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
