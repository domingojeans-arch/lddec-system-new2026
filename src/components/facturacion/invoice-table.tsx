"use client";

import React from "react";
import { Invoice } from "@/types/invoice";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, Eye, Printer, Trash2, AlertTriangle, MoreVertical, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface InvoiceTableProps {
  invoices: Invoice[];
  onView: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onDeleteFully?: (invoice: Invoice) => void;
  onPrint: (invoice: Invoice) => void;
  userRole?: string;
}

const statusMap: any = {
  "Por Cobrar": "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
  "Parcialmente Cobrada": "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50",
  "Pagada": "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
  "ANULADA": "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50",
};

export function InvoiceTable({ invoices, onView, onEdit, onDelete, onDeleteFully, onPrint, userRole }: InvoiceTableProps) {
  const role = (userRole || "").toLowerCase();
  const isAuthorizedToAnular = role === "admin" || role === "administrador" || role === "facturacion";

  const [invoiceToAnular, setInvoiceToAnular] = React.useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = React.useState<Invoice | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(val || 0);
  };

  const getNombreClienteFactura = (item: any) => {
    if (typeof item?.clienteNombre === "string" && item.clienteNombre.trim()) {
      return item.clienteNombre;
    }
    if (typeof item?.cliente === "string" && item.cliente.trim()) {
      return item.cliente;
    }
    if (typeof item?.clientName === "string" && item.clientName.trim()) {
      return item.clientName;
    }
    return "S/D";
  };

  return (
    <div className="rounded-xl overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="border-b border-border hover:bg-transparent">
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground py-6 pl-8">N° Factura</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Fecha</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Cliente</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground text-right">Subtotal</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground text-right">IVA</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground text-right">Total</TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-center">Estado Cobro</TableHead>
            <TableHead className="text-right pr-8 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id} className="group hover:bg-muted/5 transition-all border-b border-border last:border-0">
              <TableCell className="py-6 pl-8">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Receipt className="h-4.5 w-4.5" />
                  </div>
                  <span className="font-black text-sm tracking-tight">{inv.numeroFactura}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-xs font-bold text-muted-foreground">{(inv as any).displayDate}</span>
              </TableCell>
              <TableCell>
                <div className="font-bold text-[13px] text-foreground uppercase truncate max-w-[250px]">
                  {getNombreClienteFactura(inv)}
                </div>
                {inv.ingresoMaestroId && (
                  <div className="text-[9px] font-bold text-primary/60 uppercase tracking-tighter mt-0.5">Ref: {inv.ingresoMaestroId}</div>
                )}
              </TableCell>
              <TableCell className="text-right">
                <span className="text-xs font-bold text-muted-foreground">{formatCurrency(inv.subtotal)}</span>
              </TableCell>
              <TableCell className="text-right">
                <span className="text-xs font-bold text-muted-foreground">{formatCurrency(inv.iva)}</span>
              </TableCell>
              <TableCell className="text-right">
                <span className="text-sm font-black text-foreground">{formatCurrency(inv.totalFactura)}</span>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className={cn(
                  "text-[9px] px-4 py-1.5 rounded-full font-black uppercase tracking-widest border shadow-sm", 
                  statusMap[inv.estadoCobranza] || "bg-muted text-muted-foreground"
                )}>
                  {inv.estadoCobranza}
                </Badge>
              </TableCell>
              <TableCell className="text-right pr-8">
                <div className="flex items-center justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full transition-all" 
                    onClick={() => onView(inv)}
                  >
                    <Eye className="h-5 w-5" />
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:bg-muted rounded-full">
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 p-2 rounded-2xl shadow-premium-lg border-border">
                      <DropdownMenuItem className="gap-3 font-bold text-xs uppercase py-3 rounded-xl cursor-pointer" onClick={() => onEdit(inv)}>
                        <Edit3 className="h-4 w-4 text-amber-600" />
                        Editar Factura
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-3 font-bold text-xs uppercase py-3 rounded-xl cursor-pointer" onClick={() => onPrint(inv)}>
                        <Printer className="h-4 w-4 text-emerald-600" />
                        Imprimir
                      </DropdownMenuItem>
                      {isAuthorizedToAnular && inv.estadoCobranza !== "ANULADA" && (
                        <DropdownMenuItem 
                          className="gap-3 font-bold text-xs uppercase py-3 rounded-xl cursor-pointer text-destructive focus:bg-destructive/5 focus:text-destructive"
                          onClick={() => setInvoiceToAnular(inv)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Anular Factura
                        </DropdownMenuItem>
                      )}
                      
                      {isAuthorizedToAnular && inv.estadoCobranza === "ANULADA" && onDeleteFully && (
                        <DropdownMenuItem 
                          className="gap-3 font-bold text-xs uppercase py-3 rounded-xl cursor-pointer text-destructive focus:bg-destructive/5 focus:text-destructive"
                          onClick={() => setInvoiceToDelete(inv)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar Factura
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {/* Dialog para Anular */}
      <AlertDialog open={!!invoiceToAnular} onOpenChange={(open) => !open && setInvoiceToAnular(null)}>
        <AlertDialogContent className="rounded-[2rem] border-border shadow-premium-xl max-w-md bg-card text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-xl tracking-tight uppercase">¿Anular factura?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium text-sm">
              Esta acción es irreversible. La factura quedará registrada como anulada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3">
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-xs h-12">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl font-black uppercase tracking-widest text-xs h-12"
              onClick={() => {
                if (invoiceToAnular) {
                  onDelete(invoiceToAnular.id);
                  setInvoiceToAnular(null);
                }
              }}
            >
              Anular Factura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para Eliminar */}
      <AlertDialog open={!!invoiceToDelete} onOpenChange={(open) => !open && setInvoiceToDelete(null)}>
        <AlertDialogContent className="rounded-[2rem] border-border shadow-premium-xl max-w-md bg-card text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-xl tracking-tight uppercase text-destructive">¿Eliminar Definitivamente?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium text-sm">
              ¿Está seguro de eliminar definitivamente esta factura? Esta acción borrará el registro de la base de datos y liberará el ingreso asociado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3">
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-xs h-12">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl font-black uppercase tracking-widest text-xs h-12"
              onClick={() => {
                if (invoiceToDelete && onDeleteFully) {
                  onDeleteFully(invoiceToDelete);
                  setInvoiceToDelete(null);
                }
              }}
            >
              Eliminar Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
