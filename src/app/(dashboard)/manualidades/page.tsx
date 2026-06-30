
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Info, FileText, ShieldAlert, Users, CheckCircle2, Search, Building2, Zap, AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  doc, 
  Timestamp,
  writeBatch,
  getDoc
} from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export default function ManualidadesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [loadingConfig, setLoadingLoadingConfig] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [showConfirm, setReverseShowConfirm] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  
  const [manualWorkers, setManualWorkers] = useState<string[]>([]);
  const [manualidadesCatalog, setManualidadesCatalog] = useState<string[]>([]);
  const [especificaciones, setEspecificaciones] = useState<string[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const isReadOnly = user?.role === "socio";
  const [isLookingUpLot, setIsLookingUpLot] = useState(false);
  const [lotError, setLotError] = useState<string | null>(null);

  const isAdmin = user?.displayName === 'EDGAR ADMIN' || user?.email === 'ugeofly@hotmail.com';
  const todayDate = new Date();
  const isOperarioRestrictionActive = !isAdmin && todayDate.getDate() >= 2;

  const getLocalDateString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    operarioId: "", operarioNombre: "", fecha: getLocalDateString(), clienteId: "", clienteNombre: "", loteNumero: "", proceso: "", tipoPrenda: "Adulto", especificacionPrenda: "", cantidad: "", precioUnitario: 0, total: 0
  });

  useEffect(() => {
    if (!db) return;
    setMounted(true);
    
    // CARGAR CATÁLOGOS DINÁMICOS (LDDEC 1.6)
    const loadCatalogs = async () => {
      try {
        const [manualSnap, workersSnap, configSnap] = await Promise.all([
          getDocs(query(collection(db, "catalogo_manualidades"), where("active", "==", true), orderBy("name", "asc"))),
          getDocs(collection(db, "trabajadores_manualidades")),
          getDoc(doc(db, "configuracion", "manualidades_config"))
        ]);
        
        setManualidadesCatalog(manualSnap.docs.map(d => String(d.data().name || d.id).toUpperCase()));
        setManualWorkers(workersSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((w: any) => w.activo !== false && w.active !== false)
          .map((w: any) => String(w.nombre || w.name || w.id).toUpperCase())
        );
        
        if (configSnap.exists()) {
          const rawEsp = configSnap.data().especificaciones || [];
          setEspecificaciones(rawEsp.map((e: any) => typeof e === 'object' ? String(e.name || e.nombre || JSON.stringify(e)).toUpperCase() : String(e).toUpperCase()));
        }
      } catch (err) {
        console.warn("Error cargando catálogos:", err);
      } finally {
        setLoadingLoadingConfig(false);
      }
    };

    loadCatalogs();

    const unsubClients = onSnapshot(collection(db, "clients"), (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data(), displayName: String(d.data().name || d.id).toUpperCase() })).sort((a,b) => a.displayName.localeCompare(b.displayName)));
    });

    const unsubTariffs = onSnapshot(collection(db, "manualidad_tarifas"), (snap) => {
      setTariffs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubRecent = onSnapshot(query(collection(db, "manualidades"), orderBy("createdAt", "desc"), limit(5)), (snap) => {
      setRecentActivity(snap.docs.map(d => ({ id: d.id, ...d.data(), hora: d.data().createdAt ? new Date(d.data().createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "" })));
    });

    return () => { unsubClients(); unsubTariffs(); unsubRecent(); };
  }, []);

  useEffect(() => {
    const term = formData.loteNumero.trim().toUpperCase();
    if (term.length < 3) { if (formData.clienteId) setFormData(prev => ({ ...prev, clienteId: "", clienteNombre: "" })); setLotError(null); return; }
    const lookupClient = async () => {
      setIsLookingUpLot(true); setLotError(null);
      try {
        const q = query(collection(db, "entries"), where("loteIdList", "array-contains", term), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const entryData = snap.docs[0].data();
          setFormData(prev => ({ ...prev, clienteId: entryData.clientId || entryData.clienteId, clienteNombre: (entryData.clientName || entryData.clienteNombre || "Socio").toUpperCase() }));
        } else { setLotError("Lote no encontrado"); setFormData(prev => ({ ...prev, clienteId: "", clienteNombre: "" })); }
      } catch (err) { console.error(err); } finally { setIsLookingUpLot(false); }
    };
    const timer = setTimeout(lookupClient, 600);
    return () => clearTimeout(timer);
  }, [formData.loteNumero]);

  useEffect(() => {
    const tariff = tariffs.find(t => String(t.processName || t.manualidad).toUpperCase() === String(formData.proceso).toUpperCase());
    if (tariff) {
      const price = formData.tipoPrenda === 'Adulto' ? (tariff.adultPrice || tariff.precioAdulto) : (tariff.childPrice || tariff.precioNino);
      const qty = parseFloat(formData.cantidad) || 0;
      setFormData(prev => ({ ...prev, precioUnitario: price, total: price * qty }));
    } else setFormData(prev => ({ ...prev, precioUnitario: 0, total: 0 }));
  }, [formData.proceso, formData.tipoPrenda, formData.cantidad, tariffs]);

  const handleFinalSave = async () => {
    try {
      const loteFormatted = formData.loteNumero.toUpperCase().trim();
      const operarioFormatted = formData.operarioNombre.toUpperCase().trim();
      const procesoFormatted = formData.proceso.toUpperCase().trim();
      const cantidadNum = Number(formData.cantidad);
      
      // 1. Backend Validation for Date Manipulation
      let finalFecha = formData.fecha;
      if (isOperarioRestrictionActive) {
        finalFecha = getLocalDateString(); // Force today's date, ignoring frontend tampering
      }

      // 2. Validación estricta de duplicados en Firestore
      const qDup = query(
        collection(db, "manualidades"),
        where("loteNumero", "==", loteFormatted),
        where("operarioNombre", "==", operarioFormatted),
        where("proceso", "==", procesoFormatted),
        where("cantidad", "==", cantidadNum)
      );
      
      const dupSnap = await getDocs(qDup);
      const activeDuplicates = dupSnap.docs.filter(docSnap => docSnap.data()?.estado !== "rechazado");

      if (activeDuplicates.length > 0) {
        toast({ 
          variant: "destructive", 
          title: "Error: Este registro ya existe exactamente igual para este operario." 
        });
        setReverseShowConfirm(false);
        return;
      }

      const payload = { ...formData, operarioId: operarioFormatted, operarioNombre: operarioFormatted, loteNumero: loteFormatted, proceso: procesoFormatted, especificacionPrenda: formData.especificacionPrenda.toUpperCase().trim(), cantidad: cantidadNum, estado: "pendiente", createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdByUid: user?.uid || "system", createdBy: user?.displayName || "system", fechaStr: finalFecha, fecha: finalFecha };
      await addDoc(collection(db, "manualidades"), payload);
      toast({ title: "Registro Exitoso" });
      setReverseShowConfirm(false);
      setFormData(prev => ({ ...prev, loteNumero: "", cantidad: "", clienteId: "", clienteNombre: "" }));
    } catch (error) { 
      console.error("Error al guardar:", error);
      toast({ variant: "destructive", title: "Error al guardar el registro" }); 
    }
  };

  if (!mounted || loadingConfig) return <div className="min-h-[400px] flex flex-col items-center justify-center gap-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sincronizando catálogos...</p></div>;

  return (
    <div className="max-w-[1100px] mx-auto space-y-10 py-8 animate-in fade-in duration-500">
      <div className="text-center space-y-1"><h1 className="text-3xl font-bold text-foreground">Terminal de Manualidades</h1><div className="flex items-center justify-center gap-2">{isReadOnly ? <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3 mt-2">Modo Solo Lectura</Badge> : <p className="text-[10px] font-black uppercase text-primary tracking-widest">Operador: {user?.displayName}</p>}</div></div>
      <div className="bg-card p-10 rounded-[3rem] border border-border shadow-premium relative">
        {(isSearching || isLookingUpLot) && <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-[3rem]"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Operario</Label>
              <Select disabled={isReadOnly} value={formData.operarioNombre} onValueChange={(val) => setFormData({...formData, operarioId: val, operarioNombre: val})}>
                <SelectTrigger className="h-12 border-border bg-muted/20 text-sm font-bold rounded-xl"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                <SelectContent className="bg-card border-border max-h-[300px] rounded-xl shadow-2xl">
                  {manualWorkers.map((op, i) => (
                    <SelectItem key={`${op}-${i}`} value={op} className="font-bold uppercase text-xs py-3">{op}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-sm font-semibold flex items-center gap-2"><Search className="h-4 w-4 text-primary" /> Número de Lote</Label><Input readOnly={isReadOnly} placeholder="Ej: 21220" className={cn("h-12 border-border font-black text-sm text-primary rounded-xl", lotError ? "border-destructive bg-destructive/5" : "bg-muted/20")} value={formData.loteNumero} onChange={(e) => setFormData({...formData, loteNumero: e.target.value.toUpperCase()})} />{lotError && <p className="text-[10px] font-bold text-destructive uppercase flex items-center gap-1.5 ml-1"><AlertTriangle className="h-3 w-3" /> {lotError}</p>}</div>
            <div className="space-y-1.5"><Label className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Socio Industrial</Label><Input readOnly value={formData.clienteNombre} placeholder="Auto-asignado" className="h-12 border-border bg-muted/10 text-xs font-bold rounded-xl uppercase opacity-80" /></div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Manualidad</Label>
              <Select disabled={isReadOnly} value={formData.proceso} onValueChange={(val) => setFormData({...formData, proceso: val})}>
                <SelectTrigger className="h-12 border-border bg-muted/20 text-sm rounded-xl"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                <SelectContent className="bg-card border-border max-h-[300px] rounded-xl">
                  {manualidadesCatalog.map((p, i) => (
                    <SelectItem key={`${p}-${i}`} value={p} className="uppercase text-xs">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-5">
            <div className="space-y-1.5"><Label className="text-sm font-semibold">Fecha</Label><Popover><PopoverTrigger asChild><Button disabled={isReadOnly || isOperarioRestrictionActive} variant="outline" className="w-full h-12 border-border bg-muted/20 justify-start text-left font-bold text-sm rounded-xl"><CalendarIcon className="mr-2 h-4 w-4 text-primary" />{formData.fecha ? format(parseISO(formData.fecha), "dd/MM/yyyy") : "Fecha"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start"><Calendar mode="single" selected={parseISO(formData.fecha)} onSelect={(d) => setFormData({...formData, fecha: d ? format(d, "yyyy-MM-dd") : ""})} locale={es} initialFocus /></PopoverContent></Popover></div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Especificación</Label>
              <Select disabled={isReadOnly} value={formData.especificacionPrenda} onValueChange={(val) => setFormData({...formData, especificacionPrenda: val})}>
                <SelectTrigger className="h-12 border-border bg-muted/20 text-sm rounded-xl"><SelectValue placeholder="Opcional..." /></SelectTrigger>
                <SelectContent className="bg-card border-border max-h-[300px] rounded-xl">
                  {especificaciones.map((esp, i) => (
                    <SelectItem key={`${esp}-${i}`} value={esp} className="uppercase text-xs">{esp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Tipo</Label>
              <Select disabled={isReadOnly} value={formData.tipoPrenda} onValueChange={(val) => setFormData({...formData, tipoPrenda: val})}>
                <SelectTrigger className="h-12 border-border bg-muted/20 text-sm rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Adulto">Prenda Adulto / Prenda Grande</SelectItem><SelectItem value="Niño">Prenda Niño / Prenda Pequeña</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-sm font-semibold">Cantidad</Label><Input readOnly={isReadOnly} type="number" placeholder="0" className="h-12 border-border bg-muted/20 font-black text-2xl text-center rounded-xl" value={formData.cantidad} onChange={(e) => setFormData({...formData, cantidad: e.target.value})} /></div>
          </div>
        </div>
        <div className="flex gap-4 justify-center pt-10">
          {!isReadOnly && (
            <>
              <Button onClick={() => setFormData({...formData, loteNumero: "", cantidad: "", clienteId: "", clienteNombre: ""})} variant="outline" className="h-14 px-12 rounded-2xl font-black uppercase text-xs">LIMPIAR</Button>
              <Button onClick={() => setReverseShowConfirm(true)} disabled={!formData.clienteId || !formData.proceso || !formData.cantidad} className="h-14 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase px-14 rounded-2xl shadow-xl shadow-primary/20">GUARDAR TRABAJO</Button>
            </>
          )}
        </div>
      </div>
      <div className="space-y-6 pt-4"><h3 className="text-sm font-black text-muted-foreground uppercase text-center tracking-[0.3em]">ACTIVIDAD RECIENTE</h3><div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-premium"><Table><TableHeader className="bg-muted/50"><TableRow><TableHead className="text-[10px] font-black uppercase py-4 pl-8">HORA</TableHead><TableHead className="text-[10px] font-black uppercase">OPERARIO</TableHead><TableHead className="text-[10px] font-black uppercase">LOTE</TableHead><TableHead className="text-[10px] font-black uppercase">MANUALIDAD</TableHead><TableHead className="text-[10px] font-black uppercase text-center">CANT.</TableHead><TableHead className="text-[10px] font-black uppercase text-center pr-8">CATEGORÍA</TableHead></TableRow></TableHeader><TableBody>{recentActivity.map((item) => (<TableRow key={item.id} className="border-b border-border hover:bg-muted/5"><TableCell className="text-[11px] font-medium text-muted-foreground py-5 pl-8">{item.hora}</TableCell><TableCell className="text-xs font-bold uppercase">{item.operarioNombre}</TableCell><TableCell className="text-xs font-black text-primary uppercase">{item.loteNumero}</TableCell><TableCell className="text-xs font-medium uppercase">{item.proceso}</TableCell><TableCell className="text-sm font-black text-center">{item.cantidad}</TableCell><TableCell className="text-center pr-8"><Badge variant="outline" className={cn("text-[9px] font-black border-none px-3 py-1 rounded-full", item.tipoPrenda === 'Adulto' ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600")}>{item.tipoPrenda === 'Adulto' ? 'Prenda Adulto / Prenda Grande' : item.tipoPrenda === 'Niño' ? 'Prenda Niño / Prenda Pequeña' : item.tipoPrenda}</Badge></TableCell></TableRow>))}</TableBody></Table></div></div>
      <AlertDialog open={showConfirm} onOpenChange={setReverseShowConfirm}><AlertDialogContent className="rounded-[2.5rem] max-w-md border-none shadow-2xl bg-card p-10"><AlertDialogHeader className="items-center text-center"><AlertDialogTitle className="text-2xl font-black tracking-tight flex flex-col items-center gap-4"><CheckCircle2 className="h-14 w-14 text-primary" />Confirmar Registro</AlertDialogTitle><AlertDialogDescription asChild><div className="space-y-6 pt-4"><div className="bg-muted/30 p-8 rounded-[2rem] border border-border space-y-4 text-left"><div className="flex justify-between text-xs font-bold uppercase"><span className="text-muted-foreground">Operario:</span><span>{formData.operarioNombre}</span></div><div className="flex justify-between text-xs font-bold uppercase"><span className="text-muted-foreground">Lote:</span><span className="text-primary">{formData.loteNumero}</span></div><div className="flex justify-between text-xs font-bold uppercase"><span className="text-muted-foreground">Manualidad:</span><span>{formData.proceso}</span></div><div className="flex justify-between text-xs font-bold uppercase border-t border-border pt-2"><span className="text-muted-foreground">Cantidad:</span><span>{formData.cantidad} prendas</span></div></div></div></AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="flex gap-3 pt-6"><AlertDialogCancel className="flex-1 rounded-xl h-12 font-bold text-xs uppercase">Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleFinalSave} className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl h-12 font-black text-xs uppercase shadow-lg">CONFIRMAR</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
