"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Database, Search, Loader2, CheckCircle2, AlertCircle, Building2, Calendar, Zap, Truck, Package, Layers, Receipt, ArrowRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, doc, getDoc } from "firebase/firestore";
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

export function AuditOutputPanel() {
  const [searchTerm, setSearchTerm] = useState("");
  const [result, setResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    const term = searchTerm.trim().toUpperCase();
    if (!term) return;

    setSearching(true);
    setResult(null);

    try {
      // Búsqueda Maestra de la Salida
      let outputDoc: any = null;
      
      const q1 = query(collection(db, "outputs"), where("numeroSalida", "==", term), limit(1));
      const q2 = query(collection(db, "outputs"), where("numeroGuia", "==", term), limit(1));
      const q3 = query(collection(db, "outputs"), where("outputNumber", "==", term), limit(1));
      
      const [snap1, snap2, snap3, directSnap] = await Promise.all([
        getDocs(q1),
        getDocs(q2),
        getDocs(q3),
        getDoc(doc(db, "outputs", term))
      ]);

      outputDoc = directSnap.exists() ? directSnap : (snap1.docs[0] || snap2.docs[0] || snap3.docs[0]);

      if (!outputDoc) {
        setResult({ error: `El número de salida ${term} no existe en la base de datos maestra.` });
        setSearching(false);
        return;
      }

      const outputData = outputDoc.data();
      const outputId = outputDoc.id;
      const outputVisible = outputData.numeroSalida || outputData.numeroGuia || outputData.outputNumber || outputId;

      // Buscar si tiene facturas asociadas
      const qFacturas = query(
        collection(db, "facturas"), 
        where("numeroSalida", "==", outputVisible),
        limit(5)
      );
      const facturasSnap = await getDocs(qFacturas);
      
      // Buscar si el ingreso padre está registrado
      let parentEntry: any = null;
      const parentRef = outputData.parentIngresoMaestro || outputData.entryNumber || outputData.numeroIngreso;
      if (parentRef) {
        const qEntry1 = query(collection(db, "entries"), where("entryNumber", "==", String(parentRef).toUpperCase()), limit(1));
        const qEntry2 = query(collection(db, "entries"), where("numeroIngreso", "==", String(parentRef).toUpperCase()), limit(1));
        const [eSnap1, eSnap2, eDirect] = await Promise.all([
          getDocs(qEntry1),
          getDocs(qEntry2),
          getDoc(doc(db, "entries", String(parentRef).toUpperCase()))
        ]);
        const matchedEntryDoc = eDirect.exists() ? eDirect : (eSnap1.docs[0] || eSnap2.docs[0]);
        if (matchedEntryDoc) {
          parentEntry = {
            id: matchedEntryDoc.id,
            ...matchedEntryDoc.data()
          };
        }
      }

      const rawItems = outputData.itemsDispatched || outputData.lotes || outputData.items || [];
      let totalDespachado = 0;

      const itemsAudit = rawItems.map((item: any) => {
        const lid = getVisibleLotName(item);
        const qty = Number(item.quantityToDispatch || item.cantidad || item.quantity || item.cantidadDespachada || 0);
        totalDespachado += qty;

        // Buscar cantidad original en el ingreso padre si lo tenemos
        let originalQty = 0;
        if (parentEntry) {
          const parentLot = (parentEntry.lotes || parentEntry.lots || []).find((l: any) => getVisibleLotName(l) === lid);
          originalQty = Number(parentLot?.cantidadConfirmada || parentLot?.quantity || parentLot?.cantidad || 0);
        }

        return {
          id: lid,
          garment: item.garmentType || item.prendas?.[0]?.tipo || "Varios",
          qty,
          originalQty
        };
      });

      setResult({
        header: {
          number: outputVisible,
          client: outputData.clientName || outputData.cliente || "Socio",
          date: toDate(outputData.date || outputData.fechaSalida || outputData.createdAt),
          driver: outputData.responsiblePerson || outputData.driver || "S/D"
        },
        metrics: {
          totalDespachado,
          itemsCount: itemsAudit.length,
          parentRef: parentRef || "SIN REF"
        },
        parentEntry,
        invoices: facturasSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        itemsAudit
      });

    } catch (e) {
      console.error(e);
      setResult({ error: "Error técnico al consultar la base de datos de salidas." });
    } finally {
      setSearching(false);
    }
  };

  return (
    <Card className="rounded-[2.5rem] border border-border shadow-premium overflow-hidden bg-card">
      <CardHeader className="bg-primary/5 border-b border-border p-8">
        <CardTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
          <Truck className="h-6 w-6 text-primary" /> Auditoría de Salida Maestra
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Número de Salida (Ej: 7224)..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="pl-12 erp-input h-14 text-lg font-black" 
            />
          </div>
          <Button onClick={handleSearch} disabled={searching} className="bg-primary hover:bg-primary/90 text-white font-black uppercase h-14 px-10 rounded-2xl shadow-xl">
            {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Auditar Salida"}
          </Button>
        </div>

        {result && !result.error && (
          <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
            {/* RESUMEN DE EXPEDIENTE */}
            <div className="bg-muted/20 p-8 rounded-[2.5rem] border border-border space-y-6">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Expediente de Despacho</p>
                  <h3 className="text-4xl font-black tracking-tighter">SALIDA: {result.header.number}</h3>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase"><Building2 className="h-4 w-4 text-muted-foreground" /> {result.header.client}</div>
                    <div className="flex items-center gap-2 text-sm font-bold uppercase"><Calendar className="h-4 w-4 text-muted-foreground" /> {result.header.date?.toLocaleDateString('es-EC')}</div>
                    <div className="flex items-center gap-2 text-sm font-bold uppercase"><Truck className="h-4 w-4 text-muted-foreground" /> Chofer: {result.header.driver}</div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Referencia Origen</p>
                  <Badge className="px-6 py-2 rounded-full font-black uppercase text-[11px] bg-primary text-white border-none shadow-sm">
                    ING: {result.metrics.parentRef}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 border-t border-border/50">
                <div className="space-y-1"><p className="text-[9px] font-black text-muted-foreground uppercase">Despacho Total</p><p className="text-2xl font-black text-emerald-600">{result.metrics.totalDespachado} unds</p></div>
                <div className="space-y-1"><p className="text-[9px] font-black text-muted-foreground uppercase">Lotes en Guía</p><p className="text-2xl font-black">{result.metrics.itemsCount} lotes</p></div>
                <div className="space-y-1"><p className="text-[9px] font-black text-muted-foreground uppercase">Facturas Vinculadas</p><p className="text-2xl font-black text-blue-600">{result.invoices.length}</p></div>
              </div>
            </div>

            {/* EXPEDIENTE DE FACTURACIÓN ASOCIADA */}
            {result.invoices.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest px-2">Documentos Fiscales Vinculados</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.invoices.map((inv: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-6 p-5 bg-card rounded-2xl border border-border hover:border-primary/30 transition-all">
                      <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm uppercase">Factura {inv.numeroFactura}</span>
                          <span className="text-[10px] font-bold text-muted-foreground">{inv.fechaFactura?.toDate ? inv.fechaFactura.toDate().toLocaleDateString('es-EC') : ""}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Estado Cobro: {inv.estadoCobranza}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-blue-600 text-lg">${inv.totalFactura?.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TABLA DE AUDITORÍA GRANULAR */}
            <div className="space-y-4">
              <h4 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest px-2">Detalle de Prendas Despachadas</h4>
              <div className="rounded-3xl border border-border overflow-hidden shadow-sm bg-background">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="py-5 pl-8 text-[10px] font-black uppercase">ID Lote / Prenda</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-right">Cantidad Despachada</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-right pr-8">Cantidad Ingreso Origen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.itemsAudit.map((item: any, i: number) => (
                      <TableRow key={i} className="border-border hover:bg-muted/5 transition-colors">
                        <TableCell className="py-6 pl-8">
                          <div className="flex flex-col">
                            <span className="font-black text-sm text-primary uppercase">{item.id}</span>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{item.garment}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-black text-emerald-600 text-base">{item.qty} unds</TableCell>
                        <TableCell className="text-right pr-8 font-bold text-muted-foreground">
                          {item.originalQty > 0 ? `${item.originalQty} unds` : "SIN REF"}
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
            <Truck className="h-20 w-20 mb-4" />
            <p className="text-sm font-black uppercase tracking-widest text-center max-w-md">Ingrese un número de Salida para auditar el despacho y rastrear su trazabilidad completa</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
