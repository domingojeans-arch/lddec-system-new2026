"use client";

import React from "react";
import { Chemical } from "@/types/chemical";
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
import { Beaker, Building2, Eye, Edit3, Scale, Trash2, AlertTriangle } from "lucide-react";
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

interface ChemicalTableProps {
  chemicals: Chemical[];
  onView: (chemical: Chemical) => void;
  onEdit: (chemical: Chemical) => void;
  onDelete: (id: string) => void;
}

const statusMap = {
  active: { label: "Activo", color: "bg-emerald-500/10 text-emerald-600" },
  low_stock: { label: "Bajo Stock", color: "bg-amber-500/10 text-amber-600" },
  empty: { label: "Agotado", color: "bg-destructive/10 text-destructive" },
};

export function ChemicalTable({ chemicals, onView, onEdit, onDelete }: ChemicalTableProps) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-b border-border">
            <TableHead className="py-5 pl-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">Nombre Insumo / Proveedor</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-right text-muted-foreground">Costo Unit.</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-center text-muted-foreground">Peso Neto</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-right text-muted-foreground">Stock Actual</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Estado</TableHead>
            <TableHead className="text-right pr-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {chemicals.map((chemical) => (
            <TableRow key={chemical.id} className="group hover:bg-muted/10 transition-all duration-200 border-b border-border">
              <TableCell className="py-5 pl-8">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-indigo-500/5 flex items-center justify-center shrink-0 border border-indigo-500/10">
                    <Beaker className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="font-bold text-base text-foreground group-hover:text-indigo-600 transition-colors">
                      {chemical.chemicalName}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                        {chemical.supplier}
                      </span>
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="font-bold text-foreground">
                  ${chemical.unitCost.toFixed(2)}/kg
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1.5 font-bold text-primary">
                  <Scale className="h-3.5 w-3.5" />
                  {chemical.netWeight} kg
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className={`font-black ${chemical.currentStockKg < chemical.netWeight * 0.2 ? "text-amber-600" : "text-emerald-600"}`}>
                  {chemical.currentStockKg.toFixed(2)} kg
                </div>
              </TableCell>
              <TableCell>
                <Badge 
                  variant="outline"
                  className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-[0.1em] border-none ${statusMap[chemical.status].color}`}
                >
                  {statusMap[chemical.status].label}
                </Badge>
              </TableCell>
              <TableCell className="text-right pr-8">
                <div className="flex items-center justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/5"
                    onClick={() => onView(chemical)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/5"
                    onClick={() => onEdit(chemical)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-border rounded-[2rem]">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Retirar Insumo
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          ¿Confirmas la eliminación de <strong>{chemical.chemicalName}</strong> del inventario industrial? Esta acción borrará el stock y costos asociados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => onDelete(chemical.id)}
                          className="bg-destructive text-white hover:bg-destructive/90 rounded-xl font-bold"
                        >
                          Eliminar Insumo
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
