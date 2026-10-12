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
import { Save, X, Calendar, User, AlertCircle, CheckCircle2, ClipboardCheck, Layers, Shirt } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
  const [lots, setLots] = useState<EntryLot[]>(() => {
    if (initialData?.lots && initialData.lots.length > 0) return initialData.lots;
    return [{
      id: Math.random().toString(36).substr(2, 9),
      lotNumber: "",
      responsible: initialData?.responsible || user?.displayName || "",
      process: "",
      washType: "",
      notes: "",
      isSample: false,
      status: "pending",
      garments: [{ id: Math.random().toString(36).substr(2, 9), garmentType: "", quantity: 0 }],
    }];
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<(EntryInput & { lots: EntryLot[] }) | null>(null);
  
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
    if (!initialData && user?.displayName) {
      if (!form.getValues("responsible")) {
        form.setValue("responsible", user.displayName);
      }
      setLots(prev => prev.map(l => (!l.responsible ? { ...l, responsible: user.displayName || "" } : l)));
    }
  }, [user, initialData, form]);

  const isSample = form.watch("isSample");

  const clientOptions = React.useMemo(() => {
    const opts = (clients || []).map(c => ({
      label: (c?.name || c?.nombre || `${c?.firstName || ""} ${c?.lastName || ""}`).trim().toUpperCase(),
      value: c?.id || ""
    }));
    if (initialData && initialData.clientId && !opts.some(o => o.value === initialData.clientId)) {
      opts.push({
        label: (initialData.clientName || "Socio").trim().toUpperCase(),
        value: initialData.clientId
      });
    }
    return opts;
  }, [clients, initialData]);

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

    for (const lot of lots || []) {
      if (!lot?.lotNumber) {
        setLocalError(`El Lote #${(lots || []).indexOf(lot) + 1} no tiene número.`);
        return;
      }
      if (!lot?.garments || lot.garments.length === 0) {
        setLocalError(`El Lote ${lot.lotNumber} debe tener prendas.`);
        return;
      }
      const totalLotGarments = (lot.garments || []).reduce((sum, g) => sum + (Number(g.quantity) || 0), 0);
      if (totalLotGarments <= 0) {
        setLocalError(`El Lote ${lot.lotNumber} debe tener una cantidad de prendas mayor a 0.`);
        return;
      }
    }

    const client = clients.find(c => c.id === values.clientId);
    setPendingSubmitData({
      ...values,
      clientName: client?.name || client?.nombre || initialData?.clientName || "Desconocido",
      lots,
    });
    setIsConfirmOpen(true);
  };

  const handleConfirmSave = () => {
    if (!pendingSubmitData) return;
    setIsConfirmOpen(false);
    onSubmit(pendingSubmitData);
  };

  const totalSummaryGarments = (pendingSubmitData?.lots || []).reduce(
    (acc, lot) => acc + (lot.garments || []).reduce((gSum, g) => gSum + (Number(g.quantity) || 0), 0),
    0
  );

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

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-4">
              <FormField
                control={form.control}
                name="entryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Fecha de Ingreso</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="date" className="pl-10 erp-input h-11 text-xs" value={field.value || ""} onChange={field.onChange} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="md:col-span-8">
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

        {/* Ventana de Resumen antes de Guardar */}
        <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <DialogContent className="max-w-md sm:max-w-lg p-6 rounded-[28px] border border-border shadow-2xl">
            <DialogHeader className="space-y-1 pb-2 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="bg-primary/10 p-2 rounded-xl">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black uppercase tracking-tight">
                    Resumen del Ingreso
                  </DialogTitle>
                  <DialogDescription className="text-xs font-medium text-muted-foreground">
                    Verifica los datos antes de guardar el ingreso
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {pendingSubmitData && (
              <div className="space-y-4 py-2">
                {/* Datos principales: Cliente y N° de Ingreso */}
                <div className="bg-muted/30 rounded-2xl p-4 border border-border/60 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Cliente / Socio
                      </p>
                      <p className="text-sm font-black text-foreground uppercase mt-0.5">
                        {pendingSubmitData.clientName}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        N° de Ingreso
                      </p>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <span className="text-base font-black text-primary">
                          #{pendingSubmitData.entryNumber}
                        </span>
                        {pendingSubmitData.isSample && (
                          <Badge className="bg-primary/15 text-primary border-none text-[9px] font-black uppercase px-2 py-0">
                            Muestra
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">Fecha</span>
                      <span className="font-bold text-foreground">{pendingSubmitData.entryDate}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">Responsable</span>
                      <span className="font-bold text-foreground uppercase">{pendingSubmitData.responsible}</span>
                    </div>
                  </div>
                </div>

                {/* Tabla de Lotes, Tipo de Prenda y Cantidad */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" /> Detalle de Lotes ({pendingSubmitData.lots.length})
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <Shirt className="h-3.5 w-3.5 text-emerald-600" /> Total: {totalSummaryGarments} prendas
                    </span>
                  </div>

                  <div className="max-h-[240px] overflow-y-auto rounded-2xl border border-border bg-card">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60 sticky top-0 border-b border-border">
                        <tr>
                          <th className="py-2.5 pl-4 text-left text-[10px] font-black uppercase text-muted-foreground">N° Lote</th>
                          <th className="py-2.5 px-2 text-left text-[10px] font-black uppercase text-muted-foreground">Tipo de Prenda</th>
                          <th className="py-2.5 pr-4 text-right text-[10px] font-black uppercase text-muted-foreground">Cantidad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {pendingSubmitData.lots.map((lot) =>
                          (lot.garments || []).map((g, gIdx) => (
                            <tr key={`${lot.id}-${g.id || gIdx}`} className="hover:bg-muted/20">
                              <td className="py-2.5 pl-4 font-black text-foreground">
                                {lot.lotNumber}
                              </td>
                              <td className="py-2.5 px-2 font-semibold text-foreground uppercase">
                                {g.garmentType || <span className="text-amber-600 italic">Sin especificar</span>}
                              </td>
                              <td className="py-2.5 pr-4 text-right font-black text-primary">
                                {Number(g.quantity) || 0}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="bg-muted/40 border-t border-border">
                        <tr>
                          <td colSpan={2} className="py-2.5 pl-4 text-[10px] font-black uppercase text-foreground">
                            Total Prendas a Ingresar
                          </td>
                          <td className="py-2.5 pr-4 text-right text-sm font-black text-emerald-600">
                            {totalSummaryGarments}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-row gap-3 pt-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 h-11 rounded-xl font-bold text-xs"
              >
                <X className="h-4 w-4 mr-1.5" />
                Corregir
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSave}
                className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-primary/20 gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </form>
    </Form>
  );
}
