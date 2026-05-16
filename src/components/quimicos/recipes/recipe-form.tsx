"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ChemicalRecipe, ChemicalRecipeInput, ChemicalRecipeItem } from "@/types/chemical-recipe";
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
import { Save, X, Plus, FlaskConical, Search, Calculator, User, Shirt, Calendar as CalendarIcon } from "lucide-react";
import { LotRecipeSelector } from "./lot-recipe-selector";
import { ChemicalSelector } from "./chemical-selector";
import { RecipeItemsEditor } from "./recipe-items-editor";
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

const recipeSchema = z.object({
  recipeNumber: z.string().min(1, "Nro. receta obligatorio"),
  orderNumber: z.string().min(1, "Nro. orden obligatorio"),
  entryId: z.string().min(1),
  entryNumber: z.string().min(1),
  lotId: z.string().min(1, "Lote obligatorio"),
  lotNumber: z.string().min(1),
  clientId: z.string().min(1),
  clientName: z.string().min(1),
  process: z.string().min(1, "Proceso obligatorio"),
  responsible: z.string().min(1, "Responsable obligatorio"),
  recipeDate: z.string().min(1, "Fecha obligatoria"),
  notes: z.string().optional(),
  status: z.enum(["draft", "prepared", "applied"]),
});

interface RecipeFormProps {
  initialData?: ChemicalRecipe;
  onSubmit: (data: ChemicalRecipeInput & { items: ChemicalRecipeItem[] }) => void;
  onCancel: () => void;
}

export function RecipeForm({ initialData, onSubmit, onCancel }: RecipeFormProps) {
  const [items, setItems] = useState<ChemicalRecipeItem[]>(initialData?.items || []);
  const [isLotSelectorOpen, setIsLotSelectorOpen] = useState(false);
  const [isChemicalSelectorOpen, setIsChemicalSelectorOpen] = useState(false);
  
  const form = useForm<z.infer<typeof recipeSchema>>({
    resolver: zodResolver(recipeSchema),
    defaultValues: initialData ? {
      recipeNumber: initialData.recipeNumber,
      orderNumber: initialData.orderNumber,
      entryId: initialData.entryId,
      entryNumber: initialData.entryNumber,
      lotId: initialData.lotId,
      lotNumber: initialData.lotNumber,
      clientId: initialData.clientId,
      clientName: initialData.clientName,
      process: initialData.process,
      responsible: initialData.responsible,
      recipeDate: initialData.recipeDate,
      notes: initialData.notes || "",
      status: initialData.status,
    } : {
      recipeNumber: `REC-${Math.floor(Math.random() * 900) + 100}`,
      orderNumber: `ORD-${Math.floor(Math.random() * 9000) + 1000}`,
      entryId: "",
      entryNumber: "",
      lotId: "",
      lotNumber: "",
      clientId: "",
      clientName: "",
      process: "",
      responsible: "",
      recipeDate: new Date().toISOString().split('T')[0],
      notes: "",
      status: "draft",
    },
  });

  const totalCost = items.reduce((acc, item) => acc + item.totalCost, 0);
  const recipeDate = form.watch("recipeDate");
  const recipeDateObj = recipeDate ? parseISO(recipeDate) : undefined;

  const handleSelectLot = (lot: any, entryId: string, entryNumber: string, clientId: string, clientName: string) => {
    form.setValue("entryId", entryId);
    form.setValue("entryNumber", entryNumber);
    form.setValue("lotId", lot.id);
    form.setValue("lotNumber", lot.lotNumber);
    form.setValue("clientId", clientId);
    form.setValue("clientName", clientName);
    form.setValue("process", lot.process);
    setIsLotSelectorOpen(false);
  };

  const handleAddChemical = (chemical: any) => {
    const newItem: ChemicalRecipeItem = {
      id: Math.random().toString(36).substr(2, 9),
      chemicalId: chemical.id,
      chemicalName: chemical.chemicalName,
      quantityGrams: 0,
      quantityKg: 0,
      unitCost: chemical.unitCost,
      totalCost: 0,
      stockBeforeKg: chemical.currentStockKg,
      stockAfterKg: chemical.currentStockKg,
      notes: ""
    };
    setItems([...items, newItem]);
    setIsChemicalSelectorOpen(false);
  };

  const handleFormSubmit = (values: z.infer<typeof recipeSchema>) => {
    if (items.length === 0) {
      alert("Debes agregar al menos un insumo químico.");
      return;
    }
    onSubmit({
      ...values,
      items,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex flex-col h-full">
        <ScrollArea className="flex-1 px-10 py-8">
          <div className="space-y-12">
            {/* Context Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                  Selección de Lote Operativo
                </h4>
                {!initialData && (
                  <Dialog open={isLotSelectorOpen} onOpenChange={setIsLotSelectorOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" size="sm" className="rounded-full bg-primary text-white font-bold px-6">
                        <Search className="h-4 w-4 mr-2" />
                        Buscar Lote
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] rounded-[2.5rem]">
                      <DialogHeader>
                        <DialogTitle>Vincular a Lote Industrial</DialogTitle>
                      </DialogHeader>
                      <LotRecipeSelector 
                        onSelect={handleSelectLot} 
                        selectedLotId={form.getValues("lotId")} 
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <FormField
                  control={form.control}
                  name="recipeNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nro. Receta</FormLabel>
                      <FormControl>
                        <Input className="rounded-xl bg-muted/20 border-none h-11 font-bold" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="bg-muted/10 p-4 rounded-2xl border border-muted/20 space-y-1 md:col-span-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Lote / Cliente</p>
                  <p className="font-bold truncate">
                    {form.getValues("lotNumber") ? `${form.getValues("lotNumber")} • ${form.getValues("clientName")}` : "No seleccionado"}
                  </p>
                </div>
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
                          <SelectItem value="prepared">Preparada</SelectItem>
                          <SelectItem value="applied">Aplicada</SelectItem>
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
                  name="process"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proceso Técnico</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Shirt className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                          <Input placeholder="Ej. Stone Wash..." className="pl-10 rounded-xl bg-muted/20 border-none h-11" {...field} />
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
                      <FormLabel>Ing. Responsable</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                          <Input placeholder="Nombre del preparador" className="pl-10 rounded-xl bg-muted/20 border-none h-11" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recipeDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-11 rounded-xl bg-muted/20 border-none justify-start text-left font-bold text-xs">
                              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground/50" />
                              {recipeDateObj && isValid(recipeDateObj) ? format(recipeDateObj, "dd/MM/yyyy") : "Elegir fecha..."}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start">
                            <Calendar
                              mode="single"
                              selected={recipeDateObj}
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

            {/* Items Editor Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                  Dosificación de Insumos
                </h4>
                <Dialog open={isChemicalSelectorOpen} onOpenChange={setIsChemicalSelectorOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" size="sm" className="rounded-full bg-cyan-600 text-white font-bold px-6">
                      <Plus className="h-4 w-4 mr-2" />
                      Añadir Químico
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[650px] rounded-[2.5rem]">
                    <DialogHeader>
                      <DialogTitle>Catálogo de Insumos</DialogTitle>
                    </DialogHeader>
                    <ChemicalSelector 
                      onSelect={handleAddChemical} 
                      selectedChemicalIds={items.map(i => i.chemicalId)} 
                    />
                  </DialogContent>
                </Dialog>
              </div>

              <RecipeItemsEditor items={items} onChange={setItems} />
            </div>
          </div>
        </ScrollArea>

        {/* Footer Summary */}
        <div className="bg-background border-t p-6 px-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Insumos</span>
              <div className="flex items-center gap-2 font-black text-xl">
                {items.length} ítems
              </div>
            </div>
            <div className="h-10 w-px bg-muted/40 hidden sm:block" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Costo Estimado Mezcla</span>
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
            <Button type="submit" className="rounded-xl px-10 h-12 bg-cyan-600 hover:bg-cyan-700 text-white shadow-xl shadow-cyan-600/20 font-bold transition-all flex-1 sm:flex-none">
              <Save className="h-4 w-4 mr-2" />
              {initialData ? "Actualizar Receta" : "Confirmar Fórmula"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
