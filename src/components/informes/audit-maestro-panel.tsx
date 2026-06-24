
"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Database, Search, Loader2, CheckCircle2, AlertCircle, Building2, Calendar, Zap, Truck, Package, Layers, Receipt, ArrowRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, doc, getDoc, orderBy } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { toDate } from "@/lib/toDate";
import { Progress } from "@/components/ui/progress";

function getEntryVisible(item: any, id: string): string {
  const candidates = [item.numeroIngreso, item.entryNumber, item.numeroIngresoMaestro, item.numero];
  for (const val of candidates) {
    if (val && String(val).length < 18 && val !== "undefined" && val !== "[object Object]") return String(val).toUpperCase();
  }
  return id && id.length < 18 ? id.toUpperCase() : "INGRESO S/N";
}

function getVisibleLotName(lote: any): string {
  if (!lote) return "S/L";
  const candidates = [lote.lotNumber, lote.entryLotNumber, lote.numeroLote, lote.lote, lote.loteId];
  for (const val of candidates) {
    if (val && String(val).trim() && String(val).length < 18) return String(val).trim().toUpperCase();
  }
  return lote.id && String(lote.id).length < 18 ? String(lote.id).toUpperCase() : "LOTE S/N";
}

export function AuditMaestroPanel() {
  const [searchTerm, setSearchTerm] = useState("");
  const [result, setResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    const term = searchTerm.trim().toUpperCase();
    if (!term) return;

    setSearching(true);
    setResult(null);

    try {
      // PASO 1: Búsqueda Maestra del Ingreso
      let entryDoc: any = null;
      
      const q1 = query(collection(db, "entries"), where("entryNumber", "==", term), limit(1));
      const q2 = query(collection(db, "entries"), where("numeroIngreso", "==", term), limit(1));
      
      const [snap1, snap2, directSnap] = await Promise.all([
        getDocs(q1),
        getDocs(q2),
        getDoc(doc(db, "entries", term))
      ]);

      entryDoc = directSnap.exists() ? directSnap : (snap1.docs[0] || snap2.docs[0]);

      if (!entryDoc) {
        setResult({ error: `El número de ingreso ${term} no existe en la base de datos maestra.` });
        setSearching(false);
        return;
      }

      const entryData = entryDoc.data();
      const entryId = entryDoc.id;
      const entryVisible = getEntryVisible(entryData, entryId);

      // PASO 2: Consultas Multicanal
      const [outsSnap, salsSnap, muesSnap, facturasSnap] = await Promise.all([
        getDocs(collection(db, "outputs")),
        getDocs(collection(db, "salidas")),
        getDocs(collection(db, "muestras")),
        getDocs(collection(db, "facturas"))
      ]);

      const facturasFilter = facturasSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((inv: any) => {
        const refs = [
          inv.ingresoMaestroId, 
          inv.referencia, 
          inv.ref, 
          inv.numeroIngreso, 
          inv.entryNumber, 
          ...(Array.isArray(inv.ingresoMaestroIds) ? inv.ingresoMaestroIds : []),
          ...(Array.isArray(inv.ingresos) ? inv.ingresos.map((item: any) => typeof item === 'string' ? item : (item.id || item.ingresoId || item.entryNumber || item.idIngreso)) : []),
          ...(Array.isArray(inv.ingresosIds) ? inv.ingresosIds.map((item: any) => typeof item === 'string' ? item : (item.id || item.ingresoId || item.entryNumber || item.idIngreso)) : [])
        ];
        const stringRefs = refs.filter(Boolean).map(s => String(s).trim().toUpperCase());
        return stringRefs.includes(entryVisible) || stringRefs.includes(term.toUpperCase());
      });

      const allOutDocs = [...outsSnap.docs, ...salsSnap.docs, ...muesSnap.docs].map(d => d.data());

      // PASO 3: Auditoría por Lote
      let totalIngresado = 0;
      let totalDespachado = 0;

      const rawLots = entryData.lotes || entryData.lots || [];
      const lotAudit = rawLots.map((lot: any) => {
        const lid = getVisibleLotName(lot);
        
        const garments = lot.garments || lot.prendas || [];
        let original = 0;
        if (garments.length > 0) {
          original = garments.reduce((acc: number, g: any) => acc + (Number(g.quantity || g.cantidad || 0)), 0);
        } else {
          original = Number(lot.cantidadConfirmada || lot.quantity || lot.cantidad || 0);
        }
        
        totalIngresado += original;

        let despachadoLote = 0;
        const matchedOuts: string[] = [];

        allOutDocs.forEach((o: any) => {
          const checkOutputRefs = [o.parentIngresoMaestro, o.entryNumber, o.numeroIngreso, o.referencia, o.ref].filter(Boolean).map(s => String(s).trim().toUpperCase());
          const isFromThisEntry = checkOutputRefs.includes(entryVisible) || checkOutputRefs.includes(term.toUpperCase());

          const items = o.itemsDispatched || o.lotes || [];
          if (items.length > 0) {
            items.forEach((it: any) => {
              // Puede coincidir por ID de lote O porque la salida pertenece completamente al ingreso
              if (getVisibleLotName(it) === lid || (isFromThisEntry && items.length === 1 && rawLots.length === 1)) {
                const qty = Number(it.quantityToDispatch || it.cantidad || it.quantity || it.cantidadDespachada || 0);
                despachadoLote += qty;
                matchedOuts.push(o.numeroSalida || o.numeroGuia || o.id);
              }
            });
          } else if (isFromThisEntry) {
            // Salidas sin desglose
            const qty = Number(o.totalPrendas || o.total || o.cantidad || 0);
            despachadoLote += qty;
            matchedOuts.push(o.numeroSalida || o.numeroGuia || o.id);
          }
        });

        totalDespachado += despachadoLote;
        const isCompletado = despachadoLote >= (original - 1);

        return {
          id: lid,
          garment: lot.garmentType || lot.prendas?.[0]?.tipo || "Varios",
          original,
          despachado: despachadoLote,
          pct: Math.min(100, original > 0 ? Math.round((despachadoLote / original) * 100) : 0),
          isCompletado,
          outs: Array.from(new Set(matchedOuts))
        };
      });

      setResult({
        header: {
          number: entryVisible,
          client: entryData.clientName || "Socio",
          date: toDate(entryData.date || entryData.entryDate)
        },
        metrics: {
          totalIngresado,
          totalDespachado,
          lotesTotales: lotAudit.length,
          lotesListos: lotAudit.filter((l:any) => l.isCompletado).length
        },
        invoices: facturasFilter,
        lotAudit
      });

    } catch (e) {
      console.error(e);
      setResult({ error: "Error técnico al procesar el expediente multicanal." });
    } finally {
      setSearching(false);
    }
  };

  return (
    <Card className="rounded-[2.5rem] border border-border shadow-premium overflow-hidden bg-card">
      <CardHeader className="bg-primary/5 border-b border-border p-8">
        <CardTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" /> Auditoría de Ingreso Maestro
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Número de Ingreso (Ej: 4804)..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="pl-12 erp-input h-14 text-lg font-black" 
            />
          </div>
          <Button onClick={handleSearch} disabled={searching} className="bg-primary hover:bg-primary/90 text-white font-black uppercase h-14 px-10 rounded-2xl shadow-xl">
            {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Auditar Ingreso"}
          </Button>
        </div>

        {result && !result.error && (
          <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
            {/* RESUMEN DE EXPEDIENTE */}
            <div className="bg-muted/20 p-8 rounded-[2.5rem] border border-border space-y-6">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Expediente Industrial</p>
                  <h3 className="text-4xl font-black tracking-tighter">{result.header.number}</h3>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase"><Building2 className="h-4 w-4 text-muted-foreground" /> {result.header.client}</div>
                    <div className="flex items-center gap-2 text-sm font-bold uppercase"><Calendar className="h-4 w-4 text-muted-foreground" /> {result.header.date?.toLocaleDateString('es-EC')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Estado Maestro</p>
                  <Badge className={cn("px-6 py-2 rounded-full font-black uppercase text-[11px] border-none shadow-sm", result.metrics.totalDespachado >= result.metrics.totalIngresado ? "bg-emerald-500 text-white" : "bg-amber-500 text-white")}>
                    {result.metrics.totalDespachado >= result.metrics.totalIngresado ? "CERRADO TOTAL" : "PROCESO ABIERTO"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-border/50">
                <div className="space-y-1"><p className="text-[9px] font-black text-muted-foreground uppercase">Ingreso Total</p><p className="text-2xl font-black text-primary">{result.metrics.totalIngresado} unds</p></div>
                <div className="space-y-1"><p className="text-[9px] font-black text-muted-foreground uppercase">Despacho Real</p><p className="text-2xl font-black text-emerald-600">{result.metrics.totalDespachado} unds</p></div>
                <div className="space-y-1"><p className="text-[9px] font-black text-muted-foreground uppercase">Lotes Procesados</p><p className="text-2xl font-black">{result.metrics.lotesListos} / {result.metrics.lotesTotales}</p></div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-muted-foreground uppercase">Facturas</p>
                  <p className="text-2xl font-black text-blue-600 flex items-baseline gap-2 flex-wrap">
                    {result.invoices.length}
                    {result.invoices.length > 0 && (
                      <span className="text-[11px] font-bold text-muted-foreground">
                        ({result.invoices.map((inv: any) => inv.numeroFactura || inv.invoiceNumber || inv.numero || inv.id).join(", ")})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* TABLA DE AUDITORÍA GRANULAR */}
            <div className="space-y-4">
              <h4 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest px-2">Análisis de Integridad por Lote</h4>
              <div className="rounded-3xl border border-border overflow-hidden shadow-sm bg-background">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="py-5 pl-8 text-[10px] font-black uppercase">ID Lote / Prenda</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center w-[120px]">Progreso</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-right">Ingreso</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-right">Salida</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-right pr-8">Guías Detectadas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.lotAudit.map((lot: any, i: number) => (
                      <TableRow key={i} className="border-border hover:bg-muted/5 transition-colors">
                        <TableCell className="py-6 pl-8">
                          <div className="flex flex-col"><span className="font-black text-sm text-primary uppercase">{lot.id}</span><span className="text-[9px] font-bold text-muted-foreground uppercase">{lot.garment}</span></div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5"><div className="flex justify-between text-[8px] font-black uppercase"><span>{lot.pct}%</span>{lot.isCompletado && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />}</div><Progress value={lot.pct} className="h-1 bg-muted rounded-full overflow-hidden" /></div>
                        </TableCell>
                        <TableCell className="text-right font-bold">{lot.original}</TableCell>
                        <TableCell className="text-right font-black text-emerald-600">{lot.despachado}</TableCell>
                        <TableCell className="text-right pr-8">
                          <div className="flex flex-wrap justify-end gap-1">
                            {lot.outs.map((num: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-[8px] font-black border-muted-foreground/20 px-1.5 h-4 uppercase">{num}</Badge>
                            ))}
                            {lot.outs.length === 0 && <span className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-widest italic">PENDIENTE</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {result?.error && (
          <div className="p-12 text-center bg-red-50 rounded-[2.5rem] border border-red-100">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-black text-red-900 uppercase">Sin Registros</h3>
            <p className="text-sm font-medium text-red-700 mt-2">{result.error}</p>
          </div>
        )}

        {!result && !searching && (
          <div className="h-64 flex flex-col items-center justify-center opacity-20">
            <Database className="h-20 w-20 mb-4" />
            <p className="text-sm font-black uppercase tracking-widest">Ingrese un ID de Ingreso Maestro para reconstruir el expediente completo</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
