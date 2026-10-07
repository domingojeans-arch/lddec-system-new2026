"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Supplier, 
  PurchaseInvoice, 
  PURCHASE_CATEGORIES, 
  CREDIT_DAYS_OPTIONS, 
  PaymentCondition 
} from "@/types/proveedores";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Loader2, 
  Receipt, 
  Plus, 
  Calendar, 
  DollarSign, 
  CalendarClock, 
  Tag, 
  FileText,
  CheckCircle2,
  Percent
} from "lucide-react";
import { addDays, format, parseISO } from "date-fns";

interface InvoiceFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  invoiceToEdit?: PurchaseInvoice | null;
  onOpenNewSupplierModal: () => void;
}

export function InvoiceFormDialog({
  isOpen,
  onClose,
  suppliers,
  invoiceToEdit,
  onOpenNewSupplierModal,
}: InvoiceFormDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [proveedorId, setProveedorId] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [fechaEmision, setFechaEmision] = useState(todayStr);
  const [condicionPago, setCondicionPago] = useState<PaymentCondition>("CREDITO");
  const [diasCredito, setDiasCredito] = useState<number>(30);
  const [fechaVencimiento, setFechaVencimiento] = useState(todayStr);
  const [categoria, setCategoria] = useState<string>("QUIMICOS");
  const [descripcion, setDescripcion] = useState("");

  const [subtotal, setSubtotal] = useState<string>("");
  const [aplicaIva, setAplicaIva] = useState<boolean>(true);
  const [iva, setIva] = useState<string>("");
  const [montoTotal, setMontoTotal] = useState<string>("");

  // Al seleccionar proveedor, cargar sus días de crédito habituales y categoría
  const handleSelectSupplier = (id: string) => {
    setProveedorId(id);
    const sup = suppliers.find((s) => s.id === id);
    if (sup) {
      if (sup.categoriaPrincipal) setCategoria(sup.categoriaPrincipal);
      if (sup.diasCreditoHabitual) {
        setDiasCredito(sup.diasCreditoHabitual);
        recalcDueDate(fechaEmision, sup.diasCreditoHabitual);
      }
    }
  };

  // Recalcular fecha de vencimiento según fecha de emisión y días de crédito
  const recalcDueDate = (baseDateStr: string, days: number) => {
    try {
      if (!baseDateStr) return;
      const baseDate = parseISO(baseDateStr);
      if (isNaN(baseDate.getTime())) return;
      const due = addDays(baseDate, days);
      setFechaVencimiento(format(due, "yyyy-MM-dd"));
    } catch (e) {
      // Ignorar error de parsing
    }
  };

  // Efecto para recalcular vencimiento cuando cambia fecha de emisión o condición de pago
  useEffect(() => {
    if (condicionPago === "CONTADO") {
      setFechaVencimiento(fechaEmision);
    } else {
      recalcDueDate(fechaEmision, diasCredito);
    }
  }, [fechaEmision, condicionPago, diasCredito]);

  // Cálculo de Subtotal e IVA
  const handleSubtotalChange = (val: string) => {
    setSubtotal(val);
    const numSub = parseFloat(val);
    if (!isNaN(numSub) && numSub > 0) {
      const calcIva = aplicaIva ? Number((numSub * 0.15).toFixed(2)) : 0;
      setIva(calcIva.toFixed(2));
      setMontoTotal((numSub + calcIva).toFixed(2));
    } else {
      setIva("");
      setMontoTotal("");
    }
  };

  const handleTotalDirectChange = (val: string) => {
    setMontoTotal(val);
    const numTot = parseFloat(val);
    if (!isNaN(numTot) && numTot > 0 && aplicaIva) {
      const numSub = Number((numTot / 1.15).toFixed(2));
      const calcIva = Number((numTot - numSub).toFixed(2));
      setSubtotal(numSub.toFixed(2));
      setIva(calcIva.toFixed(2));
    }
  };

  const toggleIva = (checked: boolean) => {
    setAplicaIva(checked);
    const numSub = parseFloat(subtotal);
    if (!isNaN(numSub) && numSub > 0) {
      const calcIva = checked ? Number((numSub * 0.15).toFixed(2)) : 0;
      setIva(calcIva.toFixed(2));
      setMontoTotal((numSub + calcIva).toFixed(2));
    }
  };

  useEffect(() => {
    if (invoiceToEdit) {
      setProveedorId(invoiceToEdit.proveedorId || "");
      setNumeroFactura(invoiceToEdit.numeroFactura || "");
      setFechaEmision(invoiceToEdit.fechaEmision || todayStr);
      setCondicionPago(invoiceToEdit.condicionPago || "CREDITO");
      setDiasCredito(invoiceToEdit.diasCredito || 30);
      setFechaVencimiento(invoiceToEdit.fechaVencimiento || todayStr);
      setCategoria(invoiceToEdit.categoria || "QUIMICOS");
      setDescripcion(invoiceToEdit.descripcion || "");
      setSubtotal(invoiceToEdit.subtotal ? invoiceToEdit.subtotal.toString() : "");
      setIva(invoiceToEdit.iva ? invoiceToEdit.iva.toString() : "");
      setMontoTotal(invoiceToEdit.montoTotal ? invoiceToEdit.montoTotal.toString() : "");
      setAplicaIva((invoiceToEdit.iva || 0) > 0);
    } else {
      setProveedorId("");
      setNumeroFactura("");
      setFechaEmision(todayStr);
      setCondicionPago("CREDITO");
      setDiasCredito(30);
      setFechaVencimiento(format(addDays(new Date(), 30), "yyyy-MM-dd"));
      setCategoria("QUIMICOS");
      setDescripcion("");
      setSubtotal("");
      setAplicaIva(true);
      setIva("");
      setMontoTotal("");
    }
  }, [invoiceToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!proveedorId) {
      toast({ variant: "destructive", title: "Por favor seleccione un proveedor" });
      return;
    }
    if (!numeroFactura.trim()) {
      toast({ variant: "destructive", title: "Ingrese el número de factura" });
      return;
    }
    const totalNum = parseFloat(montoTotal);
    if (isNaN(totalNum) || totalNum <= 0) {
      toast({ variant: "destructive", title: "El monto total debe ser mayor a $0.00" });
      return;
    }

    const selectedSupplier = suppliers.find((s) => s.id === proveedorId);
    const proveedorNombre = selectedSupplier ? selectedSupplier.nombre : "PROVEEDOR";
    const proveedorRuc = selectedSupplier?.ruc || "";

    setLoading(true);
    try {
      const totalAbonado = invoiceToEdit ? (invoiceToEdit.totalAbonado || 0) : (condicionPago === "CONTADO" ? totalNum : 0);
      const saldoPendiente = Math.max(0, totalNum - totalAbonado);
      
      let estado = invoiceToEdit?.estado || "PENDIENTE";
      if (saldoPendiente <= 0) {
        estado = "PAGADA";
      } else if (totalAbonado > 0) {
        estado = "ABONADA";
      } else {
        estado = "PENDIENTE";
      }

      const payload: Partial<PurchaseInvoice> = {
        proveedorId,
        proveedorNombre,
        proveedorRuc,
        numeroFactura: numeroFactura.trim().toUpperCase(),
        fechaEmision,
        condicionPago,
        diasCredito: condicionPago === "CREDITO" ? Number(diasCredito) : 0,
        fechaVencimiento: condicionPago === "CONTADO" ? fechaEmision : fechaVencimiento,
        categoria,
        descripcion: descripcion.trim(),
        subtotal: parseFloat(subtotal) || totalNum,
        iva: parseFloat(iva) || 0,
        montoTotal: totalNum,
        totalAbonado,
        saldoPendiente,
        estado,
        updatedAt: serverTimestamp(),
      };

      if (invoiceToEdit) {
        await updateDoc(doc(db, "purchase_invoices", invoiceToEdit.id), payload);
        toast({
          title: "Factura actualizada ✅",
          description: `Factura ${numeroFactura} de ${proveedorNombre} guardada.`,
          className: "bg-emerald-600 text-white font-bold",
        });
      } else {
        payload.createdAt = serverTimestamp();
        payload.createdBy = user?.email || "admin";
        payload.pagos = [];
        
        // Si fue de contado, registrar el pago inicial automático
        if (condicionPago === "CONTADO") {
          payload.pagos = [{
            id: `pago-${Date.now()}`,
            invoiceId: "",
            monto: totalNum,
            fechaPago: fechaEmision,
            metodoPago: "TRANSFERENCIA",
            bancoOrigen: "PAGO INMEDIATO CONTADO",
            numeroReferencia: `CONTADO-${numeroFactura}`,
            notas: "Pago inmediato de contado registrado en la emisión",
            registradoPor: user?.email || "admin",
            createdAt: new Date().toISOString(),
          }];
        }

        await addDoc(collection(db, "purchase_invoices"), payload);
        toast({
          title: "Factura de compra registrada ✅",
          description: `Se registró la factura ${numeroFactura} por $${totalNum.toFixed(2)}.`,
          className: "bg-emerald-600 text-white font-bold",
        });
      }

      onClose();
    } catch (err: any) {
      console.error("Error guardando factura:", err);
      toast({
        variant: "destructive",
        title: "Error al guardar la factura",
        description: err.message || "Ocurrió un error inesperado.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            {invoiceToEdit ? "Editar Factura de Compra" : "Registrar Factura de Compra"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* SECCIÓN 1: PROVEEDOR Y FACTURA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase text-muted-foreground">Proveedor *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] font-black uppercase text-primary gap-1 px-2"
                  onClick={onOpenNewSupplierModal}
                >
                  <Plus className="h-3 w-3" /> Crear Nuevo Proveedor
                </Button>
              </div>
              <Select value={proveedorId} onValueChange={handleSelectSupplier}>
                <SelectTrigger className="erp-input font-bold h-11">
                  <SelectValue placeholder="Seleccione el proveedor..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl max-h-60">
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="font-bold">
                      {s.nombre} {s.ruc ? `(${s.ruc})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground">N° Factura Física / Electrónica *</Label>
              <Input
                className="erp-input font-mono font-bold uppercase"
                placeholder="Ej: 001-002-00012345"
                value={numeroFactura}
                onChange={(e) => setNumeroFactura(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground">Categoría de Compra *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="erp-input font-bold">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {PURCHASE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <Tag className="h-3 w-3 text-primary" />
                        {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* SECCIÓN 2: CONDICIÓN DE PAGO Y PLAZO HASTA 120 DÍAS */}
          <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 text-primary" /> Condición de Pago y Plazo
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={condicionPago === "CONTADO" ? "default" : "outline"}
                  className="h-8 rounded-xl font-black text-xs"
                  onClick={() => setCondicionPago("CONTADO")}
                >
                  Contado
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={condicionPago === "CREDITO" ? "default" : "outline"}
                  className="h-8 rounded-xl font-black text-xs"
                  onClick={() => setCondicionPago("CREDITO")}
                >
                  Crédito
                </Button>
              </div>
            </div>

            {condicionPago === "CREDITO" && (
              <div className="space-y-2 pt-1 animate-in fade-in duration-300">
                <Label className="text-[11px] font-bold text-muted-foreground">Seleccionar días de crédito:</Label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {CREDIT_DAYS_OPTIONS.map((days) => (
                    <Button
                      key={days}
                      type="button"
                      variant={diasCredito === days ? "default" : "secondary"}
                      className="h-8 text-xs font-bold rounded-lg"
                      onClick={() => setDiasCredito(days)}
                    >
                      {days} días
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Fecha de Emisión *
                </Label>
                <Input
                  type="date"
                  className="erp-input font-bold h-9"
                  value={fechaEmision}
                  onChange={(e) => setFechaEmision(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                  <CalendarClock className="h-3 w-3 text-amber-500" /> Fecha de Vencimiento
                </Label>
                <Input
                  type="date"
                  className="erp-input font-bold h-9 bg-background"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  disabled={condicionPago === "CONTADO"}
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: MONTOS EN DÓLARES */}
          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-emerald-600" /> Valores en Dólares ($)
              </Label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold select-none text-muted-foreground">
                <input
                  type="checkbox"
                  checked={aplicaIva}
                  onChange={(e) => toggleIva(e.target.checked)}
                  className="rounded border-border"
                />
                Calcular IVA (15%)
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-muted-foreground">Subtotal ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="erp-input font-mono font-bold"
                  placeholder="0.00"
                  value={subtotal}
                  onChange={(e) => handleSubtotalChange(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-muted-foreground">IVA 15% ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="erp-input font-mono font-bold"
                  placeholder="0.00"
                  value={iva}
                  onChange={(e) => {
                    setIva(e.target.value);
                    const sub = parseFloat(subtotal) || 0;
                    const iv = parseFloat(e.target.value) || 0;
                    setMontoTotal((sub + iv).toFixed(2));
                  }}
                  disabled={!aplicaIva}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-primary">Monto Total ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="erp-input font-mono font-black text-lg text-primary border-primary/40"
                  placeholder="0.00"
                  value={montoTotal}
                  onChange={(e) => handleTotalDirectChange(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: DETALLE DE COMPRA */}
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Detalle / Descripción de la Compra
            </Label>
            <Textarea
              className="erp-input rounded-2xl min-h-[70px]"
              placeholder="Ej: 5 canecas de Metabisulfito de Sodio, 2 bultos de Sal Industrial, etc."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-xs rounded-xl px-6"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {invoiceToEdit ? "Guardar Cambios" : "Registrar Factura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
