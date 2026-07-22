"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Wallet, Plus, CreditCard, Calendar as CalendarIcon } from "lucide-react";
import { TipoAjusteCobranza, MetodoPagoCobranza } from "@/types/lddec";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CobranzaFormProps {
  lines: any[];
  onUpdateLine: (id: string, updates: any) => void;
  onRemoveLine: (id: string) => void;
  onAddLine: () => void;
  invoices: any[];
}

const TIPO_TRANSACCION: TipoAjusteCobranza[] = [
  "Pago", 
  "Descuento Pronto Pago", 
  "Retención", 
  "Nota de Crédito", 
  "Reverso", 
  "Otro Ajuste"
];

const METODOS_PAGO: MetodoPagoCobranza[] = [
  "Efectivo", 
  "Transferencia", 
  "Cheque", 
  "Tarjeta"
];

export function CobranzaForm({ lines, onUpdateLine, onRemoveLine, onAddLine, invoices }: CobranzaFormProps) {
  const formatBalance = (val: any) => {
    const n = Number(val || 0);
    return n.toFixed(2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-primary" />
          <h4 className="text-sm font-black uppercase tracking-widest text-foreground">Registro de Pagos Asignados</h4>
        </div>
      </div>

      <div className="space-y-4">
        {lines.map((line, index) => {
          const isNotaCredito = line.tipoTransaccion === "Nota de Crédito";
          const isRetencion = line.tipoTransaccion === "Retención";
          const disablePaymentMethod = isNotaCredito || isRetencion;

          return (
            <div key={line.id} className="bg-muted/20 p-6 rounded-[1.5rem] border border-border space-y-6 animate-in slide-in-from-right-2">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-3 py-1 rounded-full tracking-widest">
                  Documento #{index + 1}
                </span>
                <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">
                  Línea de Cobro
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="space-y-1.5 md:col-span-8">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Factura Destino</Label>
                  <Select value={line.invoiceId} onValueChange={(val) => onUpdateLine(line.id, { invoiceId: val })}>
                    <SelectTrigger className="erp-input h-11 bg-background font-bold text-xs">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {invoices.map(inv => {
                        const isAlreadySelected = lines.some(line => line.invoiceId === inv.id);
                        return (
                          <SelectItem 
                            key={inv.id} 
                            value={inv.id} 
                            className={cn(
                              "text-xs uppercase font-bold",
                              isAlreadySelected && "bg-green-50/70 dark:bg-green-950/40 border-l-2 border-green-400 dark:border-green-500 data-[highlighted]:bg-green-100 dark:data-[highlighted]:bg-green-900/40"
                            )}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <span>
                                {inv._normalizedNumero || inv.numeroFactura || "DOCTO"} (Saldo: ${formatBalance(inv._normalizedSaldo || inv.saldoPendiente)})
                              </span>
                              {isAlreadySelected && (
                                <span className="shrink-0 text-[10px] font-black uppercase text-green-700 dark:text-green-400 bg-green-100/50 dark:bg-green-950/60 px-1.5 py-0.5 rounded">
                                  Agregada
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 md:col-span-4">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Monto ($)</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={line.monto === 0 ? "" : line.monto}
                    onChange={(e) => onUpdateLine(line.id, { monto: parseFloat(e.target.value) || 0 })}
                    className="erp-input h-11 bg-background font-black text-emerald-600 text-lg"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-4">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Tipo Transacción</Label>
                  <Select 
                    value={line.tipoTransaccion} 
                    onValueChange={(val) => {
                      const updates: any = { tipoTransaccion: val };
                      if (val === "Nota de Crédito" || val === "Retención") {
                        updates.metodoPago = ""; // Limpiar método de pago si es un ajuste sin flujo directo
                      }
                      onUpdateLine(line.id, updates);
                    }}
                  >
                    <SelectTrigger className="erp-input h-11 bg-background font-bold text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {TIPO_TRANSACCION.map(t => <SelectItem key={t} value={t} className="text-[10px] font-bold uppercase">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 md:col-span-4">
                  <Label className={cn("text-[10px] font-black uppercase tracking-widest ml-1", disablePaymentMethod ? "text-muted-foreground/40" : "text-muted-foreground")}>
                    Método de Pago
                  </Label>
                  <Select 
                    value={line.metodoPago} 
                    onValueChange={(val) => onUpdateLine(line.id, { metodoPago: val })}
                    disabled={disablePaymentMethod}
                  >
                    <SelectTrigger className={cn(
                      "erp-input h-11 bg-background font-bold text-xs", 
                      disablePaymentMethod && "opacity-40 cursor-not-allowed bg-muted/50"
                    )}>
                      <SelectValue placeholder={disablePaymentMethod ? "N/A" : "Seleccione..."} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {METODOS_PAGO.map(m => <SelectItem key={m} value={m} className="text-[10px] font-bold uppercase">{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 md:col-span-4">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Fecha Pago</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-11 erp-input bg-background justify-start text-left font-bold text-xs">
                        <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />
                        {line.fechaTransaccion ? format(line.fechaTransaccion, "dd/MM/yyyy") : "Elegir..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start">
                      <Calendar
                        mode="single"
                        selected={line.fechaTransaccion}
                        onSelect={(date) => onUpdateLine(line.id, { fechaTransaccion: date || new Date() })}
                        disabled={(date) => date > new Date()} // Evitar fechas futuras
                        locale={es}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {line.metodoPago === "Cheque" && !disablePaymentMethod && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-primary/5 rounded-xl border border-primary/10 animate-in zoom-in-95">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-primary">N° Cheque</Label>
                    <Input value={line.numeroCheque} onChange={e => onUpdateLine(line.id, { numeroCheque: e.target.value })} className="h-9 bg-background text-xs font-bold" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-primary">Banco</Label>
                    <Input value={line.banco} onChange={e => onUpdateLine(line.id, { banco: e.target.value })} className="h-9 bg-background text-xs font-bold" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-primary">Girador</Label>
                    <Input value={line.nombreGirador} onChange={e => onUpdateLine(line.id, { nombreGirador: e.target.value })} className="h-9 bg-background text-xs font-bold" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-primary">Fecha Cobro</Label>
                    <Input type="date" value={line.fechaCobro} onChange={e => onUpdateLine(line.id, { fechaCobro: e.target.value })} className="h-9 bg-background text-xs font-bold" />
                  </div>
                </div>
              )}

              <div className="flex gap-4 items-start">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Descripción / Referencia</Label>
                  <Textarea 
                    value={line.descripcion}
                    onChange={(e) => onUpdateLine(line.id, { descripcion: e.target.value })}
                    placeholder={disablePaymentMethod ? "Motivo del ajuste contable..." : "Ej: Transferencia BCP Nro..."}
                    className="erp-input min-h-[60px] bg-background text-xs"
                  />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => onRemoveLine(line.id)}
                  className="h-11 w-11 mt-6 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          );
        })}

        {lines.length === 0 && (
          <div 
            onClick={onAddLine}
            className="h-32 border-2 border-dashed border-border hover:border-primary/45 hover:bg-primary/5 transition-all cursor-pointer rounded-[2rem] flex flex-col items-center justify-center text-muted-foreground/30 hover:text-primary/50 group"
          >
            <Plus className="h-10 w-10 mb-2 transition-transform group-hover:scale-110" />
            <p className="text-xs font-black uppercase tracking-widest">Haga clic aquí para añadir una línea de pago</p>
          </div>
        )}

        {lines.length > 0 && (
          <div className="flex justify-center pt-2">
            <Button 
              onClick={onAddLine}
              variant="outline"
              className="w-full h-12 border-dashed border-2 border-primary/30 text-primary hover:bg-primary/5 font-black text-xs uppercase tracking-widest rounded-2xl gap-2 shadow-sm transition-all hover:scale-[1.01]"
            >
              <Plus className="h-4 w-4" />
              Añadir Otra Línea de Pago
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
