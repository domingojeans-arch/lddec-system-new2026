"use client";

import React from "react";
import { Chemical } from "@/types/chemical";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Beaker, 
  Calendar, 
  Building2, 
  Scale,
  FileText,
  Clock,
  History,
  TrendingDown,
  DollarSign,
  Package,
  ArrowRight
} from "lucide-react";

interface ChemicalDetailProps {
  chemical: Chemical;
}

const statusMap = {
  active: { label: "Activo", color: "text-emerald-500 bg-emerald-500/10" },
  low_stock: { label: "Bajo Stock", color: "text-amber-500 bg-amber-500/10" },
  empty: { label: "Agotado", color: "text-destructive bg-destructive/10" },
};

export function ChemicalDetail({ chemical }: ChemicalDetailProps) {
  const stockPercentage = (chemical.currentStockKg / chemical.netWeight) * 100;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header Card */}
      <div className="bg-card p-10 rounded-[3rem] border border-muted/30 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5">
          <Beaker className="h-32 w-32" />
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 relative z-10">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-600/30">
                <Beaker className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-4xl font-black tracking-tighter text-foreground">{chemical.chemicalName}</h2>
                <Badge className={`rounded-full px-4 py-1 mt-2 font-bold text-[10px] uppercase tracking-widest ${statusMap[chemical.status].color}`}>
                  {statusMap[chemical.status].label}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-10 gap-y-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Proveedor</p>
                <div className="flex items-center gap-2 font-bold">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  {chemical.supplier}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Factura</p>
                <div className="flex items-center gap-2 font-bold">
                  <Package className="h-4 w-4 text-indigo-600" />
                  {chemical.invoiceNumber}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Fecha Ingreso</p>
                <div className="flex items-center gap-2 font-bold">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  {chemical.purchaseDate}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-600/5 p-8 rounded-[2.5rem] border border-emerald-600/10 min-w-[280px] text-right">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Stock Actual</p>
            <p className="text-5xl font-black text-emerald-600 tracking-tighter">{chemical.currentStockKg.toFixed(2)} kg</p>
            <div className="mt-4 pt-4 border-t border-emerald-600/10 flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium uppercase tracking-widest">Peso Neto Original</span>
              <span className="font-black text-foreground">{chemical.netWeight.toFixed(2)} kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Costs & Weights Section */}
      <div className="space-y-6 px-4">
        <h3 className="text-xl font-black tracking-tight">Análisis de Peso y Costos</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-card rounded-3xl p-6 border border-muted/20 text-center">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Peso Bruto</p>
            <p className="font-black text-xl">{chemical.grossWeight.toFixed(2)} kg</p>
          </div>
          <div className="bg-card rounded-3xl p-6 border border-muted/20 text-center">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Recipiente</p>
            <p className="font-bold text-destructive">-{chemical.containerWeight.toFixed(2)} kg</p>
          </div>
          <div className="bg-card rounded-3xl p-6 border border-muted/20 text-center">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Costo x Kg</p>
            <p className="font-black text-xl text-primary">${chemical.unitCost.toFixed(2)}</p>
          </div>
          <div className="bg-card rounded-3xl p-6 border border-muted/20 text-center">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Costo Total</p>
            <p className="font-black text-xl text-indigo-600">${chemical.totalCost.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Movement History Mock */}
      <div className="px-4">
        <div className="bg-muted/10 p-10 rounded-[3rem] border border-muted/20">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-8 flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial Reciente de Movimientos
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-card rounded-2xl border border-muted/10 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">Ingreso Inicial de Compra</p>
                  <p className="text-xs text-muted-foreground font-medium">{chemical.purchaseDate}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-emerald-600">+{chemical.netWeight.toFixed(2)} kg</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Referencia: {chemical.invoiceNumber}</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-card rounded-2xl border border-muted/10 shadow-sm opacity-60">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">Consumo en Receta Técnica</p>
                  <p className="text-xs text-muted-foreground font-medium">Hace 2 días</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-amber-600">-{(chemical.netWeight - chemical.currentStockKg).toFixed(2)} kg</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Referencia: REC-001</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {chemical.notes && (
        <div className="px-4 pb-10">
          <div className="bg-indigo-600/5 p-8 rounded-[2rem] border border-indigo-600/10">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Observaciones de Bodega
            </h4>
            <p className="text-sm text-foreground/80 leading-relaxed font-medium italic">
              {chemical.notes}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
