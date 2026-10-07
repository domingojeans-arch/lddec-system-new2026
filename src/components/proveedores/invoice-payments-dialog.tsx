"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseInvoice, SupplierPayment } from "@/types/proveedores";
import { CreditCard, Trash2, Calendar, Building2, Receipt, AlertCircle, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface InvoicePaymentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: PurchaseInvoice | null;
  onDeletePayment: (payment: SupplierPayment, invoice: PurchaseInvoice) => Promise<void>;
  canEdit: boolean;
}

export function InvoicePaymentsDialog({
  isOpen,
  onClose,
  invoice,
  onDeletePayment,
  canEdit,
}: InvoicePaymentsDialogProps) {
  if (!invoice) return null;

  const pagos = Array.isArray(invoice.pagos) ? invoice.pagos : [];

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
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <DialogTitle className="text-xl font-black uppercase flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Abonos y Pagos - Factura #{invoice.numeroFactura}
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                Proveedor: <span className="font-bold uppercase text-foreground">{invoice.proveedorNombre}</span>
              </p>
            </div>
            <Badge
              className={`text-[10px] font-black uppercase border-none px-3 py-1 rounded-full w-fit ${
                invoice.estado === "PAGADA"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : invoice.estado === "ABONADA"
                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
              }`}
            >
              {invoice.estado}
            </Badge>
          </div>
        </DialogHeader>

        {/* RESUMEN DE SALDOS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2">
          <div className="p-4 rounded-2xl bg-muted/40 border border-border">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
              Monto Total Factura
            </span>
            <span className="text-xl font-black text-foreground mt-1 block">
              ${(invoice.montoTotal || 0).toFixed(2)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
              Total Abonado / Pagado
            </span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
              ${(invoice.totalAbonado || 0).toFixed(2)}
            </span>
            <span className="text-[10px] font-bold text-emerald-700/80 dark:text-emerald-300/80">
              {pagos.length} pago(s) registrado(s)
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
              Saldo Pendiente
            </span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
              ${(invoice.saldoPendiente || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* LISTADO DE PAGOS */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            Desglose de Abonos Registrados
          </h4>

          <div className="rounded-2xl border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase py-3.5 pl-4">Fecha Pago</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Método</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Banco / Referencia</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Registrado Por</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Monto ($)</TableHead>
                  {canEdit && (
                    <TableHead className="text-[10px] font-black uppercase text-right pr-4">Acción</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.length > 0 ? (
                  pagos.map((p, idx) => (
                    <TableRow key={p.id || idx} className="hover:bg-muted/30">
                      <TableCell className="pl-4 text-xs font-bold text-muted-foreground whitespace-nowrap">
                        {formatDateSafe(p.fechaPago)}
                      </TableCell>
                      <TableCell className="text-xs uppercase font-bold text-muted-foreground whitespace-nowrap">
                        {p.metodoPago}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-bold block">{p.bancoOrigen || "---"}</span>
                        {p.numeroReferencia && (
                          <span className="font-mono text-[10px] text-muted-foreground block">
                            Ref: {p.numeroReferencia}
                          </span>
                        )}
                        {p.notas && (
                          <span className="text-[10px] text-muted-foreground italic block">
                            "{p.notas}"
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {p.registradoPor || "Sistema"}
                      </TableCell>
                      <TableCell className="text-right font-black text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        +${Number(p.monto || 0).toFixed(2)}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right pr-4 whitespace-nowrap">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                            title="Eliminar este abono y restablecer saldo"
                            onClick={() => onDeletePayment(p, invoice)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 6 : 5} className="h-28 text-center text-xs text-muted-foreground font-semibold">
                      Esta factura no tiene abonos ni pagos registrados aún.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
