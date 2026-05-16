"use client";

import React from "react";
import { ManualWork } from "@/types/manual-work";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Zap, 
  Calendar, 
  Building2, 
  User,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Layers,
  Shirt,
  Tag
} from "lucide-react";
import { manualWorkTypes } from "@/data/manual-work-types";

interface ManualWorkDetailProps {
  work: ManualWork;
}

const statusMap = {
  pending: { label: "Pendiente", icon: Clock, color: "text-zinc-500 bg-zinc-500/10" },
  in_progress: { label: "En Proceso", icon: AlertCircle, color: "text-amber-500 bg-amber-500/10" },
  completed: { label: "Completado", icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10" },
  cancelled: { label: "Cancelado", icon: AlertCircle, color: "text-destructive bg-destructive/10" },
};

export function ManualWorkDetail({ work }: ManualWorkDetailProps) {
  const StatusIcon = statusMap[work.status].icon;
  const workType = manualWorkTypes.find(t => t.id === work.manualWorkType);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header Card */}
      <div className="bg-card p-10 rounded-[3rem] border border-muted/30 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5">
          <Zap className="h-32 w-32" />
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 relative z-10">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center shadow-2xl shadow-accent/30">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-4xl font-black tracking-tighter text-foreground">{workType?.label}</h2>
                <Badge className={`rounded-full px-4 py-1 mt-2 font-bold text-[10px] uppercase tracking-widest ${statusMap[work.status].color}`}>
                  <StatusIcon className="h-3 w-3 mr-2" />
                  {statusMap[work.status].label}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Lote Industrial</p>
                <div className="flex items-center gap-2 font-bold">
                  <Layers className="h-4 w-4 text-accent" />
                  {work.lotNumber}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Socio</p>
                <div className="flex items-center gap-2 font-bold">
                  <Building2 className="h-4 w-4 text-accent" />
                  {work.clientName}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Fecha Trabajo</p>
                <div className="flex items-center gap-2 font-bold">
                  <Calendar className="h-4 w-4 text-accent" />
                  {work.workDate}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Operario</p>
                <div className="flex items-center gap-2 font-bold">
                  <User className="h-4 w-4 text-accent" />
                  {work.operatorName}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-600/5 p-8 rounded-[2.5rem] border border-emerald-600/10 min-w-[280px] text-right">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Costo Total</p>
            <p className="text-5xl font-black text-emerald-600 tracking-tighter">${work.totalCost.toFixed(2)}</p>
            <div className="mt-4 pt-4 border-t border-emerald-600/10 flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium uppercase tracking-widest">Costo Unitario</span>
              <span className="font-black text-foreground">${work.unitCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lot Context Section */}
      <div className="space-y-6 px-4">
        <h3 className="text-xl font-black tracking-tight">Contexto del Lote</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card rounded-3xl p-6 border border-muted/20 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center text-muted-foreground">
              <Shirt className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Prenda</p>
              <p className="font-bold">{work.garmentType}</p>
            </div>
          </div>
          <div className="bg-card rounded-3xl p-6 border border-muted/20 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center text-muted-foreground">
              <Tag className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Proceso Base</p>
              <p className="font-bold">{work.process}</p>
            </div>
          </div>
          <div className="bg-card rounded-3xl p-6 border border-muted/20 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center text-muted-foreground">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Cantidad Procesada</p>
              <p className="font-black text-accent text-xl">{work.quantity} unds</p>
            </div>
          </div>
        </div>
      </div>

      {/* Observations */}
      <div className="px-4 pb-10">
        <div className="bg-accent/5 p-10 rounded-[3rem] border border-accent/10">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent mb-6 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Observaciones del Trabajo
          </h4>
          <p className="text-sm text-foreground/80 leading-relaxed font-medium italic">
            {work.notes || "Sin observaciones adicionales registradas para este trabajo de manualidad."}
          </p>
        </div>
      </div>
    </div>
  );
}
