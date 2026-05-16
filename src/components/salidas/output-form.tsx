"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Output, OutputInput, OutputLine } from "@/types/output";
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
import { Save, X, Calculator, Plus, Truck, User } from "lucide-react";
import { LotSelector } from "./lot-selector";
import { OutputLinesEditor } from "./output-lines-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const outputSchema = z.object({
  outputNumber: z.string().min(1, "Número de salida obligatorio"),
  clientId: z.string().min(1, "Seleccione un cliente"),
  outputDate: z.string().min(1, "Fecha obligatoria"),
  responsible: z.string().min(1, "Responsable obligatorio"),
  driver: z.string().min(1, "Chofer/Transporte obligatorio"),
  notes: z.string().optional(),
  status: z.enum(["draft", "active", "completed"]),
});

interface OutputFormProps {
  initialData?: Output;
  onSubmit: (data: OutputInput & { lines: OutputLine[] }) => void;
  onCancel: () => void;
}

export function OutputForm({ initialData, onSubmit, onCancel }: OutputFormProps) {
  const [lines, setLines] = useState<OutputLine[]>(initialData?.lines || []);
  const [isLotSelectorOpen, setIsLotSelectorOpen] = useState(false);
  
  const form = useForm<z.infer<typeof outputSchema>>({
    resolver: zodResolver(outputSchema),
    defaultValues: initialData ? {
      outputNumber: initialData.outputNumber,
      clientId: initialData.clientId,
      outputDate: initialData.outputDate,
      responsible: initialData.responsible,
      driver: initialData.driver,
      notes: initialData.notes || "",
      status: initialData.status,
    } : {
      outputNumber: `SAL-2024-${Math.floor(Math.random() * 900) + 100}`,
      clientId: "",
      outputDate: new Date().toISOString().split('T')[0],
      responsible: "",
      driver: "",
      notes: "",
      status: "draft",
    },
  });

  const totals = lines.reduce((acc, line) => ({
    original: acc.original + line.quantityOriginal,
    dispatched: acc.dispatched + line.quantityDispatched,
    pending: acc.pending + line.quantityPending,
  }), { original: 0, dispatched: 0, pending: 0 });

  const handleAddLot = (lot: any, entryId: string, entryNumber: string, clientName: string) => {
    const newLine: OutputLine = {
      id: Math.random().toString(36).substr(2, 9),
      entryId,
      entryNumber,
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      garmentType: lot.garmentType,
      process: lot.process,
      washType: lot.washType,
      quantityOriginal: lot.quantity,
      quantityDispatched: lot.quantity, // Default to full dispatch
      quantitySamples: 0,
      quantityMissing: 0,
      quantityDamaged: 0,
      quantityPending: 0,
      status: 'dispatched'
    };
    setLines([...lines, newLine]);
    setIsLotSelectorOpen(false);
  };

  const handleFormSubmit = (values: z.infer<typeof outputSchema>) => {
    if (lines.length === 0) {
      alert("Debes agregar al menos una línea de despacho.");
      return;
    }

    const client = mockClients.find(c => c.id === values.clientId);
    
    onSubmit({
      ...values,
      clientName: client?.name || "Desconocido",
      lines,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex flex-col h-full">
        <ScrollArea className="flex-1 px-10 py-8">
          <div className="space-y-12">
            {/* Header / Meta Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                  Ficha Técnica de Despacho
                </h4>
                <Dialog open={isLotSelectorOpen} onOpenChange={setIsLotSelectorOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" size="sm" className="rounded-full bg-accent text-white font-bold px-5">
                      <Plus className="h-4 w-4 mr-2" />
                      Seleccionar Lotes
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] rounded-[2rem]">
                    <DialogHeader>
                      <DialogTitle>Lotes Disponibles</DialogTitle>
                    </DialogHeader>
                    <LotSelector 
                      onSelect={handleAddLot} 
                      selectedLotIds={lines.map(l => l.lotId)} 
                    />
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="outputNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nro. Guía de Salida</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl bg-muted/20 border-none h-11 focus-visible:ring-accent font-bold" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Socio Estratégico</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl bg-muted/20 border-none h-11">
                            <SelectValue placeholder="Cliente" />
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
                  name="outputDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha Despacho</FormLabel>
                      <FormControl>
                        <Input type="date" className="rounded-xl bg-muted/20 border-none h-11" {...field} />
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
                      <FormLabel>Información Transporte / Chofer</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                          <Input placeholder="Nombre y Placa..." className="pl-10 rounded-xl bg-muted/20 border-none h-11" {...field} />
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
                      <FormLabel>Responsable Despacho</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                          <Input placeholder="Personal encargado..." className="pl-10 rounded-xl bg-muted/20 border-none h-11" {...field} />
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado Operativo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl bg-muted/20 border-none h-11">
                            <SelectValue placeholder="Estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          <SelectItem value="draft">Borrador</SelectItem>
                          <SelectItem value="active">Activo / Parcial</SelectItem>
                          <SelectItem value="completed">Cerrado / Despachado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observaciones de Logística</FormLabel>
                      <FormControl>
                        <Input placeholder="Detalles de entrega..." className="rounded-xl bg-muted/20 border-none h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Lines Editor */}
            <OutputLinesEditor lines={lines} onChange={setLines} />
          </div>
        </ScrollArea>

        {/* Footer Summary */}
        <div className="bg-background border-t p-6 px-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Items</span>
              <div className="flex items-center gap-2 font-black text-xl">
                {lines.length}
              </div>
            </div>
            <div className="h-10 w-px bg-muted/40 hidden sm:block" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Despachado</span>
              <div className="flex items-center gap-2 font-black text-3xl text-accent">
                {totals.dispatched}
              </div>
            </div>
            <div className="h-10 w-px bg-muted/40 hidden sm:block" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Pendiente Total</span>
              <div className={`flex items-center gap-2 font-black text-xl ${totals.pending > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {totals.pending}
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <Button type="button" variant="ghost" className="rounded-xl px-6 h-12 font-bold text-muted-foreground flex-1 sm:flex-none" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="rounded-xl px-10 h-12 bg-accent hover:bg-accent/90 text-white shadow-xl shadow-accent/20 font-bold transition-all flex-1 sm:flex-none">
              <Save className="h-4 w-4 mr-2" />
              {initialData ? "Actualizar Salida" : "Confirmar Despacho"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
