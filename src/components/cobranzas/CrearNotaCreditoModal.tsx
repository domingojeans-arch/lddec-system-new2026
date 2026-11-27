"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  FileMinus, 
  Calendar as CalendarIcon, 
  Loader2, 
  CheckCircle2, 
  DollarSign, 
  Receipt, 
  Users, 
  Info 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { 
  collection, 
  doc, 
  serverTimestamp, 
  Timestamp, 
  writeBatch 
} from "firebase/firestore";
import { cn } from "@/lib/utils";

interface CrearNotaCreditoModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: any;
  allClients: any[];
  invoices?: any[];
  onSuccess?: () => void;
}

export function CrearNotaCreditoModal({
  isOpen,
  onClose,
  client,
  allClients,
  invoices = [],
  onSuccess
}: CrearNotaCreditoModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [numeroNC, setNumeroNC] = useState<string>("");
  const [monto, setMonto] = useState<string>("");
  const [fecha, setFecha] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("SIN_FACTURA");
  const [motivo, setMotivo] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (client) {
      setSelectedClientId(client.id);
    } else if (allClients.length > 0 && !selectedClientId) {
      setSelectedClientId(allClients[0].id);
    }
  }, [client, allClients]);

  useEffect(() => {
    if (isOpen) {
      setNumeroNC("");
      setMonto("");
      setFecha(new Date());
      setSelectedInvoiceId("SIN_FACTURA");
      setMotivo("");
      setIsSubmitting(false);
      if (client) {
        setSelectedClientId(client.id);
      }
    }
  }, [isOpen, client]);

  const targetClient = allClients.find(c => c.id === selectedClientId) || client;

  // Filtrar facturas asociadas al cliente si se proporcionan
  const clientInvoices = invoices.filter(inv => {
    const invCid = inv.clientId || inv.clienteId;
    return invCid === selectedClientId;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClient) {
      toast({ variant: "destructive", title: "Error", description: "Debe seleccionar un socio industrial." });
      return;
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      toast({ variant: "destructive", title: "Monto inválido", description: "Ingrese un monto mayor a 0." });
      return;
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const nowServer = serverTimestamp();
      const nowLocal = Timestamp.now();
      const currentUser = user?.displayName || user?.email || "Sistema";
      const fechaTx = Timestamp.fromDate(fecha || new Date());
      const cleanNC = numeroNC.trim();
      const cleanMotivo = motivo.trim();

      const globalPaymentRef = doc(collection(db, "payments"));
      const isSinFactura = !selectedInvoiceId || selectedInvoiceId === "SIN_FACTURA";

      const targetInv = !isSinFactura ? invoices.find(i => i.id === selectedInvoiceId) : null;

      const paymentData: any = {
        id: globalPaymentRef.id,
        clienteId: targetClient.id,
        clientId: targetClient.id,
        clienteNombre: targetClient.displayName || targetClient.name || `${targetClient.lastName || ""} ${targetClient.firstName || ""}`.trim() || "Socio",
        tipoTransaccion: "Nota de Crédito",
        monto: montoNum,
        fechaTransaccion: fechaTx,
        numeroDocumento: cleanNC,
        numeroFactura: isSinFactura
          ? (cleanNC ? `NC ${cleanNC} (Sin Factura)` : "SIN FACTURA (AJUSTE DIRECTO)")
          : (targetInv?.numeroFactura || targetInv?.id || "FACTURA"),
        facturaId: isSinFactura ? "" : targetInv?.id || "",
        descripcion: cleanMotivo
          ? (cleanNC ? `NC ${cleanNC}: ${cleanMotivo}` : cleanMotivo)
          : (cleanNC ? `Nota de Crédito ${cleanNC}` : "Nota de crédito directa a la cuenta del socio"),
        metodoPago: "",
        origen: isSinFactura ? "directo" : "factura",
        migrado: false,
        registradoPor: currentUser,
        fechaRegistro: nowLocal,
        createdAt: nowServer
      };

      batch.set(globalPaymentRef, paymentData);

      // Si se vinculó a una factura específica, actualizar pagosYajustes y saldo de la factura
      if (!isSinFactura && targetInv) {
        const currentPagos = Array.isArray(targetInv.pagosYajustes) ? targetInv.pagosYajustes : [];
        const newPaymentForInv = {
          id: globalPaymentRef.id,
          tipoTransaccion: "Nota de Crédito",
          metodoPago: "",
          monto: montoNum,
          fechaTransaccion: fechaTx,
          descripcion: cleanMotivo ? `NC ${cleanNC}: ${cleanMotivo}` : `Nota de Crédito ${cleanNC}`,
          fechaRegistro: nowLocal,
          registradoPor: currentUser
        };
        const updatedPagos = [...currentPagos, newPaymentForInv];
        
        const totalAbonado = updatedPagos.reduce((acc, p) => {
          if (p.anulado) return acc;
          return p.tipoTransaccion === 'Reverso' ? acc - Number(p.monto || 0) : acc + Number(p.monto || 0);
        }, 0);
        
        const originalTotal = Number(targetInv.totalFactura || targetInv.total || 0);
        const nuevoSaldo = Math.max(0, originalTotal - totalAbonado);
        
        let nuevoEstado = "Por Cobrar";
        if (nuevoSaldo <= 0.01) nuevoEstado = "Pagada";
        else if (totalAbonado > 0) nuevoEstado = "Parcialmente Cobrada";

        batch.update(doc(db, "facturas", targetInv.id), {
          pagosYajustes: updatedPagos,
          saldoPendiente: nuevoSaldo,
          estadoCobranza: nuevoEstado,
          updatedAt: nowServer
        });
      }

      await batch.commit();

      toast({
        title: "Nota de Crédito Registrada",
        description: `Se registró la Nota de Crédito por $${montoNum.toFixed(2)} a favor de ${paymentData.clienteNombre}.`
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error al registrar Nota de Crédito:", error);
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: error?.message || "No se pudo registrar la Nota de Crédito en la base de datos."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-w-xl rounded-[2.5rem] p-0 overflow-hidden border-border bg-card shadow-2xl">
        <DialogHeader className="p-8 border-b border-border bg-purple-500/5">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20">
              <FileMinus className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground">
                Nueva Nota de Crédito (N/C)
              </DialogTitle>
              <DialogDescription className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-widest mt-0.5">
                Emisión / Registro Directo a Cuenta
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/60 flex items-start gap-3">
            <Info className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-purple-900 dark:text-purple-300 leading-relaxed">
              <strong className="font-bold">Abono sin factura:</strong> Puedes crear esta Nota de Crédito directamente a la cuenta del cliente sin necesidad de vincularla a una factura previa. Se descontará de su saldo actual y figurará en el Estado de Cuentas en la columna <strong className="font-bold">N/C</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Socio Industrial */}
            <div className="space-y-2 md:col-span-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Socio Industrial (Cliente)
              </Label>
              <Select
                value={selectedClientId}
                onValueChange={(val) => {
                  setSelectedClientId(val);
                  setSelectedInvoiceId("SIN_FACTURA");
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger className="erp-input h-12 bg-background font-bold text-xs">
                  <SelectValue placeholder="Seleccione un socio..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-60">
                  {allClients.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs uppercase font-bold">
                      {c.displayName || c.name || `${c.lastName || ""} ${c.firstName || ""}`.trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Número de Nota de Crédito */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                N° Nota de Crédito
              </Label>
              <Input
                placeholder="Ej: NC-001-001-0000045"
                value={numeroNC}
                onChange={(e) => setNumeroNC(e.target.value.toUpperCase())}
                disabled={isSubmitting}
                className="erp-input h-12 bg-background font-bold text-xs uppercase"
              />
            </div>

            {/* Monto ($) */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Monto de la Nota de Crédito ($)
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-600 font-black text-sm">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  disabled={isSubmitting}
                  className="erp-input h-12 pl-8 bg-background font-black text-purple-700 dark:text-purple-400 text-lg"
                />
              </div>
            </div>

            {/* Fecha de Emisión */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Fecha de Emisión
              </Label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 erp-input bg-background justify-start text-left font-bold text-xs"
                    disabled={isSubmitting}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-purple-600" />
                    {fecha ? format(fecha, "dd/MM/yyyy") : "Seleccionar..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start">
                  <Calendar
                    mode="single"
                    selected={fecha}
                    onSelect={(d) => {
                      if (d) setFecha(d);
                      setIsCalendarOpen(false);
                    }}
                    locale={es}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Factura Relacionada (Opcional) */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Factura Relacionada (Opcional)
              </Label>
              <Select
                value={selectedInvoiceId}
                onValueChange={setSelectedInvoiceId}
                disabled={isSubmitting}
              >
                <SelectTrigger className="erp-input h-12 bg-background font-bold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-56">
                  <SelectItem value="SIN_FACTURA" className="text-xs font-black text-purple-700 dark:text-purple-300">
                    ★ SIN FACTURA (Abono directo a cuenta)
                  </SelectItem>
                  {clientInvoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id} className="text-xs font-bold uppercase">
                      Factura {inv.numeroFactura || inv.id} (Saldo: ${Number(inv.saldoPendiente || inv.totalFactura || 0).toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Motivo / Concepto */}
            <div className="space-y-2 md:col-span-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Motivo / Concepto del Ajuste
              </Label>
              <Textarea
                placeholder="Ej: Devolución de prendas defectuosas lote #..., descuento por volumen comercial, ajuste acordado..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                disabled={isSubmitting}
                className="erp-input min-h-[75px] bg-background text-xs font-medium"
              />
            </div>
          </div>

          <DialogFooter className="gap-3 pt-4 border-t border-border flex flex-col sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto rounded-xl h-12 font-bold uppercase text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !monto || parseFloat(monto) <= 0}
              className="w-full sm:flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-12 font-black uppercase text-xs shadow-lg shadow-purple-600/20 gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Registrar Nota de Crédito
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
