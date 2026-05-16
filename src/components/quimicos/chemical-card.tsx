"use client";

import React from "react";
import { Chemical } from "@/types/chemical";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Beaker, Building2, Scale, Eye, Edit3, DollarSign, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ChemicalCardProps {
  chemical: Chemical;
  onView: (chemical: Chemical) => void;
  onEdit: (chemical: Chemical) => void;
}

const statusMap = {
  active: { label: "Activo", color: "bg-emerald-500/10 text-emerald-600" },
  low_stock: { label: "Bajo Stock", color: "bg-amber-500/10 text-amber-600" },
  empty: { label: "Agotado", color: "bg-destructive/10 text-destructive" },
};

export function ChemicalCard({ chemical, onView, onEdit }: ChemicalCardProps) {
  const stockPercentage = (chemical.currentStockKg / chemical.netWeight) * 100;

  return (
    <Card className="border-none shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 bg-card rounded-[2.5rem] overflow-hidden group">
      <CardContent className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-indigo-500/5 flex items-center justify-center shrink-0 border border-indigo-500/10">
              <Beaker className="h-7 w-7 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-black text-xl text-foreground tracking-tight group-hover:text-indigo-600 transition-colors">
                {chemical.chemicalName}
              </h3>
              <p className="text-xs text-muted-foreground font-bold mt-1 uppercase tracking-widest">
                {chemical.supplier}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-indigo-500/5 hover:text-indigo-600" onClick={() => onView(chemical)}>
              <Eye className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-indigo-500/5 hover:text-indigo-600" onClick={() => onEdit(chemical)}>
              <Edit3 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Costo x Kg</p>
              <div className="text-lg font-black text-foreground">
                ${chemical.unitCost.toFixed(2)}
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Total Ingreso</p>
              <div className="text-lg font-bold text-primary">
                ${chemical.totalCost.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-end">
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Stock Disponible</p>
              <span className={`text-xl font-black ${chemical.currentStockKg < chemical.netWeight * 0.2 ? "text-amber-600" : "text-emerald-600"}`}>
                {chemical.currentStockKg.toFixed(2)} <span className="text-xs font-bold text-muted-foreground">kg</span>
              </span>
            </div>
            <Progress value={stockPercentage} className="h-2 rounded-full bg-muted/30" />
          </div>

          <div className="pt-6 border-t border-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <Package className="h-3.5 w-3.5" />
              Fact: {chemical.invoiceNumber}
            </div>
            <Badge 
              variant="outline"
              className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border-none ${statusMap[chemical.status].color}`}
            >
              {statusMap[chemical.status].label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
