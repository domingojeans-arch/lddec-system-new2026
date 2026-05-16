"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Search, 
  ArrowLeft, 
  Calendar, 
  Building2, 
  Clock, 
  CheckCircle2, 
  Package, 
  Truck,
  Layers,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, doc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { toDate } from "@/lib/toDate";

/**
 * MOTOR DE RESOLUCIÓN DE IDENTIDAD (LDDEC 1.1)
 */
function getEntryVisible(item: any, id: string): string {
  const candidates = [item.numeroIngreso, item.entryNumber, item.numeroIngresoMaestro, item.numero];
  for (const val of candidates) {
    const v = String(val ?? "").trim();
    if (v && v.length < 18) return v.toUpperCase();
  }
  return id && id.length < 18 ? id.toUpperCase() : "INGRESO S/N";
}

function getVisibleLotName(lote: any): string {
  if (!lote) return "S/L";
  const candidates = [lote.lotNumber, lote.numeroLote, lote.loteId, lote.lote];
  for (const val of candidates) {
    const s = String(val ?? "").trim();
    if (s && s.length < 25) return s.toUpperCase();
  }
  return "S/L";
}

export default function PublicStatusPage() {
  const params = useParams();
  const router = useRouter();
  const ingresoId = params.ingreso as string;
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<any>(null);
  const [outputs, setOutputs] = useState<any[]>([]);

  useEffect(() => {
    async function loadPublicData() {
      if (!db || !ingresoId) return;
      try {
        let entryDoc: any = null;
        const qNum = query(collection(db, "entries"), where("entryNumber", "==", ingresoId.toUpperCase()), limit(1));
        const snapNum = await getDocs(qNum);
        if (!snapNum.empty) entryDoc = snapNum.docs[0];
        else {
          const docRef = doc(db, "entries", ingresoId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) entryDoc = docSnap;
        }

        if (entryDoc) {
          const data = entryDoc.data();
          setEntry({ id: entryDoc.id, ...data, visibleNumber: getEntryVisible(data, entryDoc.id) });
          
          const qOuts = query(collection(db, "outputs"), limit(100));
          const snapOuts = await getDocs(qOuts);
          setOutputs(snapOuts.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadPublicData();
  }, [ingresoId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/status/${searchTerm.trim().toUpperCase()}`);
      setSearchTerm("");
    }
  };

  const lotStatusMap = {
    pending: { label: "En Espera", color: "bg-zinc-500/10 text-zinc-600", icon: Clock },
    in_process: { label: "En Producción", color: "bg-amber-500/10 text-amber-600", icon: Info },
    ready: { label: "Listo / OK", color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle2 },
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black uppercase tracking-widest opacity-30">Consultando Estado...</div>;

  if (!entry) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-8">
        <Image src="/logo-lddec.png" alt="Logo" width={64} height={64} />
        <div className="space-y-2"><h1 className="text-3xl font-black uppercase tracking-tight">Ingreso no encontrado</h1><p className="text-muted-foreground max-w-xs mx-auto">Verifique el número de ingreso e intente nuevamente.</p></div>
        <form onSubmit={handleSearch} className="w-full max-w-sm flex gap-2"><Input placeholder="Nro. Ingreso (ej: 4773)" className="erp-input h-12" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /><button type="submit" className="h-12 px-6 bg-primary text-white rounded-xl flex items-center justify-center"><Search className="h-5 w-5" /></button></form>
        <Button variant="ghost" onClick={() => router.push('/')} className="font-bold text-muted-foreground gap-2"><ArrowLeft className="h-4 w-4" /> Volver al Inicio</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-10 lg:p-20">
      <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-700">
        <div className="flex justify-center mb-10"><div className="flex items-center gap-3"><Image src="/logo-lddec.png" alt="Logo" width={40} height={40} /><span className="font-black text-2xl tracking-tighter uppercase">Laboratorio del denim Ecuador</span></div></div>
        <Card className="rounded-[2.5rem] border-none shadow-premium-lg overflow-hidden bg-card">
          <div className="bg-primary p-10 text-white relative overflow-hidden"><div className="absolute top-0 right-0 p-10 opacity-10"><Package className="h-32 w-32" /></div><div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6"><div className="space-y-1"><p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Consulta Pública de Estado</p><h1 className="text-5xl font-black tracking-tighter uppercase">Ingreso {entry.visibleNumber}</h1></div><Badge className="bg-white/20 backdrop-blur-md text-white border-none px-6 py-2 rounded-full font-black uppercase text-xs tracking-widest">{entry.status === 'completed' ? 'Procesado' : 'En Planta'}</Badge></div></div>
          <CardContent className="p-10 space-y-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
              <div className="space-y-1.5"><div className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-3.5 w-3.5" /><span className="text-[10px] font-black uppercase tracking-widest">Socio Industrial</span></div><p className="font-bold text-lg uppercase truncate">{entry.clientName}</p></div>
              <div className="space-y-1.5"><div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-3.5 w-3.5" /><span className="text-[10px] font-black uppercase tracking-widest">Fecha Ingreso</span></div><p className="font-bold text-lg">{toDate(entry.date || entry.entryDate)?.toLocaleDateString('es-EC') || "S/F"}</p></div>
              <div className="space-y-1.5"><div className="flex items-center gap-2 text-muted-foreground"><Truck className="h-3.5 w-3.5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-primary">Estado Logístico</span></div><p className="font-black text-xl text-primary uppercase">{entry.status === 'completed' ? 'DESPACHADO' : 'EN PRODUCCIÓN'}</p></div>
            </div>
            <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2"><Layers className="h-4 w-4" /> Detalle Técnico por Lote</h3>
              <div className="rounded-3xl border border-border overflow-hidden bg-background shadow-sm">
                <Table><TableHeader className="bg-muted/50"><TableRow className="hover:bg-transparent border-border"><TableHead className="text-[10px] font-black uppercase py-4 pl-8">Lote</TableHead><TableHead className="text-[10px] font-black uppercase">Prenda</TableHead><TableHead className="text-[10px] font-black uppercase text-center">Cantidad</TableHead><TableHead className="text-[10px] font-black uppercase text-center">Estado Lote</TableHead></TableRow></TableHeader>
                  <TableBody>{(entry.lotes || []).map((lot: any, idx: number) => {
                    const statusKey = (lot.productionStatus || lot.status || "pending").toLowerCase();
                    const status = lotStatusMap[statusKey as keyof typeof lotStatusMap] || lotStatusMap.pending;
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={idx} className="border-border hover:bg-muted/10 transition-colors"><TableCell className="pl-8 py-5"><span className="font-black text-foreground">{getVisibleLotName(lot)}</span></TableCell><TableCell><span className="text-xs font-bold text-muted-foreground uppercase">{lot.garmentType || lot.prendas?.[0]?.tipo || "Varios"}</span></TableCell><TableCell className="text-center"><span className="font-black text-primary text-base">{lot.cantidadConfirmada || lot.quantity || lot.cantidad || 0}</span></TableCell><TableCell className="text-center"><Badge variant="outline" className={cn("text-[9px] font-black uppercase border-none px-3 py-1", status.color)}><StatusIcon className="h-3 w-3 mr-1.5" />{status.label}</Badge></TableCell></TableRow>
                    );
                  })}</TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-10 border-t border-border/50"><form onSubmit={handleSearch} className="relative w-full md:w-80 group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" /><Input placeholder="Buscar otro ingreso..." className="pl-12 erp-input h-12 bg-card border-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></form><Button variant="ghost" onClick={() => router.push('/')} className="text-muted-foreground font-black uppercase text-[10px] tracking-widest gap-2 hover:bg-card px-8 h-12 rounded-xl"><ArrowLeft className="h-4 w-4" /> Volver al Inicio</Button></div>
      </div>
    </div>
  );
}
