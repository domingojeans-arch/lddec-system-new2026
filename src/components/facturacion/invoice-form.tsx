"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, limit } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Receipt, AlertCircle, Layers, Loader2, X, Save, Package, ShieldAlert, CheckCircle2, Calendar as CalendarIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const invoiceSchema = z.object({
  numeroFactura: z.string().min(1, "Nro. de factura obligatorio"),
  fechaFactura: z.string().min(1, "Fecha obligatoria"),
  clientId: z.string().min(1, "Seleccione un cliente"),
  numeroSalida: z.string().optional(),
  ingresoMaestroId: z.string().min(1, "Nro. de ingreso obligatorio"),
  subtotal: z.coerce.number().min(0, "Mínimo 0"),
  iva: z.coerce.number().min(0, "Mínimo 0"),
  notes: z.string().optional(),
});

function getVisibleLotName(lote: any): string {
  if (!lote) return "LOTE SIN NÚMERO";
  const candidates = [
    lote.lotNumber,
    lote.numeroLote,
    lote.entryLotNumber,
    lote.lote
  ];

  for (const val of candidates) {
    if (val && String(val).trim() && String(val).length < 18) {
      return String(val).trim().toUpperCase();
    }
  }
  return lote.id && String(lote.id).length < 18 ? String(lote.id).toUpperCase() : "LOTE SIN NÚMERO";
}

function getDispatchedQtyFromOutputItem(item: any): number {
  if (Array.isArray(item.prendas) && item.prendas.length > 0) {
    return item.prendas.reduce((acc: number, p: any) => acc + (Number(p.quantityToDispatch || p.quantity || 0)), 0);
  }
  return Number(item.quantityToDispatch ?? item.originalEntryQuantity ?? item.availableToDispatch ?? 0);
}

export function InvoiceForm({ 
  clients, 
  onSubmit, 
  onCancel, 
  initialData 
}: { 
  clients: any[], 
  onSubmit: (data: any) => void, 
  onCancel: () => void,
  initialData?: any
}) {
  const { toast } = useToast();
  const [searchEntry, setSearchEntry] = useState(initialData?.ingresoMaestroId || "");
  const [loading, setLoading] = useState(false);
  const [foundEntry, setFoundEntry] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const form = useForm<z.infer<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: initialData ? { 
      numeroFactura: initialData.numeroFactura || "", 
      fechaFactura: initialData.fechaFactura?.toDate ? initialData.fechaFactura.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      clientId: initialData.clientId || "", 
      numeroSalida: initialData.numeroSalida || "",
      ingresoMaestroId: initialData.ingresoMaestroId || "", 
      subtotal: initialData.subtotal || 0, 
      iva: initialData.iva || 0,
      notes: initialData.notes || "" 
    } : { 
      numeroFactura: "", 
      fechaFactura: new Date().toISOString().split('T')[0],
      clientId: "", 
      numeroSalida: "",
      ingresoMaestroId: "", 
      subtotal: 0, 
      iva: 0,
      notes: "" 
    },
  });

  useEffect(() => {
    if (!initialData) {
      form.reset({
        numeroFactura: "",
        fechaFactura: new Date().toISOString().split('T')[0],
        clientId: "",
        numeroSalida: "",
        ingresoMaestroId: "",
        subtotal: 0,
        iva: 0,
        notes: ""
      });
      setFoundEntry(null);
      setSearchEntry("");
      setValidationError(null);
    }
  }, [initialData, form]);

  const subtotal = form.watch("subtotal");
  const iva = form.watch("iva");
  const fechaFactura = form.watch("fechaFactura");
  const fechaFacturaObj = fechaFactura ? parseISO(fechaFactura) : undefined;
  
  const total = Number((Number(subtotal || 0) + Number(iva || 0)).toFixed(2));
  const isNotaDeVenta = Number(iva || 0) === 0;

  const handleSearchEntry = async (isManualAction = false) => {
    const rawTerm = searchEntry.trim();
    if (!rawTerm) return;

    setLoading(true);
    setValidationError(null);
    setFoundEntry(null);

    try {
      let entryDoc: any = null;
      let entryData: any = null;

      const qVariants = [
        query(collection(db, "entries"), where("entryNumber", "==", rawTerm.toUpperCase()), limit(1)),
        query(collection(db, "entries"), where("numeroIngreso", "==", rawTerm.toUpperCase()), limit(1))
      ];

      for (const q of qVariants) {
        const snap = await getDocs(q);
        if (!snap.empty) {
          entryDoc = snap.docs[0];
          entryData = entryDoc.data();
          break;
        }
      }

      if (!entryDoc) {
        const entryRef = doc(db, "entries", rawTerm.toUpperCase());
        const entrySnap = await getDoc(entryRef);
        if (entrySnap.exists()) {
          entryDoc = entrySnap;
          entryData = entrySnap.data();
        }
      }

      if (!entryDoc) {
        if (isManualAction) toast({ variant: "destructive", title: "No encontrado", description: `El ingreso ${rawTerm} no existe.` });
        setLoading(false);
        return;
      }

      const entryId = entryDoc.id;
      const entryNumberVisible = entryData.entryNumber || entryId;

      const qFacturas = collection(db, "facturas");
      const facturasSnap = await getDocs(qFacturas);
      
      const existingInvoice = facturasSnap.docs.find(d => {
        const dData = d.data();
        const refId = String(dData.ingresoMaestroId || "").toUpperCase();
        const refs = Array.isArray(dData.ingresoMaestroIds) ? dData.ingresoMaestroIds.map(id => String(id).toUpperCase()) : [];
        return refId === String(entryId).toUpperCase() || refId === entryNumberVisible.toUpperCase() || 
               refs.includes(String(entryId).toUpperCase()) || refs.includes(entryNumberVisible.toUpperCase());
      });

      if (existingInvoice && !initialData) {
        const invNum = existingInvoice.data().numeroFactura || existingInvoice.id;
        setValidationError(`BLOQUEO DE SEGURIDAD: El ingreso ${entryNumberVisible} ya fue facturado en el documento Nº ${invNum}. No se permite duplicar la facturación.`);
        if (isManualAction) {
          toast({ 
            variant: "destructive", 
            title: "Ingreso ya facturado", 
            description: `Este ingreso ya está vinculado a la factura ${invNum}.` 
          });
        }
        setLoading(false);
        return;
      }

      const qOuts = await getDocs(collection(db, "outputs"));
      const allOutputs = qOuts.docs.map(d => d.data());
      
      const rawLots = entryData.lotes || entryData.lots || [];
      let totalIngresado = 0;
      let totalDespachadoReal = 0;
      const lotSummary: any[] = [];

      rawLots.forEach((lot: any) => {
        const lid = getVisibleLotName(lot);
        const original = Number(lot.cantidadConfirmada || lot.quantity || lot.cantidad || 0);
        totalIngresado += original;

        let dispatched = 0;
        allOutputs.forEach(output => {
          const items = Array.isArray(output.itemsDispatched) ? output.itemsDispatched : [];
          items.forEach((item: any) => {
            const parentRef = String(item.parentIngresoMaestro || item.parentIngreso || "").toUpperCase();
            if ((parentRef === String(entryId).toUpperCase() || parentRef === String(entryNumberVisible).toUpperCase()) && getVisibleLotName(item) === lid) {
              dispatched += getDispatchedQtyFromOutputItem(item);
            }
          });
        });

        totalDespachadoReal += dispatched;
        lotSummary.push({
          lid,
          original,
          dispatched,
          missing: Math.max(0, original - dispatched),
          garment: lot.garmentType || lot.prendas?.[0]?.tipo || "Varios"
        });
      });

      const faltanteTotal = totalIngresado - totalDespachadoReal;
      const loteSinNingunDespacho = lotSummary.find(l => l.dispatched === 0 && l.original > 0);

      let blockReason = null;
      if (loteSinNingunDespacho) {
        blockReason = `BLOQUEO OPERATIVO: El lote ${loteSinNingunDespacho.lid} (${loteSinNingunDespacho.original} prendas) no registra ningún despacho físico.`;
      } else if (faltanteTotal > 5) {
        blockReason = `BLOQUEO OPERATIVO: Saldo pendiente total (${faltanteTotal} prendas) supera el límite de tolerancia de 5 prendas para facturar.`;
      }

      const entryDetails = {
        ...entryData,
        id: entryId,
        visibleNumber: entryNumberVisible,
        totalIngresado,
        totalDispatched: totalDespachadoReal,
        faltanteTotal,
        lotsInvoiced: lotSummary,
        canInvoice: !blockReason
      };

      setFoundEntry(entryDetails);

      if (blockReason) {
        setValidationError(blockReason);
        if (isManualAction) {
          toast({ 
            variant: "destructive", 
            title: "Despachos Incompletos", 
            description: "Aún faltan lotes por despachar o el saldo pendiente es mayor a 5 prendas." 
          });
        }
      } else if (isManualAction) {
        form.setValue("ingresoMaestroId", entryNumberVisible);
        if (entryData.clientId) {
          form.setValue("clientId", entryData.clientId);
        }
      }

    } catch (error) {
      console.error("Error en validación de facturación:", error);
      toast({ variant: "destructive", title: "Error de Sistema", description: "No se pudo completar la validación de integridad." });
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = (values: z.infer<typeof invoiceSchema>) => {
    if (foundEntry && !foundEntry.canInvoice) {
      toast({ variant: "destructive", title: "Acción Denegada", description: "No puede guardar una factura para un ingreso con bloqueos operativos." });
      return;
    }

    const client = clients.find(c => c.id === values.clientId);
    onSubmit({
      ...values,
      clienteNombre: client?.name || client?.nombre || foundEntry?.clientName || initialData?.clienteNombre,
      totalFactura: total,
      tipoComprobante: isNotaDeVenta ? "Nota de Venta" : "Factura",
      lotesIncluidos: foundEntry ? foundEntry.lotsInvoiced.map((l: any) => l.lid) : (initialData?.lotesIncluidos || [])
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFinalSubmit)} autoComplete="off" className={cn("grid grid-cols-1 gap-8 items-start", !initialData && "lg:grid-cols-12")}>
        <div className={cn("space-y-6", !initialData ? "lg:col-span-4" : "")}>
          <div className="bg-card p-8 rounded-[2rem] border border-border shadow-sm space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
              <Search className="h-4 w-4" /> 1. Asociar Ingreso
            </h4>
            <div className="flex gap-2">
              <Input 
                placeholder="ID Ingreso" 
                value={searchEntry} 
                onChange={e => setSearchEntry(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearchEntry(true))}
                className="erp-input h-12 font-bold" 
                disabled={!!initialData}
              />
              <button type="button" onClick={() => handleSearchEntry(true)} disabled={loading || !!initialData} className="bg-primary hover:bg-primary/90 text-white h-12 px-6 rounded-xl flex items-center justify-center transition-all disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-5 w-5" />}
              </button>
            </div>

            {foundEntry && (
              <div className="space-y-4 animate-in zoom-in duration-300">
                <div className="bg-muted/30 p-5 rounded-2xl border border-border space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span className="text-muted-foreground">Ingreso Vinculado:</span>
                    <span className="text-foreground font-mono">{foundEntry.visibleNumber}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span className="text-muted-foreground">Total Ingresado:</span>
                    <span className="text-foreground font-bold">{foundEntry.totalIngresado}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span className="text-primary">Despacho Real:</span>
                    <span className="text-primary font-bold">{foundEntry.totalDispatched} unds</span>
                  </div>
                  <div className="h-px bg-border my-1" />
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span className={foundEntry.canInvoice ? "text-emerald-600" : "text-red-600"}>Saldo Pendiente:</span>
                    <span className={cn("font-black", foundEntry.canInvoice ? "text-emerald-600" : "text-red-600")}>{foundEntry.faltanteTotal} unds</span>
                  </div>
                </div>

                {validationError && (
                  <Alert variant="destructive" className="rounded-xl border-none bg-red-50 text-red-700 p-4">
                    <ShieldAlert className="h-5 w-5" />
                    <AlertTitle className="text-xs font-black uppercase tracking-tight">Bloqueo de Seguridad</AlertTitle>
                    <AlertDescription className="text-[10px] font-bold uppercase leading-tight">
                      {validationError}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          {!initialData && (
            <div className="bg-card p-8 rounded-[2rem] border border-border shadow-sm space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <Layers className="h-4 w-4" /> Auditoría por Lote
              </h4>
              <div className="rounded-2xl border border-border bg-muted/10 overflow-hidden min-h-[200px] flex flex-col">
                {foundEntry && foundEntry.lotsInvoiced.length > 0 ? (
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent border-border">
                          <TableHead className="text-[9px] font-black uppercase py-3 pl-6">Lote</TableHead>
                          <TableHead className="text-[9px] font-black uppercase text-center">In / Out</TableHead>
                          <TableHead className="text-[9px] font-black uppercase text-right pr-6">Saldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {foundEntry.lotsInvoiced.map((lot: any, i: number) => (
                          <TableRow key={i} className="border-border hover:bg-muted/20">
                            <TableCell className="pl-6 py-3">
                              <div className="flex flex-col">
                                <span className="font-bold text-xs">{lot.lid}</span>
                                <span className="text-[8px] text-muted-foreground uppercase">{lot.garment}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-bold text-[10px]">
                              {lot.original} / <span className="text-primary">{lot.dispatched}</span>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              {lot.missing > 0 ? (
                                <Badge variant="outline" className={cn(
                                  "text-[9px] font-black h-5 border-none",
                                  lot.dispatched === 0 ? "bg-red-500 text-white" : "bg-amber-100 text-amber-700"
                                )}>
                                  {lot.dispatched === 0 ? "PENDIENTE" : `-${lot.missing}`}
                                </Badge>
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-30">
                    <Package className="h-10 w-10 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                      {foundEntry ? "Sin lotes detectados" : "Vincule un ingreso maestro"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={cn(
          "bg-card p-10 rounded-[2.5rem] border border-border shadow-sm space-y-10 flex flex-col h-full transition-all duration-500",
          !initialData && "lg:col-span-8",
          (!foundEntry || (foundEntry && !foundEntry.canInvoice)) && !initialData && "opacity-60"
        )}>
          <div className="flex items-center justify-between border-b border-border pb-6">
            <div className="space-y-1">
              <h4 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                <Receipt className="h-7 w-7 text-primary" /> 2. Detalles de Factura
              </h4>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Ingrese los valores exactamente como figuran en el documento físico.
              </p>
            </div>
            {(foundEntry || initialData) && (
              <Badge className={cn(
                "px-5 py-2 rounded-full font-black uppercase text-[10px] tracking-widest border-none",
                isNotaDeVenta ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"
              )}>
                {isNotaDeVenta ? "Nota de Venta" : "Factura Fiscal"}
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
              
              <FormField control={form.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Socio Comercial</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={(!foundEntry || !foundEntry.canInvoice) && !initialData}>
                    <FormControl>
                      <SelectTrigger className="erp-input h-12 font-bold">
                        <SelectValue placeholder="Elegir Socio..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-2xl shadow-2xl">
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs uppercase font-bold">{(c.name || c.nombre || "S/N").toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-border">
              <FormField control={form.control} name="subtotal" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Subtotal Bruto ($)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      className="erp-input h-14 text-lg font-black" 
                      disabled={(!foundEntry || !foundEntry.canInvoice) && !initialData}
                      {...field} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        field.onChange(val);
                        const calcIva = Number((val * 0.15).toFixed(2));
                        form.setValue("iva", calcIva);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="iva" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">IVA Liquidado ($)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      className="erp-input h-14 text-lg font-black text-amber-600" 
                      disabled={(!foundEntry || !foundEntry.canInvoice) && !initialData}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">Total Comprobante ($)</p>
                <div className="h-14 bg-primary/5 rounded-2xl flex items-center px-6 text-3xl font-black text-primary border-2 border-primary/20 shadow-inner">
                  ${total.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observaciones Manuales</FormLabel>
                  <FormControl><Textarea placeholder="Ej: Factura enviada por correo..." className="erp-input h-24 py-4 resize-none text-sm" disabled={(!foundEntry || !foundEntry.canInvoice) && !initialData} {...field} /></FormControl>
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
              disabled={(!foundEntry || (foundEntry && !foundEntry.canInvoice)) && !initialData} 
              className="bg-primary hover:bg-primary/90 text-white h-14 px-14 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-30"
            >
              <Save className="h-4 w-4 mr-3" />
              {initialData ? "Actualizar Registro" : "Registrar Factura"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}