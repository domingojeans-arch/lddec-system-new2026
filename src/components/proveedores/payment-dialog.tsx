"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PurchaseInvoice, SupplierPayment } from "@/types/proveedores";
import { db } from "@/lib/firebase";
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Loader2, 
  CreditCard, 
  DollarSign, 
  Building, 
  Calendar, 
  Hash, 
  CheckCircle2, 
  Receipt,
  FileCheck2
} from "lucide-react";
import { format } from "date-fns";

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: PurchaseInvoice | null;
}

const METODOS_PAGO = [
  { value: "TRANSFERENCIA", label: "Transferencia Bancaria" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "EFECTIVO", label: "Efectivo / Caja Chica" },
  { value: "RETENCION", label: "Comprobante de Retención" },
  { value: "OTRO", label: "Otro Método" },
];

const BANCOS_COMUNES = [
  "BANCO PICHINCHA",
  "BANCO GUAYAQUIL",
  "BANCO DEL PACÍFICO",
  "PRODUBANCO",
  "BANCO INTERNACIONAL",
  "BANCO BOLIVARIANO",
  "CAJA CHICA LDDEC",
  "OTRO BANCO",
];

export function PaymentDialog({ isOpen, onClose, invoice }: PaymentDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [monto, setMonto] = useState<string>("");
  const [fechaPago, setFechaPago] = useState<string>(todayStr);
  const [metodoPago, setMetodoPago] = useState<string>("TRANSFERENCIA");
  const [bancoOrigen, setBancoOrigen] = useState<string>("BANCO PICHINCHA");
  const [numeroReferencia, setNumeroReferencia] = useState<string>("");
  const [notas, setNotas] = useState<string>("");

  useEffect(() => {
    if (invoice) {
      setMonto(invoice.saldoPendiente > 0 ? invoice.saldoPendiente.toFixed(2) : "");
      setFechaPago(todayStr);
      setMetodoPago("TRANSFERENCIA");
      setBancoOrigen("BANCO PICHINCHA");
      setNumeroReferencia("");
      setNotas("");
    }
  }, [invoice, isOpen]);

  if (!invoice) return null;

  const handlePayFullBalance = () => {
    setMonto(invoice.saldoPendiente.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const pagoNum = parseFloat(monto);
    if (isNaN(pagoNum) || pagoNum <= 0) {
      toast({ variant: "destructive", title: "El monto a pagar debe ser mayor a $0.00" });
      return;
    }

    if (pagoNum > invoice.saldoPendiente + 0.01) {
      toast({
        variant: "destructive",
        title: "Monto excede el saldo pendiente",
        description: `El saldo pendiente de esta factura es de $${invoice.saldoPendiente.toFixed(2)}.`,
      });
      return;
    }

    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const newPayment: SupplierPayment = {
        id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        invoiceId: invoice.id,
        monto: pagoNum,
        fechaPago,
        metodoPago: metodoPago as any,
        bancoOrigen,
        numeroReferencia: numeroReferencia.trim().toUpperCase(),
        notas: notas.trim(),
        registradoPor: user?.displayName || user?.email || "admin",
        createdAt: nowIso,
      };

      const prevPagos = Array.isArray(invoice.pagos) ? invoice.pagos : [];
      const updatedPagos = [...prevPagos, newPayment];

      const newTotalAbonado = Number(((invoice.totalAbonado || 0) + pagoNum).toFixed(2));
      const newSaldoPendiente = Math.max(0, Number((invoice.montoTotal - newTotalAbonado).toFixed(2)));

      let nuevoEstado: "PENDIENTE" | "ABONADA" | "PAGADA" = "ABONADA";
      if (newSaldoPendiente <= 0) {
        nuevoEstado = "PAGADA";
      }

      // 1. Actualizar la factura
      const invoiceRef = doc(db, "purchase_invoices", invoice.id);
      await updateDoc(invoiceRef, {
        pagos: updatedPagos,
        totalAbonado: newTotalAbonado,
        saldoPendiente: newSaldoPendiente,
        estado: nuevoEstado,
        updatedAt: serverTimestamp(),
      });

      // 2. Registrar en la colección centralizada de pagos para auditoría y métricas
      await addDoc(collection(db, "supplier_payments"), {
        ...newPayment,
        invoiceNumber: invoice.numeroFactura,
        proveedorId: invoice.proveedorId,
        proveedorNombre: invoice.proveedorNombre,
        createdAt: serverTimestamp(),
      });

      toast({
        title: nuevoEstado === "PAGADA" ? "¡Factura Pagada en su Totalidad! ✅" : "Abono Registrado con Éxito ✅",
        description: `Se registró un pago de $${pagoNum.toFixed(2)} para la factura ${invoice.numeroFactura}.`,
        className: "bg-emerald-600 text-white font-bold",
      });

      onClose();
    } catch (err: any) {
      console.error("Error registrando pago:", err);
      toast({
        variant: "destructive",
        title: "Error al registrar pago",
        description: err.message || "Ocurrió un error inesperado.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-600" />
            Registrar Pago / Abono a Proveedor
          </DialogTitle>
        </DialogHeader>

        {/* RESUMEN DE LA FACTURA */}
        <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-muted-foreground uppercase">Proveedor:</span>
            <span className="font-black text-foreground truncate max-w-[250px]">{invoice.proveedorNombre}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-muted-foreground uppercase">Factura:</span>
            <span className="font-mono font-black text-primary">{invoice.numeroFactura}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/60 text-center">
            <div className="p-2 rounded-xl bg-background border border-border">
              <span className="text-[10px] font-bold text-muted-foreground block uppercase">Total</span>
              <span className="text-xs font-black text-foreground">${invoice.montoTotal.toFixed(2)}</span>
            </div>
            <div className="p-2 rounded-xl bg-background border border-border">
              <span className="text-[10px] font-bold text-muted-foreground block uppercase">Ya Pagado</span>
              <span className="text-xs font-black text-emerald-600">${(invoice.totalAbonado || 0).toFixed(2)}</span>
            </div>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 block uppercase">Saldo</span>
              <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                ${invoice.saldoPendiente.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* MONTO A PAGAR */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black uppercase text-emerald-600">Monto del Pago ($) *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[10px] font-black uppercase text-emerald-600 border-emerald-500/40 gap-1 px-2 hover:bg-emerald-500/10"
                onClick={handlePayFullBalance}
              >
                <CheckCircle2 className="h-3 w-3" /> Pagar Saldo Completo
              </Button>
            </div>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-600" />
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={invoice.saldoPendiente + 0.01}
                className="pl-10 erp-input font-mono font-black text-xl text-emerald-600 border-emerald-500/40 h-12"
                placeholder="0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground">Fecha de Pago *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  className="pl-9 erp-input font-bold"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground">Método de Pago *</Label>
              <Select value={metodoPago} onValueChange={setMetodoPago}>
                <SelectTrigger className="erp-input font-bold">
                  <SelectValue placeholder="Seleccione método" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {METODOS_PAGO.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="font-bold">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground">Banco / Origen</Label>
              <Select value={bancoOrigen} onValueChange={setBancoOrigen}>
                <SelectTrigger className="erp-input font-bold">
                  <SelectValue placeholder="Seleccione banco" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {BANCOS_COMUNES.map((b) => (
                    <SelectItem key={b} value={b} className="font-bold">
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground">N° Comprobante / Cheque</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 erp-input font-mono font-bold uppercase"
                  placeholder="Ej: TRANS-89104"
                  value={numeroReferencia}
                  onChange={(e) => setNumeroReferencia(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase text-muted-foreground">Observaciones / Notas</Label>
            <Textarea
              className="erp-input rounded-2xl min-h-[60px]"
              placeholder="Detalle adicional sobre este pago o descuento aplicado..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs rounded-xl px-6 gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
              Confirmar Pago
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
