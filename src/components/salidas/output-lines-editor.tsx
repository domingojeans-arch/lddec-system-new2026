"use client";

import React from "react";
import { OutputLine } from "@/types/output";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Calculator, AlertTriangle, CheckCircle2, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OutputLinesEditorProps {
  lines: OutputLine[];
  onChange: (lines: OutputLine[]) => void;
}

export function OutputLinesEditor({ lines, onChange }: OutputLinesEditorProps) {
  const removeLine = (id: string) => {
    onChange(lines.filter(l => l.id !== id));
  };

  const updateLine = (id: string, updates: Partial<OutputLine>) => {
    onChange(lines.map(line => {
      if (line.id !== id) return line;
      
      const updated = { ...line, ...updates };
      
      // Calculate pending
      const dispatched = updated.quantityDispatched || 0;
      const samples = updated.quantitySamples || 0;
      const missing = updated.quantityMissing || 0;
      const damaged = updated.quantityDamaged || 0;
      const original = updated.quantityOriginal;
      
      updated.quantityPending = original - dispatched - samples - damaged - missing;
      
      // Update status based on logic
      if (updated.quantityPending <= 0) {
        updated.status = (damaged > 0 || missing > 0) ? 'with_issues' : 'dispatched';
      } else if (dispatched > 0 || samples > 0) {
        updated.status = 'partial';
      } else {
        updated.status = 'pending';
      }
      
      return updated;
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/70">
          Desglose de Despacho por Lote
        </h4>
      </div>

      <div className="space-y-6">
        {lines.map((line, idx) => (
          <div 
            key={line.id} 
            className="group relative bg-muted/10 rounded-3xl p-8 border border-transparent hover:border-accent/20 transition-all animate-in fade-in slide-in-from-right-2"
          >
            <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                onClick={() => removeLine(line.id)}
                className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-full"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-8">
              {/* Header Info Line */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-muted/20 pb-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-accent/5 text-accent flex items-center justify-center font-black text-xs">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-black text-lg">{line.lotNumber}</h5>
                      <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter bg-muted/30 px-2 py-0.5 rounded">
                        Ref: {line.entryNumber}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">{line.garmentType} • {line.process}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Original</p>
                    <p className="text-lg font-black">{line.quantityOriginal}</p>
                  </div>
                  <div className="h-8 w-px bg-muted/40" />
                  <div className="text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Pendiente</p>
                    <p className={`text-lg font-black ${line.quantityPending > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {line.quantityPending}
                    </p>
                  </div>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Despachado</Label>
                  <Input 
                    type="number" 
                    value={line.quantityDispatched} 
                    onChange={e => updateLine(line.id, { quantityDispatched: parseInt(e.target.value) || 0 })}
                    className="bg-background border-none shadow-none h-11 font-black text-accent text-lg rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Muestras</Label>
                  <Input 
                    type="number" 
                    value={line.quantitySamples} 
                    onChange={e => updateLine(line.id, { quantitySamples: parseInt(e.target.value) || 0 })}
                    className="bg-background border-none shadow-none h-11 font-bold text-muted-foreground rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Faltantes</Label>
                  <Input 
                    type="number" 
                    value={line.quantityMissing} 
                    onChange={e => updateLine(line.id, { quantityMissing: parseInt(e.target.value) || 0 })}
                    className="bg-background border-none shadow-none h-11 font-bold text-destructive/70 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Dañados</Label>
                  <Input 
                    type="number" 
                    value={line.quantityDamaged} 
                    onChange={e => updateLine(line.id, { quantityDamaged: parseInt(e.target.value) || 0 })}
                    className="bg-background border-none shadow-none h-11 font-bold text-destructive rounded-xl"
                  />
                </div>
                <div className="col-span-2 lg:col-span-1 flex items-end">
                   <Badge variant="outline" className={`w-full justify-center h-11 rounded-xl border-none font-black text-[10px] uppercase tracking-widest ${
                     line.status === 'dispatched' ? 'bg-emerald-500/10 text-emerald-600' : 
                     line.status === 'partial' ? 'bg-amber-500/10 text-amber-600' :
                     line.status === 'with_issues' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                   }`}>
                     {line.status === 'dispatched' && <CheckCircle2 className="h-3 w-3 mr-1.5" />}
                     {line.status === 'partial' && <History className="h-3 w-3 mr-1.5" />}
                     {line.status === 'with_issues' && <AlertTriangle className="h-3 w-3 mr-1.5" />}
                     {line.status.replace('_', ' ')}
                   </Badge>
                </div>
              </div>

              {/* Line Notes */}
              <div className="space-y-2">
                <Textarea 
                  placeholder="Novedades específicas del lote durante el despacho..." 
                  value={line.notes} 
                  onChange={e => updateLine(line.id, { notes: e.target.value })}
                  className="bg-background border-none shadow-none min-h-[60px] resize-none text-xs rounded-xl"
                />
              </div>
            </div>
          </div>
        ))}

        {lines.length === 0 && (
          <div className="h-48 border-2 border-dashed border-muted rounded-[2rem] flex flex-col items-center justify-center text-muted-foreground bg-muted/5 gap-3">
            <Calculator className="h-8 w-8 opacity-20" />
            <p className="text-sm font-bold">Selecciona lotes para iniciar el despacho</p>
            <p className="text-xs max-w-xs text-center opacity-70">Haz clic en el botón superior para buscar en los ingresos disponibles.</p>
          </div>
        )}
      </div>
    </div>
  );
}
