"use client";

import React from "react";
import { ChemicalRecipe } from "@/types/chemical-recipe";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  FlaskConical, 
  Calendar, 
  Building2, 
  Layers,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Beaker,
  User,
  Scale,
  TrendingDown,
  ArrowRight
} from "lucide-react";

interface RecipeDetailProps {
  recipe: ChemicalRecipe;
}

const statusMap = {
  draft: { label: "Borrador", icon: Clock, color: "text-zinc-500 bg-zinc-500/10" },
  prepared: { label: "Preparada", icon: AlertCircle, color: "text-cyan-500 bg-cyan-500/10" },
  applied: { label: "Aplicada", icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10" },
};

export function RecipeDetail({ recipe }: RecipeDetailProps) {
  const StatusIcon = statusMap[recipe.status].icon;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header Info */}
      <div className="bg-card p-10 rounded-[3rem] border border-muted/30 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5">
          <FlaskConical className="h-32 w-32" />
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 relative z-10">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-cyan-600 flex items-center justify-center shadow-2xl shadow-cyan-600/30">
                <FlaskConical className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-4xl font-black tracking-tighter text-foreground">{recipe.recipeNumber}</h2>
                <Badge className={`rounded-full px-4 py-1 mt-2 font-bold text-[10px] uppercase tracking-widest ${statusMap[recipe.status].color}`}>
                  <StatusIcon className="h-3 w-3 mr-2" />
                  {statusMap[recipe.status].label}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Socio</p>
                <div className="flex items-center gap-2 font-bold">
                  <Building2 className="h-4 w-4 text-cyan-600" />
                  {recipe.clientName}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Lote Operativo</p>
                <div className="flex items-center gap-2 font-bold">
                  <Layers className="h-4 w-4 text-cyan-600" />
                  {recipe.lotNumber}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Fecha</p>
                <div className="flex items-center gap-2 font-bold">
                  <Calendar className="h-4 w-4 text-cyan-600" />
                  {recipe.recipeDate}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Responsable</p>
                <div className="flex items-center gap-2 font-bold">
                  <User className="h-4 w-4 text-cyan-600" />
                  {recipe.responsible}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-600/5 p-8 rounded-[2.5rem] border border-emerald-600/10 min-w-[280px] text-right">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Costo Total Mezcla</p>
            <p className="text-5xl font-black text-emerald-600 tracking-tighter">${recipe.totalChemicalCost.toFixed(2)}</p>
            <div className="mt-4 pt-4 border-t border-emerald-600/10 flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium uppercase tracking-widest">Insumos Utilizados</span>
              <span className="font-black text-foreground">{recipe.items.length} ítems</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="space-y-6 px-4">
        <h3 className="text-xl font-black tracking-tight">Composición de la Mezcla</h3>
        <div className="grid grid-cols-1 gap-4">
          {recipe.items.map((item) => (
            <div key={item.id} className="bg-card rounded-3xl p-8 border border-muted/20 flex flex-col lg:flex-row lg:items-center justify-between gap-8 hover:shadow-md transition-all">
              <div className="flex items-center gap-4 min-w-[300px]">
                <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                  <Beaker className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-lg">{item.chemicalName}</h4>
                  <p className="text-xs text-muted-foreground font-medium">Costo unitario: ${item.unitCost.toFixed(2)}/kg</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-12 flex-1">
                <div className="text-center">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Dosificación</p>
                  <p className="font-black text-foreground text-lg">{item.quantityGrams} <span className="text-xs font-bold text-muted-foreground">gr</span></p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Equivalente</p>
                  <p className="font-bold text-foreground/70">{item.quantityKg.toFixed(3)} kg</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Costo Ítem</p>
                  <p className="font-black text-emerald-600 text-lg">${item.totalCost.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Stock Proyectado</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {item.stockBeforeKg.toFixed(2)} <ArrowRight className="h-2 w-2 inline" /> {item.stockAfterKg.toFixed(2)} kg
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Observations */}
      {recipe.notes && (
        <div className="px-4 pb-10">
          <div className="bg-cyan-600/5 p-10 rounded-[3rem] border border-cyan-600/10">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 mb-6 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Instrucciones de Preparación
            </h4>
            <p className="text-sm text-foreground/80 leading-relaxed font-medium italic">
              {recipe.notes}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
