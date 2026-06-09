
"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Search, ArrowDownCircle, Plus, Filter, Download, Calendar as CalendarIcon, Loader2, Printer, X, RefreshCcw, User, AlertCircle, Globe, Database, Zap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Entry, EntryInput, EntryLot } from "@/types/entry";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { 
  collection, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query,
  limit,
  orderBy,
  where,
  getDocs,
  getDoc,
  setDoc,
  Timestamp,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { EntryTable as ActualEntryTable } from "@/components/ingresos/entry-table";
import { EntryForm as ActualEntryForm } from "@/components/ingresos/entry-form";
import { EntryDetail as ActualEntryDetail } from "@/components/ingresos/entry-detail";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

function getEntryVisible(item: any, id: string): string {
  const candidates = [item.numeroIngreso, item.entryNumber, item.numeroIngresoMaestro, item.numero, item.entryID, id];
  for (const val of candidates) {
    const v = String(val ?? "").trim();
    if (v && v.length < 18 && v !== "undefined" && v !== "[object Object]") return v.toUpperCase();
  }
  return id && id.length < 18 ? String(id).toUpperCase() : "INGRESO S/N";
}

function getVisibleLotNumber(lot: any): string {
  if (!lot) return "S/L";
  const candidates = [lot.lotNumber, lot.numeroLote, lot.loteId, lot.lote, lot.loteNumero, lot.numLote, lot.id];
  for (const val of candidates) {
    const s = String(val ?? "").trim();
    if (s && s.length < 25 && s !== "[object Object]" && s.toLowerCase() !== "undefined") return s.toUpperCase();
  }
  return "S/L";
}

function mapFirestoreToEntry(docSnap: any): Entry {
  const data = docSnap.data() || {};
  const id = docSnap.id;
  let entryDate = new Date().toISOString().split('T')[0];
  if (data.date?.toDate) {
    try { entryDate = data.date.toDate().toISOString().split('T')[0]; } catch(e){}
  } else if (data.entryDate && typeof data.entryDate === 'string' && data.entryDate.includes('-')) {
    entryDate = data.entryDate;
  }
  const visibleNumber = getEntryVisible(data, id);
  const mappedLots = (data.lotes || []).map((lot: any) => {
    const garmentsArr = Array.isArray(lot?.garments) ? lot.garments : (Array.isArray(lot?.prendas) ? lot.prendas : []);
    // Fallback if it's an old structure without garments array
    const finalGarments = garmentsArr.length > 0 ? garmentsArr : [{ id: Math.random().toString(36).substr(2, 9), garmentType: lot?.garmentType || lot?.tipo || "", quantity: Number(lot?.cantidad || lot?.quantity || 0) }];
    return { 
      ...(lot || {}), 
      id: lot?.id || getVisibleLotNumber(lot), 
      lotNumber: getVisibleLotNumber(lot),
      garments: finalGarments
    };
  });
  const totalGarments = mappedLots.reduce((acc: number, lot: any) => {
    const garments = lot.garments || [];
    if (garments.length > 0) {
      return acc + garments.reduce((gAcc: number, g: any) => gAcc + (Number(g.quantity || g.cantidad || g.cantidadConfirmada || 0) || 0), 0);
    }
    return acc + Number(lot?.cantidad || lot?.cantidadConfirmada || lot?.quantity || lot?.total || 0);
  }, 0);
  return {
    id,
    entryNumber: visibleNumber,
    clientId: data.clientId || data.clienteId || data.cliente || "",
    clientName: data.clientName || data.nombreCliente || data.nombre || "Socio",
    entryDate,
    responsible: data.responsible || "N/A",
    isSample: !!data.isSample,
    status: data.status || "active",
    totalGarments,
    lots: mappedLots,
    notes: data.notes || "",
  } as Entry;
}

export default function IngresosPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [garmentCatalog, setGarmentCatalog] = useState<string[]>([]);
  const [processCatalog, setProcessCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [inputSearch, setInputSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | undefined>(undefined);
  const [viewingEntry, setViewingEntry] = useState<Entry | undefined>(undefined);

  // Estados para controlar los Popovers de calendario
  const [isFromOpen, setIsFromOpen] = useState(false);
  const [isToOpen, setIsToOpen] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();
  
  const isReadOnly = user?.role === "socio";

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(inputSearch), 300);
    return () => clearTimeout(timer);
  }, [inputSearch]);

  const loadEntries = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const fromTs = Timestamp.fromDate(new Date(dateFrom + "T00:00:00"));
      const toTs = Timestamp.fromDate(new Date(dateTo + "T23:59:59"));
      const q = query(collection(db, "entries"), where("date", ">=", fromTs), where("date", "<=", toTs), orderBy("date", "desc"), limit(300));
      const snapshot = await getDocs(q);
      setEntries(snapshot.docs.map(docSnap => mapFirestoreToEntry(docSnap)));
    } catch (error) { console.warn(error); } finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (!db) return;
    const unsubClients = onSnapshot(collection(db, "clients"), (snap) => {
      const mapped = snap.docs.map(d => {
        const data = d.data();
        const firstName = data.firstName || data.nombre || "";
        const lastName = data.lastName || data.apellido || "";
        const name = (data.name || `${lastName} ${firstName}`).trim().toUpperCase();
        return {
          id: d.id,
          ...data,
          firstName,
          lastName,
          name: name || "SIN NOMBRE"
        };
      });
      const sorted = mapped.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      setClients(sorted);
    });
    
    // CARGAR CATÁLOGO DE PRENDAS DESDE NUEVA COLECCIÓN (LDDEC 1.6)
    const loadCatalogs = async () => {
      const prendasSnap = await getDocs(query(collection(db, "catalogo_prendas"), where("active", "==", true)));
      setGarmentCatalog(prendasSnap.docs.map(d => d.data().name));
      const procesosSnap = await getDocs(query(collection(db, "procesos_tecnicos"), where("active", "==", true)));
      setProcessCatalog(procesosSnap.docs.map(d => d.data().name));
    };
    loadCatalogs();
    return () => unsubClients();
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleFormSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      const normalizedEntryNumber = String(data.entryNumber || "").trim().toUpperCase();
      const payload = { ...data, lotes: data.lots, entryNumber: normalizedEntryNumber, numeroIngreso: normalizedEntryNumber, loteIdList: data.lots.map((l: any) => getVisibleLotNumber(l)), date: Timestamp.fromDate(new Date(data.entryDate + "T12:00:00")), updatedAt: serverTimestamp() };
      if (editingEntry) await updateDoc(doc(db, "entries", editingEntry.id), payload);
      else await setDoc(doc(db, "entries", normalizedEntryNumber), { ...payload, createdAt: serverTimestamp() });
      setIsSheetOpen(false);
      loadEntries();
    } catch (error) { toast({ variant: "destructive", title: "Error al guardar" }); } finally { setSubmitting(false); }
  };

  const filteredEntries = useMemo(() => entries.filter(e => e.entryNumber.toLowerCase().includes(searchTerm.toLowerCase()) || e.clientName.toLowerCase().includes(searchTerm.toLowerCase())), [entries, searchTerm]);
  const dateFromObj = dateFrom ? parseISO(dateFrom) : undefined;
  const dateToObj = dateTo ? parseISO(dateTo) : undefined;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-5xl font-black text-foreground tracking-tighter uppercase">Ingresos</h1>
          <p className="text-primary text-xs font-black uppercase tracking-[0.3em]">Gestión de Catálogos LDDEC 1.6</p>
          {isReadOnly && <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3 mt-2">Modo Solo Lectura</Badge>}
        </div>
        {(user?.role === "admin" || user?.role === "bodega") && (
          <Button onClick={() => { setEditingEntry(undefined); setIsSheetOpen(true); }} className="bg-primary hover:bg-primary/90 text-white font-black uppercase h-12 px-8 rounded-xl shadow-xl shadow-primary/20 gap-2"><Plus className="h-5 w-5" /> Nuevo Ingreso</Button>
        )}
      </div>

      <div className="bg-card p-6 rounded-[2rem] border border-border shadow-premium flex flex-col lg:flex-row items-center gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
          <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Buscador ID / Cliente</Label><div className="relative group"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Ej: 4804 o Socio..." className="pl-10 erp-input h-11" value={inputSearch} onChange={e => setInputSearch(e.target.value)} /></div></div>
          <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Desde</Label><Popover open={isFromOpen} onOpenChange={setIsFromOpen}><PopoverTrigger asChild><Button variant="outline" className="w-full h-11 erp-input bg-background justify-start text-left font-bold text-xs"><CalendarIcon className="mr-2 h-4 w-4 text-primary" />{dateFromObj && isValid(dateFromObj) ? format(dateFromObj, "dd/MM/yyyy") : "Desde"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start"><Calendar mode="single" selected={dateFromObj} onSelect={(d) => { setDateFrom(d ? format(d, "yyyy-MM-dd") : ""); setIsFromOpen(false); }} locale={es} initialFocus /></PopoverContent></Popover></div>
          <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Hasta</Label><Popover open={isToOpen} onOpenChange={setIsToOpen}><PopoverTrigger asChild><Button variant="outline" className="w-full h-11 erp-input bg-background justify-start text-left font-bold text-xs"><CalendarIcon className="mr-2 h-4 w-4 text-primary" />{dateToObj && isValid(dateToObj) ? format(dateToObj, "dd/MM/yyyy") : "Hasta"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start"><Calendar mode="single" selected={dateToObj} onSelect={(d) => { setDateTo(d ? format(d, "yyyy-MM-dd") : ""); setIsToOpen(false); }} locale={es} initialFocus /></PopoverContent></Popover></div>
          <div className="lg:col-span-2 flex items-end"><Button onClick={loadEntries} disabled={loading} className="h-11 px-8 bg-muted hover:bg-muted/80 text-foreground font-black text-[10px] uppercase tracking-widest gap-2 rounded-xl border border-border w-full lg:w-auto">{loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />} Consultar Periodo</Button></div>
        </div>
      </div>

      <div className="min-h-[400px]">
        {loading ? <div className="h-64 flex flex-col items-center justify-center space-y-4"><Loader2 className="h-12 w-12 animate-spin text-primary/20" /><p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Consultando Firestore...</p></div>
        : filteredEntries.length > 0 ? <ActualEntryTable entries={filteredEntries} onView={(e) => { setViewingEntry(e); setIsDetailOpen(true); }} onEdit={(e) => { setEditingEntry(e); setIsSheetOpen(true); }} onDelete={async (id) => { await deleteDoc(doc(db, "entries", id)); loadEntries(); }} onPrint={(e) => { setViewingEntry(e); setIsDetailOpen(true); }} canEdit={user?.role === "admin" || user?.role === "bodega"} />
        : <div className="h-64 rounded-[2.5rem] border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground bg-muted/10"><ArrowDownCircle className="h-12 w-12 mb-4 opacity-20" /><p className="font-black text-sm uppercase tracking-widest">Sin registros en el rango seleccionado</p></div>}
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}><SheetContent className="w-full sm:max-w-[650px] bg-card border-l-border p-0 overflow-hidden"><div className="h-full flex flex-col"><div className="p-8 border-b border-border bg-muted/20"><SheetHeader><SheetTitle className="text-3xl font-black text-foreground uppercase tracking-tight">{editingEntry ? "Editar Ingreso" : "Nuevo Ingreso"}</SheetTitle></SheetHeader></div><div className="flex-1 overflow-y-auto p-8">{submitting ? <div className="h-full flex flex-col items-center justify-center gap-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sincronizando...</p></div> : <ActualEntryForm key={editingEntry?.id || 'new'} initialData={editingEntry} clients={clients} garmentCatalog={garmentCatalog} processCatalog={processCatalog} onSubmit={handleFormSubmit} onCancel={() => setIsSheetOpen(false)} />}</div></div></SheetContent></Sheet>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}><DialogContent className="sm:max-w-[1000px] bg-card border-border p-0 overflow-hidden rounded-[2.5rem] shadow-2xl"><DialogHeader className="p-8 pb-0"><DialogTitle className="text-3xl font-black text-foreground uppercase tracking-tight">DETALLE</DialogTitle></DialogHeader><div className="max-h-[85vh] overflow-y-auto p-8">{viewingEntry && <ActualEntryDetail entry={viewingEntry} />}<div className="flex justify-end mt-8 pt-6 border-t border-border gap-4"><Button variant="outline" className="h-12 px-10 rounded-2xl font-bold" onClick={() => setIsDetailOpen(false)}>Cerrar</Button><Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-10 rounded-2xl gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir</Button></div></div></DialogContent></Dialog>
    </div>
  );
}
