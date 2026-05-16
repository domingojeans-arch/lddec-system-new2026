"use client";

import React from "react";
import { CollectionItem } from "@/types/collection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Receipt, DollarSign, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CollectionItemsEditorProps {
  items: CollectionItem[];
  onChange: (items: CollectionItem[]) => void;
}

export function CollectionItemsEditor({ items, onChange }: CollectionItemsEditorProps) {
  const removeItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<CollectionItem>) => {
    onChange(items.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, ...updates };
      
      // Calculate total applied
      updated.totalApplied = 
        (Number(updated.amountReceived) || 0) + 
        (Number(updated.discount) || 0) + 
        (Number(updated.promptPaymentDiscount) || 0) + 
        (Number(updated.retention) || 0) + 
        (Number(updated.damagedDiscount) || 0);
      
      // Calculate remaining balance
      updated.remainingBalance = updated.previousBalance - updated.totalApplied;
      
      // Update status
      if (updated.remainingBalance <= 0) {
        updated.status = 'settled';
      } else if (updated.totalApplied > 0) {
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
          Detalle de Aplicación de Cobro
        </h4>
      </div>

      <div className="space-y-6">
        {items.map((item) => (
          <div 
            key={item.id} 
            className="group relative bg-muted/10 rounded-3xl p-8 border border-transparent hover:border-amber-500/20 transition-all animate-in fade-in slide-in-from-right-2"
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
              {/* Header Info */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-muted/20 pb-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/5 text-amber-600 flex items-center justify-center">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-black text-lg">{item.invoiceNumber}</h5>
                      <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter bg-muted/30 px-2 py-0.5 rounded">
                        Emitida: {item.invoiceDate}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">Total Factura: ${item.invoiceTotal.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Saldo Anterior</p>
                    <p className="text-lg font-black text-foreground">${item.previousBalance.toFixed(2)}</p>
                  </div>
                  <div className="h-8 w-px bg-muted/40" />
                  <div className="text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Saldo Restante</p>
                    <p className={`text-lg font-black ${item.remainingBalance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      ${item.remainingBalance.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid of Inputs */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Valor Recibido</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
                    <Input 
                      type="number" 
                      step="0.01"
                      value={item.amountReceived} 
                      onChange={e => updateItem(item.id, { amountReceived: Number(e.target.value) || 0 })}
                      className="pl-9 bg-background border-none shadow-none h-11 font-black text-emerald-600 text-base rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Retención</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={item.retention} 
                    onChange={e => updateItem(item.id, { retention: Number(e.target.value) || 0 })}
                    className="bg-background border-none shadow-none h-11 font-bold text-muted-foreground rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Pronto Pago</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={item.promptPaymentDiscount} 
                    onChange={e => updateItem(item.id, { promptPaymentDiscount: Number(e.target.value) || 0 })}
                    className="bg-background border-none shadow-none h-11 font-bold text-muted-foreground rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Prendas Dañadas</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={item.damagedDiscount} 
                    onChange={e => updateItem(item.id, { damagedDiscount: Number(e.target.value) || 0 })}
                    className="bg-background border-none shadow-none h-11 font-bold text-destructive/70 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Otros Dctos</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={item.discount} 
                    onChange={e => updateItem(item.id, { discount: Number(e.target.value) || 0 })}
                    className="bg-background border-none shadow-none h-11 font-bold text-muted-foreground rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 bg-background/40 p-3 rounded-2xl border border-muted/10">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Aplicado a Factura</span>
                <span className="font-black text-emerald-600 text-lg">${item.totalApplied.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="h-32 border-2 border-dashed border-muted rounded-[2rem] flex flex-col items-center justify-center text-muted-foreground bg-muted/5 gap-2">
            <Calculator className="h-6 w-6 opacity-20" />
            <p className="text-sm font-medium">Selecciona facturas pendientes para registrar cobranza</p>
          </div>
        )}
      </div>
    </div>
  );
}
