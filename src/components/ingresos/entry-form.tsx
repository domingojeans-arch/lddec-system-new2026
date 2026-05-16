"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Entry, EntryInput, EntryLot } from "@/types/entry";
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
import { Checkbox } from "@/components/ui/checkbox";
import { LotRowsEditor } from "./lot-rows-editor";
import { Save, X, Calendar, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Combobox } from "@/components/lddec/combobox";

const entrySchema = z.object({
  entryNumber: z.string().min(1, "Número obligatorio"),
  isSample: z.boolean().default(false),
  clientId: z.string().min(1, "Seleccione un cliente"),
  entryDate: z.string().min(1, "Fecha obligatoria"),
  responsible: z.string().min(1, "Responsable obligatorio"),
  notes: z.string().optional(),
  status: z.enum(["draft", "active", "completed"]),
});

interface EntryFormProps {
  initialData?: Entry;
  clients: any[];
  garmentCatalog: string[];
  processCatalog: string[];
  onSubmit: (data: EntryInput & { lots: EntryLot[] }) => void;
  onCancel: () => void;
}

export function EntryForm({ initialData, clients, garmentCatalog, processCatalog, onSubmit, onCancel }: EntryFormProps) {
  const { user } = useAuth();
  const [lots, setLots] = useState<EntryLot[]>(initialData?.lots || []);
  const [localError, setLocalError] = useState<string | null>(null);
  
  const form = useForm<z.infer<typeof entrySchema>>({
    resolver: zodResolver(entrySchema),
    defaultValues: initialData ? {
      entryNumber: initialData.entryNumber || "",
      isSample: !!initialData.isSample,
      clientId: initialData.clientId || "",
      entryDate: initialData.entryDate || new Date().toISOString().split('T')[0],
      responsible: initialData.responsible || "",
      notes: initialData.notes || "",
      status: initialData.status || "active",
    } : {
      entryNumber: "",
      isSample: false,
      clientId: "",
      entryDate: new Date().toISOString().split('T')[0],
      responsible: user?.displayName || "",
      notes: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (!initialData && user?.displayName && !form.getValues("responsible")) {
      form.setValue("responsible", user.displayName);
    }
  }, [user, initialData, form]);

  const isSample = form.watch("isSample");

  const clientOptions = clients.map(c => ({
    label: (c.name || c.nombre || `${c.firstName || ""} ${c.lastName || ""}`).trim().toUpperCase(),
    value: c.id
  }));

  const handleSampleToggle = (checked: boolean) => {
    const currentVal = form.getValues("entryNumber") || "";
    const onlyNums = currentVal.replace(/[^0-9]/g, '');
    
    if (checked) {
      form.setValue("entryNumber", `MUEST-${onlyNums}`);
    } else {
      form.setValue("entryNumber", onlyNums);
    }
    form.setValue("isSample", checked);
  };

  const handleEntryNumberChange = (value: string) => {
    const safeVal = value || "";
    if (isSample) {
      const onlyNums = safeVal.replace(/[^0-9]/g, '');
      form.setValue("entryNumber", `MUEST-${onlyNums}`);
    } else {
      form.setValue("entryNumber", safeVal);
    }
  };

  const handleFormSubmit = (values: z.infer<typeof entrySchema>) => {
    setLocalError(null);

    if (lots.length === 0) {
      setLocalError("Debes agregar al menos un lote.");
      return;
    }

    for (const lot of lots) {
      if (!lot.lotNumber) {
        setLocalError(`El Lote #${lots.indexOf(lot) + 1} no tiene número.`);
        return;
      }
      if (lot.garments.length === 0) {
        setLocalError(`El Lote ${lot.lotNumber} debe tener prendas.`);
        return;
      }
    }

    const client = clients.find(c => c.id === values.clientId);
    onSubmit({
      ...values,
      clientName: client?.name || client?.nombre || "Desconocido",
      lots,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-10">
        {localError && (
          <Alert variant="destructive" className="bg-destructive/10 border-none text-destructive rounded-[20px]">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error de Validación</AlertTitle>
            <AlertDescription>{localError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary border-b border-border pb-2">Campos Iniciales</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="entryNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Nº Ingreso Maestro</FormLabel>
                  <FormControl>
                    <div className="relative group">
                      {isSample && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                          <span className="text-xs font-black text-primary/60 uppercase tracking-tighter">MUEST-</span>
                        </div>
                      )}
                      <Input 
                        placeholder={isSample ? "Número" : "Ej: 4773"}
                        value={isSample ? (field.value || "").replace('MUEST-', '') : (field.value || "")}
                        onChange={(e) => handleEntryNumberChange(e.target.value)}
                        className={cn(
                          "erp-input h-11 font-bold transition-all",
                          isSample ? "pl-16 text-primary" : ""
                        )} 
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isSample"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-8">
                  <FormControl>
                    <Checkbox
                      checked={Boolean(field.value)}
                      onCheckedChange={(checked) => handleSampleToggle(!!checked)}
                      className="h-5 w-5 border-muted-foreground/30 data-[state=checked]:bg-primary rounded-md"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-bold text-foreground cursor-pointer">
                      Es Muestra Técnica
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="entryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Fecha de Ingreso</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="date" className="pl-10 erp-input h-11" value={field.value || ""} onChange={field.onChange} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-2">Cliente / Socio</FormLabel>
                  <FormControl>
                    <Combobox
                      options={clientOptions}
                      value={field.value || ""}
                      onSelect={field.onChange}
                      placeholder="Seleccione un cliente"
                      searchPlaceholder="Escriba para filtrar..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="responsible"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Responsable Recepción</FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10 erp-input h-11" placeholder="Nombre completo" value={field.value || ""} onChange={field.onChange} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-6 pt-4">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary border-b border-border pb-2">Lotes del Ingreso</h4>
          <LotRowsEditor 
            lots={lots} 
            onChange={setLots} 
            garmentCatalog={garmentCatalog} 
            processCatalog={processCatalog} 
          />
        </div>

        <div className="pt-10 mt-10 border-t border-border flex items-center justify-between gap-4">
          <Button 
            type="button" 
            variant="outline" 
            className="flex-1 bg-background border-border text-muted-foreground hover:text-foreground font-bold h-12 rounded-2xl transition-all"
            onClick={onCancel}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            type="submit" 
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl shadow-lg shadow-primary/20 transition-all gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Guardar Ingreso
          </Button>
        </div>
      </form>
    </Form>
  );
}
