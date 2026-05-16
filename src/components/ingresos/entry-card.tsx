"use client";

import React from "react";
import { Entry } from "@/types/entry";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownCircle, User, Calendar, Shirt, Eye, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EntryCardProps {
  entry: Entry;
  onView: (entry: Entry) => void;
  onEdit: (entry: Entry) => void;
}

const statusMap = {
  draft: { label: "Borrador", color: "bg-zinc-500/10 text-zinc-600" },
  active: { label: "Activo", color: "bg-amber-500/10 text-amber-600" },
  completed: { label: "Completado", color: "bg-emerald-500/10 text-emerald-600" },
};

export function EntryCard({ entry, onView, onEdit }: EntryCardProps) {
  return (
    <Card className="border-none shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 bg-card rounded-2xl overflow-hidden group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
              <ArrowDownCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight group-hover:text-accent transition-colors">
                {entry.entryNumber}
              </h3>
              <p className="text-xs text-muted-foreground font-bold mt-1">
                {entry.clientName}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onView(entry)}>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onEdit(entry)}>
              <Edit3 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Responsable</p>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <User className="h-3 w-3 text-muted-foreground" />
              {entry.responsible}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Total Prendas</p>
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <Shirt className="h-3.5 w-3.5" />
              {entry.totalGarments} <span className="text-xs text-muted-foreground font-normal">({entry.lots.length} lotes)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-muted/30">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-full">
            <Calendar className="h-3 w-3" />
            {entry.entryDate}
          </div>
          <Badge 
            variant="outline"
            className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest border-none ${statusMap[entry.status].color}`}
          >
            {statusMap[entry.status].label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
