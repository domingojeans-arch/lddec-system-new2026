"use client";

import React, { useState, useMemo } from "react";
import { mockChemicals } from "@/data/mock-chemicals";
import { Chemical } from "@/types/chemical";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Beaker, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ChemicalSelectorProps {
  onSelect: (chemical: Chemical) => void;
  selectedChemicalIds: string[];
}

export function ChemicalSelector({ onSelect, selectedChemicalIds }: ChemicalSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const availableChemicals = useMemo(() => {
    return mockChemicals.filter(chem => {
      const matchesSearch = 
        chem.chemicalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chem.supplier.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [searchTerm]);

  return (
    <div className="space-y-4">
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-cyan-600 transition-colors" />
        <Input 
          placeholder="Filtrar por Nombre o Proveedor..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10 h-10 bg-muted/20 border-none rounded-xl text-sm"
        />
      </div>

      <ScrollArea className="h-[300px] rounded-xl border border-muted/30 p-2">
        <div className="space-y-2">
          {availableChemicals.map((item) => {
            const isSelected = selectedChemicalIds.includes(item.id);
            const isLowStock = item.status === 'low_stock' || item.currentStockKg <= 0;
            
            return (
              <div 
                key={item.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isSelected 
                    ? "bg-cyan-500/5 border-cyan-500/20" 
                    : "bg-card border-muted/20 hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-cyan-600 text-white" : "bg-muted text-muted-foreground"}`}>
                    <Beaker className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{item.chemicalName}</span>
                      {isLowStock && (
                        <Badge variant="destructive" className="h-4 px-1.5 text-[8px] uppercase tracking-tighter">Stock Crítico</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                      {item.supplier}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-xs font-black ${isLowStock ? "text-destructive" : "text-primary"}`}>{item.currentStockKg.toFixed(2)} kg</p>
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Disponible</p>
                  </div>
                  
                  <Button
                    size="icon"
                    variant={isSelected ? "ghost" : "secondary"}
                    className={`h-8 w-8 rounded-full ${isSelected ? "text-cyan-600 cursor-default" : "hover:bg-cyan-600 hover:text-white"}`}
                    onClick={() => !isSelected && onSelect(item)}
                  >
                    {isSelected ? <CheckCircle2 className="h-5 w-5" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            );
          })}

          {availableChemicals.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
              <Circle className="h-8 w-8 opacity-10 mb-2" />
              <p className="text-xs font-medium">No se encontraron insumos</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
