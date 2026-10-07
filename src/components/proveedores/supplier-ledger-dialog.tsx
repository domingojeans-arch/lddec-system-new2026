"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Supplier, PurchaseInvoice } from "@/types/proveedores";
import { 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Receipt, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Calendar
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface SupplierLedgerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  invoices: PurchaseInvoice[];
  onOpenPaymentDialog: (invoice: PurchaseInvoice) => void;
}

export function SupplierLedgerDialog({
  isOpen,
  onClose,
  supplier,
  invoices,
  onOpenPaymentDialog,
}: SupplierLedgerDialogProps) {
  if (!supplier) return null;

  // Filtrar facturas de este proveedor
  const supplierInvoices = invoices.filter((inv) => inv.proveedorId === supplier.id);

  // Calcular métricas
  const totalComprado = supplierInvoices.reduce((sum, inv) => sum + (inv.montoTotal || 0), 0);
  const totalPagado = supplierInvoices.reduce((sum, inv) => sum + (inv.totalAbonado || 0), 0);
  const saldoPendiente = supplierInvoices.reduce((sum, inv) => sum + (inv.saldoPendiente || 0), 0);

  // Extraer todos los pagos realizados a este proveedor
  const allPayments = supplierInvoices.flatMap((inv) =>
    (inv.pagos || []).map((p) => ({
      ...p,
      invoiceNumber: inv.numeroFactura,
    }))
  ).sort((a, b) => new Date(b.fechaPago).getTime() - new Date(a.fechaPago).getTime());

  const formatDateSafe = (dateStr: string) => {
    try {
      if (!dateStr) return "---";
      const parsed = parseISO(dateStr);
      return isNaN(parsed.getTime()) ? dateStr : format(parsed, "dd/MM/yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <DialogTitle className="text-xl font-black uppercase flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {supplier.nombre}
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                RUC: {supplier.ruc || "S/N"} {supplier.contacto ? `• Contacto: ${supplier.contacto}` : ""}
              </p>
            </div>
            {supplier.telefono && (
              <Badge variant="outline" className="text-xs font-mono font-bold w-fit">
                <Phone className="h-3 w-3 mr-1" /> {supplier.telefono}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* TARJETAS DE SALDO DEL PROVEEDOR */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2">
          <div className="p-4 rounded-2xl bg-muted/40 border border-border">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
              Total Histórico Comprado
            </span>
            <span className="text-xl font-black text-foreground mt-1 block">
              ${totalComprado.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-muted-foreground font-bold">
              {supplierInvoices.length} factura(s) registrada(s)
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
              Total Pagado
            </span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
              ${totalPagado.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-emerald-600/80 font-bold">
              {allPayments.length} pago(s) efectuado(s)
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-200 block">
              Saldo Pendiente Actual
            </span>
            <span className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1 block">
              ${saldoPendiente.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-bold">
              Cuentas por pagar a este proveedor
            </span>
          </div>
        </div>

        {/* TABS DE FACTURAS Y PAGOS */}
        <Tabs defaultValue="facturas" className="w-full mt-2">
          <TabsList className="grid grid-cols-2 rounded-2xl p-1 bg-muted/60">
            <TabsTrigger value="facturas" className="rounded-xl font-black text-xs uppercase gap-1.5">
              <Receipt className="h-4 w-4" /> Facturas ({supplierInvoices.length})
            </TabsTrigger>
            <TabsTrigger value="pagos" className="rounded-xl font-black text-xs uppercase gap-1.5">
              <CreditCard className="h-4 w-4" /> Historial de Pagos ({allPayments.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB FACTURAS */}
          <TabsContent value="facturas" className="space-y-3 pt-2">
            <div className="rounded-2xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase">N° Factura</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Emisión</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Vencimiento</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right">Total ($)</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right">Saldo ($)</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">Estado</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right pr-4">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierInvoices.length > 0 ? (
                    supplierInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono font-bold text-xs">{inv.numeroFactura}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateSafe(inv.fechaEmision)}</TableCell>
                        <TableCell className="text-xs font-semibold">
                          {formatDateSafe(inv.fechaVencimiento)}
                          {inv.diasCredito ? (
                            <span className="text-[10px] text-muted-foreground block">
                              ({inv.diasCredito}d plazo)
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs font-black text-right">${inv.montoTotal.toFixed(2)}</TableCell>
                        <TableCell className="text-xs font-black text-right text-amber-600 dark:text-amber-400">
                          ${inv.saldoPendiente.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={`text-[9px] font-black uppercase border-none px-2 py-0.5 rounded-full ${
                              inv.estado === "PAGADA"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : inv.estado === "ABONADA"
                                ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            {inv.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          {inv.saldoPendiente > 0 && (
                            <Button
                              size="sm"
                              className="h-7 text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 shadow-sm"
                              onClick={() => onOpenPaymentDialog(inv)}
                            >
                              Abonar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-28 text-center text-xs text-muted-foreground font-semibold">
                        No hay facturas registradas para este proveedor.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB PAGOS */}
          <TabsContent value="pagos" className="space-y-3 pt-2">
            <div className="rounded-2xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Factura</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Método</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Banco / Referencia</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right pr-4">Monto Pagado ($)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPayments.length > 0 ? (
                    allPayments.map((p, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-semibold">{formatDateSafe(p.fechaPago)}</TableCell>
                        <TableCell className="font-mono text-xs font-bold text-primary">{p.invoiceNumber}</TableCell>
                        <TableCell className="text-xs uppercase font-bold text-muted-foreground">
                          {p.metodoPago}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-bold block">{p.bancoOrigen || "---"}</span>
                          {p.numeroReferencia && (
                            <span className="font-mono text-[10px] text-muted-foreground">Ref: {p.numeroReferencia}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-4 font-black text-xs text-emerald-600 dark:text-emerald-400">
                          +${p.monto.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center text-xs text-muted-foreground font-semibold">
                        No se registran pagos realizados a este proveedor aún.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-3 border-t border-border">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
