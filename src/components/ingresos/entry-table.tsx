"use client";

import React, { useState, useMemo } from "react";
import { Entry } from "@/types/entry";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Edit3, Trash2, Printer, AlertTriangle, ArrowUp, ArrowDown, ChevronsUpDown, ShieldCheck } from "lucide-react";
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

interface EntryTableProps {
  entries: Entry[];
  onView: (entry: Entry) => void;
  onEdit: (entry: Entry) => void;
  onDelete: (id: string) => void;
  onPrint?: (entry: Entry) => void;
  canEdit?: boolean;
}

export function EntryTable({ entries, onView, onEdit, onDelete, onPrint, canEdit = true }: EntryTableProps) {
  const [sortKey, setSortKey] = useState<string>("entryNumber");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      let valA: any = a[sortKey as keyof Entry] || "";
      let valB: any = b[sortKey as keyof Entry] || "";

      if (sortKey === "entryDate") {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (typeof valA === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB, 'es') : valB.localeCompare(valA, 'es');
      }
      return sortDir === "asc" ? valA - valB : valB - valA;
    });
  }, [entries, sortKey, sortDir]);

  return (
    <div className="rounded-[20px] border border-border bg-card overflow-hidden shadow-premium transition-colors duration-300">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-b border-border hover:bg-transparent">
            <TableHead onClick={() => handleSort("entryNumber")} className="cursor-pointer text-[11px] font-black uppercase tracking-widest text-muted-foreground py-5 pl-8">
              <div className="flex items-center">ID <SortIcon colKey="entryNumber" /></div>
            </TableHead>
            <TableHead onClick={() => handleSort("entryDate")} className="cursor-pointer text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center">Fecha <SortIcon colKey="entryDate" /></div>
            </TableHead>
            <TableHead onClick={() => handleSort("clientName")} className="cursor-pointer text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center">Cliente <SortIcon colKey="clientName" /></div>
            </TableHead>
            <TableHead onClick={() => handleSort("totalGarments")} className="cursor-pointer text-[11px] font-black uppercase tracking-widest text-muted-foreground text-center">
              <div className="flex items-center justify-center">Total <SortIcon colKey="totalGarments" /></div>
            </TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground text-center">
              <div className="flex items-center justify-center">Total Calculado</div>
            </TableHead>
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground text-right pr-8">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedEntries.map((entry) => {
            // Formatear fecha para visualización bonita si es YYYY-MM-DD
            const displayDate = entry.entryDate && entry.entryDate.includes('-')
              ? entry.entryDate.split('-').reverse().join('/')
              : entry.entryDate;

            // Asegurar la obtención del array de lotes bajo cualquier alias idiomático
            const currentLots = entry.lots || (entry as any).lotes || [];

            // Lógica de cálculo en tiempo real blindada y definitiva (Priorizando totalPrendas)
            let totalGarments = 0;
            if ((entry as any).totalPrendas !== undefined && (entry as any).totalPrendas !== null && (entry as any).totalPrendas !== "") {
              totalGarments = Number((entry as any).totalPrendas);
            } else if (Array.isArray(currentLots) && currentLots.length > 0) {
              totalGarments = currentLots.reduce((sum: number, lote: any) => {
                return sum + (Number(lote.cantidad || lote.cantidadConfirmada || lote.quantity || lote.total) || 0);
              }, 0);
            } else {
              totalGarments = Number(entry.totalGarments) || Number((entry as any).total) || Number((entry as any).cantidad) || 0;
            }

            return (
              <TableRow key={entry.id} className="border-b border-border hover:bg-muted/10 transition-all duration-200 group">
                <TableCell className="py-5 pl-8">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-primary tracking-tight">
                      {entry.entryNumber}
                    </span>
                    {(entry as any).reconciledBy && <ShieldCheck className="h-3 w-3 text-emerald-500" title="Reconciliado con Salidas" />}
                  </div>
                </TableCell>

                <TableCell>
                  <span className="text-sm font-bold text-foreground/70">
                    {displayDate}
                  </span>
                </TableCell>

                <TableCell>
                  <div className="font-black text-sm text-foreground uppercase truncate max-w-[200px]">
                    {entry.clientName}
                  </div>
                  <div className="text-[9px] text-muted-foreground uppercase font-bold mt-0.5 tracking-widest">
                    {currentLots.length} Lotes Registrados
                  </div>
                </TableCell>

                <TableCell className="text-center">
                  <span className="text-xl font-black text-foreground tracking-tighter">
                    {(() => {
                      const item = entry as any;
                      // 1. Obtener la suma por campos directos en la raíz
                      const totalCampos = Number(item.totalPrendas) || Number(item.totalGarments) || Number(item.total) || Number(item.cantidad) || 0;

                      // 2. Si da 0, sumamos el array interno de lotes (soportando lotes y lots, y cantidad/cantidadConfirmada/quantity/total)
                      const lotesArr = item.lotes || item.lots || [];
                      const totalLotes = (lotesArr && Array.isArray(lotesArr)) 
                        ? lotesArr.reduce((sum: number, l: any) => sum + (Number(l.cantidad || l.cantidadConfirmada || l.quantity || l.total) || 0), 0) 
                        : 0;

                      return totalCampos > 0 ? totalCampos : totalLotes;
                    })()}
                  </span>
                </TableCell>

                <TableCell className="text-center">
                  <span className="text-xl font-black text-primary tracking-tighter">
                    {(() => {
                      const currentLots = entry.lots || (entry as any).lotes || [];
                      return currentLots.reduce((acc: number, lot: any) => {
                        const garments = lot.garments || lot.prendas || [];
                        if (garments.length > 0) {
                          return acc + garments.reduce((gAcc: number, g: any) => gAcc + (Number(g.quantity || g.cantidad || g.cantidadConfirmada || 0) || 0), 0);
                        }
                        return acc + Number(lot.cantidad || lot.cantidadConfirmada || lot.quantity || lot.total || 0);
                      }, 0);
                    })()}
                  </span>
                </TableCell>

                <TableCell className="text-right pr-8">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                      onClick={() => onView(entry)}
                      title="Ver Detalle"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {canEdit && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded-full"
                          onClick={() => onEdit(entry)}
                          title="Modificar"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 rounded-full"
                          onClick={() => onPrint?.(entry)}
                          title="Imprimir"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full"
                              title="Anular / Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-border rounded-[2.5rem] p-10">
                            <AlertDialogHeader className="items-center text-center">
                              <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="h-8 w-8 text-destructive" />
                              </div>
                              <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight">Anular Ingreso</AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground font-medium">
                                ¿Estás seguro de eliminar el registro <strong>{entry.entryNumber}</strong>? Esta acción retirará todos los lotes asociados del flujo de producción.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-6">
                              <AlertDialogCancel className="rounded-xl font-bold h-12">Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDelete(entry.id)}
                                className="bg-destructive text-white hover:bg-destructive/90 rounded-xl font-bold h-12"
                              >
                                Confirmar Eliminación
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
