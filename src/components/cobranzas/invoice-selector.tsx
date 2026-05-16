"use client";

import React, { useState, useMemo } from "react";
import { mockInvoices } from "@/data/mock-invoices";
import { Invoice } from "@/types/invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Receipt, CheckCircle2, Circle, Calendar } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface InvoiceSelectorProps {
  clientId: string;
  onSelect: (invoice: Invoice) => void;
  selectedInvoiceIds: string[];
}

export function InvoiceSelector({ clientId, onSelect, selectedInvoiceIds }: InvoiceSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const availableInvoices = useMemo(() => {
    return mockInvoices.filter(invoice => {
      const isClientMatch = !clientId || invoice.clientId === clientId;
      const isNotSettled = invoice.balancePending > 0;
      const matchesSearch = 
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      
      return isClientMatch && isNotSettled && matchesSearch;
    });
  }, [searchTerm, clientId]);

  return (
    <div className="space-y-4">
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-amber-600 transition-colors" />
        <Input 
          placeholder="Buscar facturas pendientes por Nro o Socio..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10 h-10 bg-muted/20 border-none rounded-xl text-sm"
        />
      </div>

      <ScrollArea className="h-[350px] rounded-xl border border-muted/30 p-2">
        <div className="space-y-2">
          {availableInvoices.map((invoice) => {
            const isSelected = selectedInvoiceIds.includes(invoice.id);
            return (
              <div 
                key={invoice.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  isSelected 
                    ? "bg-amber-500/5 border-amber-500/20" 
                    : "bg-card border-muted/20 hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isSelected ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{invoice.invoiceNumber}</span>
                      <Badge variant="outline" className="text-[9px] font-black border-none bg-muted/50 px-1.5 h-4">
                        Total: ${invoice.total.toFixed(2)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                      <Calendar className="h-3 w-3" />
                      Vence: {invoice.dueDate}
                      <span className="opacity-30">•</span>
                      {invoice.clientName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs font-black text-amber-600">${invoice.balancePending.toFixed(2)}</p>
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Saldo Pendiente</p>
                  </div>
                  
                  <Button
                    size="icon"
                    variant={isSelected ? "ghost" : "secondary"}
                    className={`h-8 w-8 rounded-full ${isSelected ? "text-amber-500 cursor-default" : "hover:bg-amber-500 hover:text-white"}`}
                    onClick={() => !isSelected && onSelect(invoice)}
                  >
                    {isSelected ? <CheckCircle2 className="h-5 w-5" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            );
          })}

          {availableInvoices.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
              <Circle className="h-8 w-8 opacity-10 mb-2" />
              <p className="text-xs font-medium">No hay facturas pendientes</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
