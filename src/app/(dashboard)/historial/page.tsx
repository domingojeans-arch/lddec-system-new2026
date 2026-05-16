"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Printer, 
  Calendar as CalendarIcon, 
  Building2, 
  FileText, 
  ArrowDownCircle, 
  CheckCircle2, 
  Clock,
  ChevronRight,
  Loader2,
  Wallet,
  Trash2,
  Edit3,
  AlertTriangle,
  History as HistoryIcon,
  Layers,
  ArrowRight,
  Receipt,
  Eye,
  X
} from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc, 
  orderBy, 
  updateDoc, 
  Timestamp,
  serverTimestamp,
  limit
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { calculateClientAccountingMetrics } from "@/lib/accounting-motor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toDate } from "@/lib/toDate";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const statusMap: Record<string, string> = {
  "Por Cobrar": "bg-amber-100 text-amber-700 border-amber-200",
  "Parcialmente Cobrada": "bg-blue-100 text-blue-700 border-blue-200",
  "Pagada": "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function getEntryVisible(item: any, id: string): string {
  const candidates = [item.numeroIngreso, item.entryNumber, item.numeroIngresoMaestro, item.numero];
  for (const val of candidates) {
    if (val && String(val).length < 18 && val !== "undefined" && val !== "[object Object]") return String(val).toUpperCase();
  }
  return id && id.length < 18 ? id.toUpperCase() : "INGRESO S/N";
}

function getInvoiceBadgeInfo(inv: any) {
  const num = inv.numeroFactura || inv.id;
  const total = Number(inv.totalFactura || inv.total || 0);
  const pagos = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : []);
  const abonado = pagos.reduce((acc, p) => p.anulado ? acc : (p.tipoTransaccion === 'Reverso' ? acc - Number(p.monto || 0) : acc + Number(p.monto || 0)), 0);
  const saldo = Math.max(0, total - abonado);
  
  const d = toDate(inv.fechaFactura || inv.createdAt || inv.invoiceDate || Date.now());
  const fechaVencimiento = new Date(d ? d.getTime() : Date.now());
  const diasCredito = Number(inv.diasCredito || 0);
  fechaVencimiento.setDate(fechaVencimiento.getDate() + diasCredito);
  
  const isVencida = fechaVencimiento < new Date() && saldo > 0;

  if (saldo <= 0.01) {
    return { text: `FACTURA: ${num} PAGADA`, colors: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  }
  if (abonado > 0.01 && saldo > 0.01) {
    return { text: `FACTURA: ${num} PAGO PARCIAL`, colors: "text-blue-700 bg-blue-50 border-blue-200" };
  }
  if (abonado <= 0.01 && isVencida) {
    return { text: `FACTURA VENCIDA`, colors: "text-red-700 bg-red-50 border-red-200" };
  }
  return { text: `FACTURA: PENDIENTE`, colors: "text-amber-600 bg-amber-50 border-amber-200" };
}

export default function HistorialPage() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === "administrador" || authUser?.role === "admin" || authUser?.role === "ADMIN";
  const isCobranzas = authUser?.role === "cobranzas" || authUser?.role === "COBRANZAS";
  
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);

  // Estados para el Modal de Detalles (Ojito)
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useEffect(() => {
    if (!db) return;
    const loadClients = async () => {
      const snap = await getDocs(collection(db, "clients"));
      
      const mapped = snap.docs.map(d => {
        const data = d.data();
        const rawName = (data.name || data.nombre || "").trim().toUpperCase();
        return { id: d.id, ...data, displayName: rawName };
      });
      
      const sorted = mapped.sort((a, b) => 
        a.displayName.localeCompare(b.displayName, 'es', { sensitivity: 'base' })
      );
      setClients(sorted);
    };
    loadClients();
  }, []);

  const handleGenerateAudit = async () => {
    if (!selectedClientId) {
      toast({ variant: "destructive", title: "Atención", description: "Seleccione un cliente para auditar." });
      return;
    }

    setLoading(true);
    setAuditData(null);

    try {
      const clientDoc = await getDoc(doc(db, "clients", selectedClientId));
      const clientData = clientDoc.data() || {};
      const baseDebt = Number(clientData.baseDebt || clientData.saldoInicial || 0);

      // 1. Obtener todas las facturas y filtrar en memoria por clientId/clienteId
      const qInvoices = query(collection(db, "facturas"));
      const invoicesSnap = await getDocs(qInvoices);
      const allInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const clientInvoices = allInvoices.filter((inv: any) => 
        inv.clientId === selectedClientId || inv.clienteId === selectedClientId
      );

      // 2. Hacer lo mismo para ingresos (por si acaso existen como clienteId)
      const qEntries = query(collection(db, "entries"));
      const entriesSnap = await getDocs(qEntries);
      const allEntries = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const clientEntries = allEntries.filter((entry: any) => 
        entry.clientId === selectedClientId || entry.clienteId === selectedClientId
      );

      const timeline: any[] = [];

      if (baseDebt > 0) {
        timeline.push({
          type: "INITIAL_BALANCE_DOC",
          date: new Date("2026-01-01T12:00:00"),
          id: "initial-balance-2026",
          number: "SALDO INICIAL 2026",
          monto: baseDebt,
          movimientos: clientData?.pagosSaldoInicial || [],
          clientId: selectedClientId,
          description: "Documento base de apertura del período fiscal 2026."
        });
      }

      clientEntries.forEach((entry: any) => {
        const entryId = entry.id;
        const entryVisible = getEntryVisible(entry, entryId);
        
        const associatedInvoices = clientInvoices.filter((inv: any) => {
          const checkIds = [
            inv.ingresoMaestroId, 
            inv.referencia, 
            inv.ref, 
            inv.numeroIngreso, 
            inv.entryNumber,
            ...(Array.isArray(inv.ingresoMaestroIds) ? inv.ingresoMaestroIds : [])
          ].filter(Boolean).map(String).map(s => s.trim().toUpperCase());

          const targetId = String(entryId).trim().toUpperCase();
          const targetVisible = String(entryVisible).trim().toUpperCase();

          return checkIds.includes(targetId) || checkIds.includes(targetVisible);
        });

        const entryDate = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date || entry.entryDate || entry.createdAt);

        timeline.push({
          type: "entry",
          date: entryDate,
          id: entryId,
          number: entry.entryNumber || entryId,
          data: entry,
          invoices: associatedInvoices.map(inv => {
            const invDate = inv.fechaFactura?.toDate ? inv.fechaFactura.toDate() : new Date(inv.fechaFactura || inv.createdAt || inv.invoiceDate);
            return {
              ...inv,
              displayDate: invDate,
              movimientos: Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : []
            };
          })
        });
      });

      clientInvoices.forEach((inv: any) => {
        const checkIds = [
          inv.ingresoMaestroId, 
          inv.referencia, 
          inv.ref, 
          inv.numeroIngreso, 
          inv.entryNumber,
          ...(Array.isArray(inv.ingresoMaestroIds) ? inv.ingresoMaestroIds : [])
        ].filter(Boolean).map(String).map(s => s.trim().toUpperCase());

        const isLinked = clientEntries.some(e => {
          const eVisible = getEntryVisible(e, e.id);
          const targetId = String(e.id).trim().toUpperCase();
          const targetVisible = String(eVisible).trim().toUpperCase();
          return checkIds.includes(targetId) || checkIds.includes(targetVisible);
        });

        if (!isLinked) {
          const invDate = inv.fechaFactura?.toDate ? inv.fechaFactura.toDate() : new Date(inv.fechaFactura || inv.createdAt || inv.invoiceDate);
          timeline.push({
            type: "invoice_standalone",
            date: invDate,
            id: inv.id,
            number: inv.numeroFactura || inv.id,
            data: inv,
            movimientos: Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : []
          });
        }
      });

      let filteredTimeline = timeline;
      if (dateFrom && dateTo) {
        const start = new Date(dateFrom + "T00:00:00");
        const end = new Date(dateTo + "T23:59:59");
        filteredTimeline = timeline.filter(item => item.date >= start && item.date <= end);
      }

      filteredTimeline.sort((a, b) => b.date.getTime() - a.date.getTime());

      const invoicePayments = clientInvoices.flatMap(inv => Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : []);
      const metrics = calculateClientAccountingMetrics(
        baseDebt,
        dateFrom || "2026-01-01",
        dateTo || new Date().toISOString().split('T')[0],
        clientInvoices,
        invoicePayments,
        clientData
      );

      setAuditData({
        client: clientData,
        summary: {
          baseDebt,
          totalFacturado: metrics.facturacion,
          totalCobrado: metrics.cobro + metrics.retencion + metrics.nc,
          saldoPendienteGeneral: metrics.saldoActual
        },
        timeline: filteredTimeline
      });

    } catch (error) {
      console.error("Audit Error:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el historial." });
    } finally {
      setLoading(false);
    }
  };

  const handleAnnullPayment = async (docId: string, paymentId: string, isInitialBalance = false, pagoConfirmado = false) => {
    const canDelete = isAdmin || (isCobranzas && !pagoConfirmado);

    if (!canDelete) {
      toast({ variant: "destructive", title: "Acceso Denegado", description: "No tienes permisos para eliminar este pago." });
      return;
    }

    if (!confirm("¿Seguro que deseas eliminar este pago? Esta acción recalculará los saldos de forma definitiva.")) return;

    try {
      if (isInitialBalance) {
        const clientRef = doc(db, "clients", docId);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) return;

        const currentPagos = clientSnap.data().pagosSaldoInicial || [];
        const updatedPagos = currentPagos.map((p: any) => {
          if (p.id === paymentId) {
            return { ...p, anulado: true, updatedAt: new Date().toISOString(), anuladoPor: authUser?.displayName || "Admin" };
          }
          return p;
        });

        await updateDoc(clientRef, {
          pagosSaldoInicial: updatedPagos,
          updatedAt: serverTimestamp()
        });
      } else {
        const invRef = doc(db, "facturas", docId);
        const invSnap = await getDoc(invRef);
        if (!invSnap.exists()) return;

        const data = invSnap.data();
        const currentPagos = data.pagosYajustes || [];
        
        const updatedPagos = currentPagos.map((p: any) => {
          if (p.id === paymentId) {
            return { ...p, anulado: true, updatedAt: new Date().toISOString(), anuladoPor: authUser?.displayName || "Admin" };
          }
          return p;
        });

        const totalAbonado = updatedPagos.reduce((acc, p) => 
          p.anulado ? acc : (p.tipoTransaccion === 'Reverso' ? acc - Number(p.monto || 0) : acc + Number(p.monto || 0)), 0
        );
        const originalTotal = Number(data.totalFactura || data.total || 0);
        const nuevoSaldo = Math.max(0, originalTotal - totalAbonado);

        await updateDoc(invRef, {
          pagosYajustes: updatedPagos,
          saldoPendiente: nuevoSaldo,
          estadoCobranza: nuevoSaldo <= 0.01 ? "Pagada" : totalAbonado > 0 ? "Parcialmente Cobrada" : "Por Cobrar",
          updatedAt: serverTimestamp()
        });
      }

      toast({ title: "Movimiento Anulado con Éxito" });
      setIsDetailOpen(false);
      handleGenerateAudit(); 
    } catch (error: any) {
      console.error("Delete Payment Error:", error);
      toast({ variant: "destructive", title: "Error técnico", description: error.message || "No se pudo anular el pago." });
    }
  };

  const handleConfirmPayment = async (docId: string, paymentId: string, isInitialBalance = false) => {
    if (!isCobranzas && !isAdmin) {
      toast({ variant: "destructive", title: "Acceso Denegado", description: "Solo cobranzas o administradores pueden confirmar pagos." });
      return;
    }

    if (!confirm("¿Seguro que deseas marcar este pago como confirmado?")) return;

    try {
      if (isInitialBalance) {
        const clientRef = doc(db, "clients", docId);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) return;

        const updatedPagos = (clientSnap.data().pagosSaldoInicial || []).map((p: any) => 
          p.id === paymentId ? { ...p, confirmado: true, confirmadoPor: authUser?.displayName || "Usuario" } : p
        );
        await updateDoc(clientRef, { pagosSaldoInicial: updatedPagos, updatedAt: serverTimestamp() });
      } else {
        const invRef = doc(db, "facturas", docId);
        const invSnap = await getDoc(invRef);
        if (!invSnap.exists()) return;

        const updatedPagos = (invSnap.data().pagosYajustes || []).map((p: any) => 
          p.id === paymentId ? { ...p, confirmado: true, confirmadoPor: authUser?.displayName || "Usuario" } : p
        );
        await updateDoc(invRef, { pagosYajustes: updatedPagos, updatedAt: serverTimestamp() });
      }
      
      toast({ title: "Pago Confirmado Correctamente" });
      handleGenerateAudit();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo confirmar el pago." });
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
  };

  const formatDateRow = (rawDate: any) => {
    if (!rawDate) return "S/F";
    let d = toDate(rawDate);
    if (!d) return "S/F";
    return format(d, 'dd/MM/yy');
  };

  const dateFromObj = dateFrom ? parseISO(dateFrom) : undefined;
  const dateToObj = dateTo ? parseISO(dateTo) : undefined;

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      
      <div className="space-y-1">
        <h1 className="text-5xl font-black tracking-tighter uppercase">Historial de Auditoría</h1>
        <p className="text-primary text-xs font-black uppercase tracking-[0.3em]">Trazabilidad Cronológica Industrial 1.1</p>
      </div>

      <div className="bg-card p-8 rounded-[2.5rem] border border-border shadow-premium space-y-8 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Socio Industrial</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="erp-input h-12 font-bold">
                <SelectValue placeholder="Elija un cliente..." />
              </SelectTrigger>
              <SelectContent className="rounded-2xl max-h-[350px]">
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Desde</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-12 erp-input bg-background justify-start text-left font-bold text-xs">
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {dateFromObj && isValid(dateFromObj) ? format(dateFromObj, "dd/MM/yyyy") : "Desde..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start">
                <Calendar
                  mode="single"
                  selected={dateFromObj}
                  onSelect={(d) => setDateFrom(d ? format(d, "yyyy-MM-dd") : "")}
                  locale={es}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Hasta</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-12 erp-input bg-background justify-start text-left font-bold text-xs">
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {dateToObj && isValid(dateToObj) ? format(dateToObj, "dd/MM/yyyy") : "Hasta..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start">
                <Calendar
                  mode="single"
                  selected={dateToObj}
                  onSelect={(d) => setDateTo(d ? format(d, "yyyy-MM-dd") : "")}
                  locale={es}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <Button 
          onClick={handleGenerateAudit} 
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] h-14 rounded-2xl shadow-xl shadow-primary/20"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <Search className="h-5 w-5 mr-3" />}
          Generar Auditoría Optimizada
        </Button>
      </div>

      {auditData && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-card p-8 rounded-[2rem] border border-border text-center space-y-1 shadow-sm">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Saldo Inicial Base</p>
              <p className="text-3xl font-black text-foreground">{formatCurrency(auditData.summary.baseDebt)}</p>
            </div>
            <div className="bg-card p-8 rounded-[2rem] border border-border text-center space-y-1 shadow-sm">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Facturado</p>
              <p className="text-3xl font-black text-foreground">{formatCurrency(auditData.summary.totalFacturado)}</p>
            </div>
            <div className="bg-card p-8 rounded-[2rem] border border-border text-center space-y-1 shadow-sm">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Recaudación Lograda</p>
              <p className="text-3xl font-black text-emerald-600">{formatCurrency(auditData.summary.totalCobrado)}</p>
            </div>
            <div className="bg-primary/5 p-8 rounded-[2rem] border border-primary/20 text-center space-y-1 shadow-md">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">Saldo Pendiente Global</p>
              <p className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(auditData.summary.saldoPendienteGeneral)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-border pb-4">
            <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <HistoryIcon className="h-6 w-6 text-primary" />
              Línea de Tiempo Operativa
            </h3>
            <Button variant="outline" onClick={() => window.print()} className="rounded-xl font-bold uppercase text-[10px] gap-2 h-10 px-6">
              <Printer className="h-4 w-4" /> Imprimir Estado
            </Button>
          </div>

          <div className="space-y-12 relative before:absolute before:left-8 before:top-0 before:bottom-0 before:w-0.5 before:bg-muted/50">
            {auditData.timeline.map((event: any, idx: number) => (
              <div key={idx} className="relative pl-20 group">
                <div className={cn(
                  "absolute left-[30px] top-8 h-4 w-4 rounded-full border-4 border-background z-10 transition-transform group-hover:scale-125",
                  event.type === 'entry' ? "bg-primary" : 
                  event.type === 'INITIAL_BALANCE_DOC' ? "bg-amber-500" : "bg-primary"
                )} />

                <div className="space-y-6">
                  <div className={cn(
                    "p-8 rounded-[2.5rem] border shadow-premium transition-all",
                    event.type === 'entry' ? "bg-card border-border" : "bg-amber-50/10 border-amber-200"
                  )}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "h-14 w-14 rounded-2xl flex items-center justify-center",
                          event.type === 'entry' ? "bg-primary/5 text-primary" : "bg-amber-500/5 text-amber-600"
                        )}>
                          {event.type === 'entry' ? <ArrowDownCircle className="h-7 w-7" /> : <Wallet className="h-7 w-7" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                            {event.type === 'entry' ? 'INGRESO MAESTRO' : 'DOCUMENTO VIRTUAL BASE'}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <h4 className="text-lg font-black text-foreground tracking-tight">
                              {event.number}
                            </h4>
                            {event.type === 'entry' && (!event.invoices || event.invoices.length === 0) && (
                              <span className="text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-md text-amber-600 bg-amber-50 border-amber-200">
                                FACTURA: PENDIENTE
                              </span>
                            )}
                            {event.type === 'entry' && event.invoices && event.invoices.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {event.invoices.map((inv: any) => {
                                  const badge = getInvoiceBadgeInfo(inv);
                                  return (
                                    <span key={inv.id} className={cn("text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-md", badge.colors)}>
                                      {badge.text}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {event.type === 'invoice_standalone' && (
                              <div className="flex flex-wrap gap-2">
                                <span className={cn("text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-md", getInvoiceBadgeInfo(event.data).colors)}>
                                  {getInvoiceBadgeInfo(event.data).text}
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
                            {event.date.toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {event.type === 'entry' && (
                          <div className="bg-muted/30 px-6 py-3 rounded-2xl border border-border text-center">
                            <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Volumen</p>
                            <p className="text-lg font-black text-primary">{(event.data.lotes || []).length} <span className="text-xs font-normal">lotes</span></p>
                          </div>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => { setSelectedEvent(event); setIsDetailOpen(true); }}
                          className="h-12 w-12 rounded-full hover:bg-muted"
                        >
                          <Eye className="h-6 w-6 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {auditData?.timeline.length === 0 && (
              <div className="h-64 flex flex-col items-center justify-center opacity-20">
                <HistoryIcon className="h-16 w-16 mb-4" />
                <p className="text-sm font-black uppercase tracking-[0.3em]">Sin registros detectados para este período</p>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl p-0 rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card">
          {selectedEvent && (
            <div className="flex flex-col h-full max-h-[90vh]">
              <div className="p-8 border-b border-border bg-primary/5">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center",
                    selectedEvent.type === 'entry' ? "bg-primary text-white" : "bg-amber-500 text-white"
                  )}>
                    {selectedEvent.type === 'entry' ? <Layers className="h-6 w-6" /> : <Receipt className="h-6 w-6" />}
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                      {selectedEvent.type === 'entry' ? `Detalle Ingreso ${selectedEvent.number}` : 
                       selectedEvent.type === 'INITIAL_BALANCE_DOC' ? `Detalle Saldo Inicial 2026` :
                       `Detalle Factura ${selectedEvent.number}`}
                    </DialogTitle>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Expediente de Auditoría Industrial</p>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 p-8">
                <div className="space-y-10">
                  {selectedEvent.type === 'entry' && (
                    <div className="space-y-8">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="bg-muted/30 p-4 rounded-2xl"><p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Cliente</p><p className="font-bold text-sm uppercase truncate">{auditData?.client?.displayName || "Socio"}</p></div>
                        <div className="bg-muted/30 p-4 rounded-2xl"><p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Fecha</p><p className="font-bold text-sm">{selectedEvent.date.toLocaleDateString('es-EC')}</p></div>
                        <div className="bg-muted/30 p-4 rounded-2xl"><p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Responsable</p><p className="font-bold text-sm uppercase">{selectedEvent.data.responsible || "S/D"}</p></div>
                        <div className="bg-muted/30 p-4 rounded-2xl"><p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Muestras</p><p className="font-bold text-sm">{selectedEvent.data.isSample ? "SÍ" : "NO"}</p></div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[11px] font-black uppercase text-primary border-l-4 border-primary pl-3">Documentos Fiscales Asociados</h4>
                        {selectedEvent.invoices.map((inv: any, iIdx: number) => (
                          <div key={iIdx} className="bg-muted/20 rounded-3xl border border-border/50 p-6 space-y-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <Receipt className="h-5 w-5 text-amber-600" />
                                <div>
                                  <p className="font-black text-base">Factura: {inv.numeroFactura}</p>
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Total: {formatCurrency(inv.totalFactura)}</p>
                                </div>
                              </div>
                              <Badge className={cn("px-3 py-1 font-black text-[9px] uppercase border-none", statusMap[inv.estadoCobranza] || "bg-muted")}>{inv.estadoCobranza}</Badge>
                            </div>

                            <div className="rounded-2xl border border-border/50 bg-background overflow-hidden">
                              <Table>
                                <TableHeader className="bg-muted/50">
                                  <TableRow><TableHead className="text-[9px] font-black uppercase py-3 pl-6">Fecha Pago</TableHead><TableHead className="text-[9px] font-black uppercase">Tipo / Concepto</TableHead><TableHead className="text-[9px] font-black uppercase text-right">Monto</TableHead><TableHead className="text-[9px] font-black uppercase text-right pr-6">Acción</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                  {inv.movimientos.map((pago: any, pIdx: number) => (
                                    <TableRow key={pIdx} className={cn("border-border/50", pago.anulado && "opacity-40 italic")}>
                                      <TableCell className="pl-6 py-3 text-xs">{formatDateRow(pago.fechaTransaccion)}</TableCell>
                                      <TableCell className="text-xs uppercase font-bold">
                                        {pago.tipoTransaccion} 
                                        {pago.anulado && <span className="text-red-500 ml-2">(ANULADO)</span>}
                                        {!pago.anulado && pago.confirmado && <span className="text-emerald-600 ml-2 text-[9px]">(CONFIRMADO)</span>}
                                        {!pago.anulado && !pago.confirmado && <span className="text-amber-600 ml-2 text-[9px]">(NO CONFIRMADO)</span>}
                                      </TableCell>
                                      <TableCell className="text-right font-black text-emerald-600">${Number(pago.monto).toFixed(2)}</TableCell>
                                      <TableCell className="text-right pr-6">
                                        <div className="flex items-center justify-end gap-2">
                                          {!pago.anulado && !pago.confirmado && (isCobranzas || isAdmin) && (
                                            <Button variant="ghost" size="icon" onClick={() => handleConfirmPayment(inv.id, pago.id)} className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" title="Confirmar Pago">
                                              <CheckCircle2 className="h-4 w-4" />
                                            </Button>
                                          )}
                                          {!pago.anulado && (isAdmin || (isCobranzas && !pago.confirmado)) && (
                                            <Button variant="ghost" size="icon" onClick={() => handleAnnullPayment(inv.id, pago.id, false, pago.confirmado)} className="h-7 w-7 text-red-500 hover:bg-red-50" title="Eliminar Pago">
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        ))}
                        {selectedEvent.invoices.length === 0 && <p className="text-center p-10 text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">Sin facturas vinculadas a este ingreso</p>}
                      </div>
                    </div>
                  )}

                  {(selectedEvent.type === 'invoice_standalone' || selectedEvent.type === 'INITIAL_BALANCE_DOC') && (
                    <div className="space-y-8">
                      <div className="bg-muted/20 p-8 rounded-3xl border border-border">
                        <div className="flex items-center gap-4 mb-6">
                          <Wallet className="h-6 w-6 text-amber-600" />
                          <h4 className="font-black text-lg">Detalle del Movimiento Base</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <p className="text-[10px] font-black text-muted-foreground uppercase">Socio</p>
                            <p className="font-bold text-sm uppercase">{auditData?.client?.displayName || "Socio"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-muted-foreground uppercase">Monto Registro</p>
                            <p className="font-black text-lg text-foreground">{formatCurrency(selectedEvent.monto || selectedEvent.data?.totalFactura || 0)}</p>
                          </div>
                        </div>
                        {selectedEvent.description && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <p className="text-[10px] font-black text-muted-foreground uppercase">Observación</p>
                            <p className="text-sm italic">{selectedEvent.description}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[11px] font-black uppercase text-amber-600 border-l-4 border-amber-500 pl-3">Abonos y Ajustes Detectados</h4>
                        <div className="rounded-2xl border border-border bg-background overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted/50">
                              <TableRow><TableHead className="text-[9px] font-black uppercase py-4 pl-8">Fecha</TableHead><TableHead className="text-[9px] font-black uppercase">Tipo / Concepto</TableHead><TableHead className="text-[9px] font-black uppercase text-right">Monto</TableHead><TableHead className="text-[9px] font-black uppercase text-right pr-8">Acción</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedEvent.movimientos?.map((pago: any, pIdx: number) => (
                                <TableRow key={pIdx} className={cn(pago.anulado && "opacity-40 italic")}>
                                  <TableCell className="pl-8 py-4 text-xs">{formatDateRow(pago.fechaTransaccion || pago.fecha)}</TableCell>
                                  <TableCell className="text-xs uppercase font-bold">
                                    {pago.tipoTransaccion || "PAGO"} 
                                    {pago.anulado && <span className="text-red-500 ml-2">(ANULADO)</span>}
                                    {!pago.anulado && pago.confirmado && <span className="text-emerald-600 ml-2 text-[9px]">(CONFIRMADO)</span>}
                                    {!pago.anulado && !pago.confirmado && <span className="text-amber-600 ml-2 text-[9px]">(NO CONFIRMADO)</span>}
                                  </TableCell>
                                  <TableCell className="text-right font-black text-emerald-600">${Number(pago.monto).toFixed(2)}</TableCell>
                                  <TableCell className="text-right pr-8">
                                    <div className="flex items-center justify-end gap-2">
                                      {!pago.anulado && !pago.confirmado && (isCobranzas || isAdmin) && (
                                        <Button variant="ghost" size="icon" onClick={() => handleConfirmPayment(selectedEvent.type === 'INITIAL_BALANCE_DOC' ? selectedEvent.clientId : selectedEvent.id, pago.id, selectedEvent.type === 'INITIAL_BALANCE_DOC')} className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="Confirmar Pago">
                                          <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                      {!pago.anulado && (isAdmin || (isCobranzas && !pago.confirmado)) && (
                                        <Button variant="ghost" size="icon" onClick={() => handleAnnullPayment(selectedEvent.type === 'INITIAL_BALANCE_DOC' ? selectedEvent.clientId : selectedEvent.id, pago.id, selectedEvent.type === 'INITIAL_BALANCE_DOC', pago.confirmado)} className="h-8 w-8 text-red-500 hover:bg-red-50" title="Eliminar Pago">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {(!selectedEvent.movimientos || selectedEvent.movimientos.length === 0) && (
                                <TableRow><TableCell colSpan={4} className="h-20 text-center text-[10px] font-bold text-muted-foreground/30 uppercase italic">Sin pagos vinculados</TableCell></TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <div className="p-8 border-t border-border bg-muted/20 flex justify-end">
                <Button onClick={() => setIsDetailOpen(false)} className="rounded-xl font-black uppercase text-xs h-12 px-10">Cerrar Expediente</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}