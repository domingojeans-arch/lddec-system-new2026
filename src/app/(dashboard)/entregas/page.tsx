"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  Search, 
  Truck, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  PackageCheck,
  Loader2,
  CheckCircle,
  CheckSquare,
  X,
  CalendarDays,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  serverTimestamp,
  writeBatch,
  getDoc
} from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/**
 * MOTOR DE RESOLUCIÓN DE IDENTIDAD PARA SALIDAS (LDDEC 1.1)
 */
function isVisibleGuide(value: any): boolean {
  const v = String(value ?? "").trim();
  if (!v || v === "undefined" || v === "[object Object]") return false;
  if (v.length > 18) return false;
  return /^[0-9]+$/.test(v) || /^[A-Z0-9\-]+$/.test(v);
}

function getGuiaRaw(item: any): string {
  const candidates = [item?.numeroSalida, item?.numeroGuia, item?.outputNumber, item?.id];
  for (const val of candidates) {
    if (isVisibleGuide(val)) return String(val).toUpperCase();
  }
  return "GUÍA SIN NÚMERO";
}

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

export function cleanClientNames(nameStr: string): string {
  if (!nameStr) return "";
  const parts = nameStr.split(",").map(p => p.trim()).filter(Boolean);
  const seenSignatures = new Set<string>();
  const uniqueParts: string[] = [];

  for (const part of parts) {
    const words = part.split(/\s+/).filter(Boolean);
    const cleanWords: string[] = [];
    for (let i = 0; i < words.length; i++) {
      if (i === 0 || words[i].toUpperCase() !== words[i - 1].toUpperCase()) {
        cleanWords.push(words[i]);
      }
    }
    const cleanPart = cleanWords.join(" ");
    const signature = cleanWords
      .map(w => w.toUpperCase())
      .sort()
      .join(" ");

    if (signature && !seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      uniqueParts.push(cleanPart);
    }
  }

  const result = uniqueParts.join(", ");
  const finalWords = result.split(/\s+/).filter(Boolean);
  const finalCleanWords: string[] = [];
  for (let i = 0; i < finalWords.length; i++) {
    const currentWordClean = finalWords[i].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toUpperCase();
    const prevWordClean = i > 0 ? finalWords[i - 1].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toUpperCase() : "";
    if (i === 0 || currentWordClean !== prevWordClean) {
      finalCleanWords.push(finalWords[i]);
    }
  }
  
  let finalStr = finalCleanWords.join(" ");
  finalStr = finalStr.replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim();
  return finalStr;
}

function getClienteSalida(item: any): string {
  let rawClient = item?.clienteNombre || item?.cliente || item?.clientName || "";
  if (!rawClient) {
    const clientNamesArray = Array.isArray(item?.containedClientNames) ? item.containedClientNames : [];
    rawClient = clientNamesArray.length > 0 ? clientNamesArray.join(", ") : "S/D";
  }
  return cleanClientNames(rawClient.toString().toUpperCase());
}

function formatFechaEC(rawDate: any): string {
  if (!rawDate) return "---";
  let date: Date;
  if (typeof rawDate.toDate === "function") date = rawDate.toDate();
  else date = new Date(rawDate);
  if (isNaN(date.getTime())) return "---";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

const MESES = [
  { value: "0", label: "Enero" },
  { value: "1", label: "Febrero" },
  { value: "2", label: "Marzo" },
  { value: "3", label: "Abril" },
  { value: "4", label: "Mayo" },
  { value: "5", label: "Junio" },
  { value: "6", label: "Julio" },
  { value: "7", label: "Agosto" },
  { value: "8", label: "Septiembre" },
  { value: "9", label: "Octubre" },
  { value: "10", label: "Noviembre" },
  { value: "11", label: "Diciembre" },
];

export default function EntregasPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [outputs, setOutputs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pendientes");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processingBulk, setProcessingBulk] = useState(false);

  // Estados de paginación por mes
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());

  const canEdit = user?.role !== "socio";

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "outputs"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOutputs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredOutputs = useMemo(() => {
    return outputs.filter(out => {
      const guia = getGuiaRaw(out).toLowerCase();
      const cliente = getClienteSalida(out).toLowerCase();
      const matchesSearch = guia.includes(searchTerm.toLowerCase()) || cliente.includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      const items = out.itemsDispatched || [];
      const isDelivered = items.length > 0 && items.every((i: any) => i.isClientDelivered === true);
      
      const isCorrectTab = activeTab === "pendientes" ? !isDelivered : isDelivered;
      if (!isCorrectTab) return false;

      // Si estamos en la pestaña de entregados, aplicamos el filtro por mes y año
      if (activeTab === "entregados") {
        const outDateRaw = out.date || out.fechaSalida || out.createdAt;
        let date: Date;
        if (outDateRaw?.toDate) date = outDateRaw.toDate();
        else date = new Date(outDateRaw);

        const monthMatch = date.getMonth().toString() === selectedMonth;
        const yearMatch = date.getFullYear().toString() === selectedYear;
        return monthMatch && yearMatch;
      }

      return true;
    });
  }, [outputs, searchTerm, activeTab, selectedMonth, selectedYear]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current.toString(), (current - 1).toString(), (current - 2).toString()];
  }, []);

  const handleToggleSelect = (id: string) => {
    if (!canEdit) return;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDeliverLot = async (outputId: string, lotNumber: string) => {
    if (!canEdit) return;
    const output = outputs.find(o => o.id === outputId);
    if (!output) return;
    try {
      const batch = writeBatch(db);
      const itemToDeliver = output.itemsDispatched.find((i: any) => getVisibleLotName(i) === lotNumber.toUpperCase());
      if (!itemToDeliver) return;
      
      const updatedItems = (output.itemsDispatched || []).map((item: any) => {
        if (getVisibleLotName(item) === lotNumber.toUpperCase()) {
          return { ...item, isClientDelivered: true, clientDeliveryTimestamp: new Date().toISOString(), entregadoPor: user?.displayName || "sistema" };
        }
        return item;
      });
      batch.update(doc(db, "outputs", outputId), { itemsDispatched: updatedItems, updatedAt: serverTimestamp() });
      
      const entryRef = doc(db, "entries", itemToDeliver.parentIngresoMaestro);
      const entrySnap = await getDoc(entryRef);
      if (entrySnap.exists()) {
        const entryData = entrySnap.data();
        const updatedLotes = (entryData.lotes || []).map((l: any) => {
          if (getVisibleLotName(l) === lotNumber.toUpperCase()) return { ...l, productionStatus: "Completed", status: "ready" };
          return l;
        });
        batch.update(entryRef, { lotes: updatedLotes, updatedAt: serverTimestamp() });
      }
      await batch.commit();
      toast({ title: "Lote Entregado" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const handleDeliverSelected = async () => {
    if (!canEdit || selectedIds.length === 0) return;
    setProcessingBulk(true);
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      const currentUser = user?.displayName || "sistema";
      const entriesToUpdate = new Map<string, Set<string>>();
      
      selectedIds.forEach(id => {
        const out = outputs.find(o => o.id === id);
        if (out) {
          const updatedItems = (out.itemsDispatched || []).map((item: any) => {
            const entryId = item.parentIngresoMaestro;
            const lotNum = getVisibleLotName(item);
            if (entryId && lotNum !== "S/L") {
              if (!entriesToUpdate.has(entryId)) entriesToUpdate.set(entryId, new Set());
              entriesToUpdate.get(entryId)!.add(lotNum);
            }
            return { ...item, isClientDelivered: true, clientDeliveryTimestamp: now, entregadoPor: currentUser };
          });
          batch.update(doc(db, "outputs", id), { itemsDispatched: updatedItems, updatedAt: serverTimestamp() });
        }
      });
      
      for (const [entryId, lotNumbers] of entriesToUpdate.entries()) {
        const entryRef = doc(db, "entries", entryId);
        const entrySnap = await getDoc(entryRef);
        if (entrySnap.exists()) {
          const entryData = entrySnap.data();
          const updatedLotes = (entryData.lotes || []).map((l: any) => {
            const lid = getVisibleLotName(l);
            if (lotNumbers.has(lid)) return { ...l, productionStatus: "Completed", status: "ready" };
            return l;
          });
          batch.update(entryRef, { lotes: updatedLotes, updatedAt: serverTimestamp() });
        }
      }
      await batch.commit();
      toast({ title: "Entregas Confirmadas" });
      setSelectedIds([]);
    } catch (error) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setProcessingBulk(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase">Confirmación de Entregas</h1>
          <p className="text-muted-foreground text-sm font-medium">Recepción final del cliente basada en guías de salida.</p>
          {isReadOnly && <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3 mt-2">Modo Solo Lectura</Badge>}
        </div>
        {canEdit && selectedIds.length > 0 && activeTab === "pendientes" && (
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl flex items-center gap-6 shadow-sm">
            <div className="flex flex-col"><span className="text-[10px] font-black text-primary uppercase">Seleccionadas</span><span className="text-2xl font-black text-primary">{selectedIds.length}</span></div>
            <Button onClick={handleDeliverSelected} disabled={processingBulk} className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-xs h-12 px-8 rounded-xl shadow-xl gap-2">{processingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />} Entregar Seleccionadas</Button>
            <Button variant="ghost" size="icon" onClick={() => setSelectedIds([])} className="h-10 w-10 text-muted-foreground hover:text-red-500 rounded-full"><X className="h-5 w-5" /></Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedIds([]); }} className="w-full space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <TabsList className="bg-muted/30 border border-border p-1 h-12">
            <TabsTrigger value="pendientes" className="px-8 rounded-lg font-bold text-xs uppercase gap-2"><Clock className="h-3.5 w-3.5" /> Pendientes</TabsTrigger>
            <TabsTrigger value="entregados" className="px-8 rounded-lg font-bold text-xs uppercase gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Entregados</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-4">
            {activeTab === "entregados" && (
              <div className="flex items-center gap-2 bg-muted/20 p-1 rounded-xl border border-border">
                <div className="flex items-center gap-2 px-3 text-[10px] font-black uppercase text-muted-foreground border-r border-border">
                  <Filter className="h-3 w-3" />
                  Periodo
                </div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="h-9 border-none bg-transparent text-[11px] font-bold w-32 shadow-none focus:ring-0">
                    <SelectValue placeholder="Mes" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="h-9 border-none bg-transparent text-[11px] font-bold w-24 shadow-none focus:ring-0">
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar guía o cliente..." 
                className="pl-12 erp-input h-11" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-card overflow-hidden shadow-premium">
          <div className="bg-muted/10 p-4 border-b border-border flex justify-between items-center">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              {activeTab === "entregados" 
                ? `Entregas de ${MESES.find(m => m.value === selectedMonth)?.label} ${selectedYear}`
                : "Entregas Pendientes de Confirmación"}
            </h3>
            <Badge variant="outline" className="bg-background font-black text-primary border-border h-6 px-3">
              {filteredOutputs.length} Registros
            </Badge>
          </div>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-b border-border hover:bg-transparent">
                {canEdit && activeTab === "pendientes" && <TableHead className="w-12 pl-6"><Checkbox checked={selectedIds.length === filteredOutputs.length && filteredOutputs.length > 0} onCheckedChange={() => { if(selectedIds.length === filteredOutputs.length) setSelectedIds([]); else setSelectedIds(filteredOutputs.map(o => o.id)); }} className="border-border data-[state=checked]:bg-primary"/></TableHead>}
                <TableHead className="w-12 text-center"></TableHead>
                <TableHead className="text-[11px] font-black uppercase py-5">Guía de Salida</TableHead>
                <TableHead className="text-[11px] font-black uppercase">Socio Industrial</TableHead>
                <TableHead className="text-[11px] font-black uppercase text-center">Fecha Salida</TableHead>
                <TableHead className="text-[11px] font-black uppercase text-center">Lotes</TableHead>
                <TableHead className="text-[11px] font-black uppercase text-right pr-8">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={7} className="h-64 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20"/></TableCell></TableRow>
              : filteredOutputs.length > 0 ? filteredOutputs.map((output) => (
                <React.Fragment key={output.id}>
                  <TableRow className={cn("border-b border-border hover:bg-muted/20 transition-colors group", expandedRows[output.id] && "bg-muted/10", selectedIds.includes(output.id) && "bg-primary/5")}>
                    {canEdit && activeTab === "pendientes" && <TableCell className="pl-6"><Checkbox checked={selectedIds.includes(output.id)} onCheckedChange={() => handleToggleSelect(output.id)}/></TableCell>}
                    <TableCell className="text-center" onClick={() => toggleRow(output.id)}><button className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-all">{expandedRows[output.id] ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />}</button></TableCell>
                    <TableCell onClick={() => toggleRow(output.id)} className="cursor-pointer"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Truck className="h-4.5 w-4.5" /></div><span className="font-black text-foreground">{getGuiaRaw(output)}</span></div></TableCell>
                    <TableCell onClick={() => toggleRow(output.id)} className="cursor-pointer"><span className="font-bold text-foreground uppercase truncate block max-w-[250px]">{getClienteSalida(output)}</span></TableCell>
                    <TableCell onClick={() => toggleRow(output.id)} className="text-center cursor-pointer"><span className="text-xs font-medium text-muted-foreground">{formatFechaEC(output.date || output.fechaSalida)}</span></TableCell>
                    <TableCell onClick={() => toggleRow(output.id)} className="text-center cursor-pointer"><Badge variant="outline" className="bg-muted/50 border-none font-black text-primary">{(output.itemsDispatched || []).length}</Badge></TableCell>
                    <TableCell className="text-right pr-8" onClick={() => toggleRow(output.id)}><Badge variant="outline" className={cn("text-[9px] font-black uppercase border-none px-3 py-1", activeTab === "entregados" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>{activeTab === "entregados" ? 'Entregado' : 'Pendiente'}</Badge></TableCell>
                  </TableRow>
                  {expandedRows[output.id] && (
                    <TableRow className="bg-muted/5">
                      <TableCell colSpan={7} className="p-0 border-b border-border">
                        <div className="p-8 space-y-6">
                          <h4 className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2"><PackageCheck className="h-4 w-4" /> Detalle de Lotes</h4>
                          <div className="rounded-2xl border border-border bg-background overflow-hidden">
                            <Table>
                              <TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[9px] font-black uppercase py-3 pl-6">Lote</TableHead><TableHead className="text-[9px] font-black uppercase text-center">Estado</TableHead><TableHead className="text-[9px] font-black uppercase text-right pr-6">Acción</TableHead></TableRow></TableHeader>
                              <TableBody>
                                {(output.itemsDispatched || []).map((item: any, idx: number) => {
                                  const lotVisible = getVisibleLotName(item);
                                  return (
                                    <TableRow key={idx} className="border-b border-border last:border-0">
                                      <TableCell className="pl-6 font-black text-xs text-primary">{lotVisible}</TableCell>
                                      <TableCell className="text-center"><Badge className={cn("text-[8px] font-black uppercase px-2 h-5 rounded-full border-none", item.isClientDelivered ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>{item.isClientDelivered ? 'Entregado' : 'En Tránsito'}</Badge></TableCell>
                                      <TableCell className="text-right pr-6">{canEdit && !item.isClientDelivered && <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg gap-1.5" onClick={() => handleDeliverLot(output.id, lotVisible)}><CheckCircle2 className="h-3 w-3" /> Entregar</Button>}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )) : <TableRow><TableCell colSpan={7} className="h-64 text-center opacity-20"><Truck className="h-16 w-16 mx-auto mb-4"/><p className="text-sm font-black uppercase">Sin registros en este periodo</p></TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Tabs>
    </div>
  );
}