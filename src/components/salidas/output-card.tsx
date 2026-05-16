"use client";

import React from "react";
import { Output } from "@/types/output";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpCircle, User, Calendar, Truck, Eye, Edit3, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OutputCardProps {
  output: Output;
  onView: (output: Output) => void;
  onEdit: (output: Output) => void;
}

const statusMap = {
  draft: { label: "Borrador", color: "bg-zinc-500/10 text-zinc-600" },
  active: { label: "En Despacho", color: "bg-amber-500/10 text-amber-600" },
  completed: { label: "Completado", color: "bg-emerald-500/10 text-emerald-600" },
};

export function OutputCard({ output, onView, onEdit }: OutputCardProps) {
  return (
    <Card className="border-none shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 bg-card rounded-2xl overflow-hidden group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-accent/5 flex items-center justify-center shrink-0 border border-accent/10">
              <ArrowUpCircle className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight group-hover:text-accent transition-colors">
                {output.outputNumber}
              </h3>
              <p className="text-xs text-muted-foreground font-bold mt-1">
                {output.clientName}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onView(output)}>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onEdit(output)}>
              <Edit3 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Chofer / Transporte</p>
            <div className="flex items-center gap-2 text-sm font-semibold truncate">
              <Truck className="h-3 w-3 text-muted-foreground" />
              {output.driver}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Despachado</p>
            <div className="flex items-center gap-2 text-sm font-bold text-accent">
              <Shirt className="h-3.5 w-3.5" />
              {output.totalDispatched} <span className="text-xs text-muted-foreground font-normal">/ {output.totalOriginal}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-muted/30">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-full">
            <Calendar className="h-3 w-3" />
            {output.outputDate}
          </div>
          <Badge 
            variant="outline"
            className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest border-none ${statusMap[output.status].color}`}
          >
            {statusMap[output.status].label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
