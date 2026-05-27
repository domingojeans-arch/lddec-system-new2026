"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Calendar as CalendarIcon, 
  Loader2, 
  DollarSign, 
  CheckCircle2, 
  Receipt, 
  ArrowUp, 
  ArrowDown, 
  ChevronsUpDown, 
  X, 
  Wallet, 
  Info,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, writeBatch, doc, Timestamp, serverTimestamp, query, where, arrayUnion, getDocs } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { FacturaPendienteRow } from "@/components/cobranzas/FacturaPendienteRow";
import { CobranzaForm } from "@/components/cobranzas/CobranzaForm";
import { PagoDetalle, EstadoCobranza } from "@/types/lddec";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { toDate } from "@/lib/toDate";
import { calculateClientAccountingMetrics, filterPaymentsByDate } from "@/lib/accounting-motor";
import { Badge } from "@/components/ui/badge";

const FECHA_BASE_2026 = new Date("2026-01-01T00:00:00");

export default function CobranzasPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === "socio";

  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [currentClient, setCurrentClient] = useState<any>(null);
  
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [paymentLines, setPaymentLines] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);

  // Estados para controlar los Popovers de calendario
  const [isFromOpen, setIsFromOpen] = useState(false);
  const [isToOpen, setIsToOpen] = useState(false);

  useEffect(() => {
    const d = new Date(); 
    d.setDate(1); 
    setDateFrom(d.toISOString().split('T')[0]);
    setDateTo(new Date().toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "clients"), (snap) => {
      const mapped = snap.docs.map(d => {
        const data = d.data();
        const rawName = (data.name || data.nombre || "").trim().toUpperCase();
        return { id: d.id, ...data, displayName: rawName };
      });
      
      const sorted = mapped.sort((a, b) => 
        a.displayName.localeCompare(b.displayName, 'es', { sensitivity: 'base' })
      );

      setClients(sorted);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      setCurrentClient(clients.find(c => c.id === selectedClientId));
      setIsGenerated(false); // Resetear al cambiar cliente
    }
  }, [selectedClientId, clients]);

  useEffect(() => {
    if (!db || !selectedClientId) { setAllInvoices([]); return; }
    setLoading(true);
    const unsubInvoices = onSnapshot(collection(db, "facturas"), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = docs.filter((inv: any) => inv.clientId === selectedClientId || inv.clienteId === selectedClientId);
      setAllInvoices(filtered);
      setLoading(false);
    });
    return () => unsubInvoices();
  }, [selectedClientId]);

  const accountMetrics = useMemo(() => {
    if (!isGenerated || !selectedClientId || !currentClient || !dateFrom || !dateTo) return null;
    return calculateClientAccountingMetrics(Number(currentClient.baseDebt || 0), dateFrom, dateTo, allInvoices, allInvoices.flatMap(inv => Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : []), currentClient);
  }, [allInvoices, currentClient, dateFrom, dateTo, selectedClientId, isGenerated]);

  /**
   * MOTOR DE RESOLUCIÓN DE PENDIENTES LDDEC 1.3
   * Inyecta saldo inicial base 2026 y garantiza visibilidad de deudas activas.
   * Ahora controlado por isGenerated.
   */
  const invoicesWithBalance = useMemo(() => {
    if (!isGenerated || !currentClient) return [];

    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : new Date();
    const to = dateTo ? new Date(dateTo + "T23:59:59") : new Date();

    const result: any[] = [];

    // 1. Process initial balance 2026 (virtual row) with date filter
    const baseDebt = Number(currentClient.baseDebt || currentClient.saldoInicial || 0);
    const pagosSI = Array.isArray(currentClient.pagosSaldoInicial) ? currentClient.pagosSaldoInicial : [];
    const filteredPagosSI = filterPaymentsByDate(pagosSI, from, to);
    const totalAbonadoSI = filteredPagosSI.reduce((acc: number, p: any) => {
      if (p.anulado) return acc;
      return p.tipoTransaccion === 'Reverso' ? acc - p.monto : acc + p.monto;
    }, 0);
    const saldoSI = Math.max(0, baseDebt - totalAbonadoSI);
    if (saldoSI > 0.01) {
      result.push({
        id: "INITIAL_BALANCE_2026",
        isInitialBalance: true,
        _normalizedNumero: "SALDO INICIAL 2026",
        _normalizedTotal: baseDebt,
        _normalizedSaldo: saldoSI,
        _normalizedDate: FECHA_BASE_2026,
        estadoCobranza: totalAbonadoSI > 0 ? "Parcialmente Cobrada" : "Por Cobrar"
      });
    }

    // 2. Process real invoices (2026+)
    const facturaRows = allInvoices.map(inv => {
      const invDate = toDate(inv.fechaFactura || inv.date);
      const pagos = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : []);
      const filteredPagos = filterPaymentsByDate(pagos, from, to);
      const totalAbonado = filteredPagos.reduce((acc: any, p: any) => p.anulado ? acc : (p.tipoTransaccion === 'Reverso' ? acc - p.monto : acc + p.monto), 0);
      const saldo = Math.max(0, Number(inv.totalFactura || 0) - totalAbonado);
      return {
        ...inv,
        _normalizedSaldo: saldo,
        _normalizedNumero: inv.numeroFactura || inv.id,
        _normalizedDate: invDate,
        _normalizedTotal: Number(inv.totalFactura || 0)
      };
    }).filter(inv => {
      if (!inv._normalizedDate || inv._normalizedDate < FECHA_BASE_2026 || inv._normalizedDate > to) return false;
      return inv._normalizedSaldo > 0.01;
    });

    return [...result, ...facturaRows].sort((a, b) => b._normalizedDate.getTime() - a._normalizedDate.getTime());
  }, [allInvoices, dateFrom, dateTo, currentClient, isGenerated]);

  const handleConfirmPayments = async () => {
    if (isReadOnly || !selectedClientId || paymentLines.length === 0) return;
    
    const invalidLine = paymentLines.find(l => !l.invoiceId || !l.monto);
    if (invalidLine) {
      toast({ variant: "destructive", title: "Datos incompletos", description: "Asegúrese de asignar una factura y monto a cada línea." });
      return;
    }

    setProcessing(true);
    try {
      const batch = writeBatch(db);
      const nowServer = serverTimestamp();
      const nowLocal = Timestamp.now();
      const currentUser = user?.displayName || "System";

      for (const line of paymentLines) {
        const montoNum = Number(line.monto || 0);
        const rawDate = toDate(line.fechaTransaccion) || new Date();
        const fechaTx = Timestamp.fromDate(rawDate);

        const newPayment: any = {
          id: Math.random().toString(36).substr(2, 9),
          tipoTransaccion: line.tipoTransaccion,
          metodoPago: line.metodoPago || "",
          monto: montoNum,
          fechaTransaccion: fechaTx,
          descripcion: line.descripcion || "",
          fechaRegistro: nowLocal,
          registradoPor: currentUser
        };

        if (line.metodoPago === "Cheque") {
          newPayment.numeroCheque = line.numeroCheque || "";
          newPayment.banco = line.banco || "";
          newPayment.nombreGirador = line.nombreGirador || "";
          newPayment.fechaCobro = line.fechaCobro || "";
        }

        if (line.invoiceId === "INITIAL_BALANCE_2026") {
          const clientRef = doc(db, "clients", selectedClientId);
          const currentPagosSI = Array.isArray(currentClient.pagosSaldoInicial) ? currentClient.pagosSaldoInicial : [];
          batch.update(clientRef, {
            pagosSaldoInicial: [...currentPagosSI, newPayment],
            updatedAt: nowServer
          });
        } 
        else {
          const inv = allInvoices.find(i => i.id === line.invoiceId);
          if (!inv) continue;

          const currentPagos = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : [];
          const updatedPagos = [...currentPagos, newPayment];
          
          const totalAbonado = updatedPagos.reduce((acc, p) => {
            if (p.anulado) return acc;
            return p.tipoTransaccion === 'Reverso' ? acc - Number(p.monto || 0) : acc + Number(p.monto || 0);
          }, 0);
          
          const originalTotal = Number(inv.totalFactura || inv.total || 0);
          const nuevoSaldo = Math.max(0, originalTotal - totalAbonado);
          
          let nuevoEstado: EstadoCobranza = "Por Cobrar";
          if (nuevoSaldo <= 0.01) nuevoEstado = "Pagada";
          else if (totalAbonado > 0) nuevoEstado = "Parcialmente Cobrada";

          batch.update(doc(db, "facturas", inv.id), { 
            pagosYajustes: updatedPagos,
            saldoPendiente: nuevoSaldo,
            estadoCobranza: nuevoEstado,
            updatedAt: nowServer
          });
        }
      }

      await batch.commit();
      toast({ title: "Recaudación Exitosa", description: "Los saldos han sido actualizados en la base de datos." });
      setPaymentLines([]); 
      setSelectedInvoices([]);
    } catch (e: any) { 
      console.error("Error al procesar cobros:", e);
      toast({ variant: "destructive", title: "Error al guardar", description: "Error técnico en la base de datos." }); 
    } finally { 
      setProcessing(false); 
    }
  };

  const handleAddLine = () => {
    const firstInvId = selectedInvoices[0] || "";
    setPaymentLines([...paymentLines, { 
      id: Math.random().toString(36).substr(2,9), 
      monto: 0, 
      tipoTransaccion: "Pago", 
      fechaTransaccion: new Date(),
      invoiceId: firstInvId
    }]);
  };

  const handleGenerateClick = () => {
    if (!selectedClientId) {
      toast({ variant: "destructive", title: "Atención", description: "Debe seleccionar un socio industrial." });
      return;
    }
    setIsGenerated(true);
  };

  const dateFromObj = dateFrom ? parseISO(dateFrom) : undefined;
  const dateToObj = dateTo ? parseISO(dateTo) : undefined;

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="space-y-1">
        <h1 className="text-5xl font-black tracking-tighter uppercase">Gestión de Cobranzas</h1>
        <p className="text-primary text-xs font-black uppercase tracking-[0.3em]">Cierre de Cartera Industrial 2026</p>
        {isReadOnly && <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3 mt-2">Modo Solo Lectura</Badge>}
      </div>

      <div className="bg-card p-8 rounded-[2.5rem] border border-border shadow-premium space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase ml-1">Socio Industrial</Label>
            <Select value={selectedClientId} onValueChange={(val) => { setSelectedClientId(val); setSelectedInvoices([]); setPaymentLines([]); setIsGenerated(false); }}>
              <SelectTrigger className="erp-input h-12 font-bold">
                <SelectValue placeholder="Seleccione un socio..." />
              </SelectTrigger>
              <SelectContent className="rounded-2xl shadow-2xl max-h-[350px]">
                {clients.map(c => <SelectItem key={c.id} value={c.id} className="text-xs uppercase font-bold">{c.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase ml-1">Facturas Desde</Label>
            <Popover open={isFromOpen} onOpenChange={setIsFromOpen}>
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
                  onSelect={(d) => { setDateFrom(d ? format(d, "yyyy-MM-dd") : ""); setIsFromOpen(false); setIsGenerated(false); }}
                  locale={es}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase ml-1">Facturas Hasta</Label>
            <Popover open={isToOpen} onOpenChange={setIsToOpen}>
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
                  onSelect={(d) => { setDateTo(d ? format(d, "yyyy-MM-dd") : ""); setIsToOpen(false); setIsGenerated(false); }}
                  locale={es}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border/50">
          <Button 
            onClick={handleGenerateClick}
            className="bg-primary hover:bg-primary/90 text-white font-black uppercase h-14 px-14 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 group"
          >
            <TrendingUp className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
            GENERAR
          </Button>
        </div>
      </div>

      {accountMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-top-4">
          <Card className="bg-card border-border shadow-sm rounded-[2rem]">
            <CardContent className="p-8">
              <p className="text-[10px] font-black uppercase text-muted-foreground">Saldo Actual al Corte</p>
              <p className="text-4xl font-black text-primary">${accountMetrics.saldoActual.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="bg-card p-10 rounded-[3rem] border border-border shadow-premium space-y-8">
        <h4 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3"><Receipt className="h-6 w-6 text-primary" /> Cartera Pendiente</h4>
        <div className="rounded-[2rem] border border-border overflow-hidden min-h-[250px]">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-12 pl-6"></TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right pr-8">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" /></TableCell></TableRow>
              ) : !isGenerated ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center opacity-30">
                    <Search className="h-12 w-12 mx-auto mb-2" />
                    <p className="font-black text-xs uppercase tracking-widest italic">Seleccione filtros y presione GENERAR</p>
                  </TableCell>
                </TableRow>
              ) : (
                invoicesWithBalance.map((inv) => (
                  <FacturaPendienteRow 
                    key={inv.id} 
                    invoice={inv} 
                    isSelected={selectedInvoices.includes(inv.id)} 
                    onToggle={(id) => { 
                      if (!isReadOnly) setSelectedInvoices(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); 
                    }} 
                  />
                ))
              )}
              {isGenerated && invoicesWithBalance.length === 0 && !loading && selectedClientId && (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center opacity-30">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2" />
                    <p className="font-black text-xs uppercase tracking-widest">Este socio no presenta facturas pendientes</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {!isReadOnly && isGenerated && selectedInvoices.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-9 bg-card p-10 rounded-[3rem] border border-border shadow-premium">
            <CobranzaForm 
              lines={paymentLines} 
              onAddLine={handleAddLine} 
              onRemoveLine={(id) => setPaymentLines(prev => prev.filter(l => l.id !== id))} 
              onUpdateLine={(id, upd) => setPaymentLines(prev => prev.map(l => l.id === id ? { ...l, ...upd } : l))} 
              invoices={invoicesWithBalance.filter(i => selectedInvoices.includes(i.id))} 
            />
          </div>
          <div className="lg:col-span-3 sticky top-24">
            <div className="bg-card p-6 rounded-[2.5rem] border border-border shadow-premium space-y-5 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600">
                <DollarSign className="h-6 w-6 animate-pulse" />
              </div>
              <div className="text-center space-y-1">
                <h5 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Acción Comercial</h5>
                <p className="text-xs font-bold text-foreground">Confirmar Cobranza</p>
              </div>
              <Button 
                onClick={handleConfirmPayments} 
                disabled={processing || paymentLines.length === 0} 
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase rounded-[2rem] shadow-xl shadow-emerald-600/10 gap-2 transition-all active:scale-95"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                Confirmar Aplicación
              </Button>
              <p className="text-[9px] leading-relaxed font-bold text-muted-foreground uppercase text-center px-2">
                Al confirmar, se actualizarán los saldos de cada factura seleccionada de forma definitiva.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
