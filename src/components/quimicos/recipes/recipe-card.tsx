"use client";

import React from "react";
import { ChemicalRecipe } from "@/types/chemical-recipe";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Building2, Layers, Eye, Edit3, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecipeCardProps {
  recipe: ChemicalRecipe;
  onView: (recipe: ChemicalRecipe) => void;
  onEdit: (recipe: ChemicalRecipe) => void;
}

const statusMap = {
  draft: { label: "Borrador", color: "bg-zinc-500/10 text-zinc-600" },
  prepared: { label: "Preparada", color: "bg-cyan-500/10 text-cyan-600" },
  applied: { label: "Aplicada", color: "bg-emerald-500/10 text-emerald-600" },
};

export function RecipeCard({ recipe, onView, onEdit }: RecipeCardProps) {
  return (
    <Card className="border-none shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 bg-card rounded-[2.5rem] overflow-hidden group">
      <CardContent className="p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-cyan-500/5 flex items-center justify-center shrink-0 border border-cyan-500/10">
              <FlaskConical className="h-7 w-7 text-cyan-600" />
            </div>
            <div>
              <h3 className="font-black text-xl text-foreground tracking-tight group-hover:text-cyan-600 transition-colors">
                {recipe.recipeNumber}
              </h3>
              <p className="text-xs text-muted-foreground font-bold mt-1 uppercase tracking-widest">
                {recipe.clientName}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-cyan-500/5 hover:text-cyan-600" onClick={() => onView(recipe)}>
              <Eye className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-cyan-500/5 hover:text-cyan-600" onClick={() => onEdit(recipe)}>
              <Edit3 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Lote Industrial</p>
                <p className="text-sm font-bold">{recipe.lotNumber} <span className="text-[10px] text-muted-foreground font-medium">({recipe.entryNumber})</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Responsable</p>
                <p className="text-sm font-bold">{recipe.responsible}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-end bg-emerald-600/5 p-4 rounded-2xl border border-emerald-600/10">
            <div className="space-y-1">
              <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Costo Químico</p>
              <div className="text-2xl font-black text-emerald-600">
                ${recipe.totalChemicalCost.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-[9px] font-black bg-emerald-600/10 text-emerald-600 border-none h-6 px-3">
                {recipe.items.length} Insumos
              </Badge>
            </div>
          </div>

          <div className="pt-6 border-t border-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <Calendar className="h-3.5 w-3.5" />
              {recipe.recipeDate}
            </div>
            <Badge 
              variant="outline"
              className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border-none ${statusMap[recipe.status].color}`}
            >
              {statusMap[recipe.status].label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
