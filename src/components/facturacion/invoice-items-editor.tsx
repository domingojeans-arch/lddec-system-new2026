"use client";

import React from "react";
import { InvoiceItem } from "@/types/invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Calculator, Shirt, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface InvoiceItemsEditorProps {
  items: InvoiceItem[];
  onChange: (items: InvoiceItem[]) => void;
}

export function InvoiceItemsEditor({ items, onChange }: InvoiceItemsEditorProps) {
  const removeItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<InvoiceItem>) => {
    onChange(items.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, ...updates };
      
      // Calculate line total
      updated.lineTotal = (updated.quantityToInvoice || 0) * (updated.unitPrice || 0);
      
      // Calculate pending
      updated.quantityPendingInvoice = updated.quantityDispatched - updated.quantityToInvoice;
      
      // Update status
      if (updated.quantityPendingInvoice <= 0) {
        updated.status = 'invoiced';
      } else if (updated.quantityToInvoice > 0) {
        updated.status = 'partial_invoiced';
      } else {
        updated.status = 'pending_invoice';
      }
      
      return updated;
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/70">
          Detalle de Ítems a Facturar
        </h4>
      </div>

      <div className="space-y-4">
        {items.map((item, idx) => (
          <div 
            key={item.id} 
            className="group relative bg-muted/10 rounded-2xl p-6 border border-transparent hover:border-accent/20 transition-all animate-in fade-in slide-in-from-right-2"
          >
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                onClick={() => removeItem(item.id)}
                className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Info Column */}
              <div className="md:col-span-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-base">{item.lotNumber}</span>
                  <Badge variant="outline" className="text-[9px] font-black border-none bg-muted/50">
                    Guía: {item.outputNumber}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-medium truncate">
                  {item.garmentType} • {item.process}
                </p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                  Disp: {item.quantityDispatched} | Pend: {item.quantityPendingInvoice}
                </p>
              </div>

              {/* Quantity to Invoice */}
              <div className="md:col-span-3 space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cantidad</Label>
                <div className="relative">
                  <Shirt className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
                  <Input 
                    type="number" 
                    value={item.quantityToInvoice} 
                    max={item.quantityDispatched}
                    onChange={e => updateItem(item.id, { quantityToInvoice: parseInt(e.target.value) || 0 })}
                    className="pl-10 bg-background border-none shadow-none h-10 font-bold rounded-xl"
                  />
                </div>
              </div>

              {/* Unit Price */}
              <div className="md:col-span-3 space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">P. Unitario</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
                  <Input 
                    type="number" 
                    step="0.01"
                    value={item.unitPrice} 
                    onChange={e => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                    className="pl-10 bg-background border-none shadow-none h-10 font-bold rounded-xl"
                  />
                </div>
              </div>

              {/* Line Total */}
              <div className="md:col-span-2 text-right">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Total</Label>
                <p className="text-lg font-black text-primary">
                  ${item.lineTotal.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="h-32 border-2 border-dashed border-muted rounded-2xl flex flex-col items-center justify-center text-muted-foreground bg-muted/5 gap-2">
            <Calculator className="h-6 w-6 opacity-20" />
            <p className="text-sm font-medium">Selecciona ítems despachados para facturar</p>
          </div>
        )}
      </div>
    </div>
  );
}
