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
  onPrint: (invoice: Invoice) => void;
  userRole?: string;
}

const statusMap: any = {
  "Por Cobrar": "bg-amber-100 text-amber-700 border-amber-200",
  "Parcialmente Cobrada": "bg-blue-100 text-blue-700 border-blue-200",
  "Pagada": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "ANULADA": "bg-red-100 text-red-700 border-red-200",
};

export function InvoiceTable({ invoices, onView, onEdit, onDelete, onPrint, userRole }: InvoiceTableProps) {
  const role = (userRole || "").toLowerCase();
  const isAuthorizedToAnular = role === "admin" || role === "administrador" || role === "facturacion";

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
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-3 font-bold text-xs uppercase py-3 rounded-xl cursor-pointer text-destructive focus:bg-destructive/5 focus:text-destructive">
                              <Trash2 className="h-4 w-4" />
                              Anular Factura
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-10">
                            <AlertDialogHeader className="items-center text-center">
                              <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="h-8 w-8 text-red-600" />
                              </div>
                              <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight">Anular Comprobante</AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground font-medium">
                                ¿Confirmas la anulación definitiva de la factura <strong>{inv.numeroFactura}</strong>? Esta acción no se puede deshacer y liberará los lotes asociados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-8 gap-3">
                              <AlertDialogCancel className="flex-1 rounded-xl h-12 font-bold uppercase text-[10px] tracking-widest border-border">Cerrar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => onDelete(inv.id)} 
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-red-600/20"
                              >
                                Anular Definitivamente
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
