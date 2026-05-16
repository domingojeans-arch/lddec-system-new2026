
"use client";

import React from "react";
import { Entry } from "@/types/entry";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Calendar, 
  User, 
  Shirt, 
  Layers, 
  Info,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface EntryDetailProps {
  entry: Entry;
}

const lotStatusMap = {
  pending: { label: "Pendiente", color: "bg-zinc-500/10 text-zinc-600", icon: Clock },
  in_process: { label: "En Proceso", color: "bg-amber-500/10 text-amber-600", icon: AlertCircle },
  ready: { label: "Listo / OK", color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle2 },
};

/**
 * MOTOR DE RESOLUCIÓN DE IDENTIDAD PARA LOTES (LDDEC 1.1)
 * Prioridad expandida para todas las generaciones de datos
 */
function getVisibleLotNumber(lot: any): string {
  if (!lot) return "S/L";
  const candidates = [
    lot.lotNumber,
    lot.numeroLote,
    lot.loteId,
    lot.lote,
    lot.loteNumero,
    lot.numLote,
    lot.id
  ];

  for (const val of candidates) {
    const s = String(val ?? "").trim();
    if (s && s.length < 25 && s !== "[object Object]" && s.toLowerCase() !== "undefined") {
      return s.toUpperCase();
    }
  }
  return "S/L";
}

export function EntryDetail({ entry }: EntryDetailProps) {
  // Asegurar que entry.lots siempre tenga datos, buscando en posibles alias de campo
  const currentLots = entry.lots || (entry as any).lotes || [];
  
  const totalGarmentsCalculated = currentLots.reduce((acc: number, lot: any) => {
    const garments = lot.garments || lot.prendas || [];
    if (garments.length > 0) {
      return acc + garments.reduce((gAcc: number, g: any) => gAcc + (Number(g.quantity) || 0), 0);
    }
    return acc + Number(lot.cantidadConfirmada || lot.quantity || lot.cantidad || 0);
  }, 0);

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      
      {/* BLOQUE 1: INFORMACIÓN GENERAL DEL INGRESO */}
      <div className="bg-muted/20 p-8 rounded-[2rem] border border-border space-y-6">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2">
          <Info className="h-4 w-4" />
          Información General del Ingreso
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">N° Ingreso</p>
            <p className="font-black text-xl text-foreground tracking-tight">{entry.entryNumber}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Fecha de Ingreso</p>
            <div className="flex items-center gap-2 font-bold text-foreground">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {entry.entryDate}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Estado Maestro</p>
            <Badge variant="outline" className="bg-primary/5 text-primary border-none font-black uppercase text-[10px] px-3">
              {entry.isSample ? "MUESTRA TÉCNICA" : "PRODUCCIÓN"}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Cliente</p>
            <div className="flex items-center gap-2 font-bold text-foreground uppercase truncate">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {entry.clientName}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Lotes</p>
            <div className="flex items-center gap-2 font-black text-primary">
              <Layers className="h-4 w-4" />
              {currentLots.length}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Responsable</p>
            <div className="flex items-center gap-2 font-bold text-foreground">
              <User className="h-4 w-4 text-muted-foreground" />
              {entry.responsible}
            </div>
          </div>
          <div className="space-y-1 lg:col-span-2">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Total Prendas Ingresadas</p>
            <div className="flex items-center gap-2 font-black text-3xl text-primary tracking-tighter">
              <Shirt className="h-7 w-7" />
              {totalGarmentsCalculated}
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE 2: DETALLES DE LOTES */}
      <div className="space-y-6">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2 px-2">
          <Layers className="h-4 w-4" />
          Detalles de Lotes
        </h3>

        <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="text-[10px] font-black uppercase py-4 pl-8">Lote ID</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Prenda (Cantidad)</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center">Total Lote</TableHead>
                <TableHead className="text-[10px) font-black uppercase">Proceso</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Estado</TableHead>
                <TableHead className="text-[10px] font-black uppercase pr-8">Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentLots.map((lot: any, lIdx: number) => {
                const garments = lot.garments || lot.prendas || [];
                const totalLotQty = garments.reduce((acc: number, g: any) => acc + (Number(g.quantity) || 0), 0) || Number(lot.cantidadConfirmada || lot.quantity || 0);
                const garmentsSummary = garments.map((g: any) => `${g.garmentType || g.tipo} (${g.quantity})`).join(", ");
                const statusKey = (lot.productionStatus || lot.status || "pending").toLowerCase();
                const status = lotStatusMap[statusKey as keyof typeof lotStatusMap] || lotStatusMap.pending;
                const StatusIcon = status.icon;
                const lotIdVisible = getVisibleLotNumber(lot);

                return (
                  <TableRow key={lot.id || lIdx} className="border-border hover:bg-muted/5 transition-colors">
                    <TableCell className="pl-8 py-5">
                      <span className="font-black text-foreground">{lotIdVisible}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-muted-foreground uppercase block max-w-[250px] truncate" title={garmentsSummary}>
                        {garmentsSummary || (lot.garmentType || lot.prendas?.[0]?.tipo || "VARIOS")}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-black text-primary text-base">{totalLotQty}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] font-bold text-foreground uppercase bg-muted/30 px-2 py-1 rounded-md">
                        {lot.process || lot.proceso || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] font-black uppercase border-none px-2.5 py-0.5 rounded-full ${status.color}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-8">
                      <div className="flex items-start gap-1.5 text-muted-foreground text-[10px] italic">
                        {lot.notes ? (
                          <>
                            <FileText className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[150px]">{lot.notes}</span>
                          </>
                        ) : "-"}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {currentLots.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center p-10 opacity-30">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Sin lotes detectados en este registro</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {entry.notes && (
        <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Observaciones Generales</p>
          <p className="text-sm text-foreground/80 font-medium italic">{entry.notes}</p>
        </div>
      )}
    </div>
  );
}
