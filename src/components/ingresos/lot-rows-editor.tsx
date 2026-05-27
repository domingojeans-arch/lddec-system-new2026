"use client";

import React from "react";
import { EntryLot, EntryGarment } from "@/types/entry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Layers, User, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LotRowsEditorProps {
  lots: EntryLot[];
  onChange: (lots: EntryLot[]) => void;
  garmentCatalog: string[];
  processCatalog: string[];
}

export function LotRowsEditor({ lots, onChange, garmentCatalog, processCatalog }: LotRowsEditorProps) {
  const addLot = () => {
    const lastLot = lots[lots.length - 1];
    
    const newLot: EntryLot = {
      id: Math.random().toString(36).substr(2, 9),
      lotNumber: "", 
      responsible: lastLot?.responsible || "",
      process: "", 
      washType: "", 
      notes: lastLot?.notes || "",
      isSample: lastLot?.isSample || false,
      status: "pending",
      garments: lastLot 
        ? lastLot.garments.map(g => ({ ...g, id: Math.random().toString(36).substr(2, 9) }))
        : [{ id: Math.random().toString(36).substr(2, 9), garmentType: "", quantity: 0 }],
    };
    onChange([...lots, newLot]);
  };

  const removeLot = (id: string) => {
    onChange(lots.filter(l => l.id !== id));
  };

  const updateLot = (id: string, updates: Partial<EntryLot>) => {
    onChange(lots.map(l => (l.id === id ? { ...l, ...updates } : l)));
  };

  const addGarment = (lotId: string) => {
    const newGarment: EntryGarment = {
      id: Math.random().toString(36).substr(2, 9),
      garmentType: "",
      quantity: 0
    };
    onChange(lots.map(l => {
      if (l.id === lotId) {
        return { ...l, garments: [...l.garments, newGarment] };
      }
      return l;
    }));
  };

  const removeGarment = (lotId: string, garmentId: string) => {
    onChange(lots.map(l => {
      if (l.id === lotId) {
        return { ...l, garments: l.garments.filter(g => g.id !== garmentId) };
      }
      return l;
    }));
  };

  const updateGarment = (lotId: string, garmentId: string, updates: Partial<EntryGarment>) => {
    onChange(lots.map(l => {
      if (l.id === lotId) {
        return {
          ...l,
          garments: l.garments.map(g => g.id === garmentId ? { ...g, ...updates } : g)
        };
      }
      return l;
    }));
  };

  return (
    <div className="space-y-8">
      <div className="space-y-10">
        {lots.map((lot, idx) => (
          <div 
            key={lot.id} 
            className="bg-muted/20 rounded-[24px] p-8 border border-border relative shadow-sm space-y-8 transition-colors duration-300"
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-2xl">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                <span className="text-base font-black text-foreground uppercase tracking-tighter">Lote #{idx + 1}</span>
              </div>
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                onClick={() => removeLot(lot.id)}
                className="h-10 w-10 text-destructive hover:bg-destructive/10 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Nº Lote</Label>
                <Input 
                  value={lot.lotNumber ?? ""} 
                  placeholder="Ej: 20340"
                  onChange={e => updateLot(lot.id, { lotNumber: e.target.value })}
                  className="erp-input h-11 font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Responsable del Lote</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    value={lot.responsible ?? ""}
                    placeholder="Encargado de planta"
                    onChange={e => updateLot(lot.id, { responsible: e.target.value })}
                    className="pl-10 erp-input h-11 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <Label className="text-[10px] uppercase font-black text-primary tracking-widest">Prendas / Desglose del Lote</Label>
              <div className="space-y-4">
                {lot.garments.map((garment) => (
                  <div key={garment.id} className="flex gap-4 items-end group animate-in fade-in duration-200">
                    <div className="flex-1 space-y-2">
                      <Select 
                        value={garment.garmentType || ""} 
                        onValueChange={v => updateGarment(lot.id, garment.id, { garmentType: v })}
                      >
                        <SelectTrigger className="erp-input h-11 text-sm font-bold">
                          <SelectValue placeholder="Seleccione Prenda" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-2xl">
                          {Array.from(new Set([...garmentCatalog, garment.garmentType].filter(Boolean))).map(g => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32 space-y-2">
                      <Input 
                        type="number"
                        value={garment.quantity ?? ""}
                        placeholder="Cant."
                        onChange={e => updateGarment(lot.id, garment.id, { quantity: parseInt(e.target.value) || 0 })}
                        className="erp-input h-11 text-base font-black text-primary text-center"
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      onClick={() => removeGarment(lot.id, garment.id)}
                      disabled={lot.garments.length <= 1}
                      className="h-11 w-11 text-destructive hover:bg-destructive/10 rounded-xl disabled:opacity-0"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => addGarment(lot.id)}
                className="h-10 bg-card border-border text-foreground hover:bg-muted font-bold text-[10px] uppercase tracking-widest px-6 rounded-xl flex items-center gap-2 transition-all shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Añadir Prenda
              </Button>
            </div>

            <div className="space-y-2 pt-4">
              <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Instrucciones / Notas del Lote</Label>
              <Textarea 
                value={lot.notes ?? ""}
                placeholder="Detalles sobre el proceso o especificaciones urgentes..."
                onChange={e => updateLot(lot.id, { notes: e.target.value })}
                className="erp-input min-h-[100px] h-auto py-4 rounded-[18px] text-sm resize-none"
              />
            </div>
          </div>
        ))}

        <div className="flex justify-start">
          <Button 
            type="button" 
            variant="outline" 
            onClick={addLot}
            className="h-12 bg-background border-border text-foreground hover:bg-muted font-black text-xs uppercase tracking-widest px-10 rounded-2xl flex items-center gap-3 transition-all shadow-sm"
          >
            <Plus className="h-5 w-5" />
            Añadir Otro Lote al Ingreso
          </Button>
        </div>
      </div>
    </div>
  );
}
