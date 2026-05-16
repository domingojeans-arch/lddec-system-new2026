"use client";

import React, { useState, useMemo } from "react";
import { mockEntries } from "@/data/mock-entries";
import { EntryLot } from "@/types/entry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Layers, Building2, CheckCircle2, Circle, Shirt } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LotRecipeSelectorProps {
  onSelect: (lot: EntryLot, entryId: string, entryNumber: string, clientId: string, clientName: string) => void;
  selectedLotId?: string;
}

export function LotRecipeSelector({ onSelect, selectedLotId }: LotRecipeSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const availableLots = useMemo(() => {
    const results: any[] = [];
    mockEntries.forEach(entry => {
      entry.lots.forEach(lot => {
        const matches = 
          lot.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (lot.garmentType || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (lot.process || "").toLowerCase().includes(searchTerm.toLowerCase());
        
        if (matches) {
          results.push({
            ...lot,
            entryId: entry.id,
            entryNumber: entry.entryNumber,
            clientId: entry.clientId,
            clientName: entry.clientName
          });
        }
      });
    });
    return results;
  }, [searchTerm]);

  return (
    <div className="space-y-4">
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Buscar lotes operativos..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10 h-10 bg-muted/20 border-none rounded-xl text-sm"
        />
      </div>

      <ScrollArea className="h-[300px] rounded-xl border border-muted/30 p-2">
        <div className="space-y-2">
          {availableLots.map((item) => {
            const isSelected = selectedLotId === item.id;
            return (
              <div 
                key={item.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isSelected 
                    ? "bg-primary/5 border-primary/20" 
                    : "bg-card border-muted/20 hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{item.lotNumber}</span>
                      <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">({item.entryNumber})</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {item.clientName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs font-black text-primary">{item.process}</p>
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">{item.garmentType}</p>
                  </div>
                  
                  <Button
                    size="icon"
                    variant={isSelected ? "ghost" : "secondary"}
                    className={`h-8 w-8 rounded-full ${isSelected ? "text-primary cursor-default" : "hover:bg-primary hover:text-white"}`}
                    onClick={() => !isSelected && onSelect(item, item.entryId, item.entryNumber, item.clientId, item.clientName)}
                  >
                    {isSelected ? <CheckCircle2 className="h-5 w-5" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            );
          })}

          {availableLots.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
              <Circle className="h-8 w-8 opacity-10 mb-2" />
              <p className="text-xs font-medium">No hay lotes que coincidan</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
