"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp 
} from "firebase/firestore";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Receipt, Boxes, X, Save, Loader2, Package, Calendar as CalendarIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const groupedInvoiceSchema = z.object({
  numeroFactura: z.string().min(1, "Nro. de factura obligatorio"),
  clientId: z.string().min(1, "Seleccione un cliente"),
  fechaFactura: z.string().min(1, "Fecha obligatoria"),
  subtotal: z.coerce.number().min(0, "Mínimo 0"),
  iva: z.coerce.number().min(0, "Mínimo 0"),
  notes: z.string().optional(),
});

interface GroupedSamplesFormProps {
  clients: any[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function GroupedSamplesForm({ clients, onSubmit, onCancel, isSubmitting = false }: GroupedSamplesFormProps) {
  const [loading, setLoading] = useState(true);
  const [unbilledSamples, setUnbilledSamples] = useState<any[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);

  const form = useForm<z.infer<typeof groupedInvoiceSchema>>({
    resolver: zodResolver(groupedInvoiceSchema),
    defaultValues: {
      numeroFactura: "",
      clientId: "",
      fechaFactura: new Date().toISOString().split('T')[0],
      subtotal: 0,
      iva: 0,
      notes: "",
    },
  });

  const selectedClientId = form.watch("clientId");
  const subtotal = form.watch("subtotal");
  const iva = form.watch("iva");
  const fechaFactura = form.watch("fechaFactura");
  const fechaFacturaObj = fechaFactura ? parseISO(fechaFactura) : undefined;
  
  const total = Number((Number(subtotal || 0) + Number(iva || 0)).toFixed(2));
  const isNotaDeVenta = Number(iva) === 0;

  useEffect(() => {
    async function loadData() {
      if (!db) return;
      setLoading(true);
      try {
        const facturasSnap = await getDocs(collection(db, "facturas"));
        const billedEntryIds = new Set<string>();
        facturasSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.ingresoMaestroId) billedEntryIds.add(data.ingresoMaestroId);
          if (Array.isArray(data.ingresoMaestroIds)) {
            data.ingresoMaestroIds.forEach((id: string) => billedEntryIds.add(id));
          }
        });

        const q = query(collection(db, "entries"), where("isSample", "==", true));
        const entriesSnap = await getDocs(q);
        
        const samples = entriesSnap.docs
          .map(doc => {
            const data = doc.data();
            let dateStr = "S/F";
            const date = data.date || data.entryDate;
            if (date?.toDate) dateStr = date.toDate().toLocaleDateString('es-EC');
            else if (date) dateStr = new Date(date).toLocaleDateString('es-EC');

            return {
              id: doc.id,
              ...data,
              displayDate: dateStr
            };
          })
          .filter(s => {
            const isNotBilled = !billedEntryIds.has(s.id);
            const isNotResolved = s.status !== "resolved"; 
            return isNotBilled && isNotResolved;
          });

        setUnbilledSamples(samples);
      } catch (error) {
        console.error("Error loading grouped billing data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    form.setValue("iva", Number((subtotal * 0.15).toFixed(2)));
  }, [subtotal, form]);

  const filteredSamples = useMemo(() => {
    return unbilledSamples.filter(s => !selectedClientId || s.clientId === selectedClientId);
  }, [unbilledSamples, selectedClientId]);

  const toggleEntry = (id: string) => {
    setSelectedEntryIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleFormSubmit = (values: z.infer<typeof groupedInvoiceSchema>) => {
    if (selectedEntryIds.length === 0) {
      alert("Seleccione al menos una muestra para facturar.");
      return;
    }

    const client = clients.find(c => c.id === values.clientId);
    const lotesAgrupados = unbilledSamples
      .filter(s => selectedEntryIds.includes(s.id))
      .flatMap(s => (s.lotes || s.lots || []).map((l: any) => ({
        loteId: l.lotNumber || l.id || l.loteId,
        garmentType: l.garmentType || (l.garments?.[0]?.garmentType) || "Muestra",
        quantity: Number(l.quantity || l.cantidad || 0),
        processType: l.process || l.proceso || "S/D"
      })));

    const payload = {
      ...values,
      clienteNombre: client?.name || client?.nombre || "Socio sin nombre",
      totalFactura: total,
      saldoPendiente: total,
      estadoCobranza: "Por Cobrar",
      ingresoMaestroIds: selectedEntryIds,
      lotesIncluidos: lotesAgrupados,
      tipoComprobante: isNotaDeVenta ? "Nota de Venta" : "Factura"
    };

    onSubmit(payload);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-card p-8 rounded-[2rem] border border-border shadow-sm space-y-6 flex flex-col h-full min-h-[600px]">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
              <Boxes className="h-4 w-4" /> 1. Agrupar Muestras
            </h4>
            
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Socio Industrial</FormLabel>
                  <Select onValueChange={(val) => { field.onChange(val); setSelectedEntryIds([]); }} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="erp-input h-11">
                        <SelectValue placeholder="Seleccione un cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-2xl shadow-2xl">
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>{(client.name || client.nombre || "").toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-2xl border border-border bg-muted/5 overflow-hidden flex-1 flex flex-col">
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Validando facturación previa...</p>
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent border-border">
                        <TableHead className="w-10 pl-4 py-3"></TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-muted-foreground">Ingreso</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-right pr-4 text-muted-foreground">Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSamples.map((entry) => (
                        <TableRow 
                          key={entry.id} 
                          className="border-border hover:bg-muted/10 cursor-pointer"
                          onClick={() => toggleEntry(entry.id)}
                        >
                          <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox 
                              checked={selectedEntryIds.includes(entry.id)}
                              onCheckedChange={() => toggleEntry(entry.id)}
                              className="border-border data-[state=checked]:bg-primary"
                            />
                          </TableCell>
                          <TableCell className="font-bold text-xs text-foreground">{entry.id}</TableCell>
                          <TableCell className="text-right pr-4 text-[10px] font-medium text-muted-foreground">
                            {entry.displayDate}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredSamples.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="h-32 text-center p-8">
                            <Package className="h-8 w-8 mx-auto mb-2 opacity-10" />
                            <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                              No hay muestras pendientes
                            </p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
          </div>
        </div>

        <div className={cn(
          "lg:col-span-8 bg-card p-10 rounded-[2.5rem] border border-border shadow-sm space-y-10 flex flex-col h-full transition-all duration-500",
          selectedEntryIds.length === 0 && "opacity-60"
        )}>
          <div className="flex items-center justify-between border-b border-border pb-6">
            <div className="space-y-1">
              <h4 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                <Receipt className="h-7 w-7 text-primary" /> 2. Detalles de la Factura
              </h4>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {selectedEntryIds.length > 0 ? `${selectedEntryIds.length} muestras seleccionadas para agrupar.` : "Estado: Seleccione muestras para activar..."}
              </p>
            </div>
            {selectedEntryIds.length > 0 && (
              <Badge className={cn(
                "px-5 py-2 rounded-full font-black uppercase text-[10px] tracking-widest border-none",
                isNotaDeVenta ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"
              )}>
                {isNotaDeVenta ? "Nota de Venta" : "Factura Agrupada"}
              </Badge>
            )}
          </div>

          <div className="space-y-8 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FormField control={form.control} name="numeroFactura" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Número de Factura</FormLabel>
                  <FormControl><Input placeholder="001-001-..." className="erp-input h-12 font-bold" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="fechaFactura" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha Factura</FormLabel>
                  <FormControl>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-12 erp-input bg-background justify-start text-left font-bold text-xs">
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {fechaFacturaObj && isValid(fechaFacturaObj) ? format(fechaFacturaObj, "dd/MM/yyyy") : "Elegir fecha..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start">
                        <Calendar
                          mode="single"
                          selected={fechaFacturaObj}
                          onSelect={(d) => field.onChange(d ? format(d, "yyyy-MM-dd") : "")}
                          locale={es}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="space-y-2">
                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</FormLabel>
                <Input readOnly value={clients.find(c => c.id === selectedClientId)?.name || "---"} className="erp-input h-12 bg-muted/20 font-black uppercase text-xs truncate" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-border">
              <FormField control={form.control} name="subtotal" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Subtotal ($)</FormLabel>
                  <FormControl><Input type="number" step="0.01" className="erp-input h-14 text-lg font-black" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="iva" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">IVA (15%) ($)</FormLabel>
                  <FormControl><Input type="number" step="0.01" className="erp-input h-14 text-lg font-black text-amber-600" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">Total Factura ($)</p>
                <div className="h-14 bg-primary/5 rounded-2xl flex items-center px-6 text-3xl font-black text-primary border-2 border-primary/20 shadow-inner">
                  ${total.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas Adicionales</FormLabel>
                  <FormControl><Textarea placeholder="Observaciones..." className="erp-input h-24 py-4 resize-none text-sm" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-10 mt-auto border-t border-border">
            <Button type="button" variant="ghost" onClick={onCancel} className="h-14 px-10 rounded-2xl font-black uppercase text-[10px] tracking-widest text-muted-foreground hover:bg-muted transition-all">
              <X className="h-4 w-4 mr-2" /> Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={selectedEntryIds.length === 0 || isSubmitting} 
              className="bg-primary hover:bg-primary/90 text-white h-14 px-14 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-30"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-3" />
                  {isNotaDeVenta ? "Crear Nota de Venta" : "Crear Factura"}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}