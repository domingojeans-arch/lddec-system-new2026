"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Cog, 
  Layers, 
  Building2, 
  Shirt, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Calendar,
  FileText,
  X,
  PlayCircle,
  CheckCircle
} from "lucide-react";

interface ProductionDetailProps {
  lot: any;
  onUpdateStatus: (status: string) => void;
  onClose: () => void;
}

const statusMap: any = {
  pending: { label: "Pendiente", color: "text-zinc-500 bg-zinc-500/10", icon: Clock },
  in_process: { label: "En Proceso", color: "text-amber-500 bg-amber-500/10", icon: AlertCircle },
  ready: { label: "Listo para Salida", color: "text-emerald-500 bg-emerald-500/10", icon: CheckCircle2 },
};

export function ProductionDetail({ lot, onUpdateStatus, onClose }: ProductionDetailProps) {
  const StatusIcon = statusMap[lot.status]?.icon || Clock;

  return (
    <div className="relative">
      {/* Header Decoration */}
      <div className="absolute top-0 right-0 p-10 opacity-5">
        <Cog className="h-32 w-32 animate-spin-slow" />
      </div>

      <div className="p-10 space-y-10 relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/30">
              <Layers className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-4xl font-black tracking-tighter text-foreground">{lot.lotNumber}</h2>
              <Badge className={`rounded-full px-4 py-1 mt-2 font-bold text-[10px] uppercase tracking-widest ${statusMap[lot.status]?.color}`}>
                <StatusIcon className="h-3 w-3 mr-2" />
                {statusMap[lot.status]?.label}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2">Información de Origen</h4>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Socio Industrial</p>
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Building2 className="h-3.5 w-3.5 text-accent" />
                  {lot.clientName}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Nro. Ingreso</p>
                <div className="font-mono text-sm font-bold text-primary">
                  {lot.entryNumber}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Fecha Recepción</p>
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Calendar className="h-3.5 w-3.5 text-accent" />
                  {lot.entryDate}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Responsable Bodega</p>
                <div className="flex items-center gap-2 font-bold text-sm">
                  <User className="h-3.5 w-3.5 text-accent" />
                  {lot.responsible}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2">Especificaciones Técnicas</h4>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Tipo de Prenda</p>
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Shirt className="h-3.5 w-3.5 text-primary" />
                  {lot.garmentType}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Cantidad Lote</p>
                <div className="text-xl font-black text-foreground">
                  {lot.quantity} <span className="text-xs font-bold text-muted-foreground">unds</span>
                </div>
              </div>
              <div className="col-span-2 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Proceso Requerido</p>
                <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 font-black text-primary uppercase text-xs tracking-widest text-center">
                  {lot.process}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-accent/5 p-8 rounded-[2.5rem] border border-accent/10 space-y-6">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent flex items-center gap-2">
            <Cog className="h-4 w-4" />
            Acciones de Flujo de Trabajo
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className={cn(
                "h-16 rounded-2xl border-2 font-bold gap-3 transition-all",
                lot.status === 'pending' ? "border-zinc-500 bg-zinc-500/10 text-zinc-700" : "border-muted hover:border-zinc-300"
              )}
              onClick={() => onUpdateStatus('pending')}
            >
              <Clock className="h-5 w-5" />
              Pendiente
            </Button>
            <Button 
              variant="outline" 
              className={cn(
                "h-16 rounded-2xl border-2 font-bold gap-3 transition-all",
                lot.status === 'in_process' ? "border-amber-500 bg-amber-500/10 text-amber-700" : "border-muted hover:border-amber-300"
              )}
              onClick={() => onUpdateStatus('in_process')}
            >
              <PlayCircle className="h-5 w-5" />
              En Proceso
            </Button>
            <Button 
              variant="outline" 
              className={cn(
                "h-16 rounded-2xl border-2 font-bold gap-3 transition-all",
                lot.status === 'ready' ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : "border-muted hover:border-emerald-300"
              )}
              onClick={() => onUpdateStatus('ready')}
            >
              <CheckCircle className="h-5 w-5" />
              Listo / Salida
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observaciones de Producción</span>
          </div>
          <p className="text-sm text-foreground/70 font-medium italic bg-muted/20 p-6 rounded-2xl border border-muted/30">
            {lot.notes || "Sin instrucciones especiales de producción para este lote."}
          </p>
        </div>

        <div className="flex justify-end pt-4">
          <Button 
            className="rounded-2xl px-10 h-12 bg-primary font-bold text-white shadow-xl shadow-primary/20" 
            onClick={onClose}
          >
            Cerrar Expediente
          </Button>
        </div>
      </div>
    </div>
  );
}
