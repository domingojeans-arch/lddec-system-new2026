"use client";

import React, { useState, useMemo } from "react";
import { mockOutputs } from "@/data/mock-outputs";
import { OutputLine } from "@/types/output";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Plus, 
  ArrowUpCircle, 
  Building2, 
  CheckCircle2,
  Circle,
  Shirt
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface DispatchLineSelectorProps {
  clientId: string;
  onSelect: (line: OutputLine, outputId: string, outputNumber: string) => void;
  selectedLineIds: string[];
}

export function DispatchLineSelector({ clientId, onSelect, selectedLineIds }: DispatchLineSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const availableLines = useMemo(() => {
    const results: any[] = [];
    mockOutputs
      .filter(output => !clientId || output.clientId === clientId)
      .forEach(output => {
        output.lines.forEach(line => {
          // In a real app we'd filter lines that are already fully invoiced
          const matches = 
            line.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            output.outputNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            line.entryNumber.toLowerCase().includes(searchTerm.toLowerCase());
          
          if (matches) {
            results.push({
              ...line,
              outputId: output.id,
              outputNumber: output.outputNumber,
              clientName: output.clientName
            });
          }
        });
      });
    return results;
  }, [searchTerm, clientId]);

  return (
    <div className="space-y-4">
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
        <Input 
          placeholder="Buscar lotes despachados por Guía, Lote o Ref..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10 h-10 bg-muted/20 border-none rounded-xl text-sm"
        />
      </div>

      <ScrollArea className="h-[350px] rounded-xl border border-muted/30 p-2">
        <div className="space-y-2">
          {availableLines.map((item) => {
            const isSelected = selectedLineIds.includes(item.id);
            return (
              <div 
                key={item.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isSelected 
                    ? "bg-accent/5 border-accent/20" 
                    : "bg-card border-muted/20 hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-accent text-white" : "bg-muted text-muted-foreground"}`}>
                    <Shirt className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{item.lotNumber}</span>
                      <Badge variant="outline" className="text-[9px] font-black border-none bg-muted/50 px-1.5 h-4">
                        {item.outputNumber}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                      <ArrowUpCircle className="h-3 w-3" />
                      {item.clientName}
                      <span className="opacity-30">•</span>
                      {item.garmentType}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs font-black text-primary">{item.quantityDispatched} unds</p>
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Despachado</p>
                  </div>
                  
                  <Button
                    size="icon"
                    variant={isSelected ? "ghost" : "secondary"}
                    className={`h-8 w-8 rounded-full ${isSelected ? "text-accent cursor-default" : "hover:bg-accent hover:text-white"}`}
                    onClick={() => !isSelected && onSelect(item, item.outputId, item.outputNumber)}
                  >
                    {isSelected ? <CheckCircle2 className="h-5 w-5" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            );
          })}

          {availableLines.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
              <Circle className="h-8 w-8 opacity-10 mb-2" />
              <p className="text-xs font-medium">No hay despachos disponibles</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
