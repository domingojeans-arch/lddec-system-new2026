"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Truck, 
  AlertTriangle, 
  Clock, 
  Search, 
  RefreshCw, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Layers, 
  Shirt, 
  FileText,
  Calendar as CalendarIcon,
  User,
  ExternalLink,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { Invoice } from "@/types/invoice";

export interface IncompleteEntryLot {
  lotNumber: string;
  garment: string;
  original: number;
  dispatched: number;
  missing: number;
  status: "completo" | "parcial" | "sin_despacho";
}

export interface IncompleteEntryItem {
  id: string;
  entryNumber: string;
  clientName: string;
  clientId: string;
  entryDate: Date;
  dateFormatted: string;
  daysElapsed: number;
  isOver30Days: boolean;
  totalIngresado: number;
  totalDespachado: number;
  faltanteTotal: number;
  percentDispatched: number;
  isSample: boolean;
  lots: IncompleteEntryLot[];
  guides: string[];
  totalLots: number;
  completedLots: number;
  pendingLots: number;
  zeroDispatchLots: number;
}

interface IncompleteDispatchesTabProps {
  invoices: Invoice[];
}

function getVisibleLotName(lote: any): string {
  if (!lote) return "S/L";
  const candidates = [
    lote.lotNumber,
    lote.numeroLote,
    lote.entryLotNumber,
    lote.lote,
    lote.loteId,
    lote.loteNumero,
    lote.numLote,
    lote.idLote,
    lote.id
  ];
  for (const val of candidates) {
    if (val && String(val).trim() && String(val).length < 25 && String(val) !== "[object Object]") {
      return String(val).trim().toUpperCase();
    }
  }
  return "S/L";
}

function getDispatchedQty(item: any): number {
  if (Array.isArray(item.prendas) && item.prendas.length > 0) {
    return item.prendas.reduce((acc: number, p: any) => acc + Number(p.quantityToDispatch || p.quantity || 0), 0);
  }
  return Number(
    item.quantityToDispatch ?? 
    item.quantityDispatched ?? 
    item.cantidad ?? 
    item.quantity ?? 
    item.originalEntryQuantity ?? 
    0
  );
}

function parseEntryDate(raw: any): Date {
  if (!raw) return new Date();
  if (raw.toDate) return raw.toDate();
  if (typeof raw === "string") {
    const d = new Date(raw.includes("T") ? raw : `${raw}T00:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof raw === "number") return new Date(raw);
  return new Date();
}

export function IncompleteDispatchesTab({ invoices }: IncompleteDispatchesTabProps) {
  const [loading, setLoading] = useState(true);
  const [incompleteEntries, setIncompleteEntries] = useState<IncompleteEntryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "criticos" | "zero_lots">("all");
  const [selectedEntry, setSelectedEntry] = useState<IncompleteEntryItem | null>(null);

  // Mapear facturas ya existentes para descartar ingresos ya facturados
  const billedEntryRefs = useMemo(() => {
    const set = new Set<string>();
    (invoices || []).forEach((invoice: any) => {
      const invState = String(invoice.estadoCobranza || invoice.estado || "").toUpperCase();
      if (invState === "ANULADA") return;

      const refs = [
        invoice.ingresoMaestroId,
        invoice.numeroIngreso,
        invoice.entryNumber,
        invoice.referencia,
        invoice.ref,
        invoice.ingresoId,
        ...(Array.isArray(invoice.ingresoMaestroIds) ? invoice.ingresoMaestroIds : []),
        ...(Array.isArray(invoice.ingresos) ? invoice.ingresos.map((i: any) => typeof i === "string" ? i : (i.id || i.entryNumber || i.ingresoId)) : [])
      ];
      refs.forEach(r => {
        if (r) set.add(String(r).trim().toUpperCase());
      });
    });
    return set;
  }, [invoices]);

  const loadData = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      // Consultamos ingresos y salidas para análisis cruzado en memoria
      const [entriesSnap, outsSnap, salsSnap] = await Promise.all([
        getDocs(collection(db, "entries")),
        getDocs(collection(db, "outputs")),
        getDocs(collection(db, "salidas")),
      ]);

      const allOutputDocs = [...outsSnap.docs, ...salsSnap.docs].map(d => ({
        id: d.id,
        ...d.data()
      }));

      // Extraer todas las líneas de salida normalizadas para búsqueda O(1)
      const normalizedOutputs: Array<{
        guideNumber: string;
        parentRef: string;
        lotName: string;
        quantity: number;
      }> = [];

      allOutputDocs.forEach((out: any) => {
        const guideNumber = String(
          out.numeroSalida || 
          out.numeroGuia || 
          out.outputNumber || 
          out.id || 
          "S/N"
        ).toUpperCase();

        const items = Array.isArray(out.itemsDispatched) 
          ? out.itemsDispatched 
          : (Array.isArray(out.lotes) 
            ? out.lotes 
            : (Array.isArray(out.lines) ? out.lines : []));

        items.forEach((item: any) => {
          const parentRef = String(
            item.parentIngresoMaestro || 
            item.parentIngreso || 
            item.entryNumber || 
            item.numeroIngreso || 
            item.entryId ||
            out.parentIngresoMaestro || 
            out.entryNumber || 
            out.numeroIngreso || 
            out.referencia || 
            out.ref || 
            ""
          ).trim().toUpperCase();

          const lotName = getVisibleLotName(item);
          const qty = getDispatchedQty(item);

          normalizedOutputs.push({
            guideNumber,
            parentRef,
            lotName,
            quantity: qty
          });
        });
      });

      const results: IncompleteEntryItem[] = [];
      const now = new Date();

      entriesSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const entryId = docSnap.id.trim().toUpperCase();
        const entryNumber = String(data.entryNumber || data.numeroIngreso || docSnap.id).trim().toUpperCase();

        // 0. EXCLUIR MUESTRAS: solo deben estar los ingresos normales
        const isSample = 
          Boolean(data.isSample) || 
          entryNumber.startsWith("MUEST") || 
          entryId.startsWith("MUEST") ||
          String(data.tipo_ingreso || data.tipoIngreso || "").toUpperCase().includes("MUEST") ||
          String(data.tipo || "").toUpperCase().includes("MUEST");

        if (isSample) return;

        // 1. Excluir si ya fue facturado o está cerrado administrativamente
        const isBilled = 
          billedEntryRefs.has(entryId) || 
          billedEntryRefs.has(entryNumber) || 
          String(data.estadoFacturacion || "").toUpperCase() === "FACTURADO" ||
          (data.numeroFactura && data.numeroFactura !== "-");

        const isClosedUnbilled = 
          data.status === "closed_unbilled" || 
          String(data.estadoFacturacion || "").toUpperCase() === "CERRADA SIN FACTURAR" || 
          data.isClosedUnbilled === true;

        if (isBilled || isClosedUnbilled) return;

        // 2. Procesar lotes del ingreso
        const rawLots = Array.isArray(data.lotes) ? data.lotes : (Array.isArray(data.lots) ? data.lots : []);
        if (rawLots.length === 0) return;

        let totalIngresado = 0;
        let totalDespachado = 0;
        const guidesSet = new Set<string>();
        const lotsBreakdown: IncompleteEntryLot[] = [];

        rawLots.forEach((lot: any) => {
          const lid = getVisibleLotName(lot);
          const garments = lot.garments || lot.prendas || [];
          let original = 0;
          if (garments.length > 0) {
            original = garments.reduce((acc: number, g: any) => acc + Number(g.quantity || g.cantidad || 0), 0);
          } else {
            original = Number(lot.cantidadConfirmada || lot.quantity || lot.cantidad || 0);
          }
          totalIngresado += original;

          // Buscar despachos correspondientes a este lote
          let dispatchedLot = 0;
          normalizedOutputs.forEach(outItem => {
            const matchesParent = 
              outItem.parentRef === entryId || 
              outItem.parentRef === entryNumber || 
              outItem.parentRef === lid;

            if (matchesParent && (outItem.lotName === lid || (rawLots.length === 1 && outItem.lotName === "S/L"))) {
              dispatchedLot += outItem.quantity;
              if (outItem.guideNumber && outItem.guideNumber !== "S/N") {
                guidesSet.add(outItem.guideNumber);
              }
            }
          });

          totalDespachado += dispatchedLot;
          const missing = Math.max(0, original - dispatchedLot);

          let lotStatus: "completo" | "parcial" | "sin_despacho" = "completo";
          if (dispatchedLot === 0) {
            lotStatus = "sin_despacho";
          } else if (dispatchedLot < original) {
            lotStatus = "parcial";
          }

          let garmentName = lot.garmentType || lot.prenda || "Prendas";
          if (garments.length > 0 && garments[0]?.garmentType) {
            garmentName = garments.map((g: any) => `${g.garmentType} (${g.quantity})`).join(", ");
          }

          lotsBreakdown.push({
            lotNumber: lid,
            garment: garmentName,
            original,
            dispatched: dispatchedLot,
            missing,
            status: lotStatus
          });
        });

        const faltanteTotal = Math.max(0, totalIngresado - totalDespachado);

        // CONDICIÓN REQUERIDA POR EL USUARIO:
        // Tolerancia de hasta 5 prendas:
        // "si faltan mas de 5 prendas ese despacho debe estar ahi si estan menos debe seguir normalmente. y cuando se complete la salida debe desaparecer de ahi porque esta completo"
        const hasOutputs = totalDespachado > 0;
        const exceedsTolerance = faltanteTotal > 5;
        const hasZeroLot = lotsBreakdown.some(l => l.status === "sin_despacho" && l.original > 0);
        const isNotFullyDispatched = exceedsTolerance || hasZeroLot;

        if (hasOutputs && isNotFullyDispatched) {
          const entryDate = parseEntryDate(data.date || data.entryDate || data.fecha || data.createdAt);
          const diffMs = now.getTime() - entryDate.getTime();
          const daysElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          const isOver30Days = daysElapsed >= 30;

          const percentDispatched = totalIngresado > 0 ? Math.min(100, Math.round((totalDespachado / totalIngresado) * 100)) : 0;
          const completedLots = lotsBreakdown.filter(l => l.status === "completo").length;
          const zeroDispatchLots = lotsBreakdown.filter(l => l.status === "sin_despacho").length;
          const pendingLots = lotsBreakdown.length - completedLots;

          results.push({
            id: docSnap.id,
            entryNumber,
            clientName: (data.clientName || data.clienteNombre || data.cliente || "Socio").toUpperCase(),
            clientId: data.clientId || data.clienteId || "",
            entryDate,
            dateFormatted: entryDate.toLocaleDateString("es-EC"),
            daysElapsed,
            isOver30Days,
            totalIngresado,
            totalDespachado,
            faltanteTotal,
            percentDispatched,
            isSample: !!data.isSample || entryNumber.startsWith("MUEST"),
            lots: lotsBreakdown,
            guides: Array.from(guidesSet),
            totalLots: lotsBreakdown.length,
            completedLots,
            pendingLots,
            zeroDispatchLots,
          });
        }
      });

      // Ordenar: primero los críticos (> 30 días), luego por más días transcurridos
      results.sort((a, b) => {
        if (a.isOver30Days && !b.isOver30Days) return -1;
        if (!a.isOver30Days && b.isOver30Days) return 1;
        return b.daysElapsed - a.daysElapsed;
      });

      setIncompleteEntries(results);
    } catch (error) {
      console.error("Error al cargar despachos incompletos:", error);
    } finally {
      setLoading(false);
    }
  }, [billedEntryRefs]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Métricas de resumen superior
  const metrics = useMemo(() => {
    const totalEntries = incompleteEntries.length;
    const over30Count = incompleteEntries.filter(e => e.isOver30Days).length;
    const totalDespachadoRetenido = incompleteEntries.reduce((sum, e) => sum + e.totalDespachado, 0);
    const totalPrendasFaltantes = incompleteEntries.reduce((sum, e) => sum + e.faltanteTotal, 0);
    const zeroLotsCount = incompleteEntries.filter(e => e.zeroDispatchLots > 0).length;

    return {
      totalEntries,
      over30Count,
      totalDespachadoRetenido,
      totalPrendasFaltantes,
      zeroLotsCount
    };
  }, [incompleteEntries]);

  // Filtrado de la tabla
  const filteredList = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return incompleteEntries.filter(item => {
      const matchesSearch = 
        !q ||
        item.entryNumber.toLowerCase().includes(q) ||
        item.clientName.toLowerCase().includes(q) ||
        item.guides.some(g => g.toLowerCase().includes(q)) ||
        item.lots.some(l => l.lotNumber.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (filterMode === "criticos") return item.isOver30Days;
      if (filterMode === "zero_lots") return item.zeroDispatchLots > 0;
      return true;
    });
  }, [incompleteEntries, searchTerm, filterMode]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* TARJETAS DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 rounded-[2rem] border border-border bg-card shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Despachos Incompletos
            </span>
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">{metrics.totalEntries}</span>
            <span className="text-xs font-bold text-muted-foreground">Ingresos</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Ingresos normales con salidas pero retenidos por lotes faltantes.
          </p>
        </Card>

        <Card className={cn(
          "p-6 rounded-[2rem] border bg-card shadow-sm space-y-2 transition-all",
          metrics.over30Count > 0 
            ? "border-red-500/50 bg-red-500/5 dark:bg-red-950/20" 
            : "border-border"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">
              Alerta Crítica (&gt; 30 Días)
            </span>
            <div className="h-8 w-8 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600 animate-pulse">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-red-600 dark:text-red-400">
              {metrics.over30Count}
            </span>
            <span className="text-xs font-bold text-red-600/70">Ingresos Retenidos</span>
          </div>
          <p className="text-[11px] text-red-700/80 dark:text-red-300/80 font-medium">
            Superan los 30 días sin completarse para facturar.
          </p>
        </Card>

        <Card className="p-6 rounded-[2rem] border border-border bg-card shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Prendas Retenidas
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">
              {metrics.totalDespachadoRetenido.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-muted-foreground">Prendas fuera</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Prendas ya despachadas físicamente sin poder cobrar aún.
          </p>
        </Card>

        <Card className="p-6 rounded-[2rem] border border-border bg-card shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Prendas Faltantes
            </span>
            <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center text-foreground">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {metrics.totalPrendasFaltantes.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-muted-foreground">Pendientes</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Saldo de prendas pendientes por entregar para cerrar el ingreso.
          </p>
        </Card>
      </div>

      {/* CONTROLES DE BÚSQUEDA Y FILTRADO */}
      <div className="bg-card p-5 rounded-[2rem] border border-border shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por ingreso, socio, lote o guía..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 erp-input h-11 text-xs font-bold"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border w-full sm:w-auto justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilterMode("all")}
              className={cn(
                "h-9 px-3.5 text-xs font-bold rounded-lg transition-all",
                filterMode === "all" ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Todos ({metrics.totalEntries})
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilterMode("criticos")}
              className={cn(
                "h-9 px-3.5 text-xs font-bold rounded-lg transition-all gap-1.5",
                filterMode === "criticos" ? "bg-red-600 text-white shadow" : "text-red-600 hover:text-red-700"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              &gt; 30 Días ({metrics.over30Count})
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilterMode("zero_lots")}
              className={cn(
                "h-9 px-3.5 text-xs font-bold rounded-lg transition-all",
                filterMode === "zero_lots" ? "bg-amber-600 text-white shadow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Con Lotes 0% ({metrics.zeroLotsCount})
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="h-11 px-5 rounded-xl text-xs font-bold uppercase tracking-wider gap-2 bg-muted/20 border-border"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* TABLA DE RESULTADOS */}
      <Card className="rounded-[2.5rem] border border-border shadow-premium overflow-hidden bg-card">
        {loading ? (
          <div className="h-72 flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="h-10 w-10 animate-spin text-primary/40" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Analizando ingresos y cruce de salidas en memoria...
            </p>
          </div>
        ) : filteredList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="py-4 pl-6">Ingreso Maestro</th>
                  <th className="py-4 px-4">Cliente / Socio</th>
                  <th className="py-4 px-4">Fecha / Antigüedad</th>
                  <th className="py-4 px-4">Avance de Despacho</th>
                  <th className="py-4 px-4">Lotes Afectados</th>
                  <th className="py-4 px-4">Guías Emitidas</th>
                  <th className="py-4 pr-6 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {filteredList.map(item => (
                  <tr 
                    key={item.id}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      item.isOver30Days && "bg-red-500/5 hover:bg-red-500/10"
                    )}
                  >
                    {/* INGRESO MAESTRO */}
                    <td className="py-4 pl-6 font-bold">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-foreground tracking-tight">
                          {item.entryNumber}
                        </span>
                      </div>
                    </td>

                    {/* CLIENTE */}
                    <td className="py-4 px-4 font-black text-foreground">
                      {item.clientName}
                    </td>

                    {/* FECHA Y ALERTA DE DÍAS */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {item.dateFormatted}
                        </div>
                        {item.isOver30Days ? (
                          <Badge className="bg-red-600 hover:bg-red-700 text-white font-black text-[9px] uppercase tracking-wider px-2 py-0.5 border-none gap-1 animate-pulse">
                            <AlertTriangle className="h-3 w-3" />
                            Alerta: {item.daysElapsed} días sin cerrar
                          </Badge>
                        ) : (
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {item.daysElapsed} días transcurridos
                          </span>
                        )}
                      </div>
                    </td>

                    {/* AVANCE DE DESPACHO */}
                    <td className="py-4 px-4 min-w-[200px]">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-foreground">
                            {item.totalDespachado} / {item.totalIngresado} prendas
                          </span>
                          <span className="font-black text-primary">{item.percentDispatched}%</span>
                        </div>
                        <Progress value={item.percentDispatched} className="h-2 bg-muted rounded-full" />
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            Salieron: {item.totalDespachado}
                          </span>
                          <span className="text-red-600 dark:text-red-400 font-black">
                            Faltan: {item.faltanteTotal}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* LOTES AFECTADOS */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-foreground">
                          {item.completedLots} de {item.totalLots} lotes cerrados
                        </div>
                        <div className="flex items-center gap-1.5">
                          {item.zeroDispatchLots > 0 && (
                            <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 text-[9px] font-bold px-1.5 py-0.2">
                              {item.zeroDispatchLots} sin salida
                            </Badge>
                          )}
                          {item.pendingLots - item.zeroDispatchLots > 0 && (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[9px] font-bold px-1.5 py-0.2">
                              {item.pendingLots - item.zeroDispatchLots} parciales
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* GUÍAS EMITIDAS */}
                    <td className="py-4 px-4">
                      {item.guides.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {item.guides.map((g, idx) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className="bg-background text-foreground font-bold text-[10px] px-2 py-0.5 border-border"
                            >
                              {g}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">
                          Sin guía registrada
                        </span>
                      )}
                    </td>

                    {/* ACCIÓN VISUAL */}
                    <td className="py-4 pr-6 text-right">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setSelectedEntry(item)}
                        className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs gap-1.5 shadow-sm"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Examinar Lotes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center space-y-3 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 text-emerald-500/40" />
            <p className="font-bold text-sm text-foreground">
              No hay ingresos con despachos incompletos.
            </p>
            <p className="text-xs text-muted-foreground max-w-md text-center">
              Todos los ingresos con salidas están completados (faltante de 5 prendas o menos según tolerancia) o ya fueron facturados.
            </p>
          </div>
        )}
      </Card>

      {/* DIALOG DETALLE DE LOTES Y FALTANTES (100% VISUAL) */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-3xl rounded-[2.5rem] bg-card border-border p-0 overflow-hidden shadow-2xl">
          {selectedEntry && (
            <div className="flex flex-col">
              {/* ENCABEZADO */}
              <div className={cn(
                "p-8 border-b border-border space-y-3",
                selectedEntry.isOver30Days ? "bg-red-500/10" : "bg-muted/20"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black">
                      <Truck className="h-6 w-6" />
                    </div>
                    <div>
                      <DialogTitle className="text-2xl font-black text-foreground uppercase tracking-tight">
                        Ingreso Maestro {selectedEntry.entryNumber}
                      </DialogTitle>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Cliente: <span className="text-foreground">{selectedEntry.clientName}</span>
                      </p>
                    </div>
                  </div>

                  {selectedEntry.isOver30Days && (
                    <Badge className="bg-red-600 text-white font-black text-xs uppercase px-3 py-1 gap-1.5 border-none animate-pulse">
                      <AlertTriangle className="h-4 w-4" />
                      &gt; 30 Días ({selectedEntry.daysElapsed} Días)
                    </Badge>
                  )}
                </div>

                {/* MOTIVO DE BLOQUEO DE FACTURACIÓN */}
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs font-medium flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-black uppercase tracking-wider block text-[10px] text-amber-800 dark:text-amber-300">
                      Razón de retención en Facturación:
                    </span>
                    Este ingreso registra salidas parciales ({selectedEntry.totalDespachado} prendas despachadas), pero tiene <strong>{selectedEntry.faltanteTotal} prendas faltantes</strong> (supera la tolerancia de 5 prendas). La facturación requiere completar el despacho.
                  </div>
                </div>
              </div>

              {/* RESUMEN DE CIFRAS */}
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                      Total Ingresado
                    </span>
                    <span className="text-2xl font-black text-foreground">
                      {selectedEntry.totalIngresado}
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 block mb-1">
                      Ya Despachado
                    </span>
                    <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                      {selectedEntry.totalDespachado}
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-700 dark:text-red-400 block mb-1">
                      Faltante por Salir
                    </span>
                    <span className="text-2xl font-black text-red-700 dark:text-red-400">
                      {selectedEntry.faltanteTotal}
                    </span>
                  </div>
                </div>

                {/* TABLA DE DESGLOSE DE LOTES */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Estado Detallado por Lote
                  </h4>

                  <div className="rounded-2xl border border-border overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          <th className="py-2.5 pl-4">Lote Nº</th>
                          <th className="py-2.5 px-3">Prenda</th>
                          <th className="py-2.5 px-3 text-right">Ingreso</th>
                          <th className="py-2.5 px-3 text-right">Despachado</th>
                          <th className="py-2.5 px-3 text-right">Faltante</th>
                          <th className="py-2.5 pr-4 text-right">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 font-medium">
                        {selectedEntry.lots.map((lot, idx) => (
                          <tr key={idx} className={cn(
                            lot.status === "sin_despacho" && "bg-red-500/5",
                            lot.status === "parcial" && "bg-amber-500/5"
                          )}>
                            <td className="py-3 pl-4 font-black text-foreground">
                              {lot.lotNumber}
                            </td>
                            <td className="py-3 px-3 text-muted-foreground uppercase text-[11px]">
                              {lot.garment}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-foreground">
                              {lot.original}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-emerald-600">
                              {lot.dispatched}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-red-600">
                              {lot.missing}
                            </td>
                            <td className="py-3 pr-4 text-right">
                              {lot.status === "completo" ? (
                                <Badge className="bg-emerald-600 text-white border-none text-[9px] font-bold">
                                  Completo
                                </Badge>
                              ) : lot.status === "parcial" ? (
                                <Badge className="bg-amber-500 text-white border-none text-[9px] font-bold">
                                  Salida Parcial
                                </Badge>
                              ) : (
                                <Badge className="bg-red-600 text-white border-none text-[9px] font-bold">
                                  Sin Despacho
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* GUÍAS RELACIONADAS */}
                {selectedEntry.guides.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                      Guías de Despacho vinculadas que generaron salidas parciales:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedEntry.guides.map((g, i) => (
                        <Badge key={i} className="bg-primary/10 text-primary border border-primary/20 font-black text-xs px-3 py-1">
                          Guía #{g}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* FOOTER */}
              <DialogFooter className="p-6 border-t border-border bg-muted/10 flex justify-end">
                <Button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  className="h-11 px-8 rounded-xl font-bold text-xs"
                >
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
