"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Collection, CollectionInput, CollectionItem } from "@/types/collection";
import { mockClients } from "@/data/mock-clients";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, X, Plus, Wallet, CreditCard, User, Truck } from "lucide-react";
import { InvoiceSelector } from "./invoice-selector";
import { CollectionItemsEditor } from "./collection-items-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const collectionSchema = z.object({
  collectionNumber: z.string().min(1, "Número obligatorio"),
  clientId: z.string().min(1, "Seleccione un cliente"),
  collectionDate: z.string().min(1, "Fecha obligatoria"),
  responsible: z.string().min(1, "Responsable obligatorio"),
  driver: z.string().min(1, "Chofer/Transporte obligatorio"),
  paymentMethod: z.string().min(1, "Método de pago obligatorio"),
  notes: z.string().optional(),
  status: z.enum(["draft", "applied", "partial", "completed"]),
});

interface CollectionFormProps {
  initialData?: Collection;
  onSubmit: (data: CollectionInput & { items: CollectionItem[] }) => void;
  onCancel: () => void;
}

export function CollectionForm({ initialData, onSubmit, onCancel }: CollectionFormProps) {
  const [items, setItems] = useState<CollectionItem[]>(initialData?.items || []);
  const [isInvoiceSelectorOpen, setIsInvoiceSelectorOpen] = useState(false);
  
  const form = useForm<z.infer<typeof collectionSchema>>({
    resolver: zodResolver(collectionSchema),
    defaultValues: initialData ? {
      collectionNumber: initialData.collectionNumber,
      clientId: initialData.clientId,
      collectionDate: initialData.collectionDate,
      responsible: initialData.responsible,
      driver: initialData.driver,
      paymentMethod: initialData.paymentMethod,
      notes: initialData.notes || "",
      status: initialData.status,
    } : {
      collectionNumber: `REC-2024-${Math.floor(Math.random() * 900) + 100}`,
      clientId: "",
      collectionDate: new Date().toISOString().split('T')[0],
      responsible: "",
      driver: "",
      paymentMethod: "Transferencia Bancaria",
      notes: "",
      status: "draft",
    },
  });

  const selectedClientId = form.watch("clientId");

  // Global calculations
  const totals = items.reduce((acc, item) => ({
    received: acc.received + (Number(item.amountReceived) || 0),
    discount: acc.discount + (Number(item.discount) || 0),
    promptPayment: acc.promptPayment + (Number(item.promptPaymentDiscount) || 0),
    retention: acc.retention + (Number(item.retention) || 0),
    damaged: acc.damaged + (Number(item.damagedDiscount) || 0),
    applied: acc.applied + item.totalApplied,
    remaining: acc.remaining + item.remainingBalance
  }), { received: 0, discount: 0, promptPayment: 0, retention: 0, damaged: 0, applied: 0, remaining: 0 });

  const handleAddInvoice = (invoice: any) => {
    const newItem: CollectionItem = {
      id: Math.random().toString(36).substr(2, 9),
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      invoiceTotal: invoice.total,
      previousBalance: invoice.balancePending,
      amountReceived: invoice.balancePending, // Default to pay all
      discount: 0,
      promptPaymentDiscount: 0,
      retention: 0,
      damagedDiscount: 0,
      totalApplied: invoice.balancePending,
      remainingBalance: 0,
      status: 'settled'
    };
    setItems([...items, newItem]);
    setIsInvoiceSelectorOpen(false);
  };

  const handleFormSubmit = (values: z.infer<typeof collectionSchema>) => {
    if (items.length === 0) {
      alert("Debes agregar al menos una factura para cobrar.");
      return;
    }

    const client = mockClients.find(c => c.id === values.clientId);
    
    onSubmit({
      ...values,
      clientName: client?.name || "Desconocido",
      items,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex flex-col h-full">
        <ScrollArea className="flex-1 px-10 py-8">
          <div className="space-y-12">
            {/* Header Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                  Ficha de Recaudación / Cobro
                </h4>
                <Dialog open={isInvoiceSelectorOpen} onOpenChange={setIsInvoiceSelectorOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      type="button" 
                      size="sm" 
                      className="rounded-full bg-amber-500 text-white font-bold px-6 hover:bg-amber-600 transition-all"
                      disabled={!selectedClientId}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Cargar Facturas
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[700px] rounded-[2.5rem]">
                    <DialogHeader>
                      <DialogTitle>Seleccionar Documentos Pendientes</DialogTitle>
                    </DialogHeader>
                    <InvoiceSelector 
                      clientId={selectedClientId}
                      onSelect={handleAddInvoice} 
                      selectedInvoiceIds={items.map(i => i.invoiceId)} 
                    />
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <FormField
                  control={form.control}
                  name="collectionNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nro. Cobro</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl bg-muted/20 border-none h-11 font-bold" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Socio Industrial</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl bg-muted/20 border-none h-11">
                            <SelectValue placeholder="Seleccione un cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          {mockClients.map(client => (
                            <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl bg-muted/20 border-none h-11">
                            <SelectValue placeholder="Estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          <SelectItem value="draft">Borrador</SelectItem>
                          <SelectItem value="applied">Aplicada</SelectItem>
                          <SelectItem value="partial">Parcial</SelectItem>
                          <SelectItem value="completed">Completada</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="collectionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha Operación</FormLabel>
                      <FormControl>
                        <Input type="date" className="rounded-xl bg-muted/20 border-none h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de Pago</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                          <Input placeholder="Ej. Depósito BCP" className="pl-10 rounded-xl bg-muted/20 border-none h-11" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="responsible"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsable Caja</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                          <Input placeholder="Personal de tesorería" className="pl-10 rounded-xl bg-muted/20 border-none h-11" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="driver"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mensajería / Chofer (Opcional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                          <Input placeholder="Quién entregó el pago" className="pl-10 rounded-xl bg-muted/20 border-none h-11" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas Adicionales</FormLabel>
                      <FormControl>
                        <Input placeholder="Cualquier aclaración relevante..." className="rounded-xl bg-muted/20 border-none h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Items Editor */}
            <CollectionItemsEditor items={items} onChange={setItems} />
          </div>
        </ScrollArea>

        {/* Financial Footer */}
        <div className="bg-background border-t p-6 px-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Efectivo Recib.</span>
              <span className="text-sm font-bold">${totals.received.toFixed(2)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Dctos/Ret</span>
              <span className="text-sm font-bold text-amber-600">-${(totals.discount + totals.promptPayment + totals.retention + totals.damaged).toFixed(2)}</span>
            </div>
            <div className="h-10 w-px bg-muted/40 hidden sm:block" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Aplicado</span>
              <div className="flex items-center gap-2 font-black text-3xl text-emerald-600">
                <Wallet className="h-7 w-7" />
                ${totals.applied.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <Button type="button" variant="ghost" className="rounded-xl px-6 h-12 font-bold text-muted-foreground flex-1 sm:flex-none" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="rounded-xl px-10 h-12 bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/20 font-bold transition-all flex-1 sm:flex-none">
              <Save className="h-4 w-4 mr-2" />
              {initialData ? "Actualizar Cobro" : "Registrar Recaudación"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
