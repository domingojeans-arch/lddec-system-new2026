"use client";

import React from "react";
import { Collection } from "@/types/collection";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Calendar, User, Eye, Edit3, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CollectionCardProps {
  collection: Collection;
  onView: (collection: Collection) => void;
  onEdit: (collection: Collection) => void;
}

const statusMap = {
  draft: { label: "Borrador", color: "bg-zinc-500/10 text-zinc-600" },
  applied: { label: "Aplicada", color: "bg-blue-500/10 text-blue-600" },
  partial: { label: "Parcial", color: "bg-amber-500/10 text-amber-600" },
  completed: { label: "Completada", color: "bg-emerald-500/10 text-emerald-600" },
};

export function CollectionCard({ collection, onView, onEdit }: CollectionCardProps) {
  return (
    <Card className="border-none shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 bg-card rounded-[2rem] overflow-hidden group">
      <CardContent className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/5 flex items-center justify-center shrink-0 border border-amber-500/10">
              <Wallet className="h-7 w-7 text-amber-600" />
            </div>
            <div>
              <h3 className="font-black text-xl text-foreground tracking-tight group-hover:text-amber-600 transition-colors">
                {collection.collectionNumber}
              </h3>
              <p className="text-xs text-muted-foreground font-bold mt-1">
                {collection.clientName}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-amber-500/5 hover:text-amber-600" onClick={() => onView(collection)}>
              <Eye className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-amber-500/5 hover:text-amber-600" onClick={() => onEdit(collection)}>
              <Edit3 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Total Aplicado</p>
              <div className="text-3xl font-black text-emerald-600 tracking-tighter">
                ${collection.totalApplied.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mb-1">Efectivo Recib.</p>
              <div className="text-xl font-bold text-foreground">
                ${collection.totalReceived.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {collection.collectionDate}
              </div>
            </div>
            <Badge 
              variant="outline"
              className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border-none ${statusMap[collection.status].color}`}
            >
              {statusMap[collection.status].label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
