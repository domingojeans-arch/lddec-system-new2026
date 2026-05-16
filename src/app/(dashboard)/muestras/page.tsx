
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  Search, 
  PackageSearch,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  AlertTriangle,
  Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  serverTimestamp,
  Timestamp,
  getDocs,
  orderBy
} from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

/**
 * MOTOR DE RESOLUCIÓN DE IDENTIDAD VISIBLE (LOTE) (LDDEC 1.1)
 * Prioridad expandida para todas las generaciones de datos
 */
function getVisibleLotName(lote: any): string {
  if (!lote) return "S/L";
  const candidates = [
    lote.lotNumber,
    lote.numeroLote,
    lote.loteId,
    lote.lote,
    lote.loteNumero,
    lote.numLote,
    lote.id
  ];

  for (const val of candidates) {
    const s = String(val ?? "").trim();
    if (s && s.length < 25 && s !== "[object Object]" && s.toLowerCase() !== "undefined") {
      return s.toUpperCase();
    }
  }
  return "S/L";
}

/**
 * MOTOR DE RESOLUCIÓN DE IDENTIDAD PARA INGRESOS (LDDEC 1.1)
 * Prioridad: numeroIngreso (Físico Real) > entryNumber > numeroIngresoMaestro > numero
 */
function getEntryVisible(item: any, id?: string): string {
  if (!item) return id || "S/I";
  const candidates = [
    item.numeroIngreso, 
    item.entryNumber, 
    item.numeroIngresoMaestro, 
    item.numero,
    item.entryID
  ];
  for (const val of candidates) {
    const v = String(val ?? "").trim();
    if (v && v.length < 18 && v !== "undefined" && v !== "[object Object]") return v.toUpperCase();
  }
  return id || "S/I";
}

export default function MuestrasAntiguasPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [outputs, setOutputs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const isReadOnly = user?.role === "socio";

  useEffect(() => {
    if (!db) return;

    // MOTOR DE CÁLCULO CRONOLÓGICO LDDEC 1.2
    // Ejemplo: Si hoy es Abril 2026, queremos registros de Enero y Febrero 2026.
    const now = new Date();
    
    // Límite Superior: Inicio del mes antepasado (Si Abril, es 1 de Marzo)
    // Esto excluye el mes actual (Abril) y el mes anterior (Marzo).
    const upperBoundDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
    
    // Límite Inferior: 2 meses antes del límite superior (Si 1 de Marzo, es 1 de Enero)
    const lowerBoundDate = new Date(now.getFullYear(), now.getMonth() - 3, 1, 0, 0, 0);

    const tsUpper = Timestamp.fromDate(upperBoundDate);
    const tsLower = Timestamp.fromDate(lowerBoundDate);

    // SE AGREGA ORDERBY PARA COINCIDIR CON ÍNDICE COMPUESTO EXISTENTE (isSample ASC, date DESC)
    const qEntries = query(
      collection(db, "entries"),
      where("isSample", "==", true),
      where("date", "<", tsUpper),
      where("date", ">=", tsLower),
      orderBy("date", "desc")
    );

    // Las salidas y facturas se consultan desde el límite inferior para cruce
    const qOutputs = query(
      collection(db, "outputs"),
      where("date", ">=", tsLower),
      orderBy("date", "desc")
    );

    const qInvoices = query(
      collection(db, "facturas"),
      where("fechaFactura", ">=", tsLower),
      orderBy("fechaFactura", "desc")
    );

    const unsubEntries = onSnapshot(qEntries, (snap) => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn("Error en listener de entradas (muestras):", err);
    });

    const unsubOutputs = onSnapshot(qOutputs, (snap) => {
      setOutputs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubInvoices = onSnapshot(qInvoices, (snap) => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubEntries();
      unsubOutputs();
      unsubInvoices();
    };
  }, []);

  const muestrasData = useMemo(() => {
    const dispatchedLotIds = new Set();
    outputs.forEach(out => {
      (out.itemsDispatched || []).forEach((item: any) => {
        const lid = getVisibleLotName(item);
        if (lid !== "S/L") dispatchedLotIds.add(lid);
      });
    });

    const invoicedLotIds = new Set();
    invoices.forEach(inv => {
      (inv.lotesIncluidos || []).forEach((lid: any) => {
        if (lid) invoicedLotIds.add(lid.toString().toUpperCase());
      });
    });

    const results: any[] = [];

    entries.forEach(entry => {
      (entry.lotes || entry.lots || []).forEach((lote: any) => {
        const lid = getVisibleLotName(lote);
        
        const isNotDispatched = !dispatchedLotIds.has(lid);
        const isNotInvoiced = !invoicedLotIds.has(lid);
        const isNotResolved = lote.isNoveltyResolved === false || lote.isNoveltyResolved === undefined;

        if (isNotDispatched && isNotInvoiced && isNotResolved) {
          const entryDate = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date || entry.entryDate);
          
          const garmentsArr = Array.isArray(lote.garments) ? lote.garments : Array.isArray(lote.prendas) ? lote.prendas : [];
          const qtyFromArr = garmentsArr.reduce((acc: number, g: any) => acc + (Number(g.quantity || g.cantidad) || 0), 0);
          const finalQty = qtyFromArr > 0 ? qtyFromArr : Number(lote.cantidadConfirmada || lote.quantity || lote.cantidad || 0);

          results.push({
            id: entry.id,
            loteId: lid,
            fechaIngreso: entryDate.toLocaleDateString('es-EC'),
            numeroIngreso: getEntryVisible(entry, entry.id), 
            cliente: entry.clientName || entry.clienteNombre || "Socio",
            prenda: lote.garmentType || (Array.isArray(garmentsArr) && garmentsArr[0]?.tipo) || garmentsArr[0]?.garmentType || "Varios",
            cantidad: finalQty,
            loteRaw: lote
          });
        }
      });
    });

    return results.filter(m => 
      m.loteId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.numeroIngreso.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [entries, outputs, invoices, searchTerm]);

  const handleResolveSample = async (entryId: string, loteId: string) => {
    if (isReadOnly) return;
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    try {
      const updatedLotes = entry.lotes.map((l: any) => {
        if (getVisibleLotName(l) === loteId) {
          return { ...l, isNoveltyResolved: true };
        }
        return l;
      });

      await updateDoc(doc(db, "entries", entryId), {
        lotes: updatedLotes,
        updatedAt: serverTimestamp()
      });

      toast({ title: "Muestra Archivada", description: `El lote ${loteId} ha sido marcado como resuelto.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 print:hidden">
        <div className="space-y-1">
          <h1 className="text-5xl font-black tracking-tighter uppercase">Muestras Antiguas</h1>
          <p className="text-primary text-xs font-black uppercase tracking-[0.3em]">Auditoría de Inactividad (2-4 Meses)</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-xs h-12 px-8 rounded-xl shadow-xl shadow-primary/20 gap-2">
            <Printer className="h-4 w-4" /> Imprimir Auditoría
          </Button>
          <div className="bg-card px-8 py-2 rounded-2xl border border-border flex items-center gap-6 shadow-sm">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Inactivas</span>
              <span className="text-3xl font-black text-red-500">{loading ? "..." : muestrasData.length}</span>
            </div>
            <PackageSearch className="h-8 w-8 text-red-500/40" />
          </div>
        </div>
      </div>

      <div className="hidden print:block text-center mb-10 space-y-2">
        <img src="/logo-lddec.png" alt="Logo" style={{ width: '2.5cm', height: '2.5cm', objectFit: 'contain', margin: '0 auto 10px auto', display: 'block' }} />
        <h1 className="text-2xl font-black uppercase text-black">LAVANDERÍA DE DECORACIONES (LDDEC)</h1>
        <h2 className="text-lg font-bold uppercase text-black">AUDITORÍA DE MUESTRAS TÉCNICAS ANTIGUAS</h2>
      </div>

      <div className="bg-card p-4 rounded-2xl border border-border flex flex-col lg:flex-row items-center gap-4 shadow-sm print:hidden">
        <div className="relative w-full lg:w-96"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por Lote, Cliente o Ingreso..." className="pl-12 erp-input h-12" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        <div className="flex-1" />
        <div className="bg-muted/30 px-6 py-2 rounded-full border border-border text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-primary" /> Escaneo de Seguridad Activo</div>
      </div>

      <div className="rounded-[2.5rem] border border-border bg-card overflow-hidden shadow-premium min-h-[400px] print:border-black print:rounded-none">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Consultando Trazabilidad...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50 print:bg-gray-100">
              <TableRow className="border-border print:border-black">
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground py-5 pl-8 print:text-black">Fecha Ingreso</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground print:text-black">N° Ingreso</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground print:text-black">N° Lote</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground print:text-black">Cliente</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground print:text-black">Prenda</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center print:text-black">Cantidad</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-right pr-8 print:hidden">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {muestrasData.length > 0 ? muestrasData.map((item, idx) => (
                  <TableRow key={`${item.id}-${item.loteId}`} className="border-border hover:bg-muted/10 transition-colors print:border-black">
                    <TableCell className="pl-8 py-4"><span className="text-xs font-medium text-muted-foreground print:text-black">{item.fechaIngreso}</span></TableCell>
                    <TableCell><span className="font-mono text-xs font-bold text-primary print:text-black">{item.numeroIngreso}</span></TableCell>
                    <TableCell><span className="text-sm font-black print:text-black">{item.loteId}</span></TableCell>
                    <TableCell><span className="text-[11px] font-bold uppercase truncate block max-w-[180px] print:text-black">{item.cliente}</span></TableCell>
                    <TableCell><span className="text-[11px] font-medium uppercase text-muted-foreground print:text-black">{item.prenda}</span></TableCell>
                    <TableCell className="text-center font-black print:text-black">{item.cantidad}</TableCell>
                    <TableCell className="text-right pr-8 print:hidden">
                      {!isReadOnly && (
                        <Button onClick={() => handleResolveSample(item.id, item.loteId)} className="bg-transparent hover:bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-black uppercase text-[9px] h-9 px-4 rounded-xl gap-2 transition-all">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Resolver y Archivar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={7} className="h-40 text-center opacity-20"><History className="h-16 w-16 mb-4" /><p className="text-sm font-black uppercase tracking-[0.3em]">Sin muestras antiguas pendientes de resolución</p></TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
