"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Chemical, ChemicalInput } from "@/types/chemical";
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
import { Save, X, Scale, DollarSign, Package, Building2, Calendar as CalendarIcon } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const chemicalSchema = z.object({
  chemicalName: z.string().min(1, "Nombre del químico obligatorio"),
  supplier: z.string().min(1, "Proveedor obligatorio"),
  invoiceNumber: z.string().min(1, "Nro. factura obligatorio"),
  purchaseDate: z.string().min(1, "Fecha obligatoria"),
  nominalWeight: z.coerce.number().min(0.1, "Peso nominal debe ser mayor a 0"),
  containerWeight: z.coerce.number().min(0, "Peso recipiente no puede ser negativo"),
  grossWeight: z.coerce.number().min(0.1, "Peso bruto debe ser mayor a 0"),
  unitCost: z.coerce.number().min(0, "Costo no puede ser negativo"),
  status: z.enum(["active", "low_stock", "empty"]),
  notes: z.string().optional(),
});

interface ChemicalFormProps {
  initialData?: Chemical;
  onSubmit: (data: ChemicalInput) => void;
  onCancel: () => void;
}

export function ChemicalForm({ initialData, onSubmit, onCancel }: ChemicalFormProps) {
  const form = useForm<z.infer<typeof chemicalSchema>>({
    resolver: zodResolver(chemicalSchema),
    defaultValues: initialData ? {
      chemicalName: initialData.chemicalName,
      supplier: initialData.supplier,
      invoiceNumber: initialData.invoiceNumber,
      purchaseDate: initialData.purchaseDate,
      nominalWeight: initialData.nominalWeight,
      containerWeight: initialData.containerWeight,
      grossWeight: initialData.grossWeight,
      unitCost: initialData.unitCost,
      status: initialData.status,
      notes: initialData.notes || "",
    } : {
      chemicalName: "",
      supplier: "",
      invoiceNumber: "",
      purchaseDate: new Date().toISOString().split('T')[0],
      nominalWeight: 0,
      containerWeight: 0,
      grossWeight: 0,
      unitCost: 0,
      status: "active",
      notes: "",
    },
  });

  const grossWeight = form.watch("grossWeight") || 0;
  const containerWeight = form.watch("containerWeight") || 0;
  const unitCost = form.watch("unitCost") || 0;
  const netWeight = Math.max(0, grossWeight - containerWeight);
  const totalCost = netWeight * unitCost;

  const purchaseDate = form.watch("purchaseDate");
  const purchaseDateObj = purchaseDate ? parseISO(purchaseDate) : undefined;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Main Info */}
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b pb-2">Identificación del Producto</h4>
            <FormField
              control={form.control}
              name="chemicalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Químico</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                      <Input placeholder="Ej. Permanganato de Potasio" className="pl-10 rounded-xl bg-muted/20 border-none h-11 focus-visible:ring-indigo-600" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                      <Input placeholder="Nombre de la empresa" className="pl-10 rounded-xl bg-muted/20 border-none h-11 focus-visible:ring-indigo-600" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nro. Factura</FormLabel>
                    <FormControl>
                      <Input placeholder="F001-..." className="rounded-xl bg-muted/20 border-none h-11 focus-visible:ring-indigo-600" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Compra</FormLabel>
                    <FormControl>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-11 rounded-xl bg-muted/20 border-none justify-start text-left font-bold text-xs">
                            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground/50" />
                            {purchaseDateObj && isValid(purchaseDateObj) ? format(purchaseDateObj, "dd/MM/yyyy") : "Elegir fecha..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start">
                          <Calendar
                            mode="single"
                            selected={purchaseDateObj}
                            onSelect={(d) => field.onChange(d ? format(d, "yyyy-MM-dd") : "")}
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
          </div>

          {/* Weights & Costs */}
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b pb-2">Pesos y Valorización</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nominalWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peso Nominal (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" className="rounded-xl bg-muted/20 border-none h-11 focus-visible:ring-indigo-600" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="containerWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peso Recipiente (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" className="rounded-xl bg-muted/20 border-none h-11 focus-visible:ring-indigo-600" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="grossWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peso Bruto Real (kg)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                        <Input type="number" step="0.01" className="pl-10 rounded-xl bg-muted/20 border-none h-11 focus-visible:ring-indigo-600 font-bold" {...field} />
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
                    <FormLabel>Costo x Kg ($)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                        <Input type="number" step="0.01" className="pl-10 rounded-xl bg-muted/20 border-none h-11 focus-visible:ring-indigo-600 font-bold" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="bg-indigo-600/5 p-4 rounded-2xl border border-indigo-600/10 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Peso Neto Real</p>
                <p className="text-2xl font-black text-indigo-600">{netWeight.toFixed(2)} kg</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Valor Total Ingreso</p>
                <p className="text-2xl font-black text-indigo-600">${totalCost.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-8">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado del Insumo</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="rounded-xl bg-muted/20 border-none h-11">
                      <SelectValue placeholder="Seleccione un estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="active" className="rounded-lg">Activo (En Uso)</SelectItem>
                    <SelectItem value="low_stock" className="rounded-lg">Bajo Stock</SelectItem>
                    <SelectItem value="empty" className="rounded-lg">Agotado</SelectItem>
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
                <FormLabel>Observaciones Técnicas</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Detalles sobre almacenamiento o precauciones..." 
                    className="min-h-[44px] h-11 py-2 rounded-xl bg-muted/20 border-none focus-visible:ring-indigo-600 resize-none"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" className="rounded-xl px-8 h-12 font-bold text-muted-foreground" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button type="submit" className="rounded-xl px-10 h-12 bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 text-white font-bold transition-all transform active:scale-95">
            <Save className="h-4 w-4 mr-2" />
            {initialData ? "Actualizar Insumo" : "Registrar Ingreso"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
