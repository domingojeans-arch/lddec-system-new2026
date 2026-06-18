"use client";

import React, { useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ManualWork, ManualWorkInput, ManualWorkTypeId } from "@/types/manual-work";
import { manualWorkTypes } from "@/data/manual-work-types";
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
import { Save, X, Zap, User, Calculator, Layers, Search, Calendar as CalendarIcon } from "lucide-react";
import { LotManualSelector } from "./lot-manual-selector";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const manualWorkSchema = z.object({
  entryId: z.string().min(1, "Lote obligatorio"),
  entryNumber: z.string().min(1),
  lotId: z.string().min(1),
  lotNumber: z.string().min(1),
  clientId: z.string().min(1),
  clientName: z.string().min(1),
  garmentType: z.string().min(1),
  process: z.string().min(1),
  manualWorkType: z.string().min(1, "Tipo de manualidad obligatorio"),
  quantity: z.coerce.number().min(1, "La cantidad debe ser mayor a 0"),
  operatorName: z.string().min(1, "Operario obligatorio"),
  workDate: z.string().min(1, "Fecha obligatoria"),
  unitCost: z.coerce.number().min(0, "El costo no puede ser negativo"),
  notes: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled", "approved", "rejected"]),
});

interface ManualWorkFormProps {
  initialData?: ManualWork;
  onSubmit: (data: ManualWorkInput) => void;
  onCancel: () => void;
}

export function ManualWorkForm({ initialData, onSubmit, onCancel }: ManualWorkFormProps) {
  const [isLotSelectorOpen, setIsLotSelectorOpen] = useState(false);
  
  const form = useForm<z.infer<typeof manualWorkSchema>>({
    resolver: zodResolver(manualWorkSchema),
    defaultValues: initialData ? {
      entryId: initialData.entryId,
      entryNumber: initialData.entryNumber,
      lotId: initialData.lotId,
      lotNumber: initialData.lotNumber,
      clientId: initialData.clientId,
      clientName: initialData.clientName,
      garmentType: initialData.garmentType,
      process: initialData.process,
      manualWorkType: initialData.manualWorkType,
      quantity: initialData.quantity,
      operatorName: initialData.operatorName,
      workDate: initialData.workDate,
      unitCost: initialData.unitCost,
      notes: initialData.notes || "",
      status: initialData.status,
    } : {
      entryId: "",
      entryNumber: "",
      lotId: "",
      lotNumber: "",
      clientId: "",
      clientName: "",
      garmentType: "",
      process: "",
      manualWorkType: "",
      quantity: 0,
      operatorName: "",
      workDate: new Date().toISOString().split('T')[0],
      unitCost: 0,
      notes: "",
      status: "pending",
    },
  });

  const quantity = form.watch("quantity") || 0;
  const unitCost = form.watch("unitCost") || 0;
  const totalCost = quantity * unitCost;
  const lotNumber = form.watch("lotNumber");
  const workDate = form.watch("workDate");
  const workDateObj = workDate ? parseISO(workDate) : undefined;

  const isDisabledDate = (date: Date) => {
    const hoy = dayjs().tz("America/Guayaquil").startOf("day");
    const targetDate = dayjs(date).tz("America/Guayaquil").startOf("day");

    // Fechas futuras a hoy bloqueadas en cualquier escenario
    if (targetDate.isAfter(hoy)) {
      return true;
    }

    const esPrimerDia = hoy.date() === 1;
    const esUltimoDia = hoy.date() === hoy.endOf("month").date();

    if (esPrimerDia || esUltimoDia) {
      // Excepción: permitir mes calendario pasado
      const limitePasado = hoy.startOf("month").subtract(1, "month").startOf("month");
      return targetDate.isBefore(limitePasado);
    } else {
      // Regla estándar: bloquear fechas anteriores al mes actual
      const inicioMesActual = hoy.startOf("month");
      return targetDate.isBefore(inicioMesActual);
    }
  };

  const handleSelectLot = (lot: any, entryId: string, entryNumber: string, clientId: string, clientName: string) => {
    form.setValue("entryId", entryId);
    form.setValue("entryNumber", entryNumber);
    form.setValue("lotId", lot.id);
    form.setValue("lotNumber", lot.lotNumber);
    form.setValue("clientId", clientId);
    form.setValue("clientName", clientName);
    form.setValue("garmentType", lot.garmentType);
    form.setValue("process", lot.process);
    form.setValue("quantity", lot.quantity);
    setIsLotSelectorOpen(false);
  };

  const handleFormSubmit = (values: z.infer<typeof manualWorkSchema>) => {
    onSubmit({
      ...values,
      manualWorkType: values.manualWorkType as ManualWorkTypeId,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex flex-col h-full">
        <ScrollArea className="flex-1 px-10 py-8">
          <div className="space-y-12">
            {/* Lot Selection Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                  Selección de Lote e Insumo
                </h4>
                {!initialData && (
                  <Dialog open={isLotSelectorOpen} onOpenChange={setIsLotSelectorOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        type="button" 
                        size="sm" 
                        className="rounded-full bg-accent text-white font-bold px-6 hover:bg-accent/90 transition-all"
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Buscar Lote
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] rounded-[2.5rem]">
                      <DialogHeader>
                        <DialogTitle>Seleccionar Lote para Manualidad</DialogTitle>
                      </DialogHeader>
                      <LotManualSelector 
                        onSelect={handleSelectLot} 
                        selectedLotId={form.getValues("lotId")} 
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-muted/10 p-4 rounded-2xl border border-muted/20 space-y-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Número de Lote</p>
                  <p className="font-bold text-lg">{lotNumber || "No seleccionado"}</p>
                </div>
                <div className="bg-muted/10 p-4 rounded-2xl border border-muted/20 space-y-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Prenda / Proceso</p>
                  <p className="font-bold">{form.getValues("garmentType") || "-"} • {form.getValues("process") || "-"}</p>
                </div>
                <div className="bg-muted/10 p-4 rounded-2xl border border-muted/20 space-y-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Socio</p>
                  <p className="font-bold truncate">{form.getValues("clientName") || "-"}</p>
                </div>
              </div>
            </div>

            {/* Work Configuration */}
            <div className="space-y-6">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b pb-4">
                Configuración del Trabajo
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="manualWorkType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Manualidad</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl bg-muted/20 border-none h-11">
                            <SelectValue placeholder="Seleccione manualidad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          {manualWorkTypes.map(type => (
                            <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="operatorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Operario</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                          <Input placeholder="Personal asignado" className="pl-10 rounded-xl bg-muted/20 border-none h-11" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad a Procesar</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                          <Input type="number" className="pl-10 rounded-xl bg-muted/20 border-none h-11 font-bold" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unitCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo Unitario ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" className="rounded-xl bg-muted/20 border-none h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="workDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Trabajo</FormLabel>
                      <FormControl>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-11 rounded-xl bg-muted/20 border-none justify-start text-left font-bold text-xs">
                              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground/50" />
                              {workDateObj && isValid(workDateObj) ? format(workDateObj, "dd/MM/yyyy") : "Elegir fecha..."}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start">
                            <Calendar
                              mode="single"
                              selected={workDateObj}
                              onSelect={(d) => field.onChange(d ? format(d, "yyyy-MM-dd") : "")}
                              disabled={isDisabledDate}
                              locale={es}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
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
                      <FormLabel>Estado del Trabajo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl bg-muted/20 border-none h-11">
                            <SelectValue placeholder="Estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          <SelectItem value="pending">Pendiente</SelectItem>
                          <SelectItem value="in_progress">En Proceso</SelectItem>
                          <SelectItem value="completed">Completado</SelectItem>
                          <SelectItem value="cancelled">Cancelado</SelectItem>
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
                      <FormLabel>Notas / Instrucciones</FormLabel>
                      <FormControl>
                        <Input placeholder="Observaciones especiales..." className="rounded-xl bg-muted/20 border-none h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer Summary */}
        <div className="bg-background border-t p-6 px-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Cantidad Total</span>
              <div className="flex items-center gap-2 font-black text-xl">
                {quantity} unds
              </div>
            </div>
            <div className="h-10 w-px bg-muted/40 hidden sm:block" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Costo Total Trabajo</span>
              <div className="flex items-center gap-2 font-black text-3xl text-emerald-600">
                <Calculator className="h-7 w-7" />
                ${totalCost.toFixed(2)}
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
              {initialData ? "Actualizar Trabajo" : "Registrar Manualidad"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
