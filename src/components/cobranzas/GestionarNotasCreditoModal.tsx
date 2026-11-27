"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, FileMinus, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface GestionarNotasCreditoModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditNotes: any[];
  onDelete: (item: any) => Promise<void>;
  clientName: string;
  isReadOnly?: boolean;
}

export function GestionarNotasCreditoModal({
  isOpen,
  onClose,
  creditNotes,
  onDelete,
  clientName,
  isReadOnly = false
}: GestionarNotasCreditoModalProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (item: any) => {
    setDeletingId(item.id);
    try {
      await onDelete(item);
    } finally {
      setDeletingId(null);
    }
  };

  const totalMonto = creditNotes.reduce((sum, n) => sum + Number(n.monto || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl rounded-[2.5rem] p-0 overflow-hidden border-border bg-card shadow-2xl">
        <DialogHeader className="p-8 border-b border-border bg-purple-500/5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20">
                <FileMinus className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground">
                  Notas de Crédito Registradas
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-widest mt-0.5">
                  Socio: {clientName || "Seleccionado"}
                </DialogDescription>
              </div>
            </div>
            {creditNotes.length > 0 && (
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                  Total en Notas de Crédito
                </span>
                <span className="text-2xl font-black text-purple-700 dark:text-purple-400 tracking-tight">
                  ${totalMonto.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
          {creditNotes.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-border rounded-2xl space-y-3">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                No hay notas de crédito registradas para este socio
              </p>
              <p className="text-[11px] text-muted-foreground/80 max-w-sm mx-auto">
                Puedes crear una nueva usando el botón "Nueva Nota de Crédito".
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="pl-6">Documento / N°</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Origen / Factura</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Monto ($)</TableHead>
                    <TableHead className="text-center pr-6 w-24">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditNotes.map((item) => {
                    const fechaStr = item.fecha instanceof Date 
                      ? item.fecha.toLocaleDateString("es-EC") 
                      : (item.fecha ? String(item.fecha) : "S/F");
                    const isDeleting = deletingId === item.id;

                    return (
                      <TableRow key={item.id} className="border-b border-border/60 hover:bg-muted/20">
                        <TableCell className="font-black text-xs uppercase text-purple-700 dark:text-purple-300 pl-6">
                          {item.numero || "NOTA DE CRÉDITO"}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{fechaStr}</TableCell>
                        <TableCell className="text-xs">
                          {item.facturaId && item.facturaId !== "SIN_FACTURA" ? (
                            <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 text-[9px] font-bold">
                              {item.numeroFactura ? `Factura ${item.numeroFactura}` : "Factura"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-purple-300 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 text-[9px] font-bold">
                              Sin Factura (Abono Directo)
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {item.descripcion || "Ajuste / Nota de Crédito"}
                        </TableCell>
                        <TableCell className="text-right font-black text-sm text-purple-600 dark:text-purple-400">
                          ${Number(item.monto || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center pr-6">
                          {!isReadOnly && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => handleDelete(item)}
                              className="h-8 px-2.5 text-red-600 hover:text-white hover:bg-red-600 rounded-lg text-xs font-bold gap-1.5 transition-colors"
                              title="Eliminar esta Nota de Crédito"
                            >
                              {isDeleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Eliminar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t border-border bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl h-11 font-bold uppercase text-xs px-8"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
