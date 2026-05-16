"use client";

import React from "react";
import { ChemicalRecipeItem } from "@/types/chemical-recipe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Calculator, Beaker, ArrowRight, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecipeItemsEditorProps {
  items: ChemicalRecipeItem[];
  onChange: (items: ChemicalRecipeItem[]) => void;
}

export function RecipeItemsEditor({ items, onChange }: RecipeItemsEditorProps) {
  const removeItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<ChemicalRecipeItem>) => {
    onChange(items.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, ...updates };
      
      // Calculate derived fields
      if (updates.quantityGrams !== undefined) {
        updated.quantityKg = updated.quantityGrams / 1000;
        updated.totalCost = updated.quantityKg * updated.unitCost;
        updated.stockAfterKg = updated.stockBeforeKg - updated.quantityKg;
      }
      
      return updated;
    }));
  };

  return (
    <div className="space-y-4">
      {items.map((item, idx) => (
        <div 
          key={item.id} 
          className="group relative bg-muted/10 rounded-[2rem] p-8 border border-transparent hover:border-cyan-500/20 transition-all animate-in fade-in slide-in-from-right-2"
        >
          <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              onClick={() => removeItem(item.id)}
              className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-full"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-6">
            {/* Header Line */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-muted/20 pb-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/5 text-indigo-600 flex items-center justify-center">
                  <Beaker className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="font-black text-lg">{item.chemicalName}</h5>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                    Costo: ${item.unitCost.toFixed(2)}/kg
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Stock Actual</p>
                  <p className="text-lg font-black">{item.stockBeforeKg.toFixed(2)} kg</p>
                </div>
                <div className="h-8 w-px bg-muted/40" />
                <div className="text-center">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Proyectado</p>
                  <p className={`text-lg font-black ${item.stockAfterKg < 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {item.stockAfterKg.toFixed(2)} kg
                  </p>
                </div>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
              <div className="md:col-span-3 space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cantidad (Gramos)</Label>
                <div className="relative">
                  <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
                  <Input 
                    type="number" 
                    value={item.quantityGrams} 
                    onChange={e => updateItem(item.id, { quantityGrams: parseInt(e.target.value) || 0 })}
                    className="pl-10 bg-background border-none shadow-none h-11 font-black text-lg rounded-xl"
                  />
                </div>
              </div>

              <div className="md:col-span-2 text-center pb-2">
                <div className="inline-flex flex-col items-center">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Equivalente</p>
                  <Badge variant="outline" className="h-7 border-none bg-muted/30 px-3 font-bold">
                    {item.quantityKg.toFixed(3)} kg
                  </Badge>
                </div>
              </div>

              <div className="md:col-span-5 space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Observación Ítem</Label>
                <Input 
                  placeholder="Instrucciones específicas..." 
                  value={item.notes} 
                  onChange={e => updateItem(item.id, { notes: e.target.value })}
                  className="bg-background border-none shadow-none h-11 rounded-xl text-sm"
                />
              </div>

              <div className="md:col-span-2 text-right space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Costo Ítem</p>
                <p className="text-2xl font-black text-emerald-600">${item.totalCost.toFixed(2)}</p>
              </div>
            </div>

            {item.stockAfterKg < 0 && (
              <div className="flex items-center gap-2 text-destructive font-bold text-[10px] uppercase tracking-widest bg-destructive/10 p-2 rounded-xl">
                <Info className="h-3 w-3" />
                Advertencia: Consumo excede el stock disponible en bodega.
              </div>
            )}
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div className="h-48 border-2 border-dashed border-muted rounded-[2.5rem] flex flex-col items-center justify-center text-muted-foreground bg-muted/5 gap-3">
          <Beaker className="h-8 w-8 opacity-20" />
          <p className="text-sm font-bold">La mezcla está vacía</p>
          <p className="text-xs max-w-xs text-center opacity-70">Añade químicos desde el catálogo superior para empezar a formular.</p>
        </div>
      )}
    </div>
  );
}
