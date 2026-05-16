
"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Layers, Loader2, CheckCircle2, AlertCircle, AlertTriangle, Clock, Truck, Building2, Calendar, Zap, Receipt, History } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit,
  doc,
  getDoc
} from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toDate } from "@/lib/toDate";

function getVisibleLotName(lote: any): string {
  if (!lote) return "S/L";
  const candidates = [lote.lotNumber, lote.entryLotNumber, lote.numeroLote, lote.lote, lote.loteId];
  for (const val of candidates) {
    if (val && String(val).trim() && String(val).length < 18) return String(val).trim().toUpperCase();
  }
  return lote.id && String(lote.id).length < 18 ? String(lote.id).toUpperCase() : "LOTE S/N";
}

function getEntryVisible(item: any, id: string): string {
  const candidates = [item.numeroIngreso, item.entryNumber, item.numeroIngresoMaestro, item.numero, item.entryID, id];
  for (const val of candidates) {
    if (val && String(val).length < 18 && val !== "undefined" && val !== "[object Object]") return String(val).toUpperCase();
  }
  return id && id.length < 18 ? id.toUpperCase() : "INGRESO S/N";
}

export function AuditLotPanel() {
  const [searchTerm, setSearchTerm] = useState("");
  const [result, setResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    const term = searchTerm.trim().toUpperCase();
    if (!term) return;

    setSearching(true);
    setResult(null);

    try {
      // PASO 1: Hallar el Ingreso Padre usando loteIdList (Indizado)
      const qEntry = query(collection(db, "entries"), where("loteIdList", "array-contains", term), limit(1));
      const entrySnap = await getDocs(qEntry);

      if (entrySnap.empty) {
        setResult({ error: `El lote ${term} no ha sido registrado en ningún ingreso maestro.` });
        setSearching(false);
        return;
      }

      const entryDoc = entrySnap.docs[0];
      const entryData = entryDoc.data();
      const lotData = (entryData.lotes || []).find((l: any) => getVisibleLotName(l) === term);

      // PASO 2: Consultas paralelas filtradas (Auditores específicos)
      const [manualSnap, facturasSnap, outs, sals, mues] = await Promise.all([
        getDocs(query(collection(db, "manualidades"), where("loteNumero", "==", term))),
        getDocs(query(collection(db, "facturas"), where("lotesIncluidos", "array-contains", term))),
        getDocs(collection(db, "outputs")), // Fallback para búsqueda manual profunda
        getDocs(collection(db, "salidas")),
        getDocs(collection(db, "muestras"))
      ]);

      // PASO 3: Cruce multicanal de salidas
      const allOutDocs = [...outs.docs, ...sals.docs, ...mues.docs].map(d => ({ id: d.id, ...d.data() }));
      const relatedOutputs = allOutDocs.filter((o: any) => {
        const items = o.itemsDispatched || o.lotes || [];
        return items.some((i: any) => getVisibleLotName(i) === term);
      }).map((o: any) => {
        const items = o.itemsDispatched || o.lotes || [];
        const match = items.find((i: any) => getVisibleLotName(i) === term);
        return {
          id: o.id,
          numero: o.numeroSalida || o.numeroGuia || o.outputNumber || o.id,
          fecha: toDate(o.date || o.fechaSalida || o.createdAt),
          cantidad: Number(match?.quantityToDispatch || match?.cantidad || match?.quantity || 0),
          chofer: o.responsiblePerson || o.driver || "S/D"
        };
      });

      const totalDespachado = relatedOutputs.reduce((acc, curr) => acc + curr.cantidad, 0);
      const originalQty = Number(lotData?.cantidadConfirmada || lotData?.quantity || lotData?.cantidad || 0);

      setResult({
        lotNumber: term,
        entry: {
          number: getEntryVisible(entryData, entryDoc.id),
          client: entryData.clientName || "Socio",
          date: toDate(entryData.date || entryData.entryDate)
        },
        technical: {
          process: lotData?.process || "S/D",
          garment: lotData?.garmentType || "Varios"
        },
        metrics: {
          original: originalQty,
          despachado: totalDespachado,
          pendiente: Math.max(0, originalQty - totalDespachado)
        },
        manualidades: manualSnap.docs.map(d => ({ id: d.id, ...d.data(), fecha: toDate(d.data().createdAt) })),
        facturas: facturasSnap.docs.map(d => ({ id: d.id, ...d.data(), fecha: toDate(d.data().fechaFactura) })),
        outputs: relatedOutputs
      });

    } catch (e) {
      console.error(e);
      setResult({ error: "Falla de integridad al consultar Firestore." });
    } finally {
      setSearching(false);
    }
  };

  return (
    <Card className="rounded-[2.5rem] border border-border shadow-premium overflow-hidden bg-card">
      <CardHeader className="bg-primary/5 border-b border-border p-8">
        <CardTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
          <Layers className="h-6 w-6 text-primary" /> Auditoría Individual de Lote
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Ingrese ID de Lote (Ej: 21220)..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="pl-12 erp-input h-14 text-lg font-black" 
            />
          </div>
          <Button onClick={handleSearch} disabled={searching} className="bg-primary hover:bg-primary/90 text-white font-black uppercase h-14 px-10 rounded-2xl shadow-xl">
            {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Auditar Lote"}
          </Button>
        </div>

        {result && !result.error && (
          <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
            {/* CABECERA DE TRAZABILIDAD */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/20 p-8 rounded-[2rem] border border-border">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Socio Industrial</p>
                <p className="font-bold text-lg uppercase truncate">{result.entry.client}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Ingreso de Origen</p>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-white font-mono">{result.entry.number}</Badge>
                  <span className="text-xs font-medium text-muted-foreground">{result.entry.date?.toLocaleDateString('es-EC')}</span>
                </div>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Estado Operativo</p>
                <Badge variant="outline" className={cn("mt-1 border-none font-black uppercase text-[10px] px-4 py-1", result.metrics.pendiente <= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                  {result.metrics.pendiente <= 0 ? "DESPACHADO TOTAL" : "PENDIENTE EN PLANTA"}
                </Badge>
              </div>
            </div>

            {/* MÉTRICAS DE BALANCE */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm text-center">
                <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">CANT. ORIGINAL</p>
                <p className="text-3xl font-black">{result.metrics.original}</p>
              </div>
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm text-center">
                <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">DESPACHADO</p>
                <p className="text-3xl font-black text-emerald-600">{result.metrics.despachado}</p>
              </div>
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm text-center">
                <p className="text-[9px] font-black text-red-500 uppercase mb-1">SALDO ACTUAL</p>
                <p className="text-3xl font-black text-red-500">{result.metrics.pendiente}</p>
              </div>
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm text-center">
                <p className="text-[9px] font-black text-primary uppercase mb-1">PROCESO</p>
                <p className="text-xs font-black uppercase truncate mt-2">{result.technical.process}</p>
              </div>
            </div>

            {/* TIMELINE DE EVENTOS */}
            <div className="space-y-6">
              <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <History className="h-5 w-5" /> Línea de Tiempo del Lote
              </h4>

              <div className="space-y-4">
                {/* SALIDAS */}
                {result.outputs.map((o: any, i: number) => (
                  <div key={i} className="flex items-center gap-6 p-5 bg-card rounded-2xl border border-border hover:border-primary/30 transition-all">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm uppercase">Guía de Salida {o.numero}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">{o.fecha?.toLocaleDateString('es-EC')}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Despachado por: {o.chofer}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-600 text-lg">+{o.cantidad}</p>
                    </div>
                  </div>
                ))}

                {/* MANUALIDADES */}
                {result.manualidades.map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-6 p-5 bg-card rounded-2xl border border-border hover:border-primary/30 transition-all">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm uppercase">Manualidad: {m.proceso}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">{m.fecha?.toLocaleDateString('es-EC')}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Operario: {m.operarioNombre}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-amber-600 text-lg">{m.cantidad} unds</p>
                    </div>
                  </div>
                ))}

                {/* FACTURAS */}
                {result.facturas.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-6 p-5 bg-card rounded-2xl border border-border hover:border-primary/30 transition-all">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm uppercase">Comprobante Fiscal {f.numeroFactura}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">{f.fecha?.toLocaleDateString('es-EC')}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Estado Cobro: {f.estadoCobranza}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-blue-600 text-lg">${f.totalFactura.toFixed(2)}</p>
                    </div>
                  </div>
                ))}

                {result.outputs.length === 0 && result.manualidades.length === 0 && result.facturas.length === 0 && (
                  <div className="h-32 flex flex-col items-center justify-center opacity-20 border-2 border-dashed border-border rounded-3xl">
                    <History className="h-8 w-8 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Sin actividad transaccional registrada</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {result?.error && (
          <div className="p-12 text-center bg-red-50 rounded-[2.5rem] border border-red-100 animate-in zoom-in duration-300">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-black text-red-900 uppercase">Sin Trazabilidad Detectada</h3>
            <p className="text-sm font-medium text-red-700 mt-2 max-w-sm mx-auto">{result.error}</p>
          </div>
        )}

        {!result && !searching && (
          <div className="h-64 flex flex-col items-center justify-center opacity-20">
            <Layers className="h-20 w-20 mb-4" />
            <p className="text-sm font-black uppercase tracking-widest">Ingrese un ID de Lote para iniciar la auditoría profunda</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
