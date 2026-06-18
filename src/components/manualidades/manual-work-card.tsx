"use client";

import React from "react";
import { ManualWork } from "@/types/manual-work";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Calendar, User, Eye, Edit3, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { manualWorkTypes } from "@/data/manual-work-types";

interface ManualWorkCardProps {
  work: ManualWork;
  onView: (work: ManualWork) => void;
  onEdit: (work: ManualWork) => void;
}

const statusMap: Record<string, { label: string, color: string }> = {
  pending: { label: "Pendiente", color: "bg-muted text-muted-foreground border-transparent" },
  in_progress: { label: "En Proceso", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  completed: { label: "Completado", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  cancelled: { label: "Cancelado", color: "bg-destructive/10 text-destructive border-destructive/20" },
  approved: { label: "Aprobado", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  rejected: { label: "Rechazado", color: "bg-red-500/10 text-red-600 border-red-500/20" },
};

export function ManualWorkCard({ work, onView, onEdit }: ManualWorkCardProps) {
  const workType = manualWorkTypes.find(t => t.id === work.manualWorkType);

  return (
    <Card className="border-none shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30_rgba(0,0,0,0.08)] transition-all duration-300 bg-card rounded-[2rem] overflow-hidden group">
      <CardContent className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-accent/5 flex items-center justify-center shrink-0 border border-accent/10">
              <Zap className="h-7 w-7 text-accent" />
            </div>
            <div>
              <h3 className="font-black text-xl text-foreground tracking-tight group-hover:text-accent transition-colors">
                {workType?.label}
              </h3>
              <p className="text-xs text-muted-foreground font-bold mt-1">
                Lote: {work.lotNumber} • {work.clientName}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-accent/5 hover:text-accent" onClick={() => onView(work)}>
              <Eye className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-accent/5 hover:text-accent" onClick={() => onEdit(work)}>
              <Edit3 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Costo Total</p>
              <div className="text-3xl font-black text-emerald-600 tracking-tighter">
                ${work.totalCost.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mb-1">Cantidad</p>
              <div className="text-xl font-bold text-primary">
                {work.quantity} <span className="text-xs font-normal text-muted-foreground">unds</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {work.operatorName}
              </div>
            </div>
            <Badge 
              variant="outline"
              className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border-none ${statusMap[work.status].color}`}
            >
              {statusMap[work.status].label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
