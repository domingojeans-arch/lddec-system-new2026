"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Building2, Shirt, Cog, ArrowRight, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductionCardProps {
  lot: any;
  onAction: (lot: any) => void;
}

const statusMap: any = {
  pending: { label: "Pendiente", color: "bg-zinc-500/10 text-zinc-600", icon: Clock },
  in_process: { label: "En Proceso", color: "bg-amber-500/10 text-amber-600", icon: AlertCircle },
  ready: { label: "Listo / OK", color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle2 },
};

export function ProductionCard({ lot, onAction }: ProductionCardProps) {
  const StatusIcon = statusMap[lot.status]?.icon || Clock;

  return (
    <Card className="border-none shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 bg-card rounded-[2rem] overflow-hidden group">
      <CardContent className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
              <Layers className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="font-black text-xl text-foreground tracking-tight group-hover:text-accent transition-colors">
                {lot.lotNumber}
              </h3>
              <p className="text-xs text-muted-foreground font-bold mt-1 uppercase tracking-widest">
                {lot.clientName}
              </p>
            </div>
          </div>
          <Badge 
            variant="outline"
            className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border-none ${statusMap[lot.status]?.color}`}
          >
            {statusMap[lot.status]?.label}
          </Badge>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Prenda</p>
              <div className="flex items-center gap-2 text-sm font-bold truncate">
                <Shirt className="h-3.5 w-3.5 text-muted-foreground" />
                {lot.garmentType}
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Proceso</p>
              <div className="text-sm font-black text-primary uppercase tracking-tighter">
                {lot.process}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-6 border-t border-muted/30">
            <div>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Cantidad</p>
              <div className="text-2xl font-black text-foreground">{lot.quantity}</div>
            </div>
            <Button 
              size="sm" 
              className="rounded-xl h-10 px-5 bg-primary font-bold text-white shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all"
              onClick={() => onAction(lot)}
            >
              Gestionar
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
