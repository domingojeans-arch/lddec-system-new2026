"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Calendar, 
  DollarSign, 
  Trash2, 
  CheckCircle, 
  Loader2, 
  Plus, 
  Building, 
  Receipt, 
  Truck, 
  AlertCircle, 
  CreditCard,
  Briefcase
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  Timestamp 
} from "firebase/firestore";
import { toDate } from "@/lib/toDate";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface PendingPayment {
  id: string;
  detalle: string;
  monto: number;
  fechaPago: string; // YYYY-MM-DD
  tipo: string;
  numeroCheque?: string;
  bancoCheque?: string;
  estado: "Pendiente" | "Pagado";
  createdAt: any;
}

export default function AgendaPagosPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const todayStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Form states
  const [detalle, setDetalle] = useState("");
  const [monto, setMonto] = useState("");
  const [fechaPago, setFechaPago] = useState("");
  const [tipo, setTipo] = useState("Banco");
  const [numeroCheque, setNumeroCheque] = useState("");
  const [bancoCheque, setBancoCheque] = useState("");
  const [esRecurrente, setEsRecurrente] = useState(false);
  const [mesesRepetir, setMesesRepetir] = useState("12");
  const [submitting, setSubmitting] = useState(false);

  // 1. PROTECTION - Admin only
  useEffect(() => {
    if (!authLoading) {
      if (!user || user.role !== "admin") {
        router.replace("/dashboard");
      }
    }
  }, [user, authLoading, router]);

  // 2. FIRESTORE REALTIME SYNC
  useEffect(() => {
    if (!db || !user || user.role !== "admin") return;

    const q = query(collection(db, "agenda_pagos"), orderBy("fechaPago", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: PendingPayment[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as PendingPayment);
      });
      setPayments(list);
      setLoadingData(false);
    }, (error) => {
      console.error("Error cargando agenda de pagos:", error);
      setLoadingData(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. ADD PAYMENT
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || submitting) return;

    if (!detalle.trim() || !monto || !fechaPago) {
      toast({
        title: "Campos incompletos",
        description: "Por favor complete Detalle, Monto y Fecha de Pago.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const parsedMonto = Number(monto);
      const isRecurrentActive = esRecurrente && Number(mesesRepetir) > 1;
      const count = isRecurrentActive ? Math.min(60, Math.max(1, Number(mesesRepetir))) : 1;

      const initialDate = new Date(fechaPago + "T00:00:00");

      for (let m = 0; m < count; m++) {
        // Calculate the target payment date by adding m months
        const targetDate = new Date(initialDate);
        targetDate.setMonth(initialDate.getMonth() + m);

        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
        const dd = String(targetDate.getDate()).padStart(2, "0");
        const targetDateStr = `${yyyy}-${mm}-${dd}`;

        const data: any = {
          detalle: isRecurrentActive ? `${detalle.trim()} (${m + 1}/${count})` : detalle.trim(),
          monto: parsedMonto,
          fechaPago: targetDateStr,
          tipo,
          estado: "Pendiente",
          createdAt: Timestamp.now()
        };

        if (esRecurrente) {
          data.esRecurrente = true;
        }

        if (tipo === "Cheque") {
          data.numeroCheque = numeroCheque.trim();
          data.bancoCheque = bancoCheque.trim();
        }

        await addDoc(collection(db, "agenda_pagos"), data);
      }

      toast({
        title: isRecurrentActive ? "Pagos Recurrentes Agendados" : "Pago Agendado",
        description: isRecurrentActive 
          ? `Se han registrado con éxito los ${count} pagos recurrentes mensuales.`
          : "El pago pendiente ha sido registrado con éxito."
      });

      // Clear form
      setDetalle("");
      setMonto("");
      setFechaPago("");
      setTipo("Banco");
      setNumeroCheque("");
      setBancoCheque("");
      setEsRecurrente(false);
      setMesesRepetir("12");
    } catch (error) {
      console.error("Error al registrar pago:", error);
      toast({
        title: "Error",
        description: "No se pudo registrar el pago pendiente.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 4. MARK AS PAID
  const handleMarkAsPaid = async (id: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, "agenda_pagos", id), { estado: "Pagado" });
      toast({
        title: "Pago Realizado",
        description: "El estado ha sido actualizado a Pagado."
      });
    } catch (error) {
      console.error("Error al actualizar pago:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del pago.",
        variant: "destructive"
      });
    }
  };

  // 5. DELETE PAYMENT
  const handleDelete = async (id: string) => {
    if (!db) return;
    if (!confirm("¿Está seguro de eliminar este registro de la agenda?")) return;

    try {
      await deleteDoc(doc(db, "agenda_pagos", id));
      toast({
        title: "Registro Eliminado",
        description: "El pago pendiente ha sido removido con éxito."
      });
    } catch (error) {
      console.error("Error al eliminar pago:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el registro de la agenda.",
        variant: "destructive"
      });
    }
  };

  // 6. REALTIME FINANCIAL METRICS
  const metrics = useMemo(() => {
    const today = new Date();
    
    // Start and end of current week
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    let totalDiario = 0;
    let totalSemanal = 0;
    let totalMensual = 0;

    payments.forEach(p => {
      if (p.estado !== "Pendiente") return;

      const pDate = new Date(p.fechaPago + "T00:00:00");
      if (isNaN(pDate.getTime())) return;

      // Check daily (filtered by selectedDate)
      if (p.fechaPago === selectedDate) {
        totalDiario += p.monto;
      }

      // Check weekly
      if (pDate >= startOfWeek && pDate <= endOfWeek) {
        totalSemanal += p.monto;
      }

      // Check monthly
      if (
        pDate.getMonth() === today.getMonth() &&
        pDate.getFullYear() === today.getFullYear()
      ) {
        totalMensual += p.monto;
      }
    });

    return { totalDiario, totalSemanal, totalMensual };
  }, [payments, selectedDate]);

  // Helper to choose color and icon per Category
  const getCategoryDetails = (category: string) => {
    switch (category) {
      case "Banco":
        return { color: "text-blue-500 bg-blue-500/10", icon: Building };
      case "Servicio":
        return { color: "text-amber-500 bg-amber-500/10", icon: CreditCard };
      case "Cheque":
        return { color: "text-emerald-500 bg-emerald-500/10", icon: Receipt };
      case "Químicos":
        return { color: "text-indigo-500 bg-indigo-500/10", icon: Truck };
      default:
        return { color: "text-muted-foreground bg-muted/10", icon: Briefcase };
    }
  };

  if (authLoading || loadingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Cargando Agenda Virtual...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background -m-4 md:-m-8 lg:-m-12 p-4 md:p-8 lg:p-12 animate-in fade-in duration-700 overflow-x-hidden">
      
      {/* HEADER */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <Calendar className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Agenda Virtual de Pagos</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Planificación y control de obligaciones financieras pendientes
            </p>
          </div>
        </div>
        <Badge className="bg-primary/20 text-primary border border-primary/30 font-bold uppercase text-[10px] px-4 h-12 rounded-2xl flex items-center justify-center">
          Consola Administrativa
        </Badge>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <Card className="bg-card border-border shadow-premium rounded-3xl overflow-hidden group hover:border-primary/30 transition-all">
          <CardContent className="p-8 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">TOTAL DIARIO PENDIENTE</p>
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-muted/40 border border-border/80 rounded-xl px-2 py-1 text-[11px] font-semibold text-foreground focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer h-8 shadow-sm text-center"
              />
            </div>
            <h3 className="text-4xl font-black text-foreground tracking-tighter flex items-center gap-1.5">
              <span className="text-primary">$</span>
              {metrics.totalDiario.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <Calendar className="h-3 w-3 text-primary" />
              <span>{selectedDate === todayStr ? "Filtrado para hoy" : `Filtrado: ${selectedDate}`}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-premium rounded-3xl overflow-hidden group hover:border-emerald-500/30 transition-all">
          <CardContent className="p-8 space-y-2">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">TOTAL SEMANAL PENDIENTE</p>
            <h3 className="text-4xl font-black text-foreground tracking-tighter flex items-center gap-1.5">
              <span className="text-emerald-500">$</span>
              {metrics.totalSemanal.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-premium rounded-3xl overflow-hidden group hover:border-amber-500/30 transition-all">
          <CardContent className="p-8 space-y-2">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">TOTAL MENSUAL PENDIENTE</p>
            <h3 className="text-4xl font-black text-foreground tracking-tighter flex items-center gap-1.5">
              <span className="text-amber-500">$</span>
              {metrics.totalMensual.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FORM PANEL */}
        <Card className="bg-card border-border shadow-premium rounded-[2rem] overflow-hidden h-fit lg:col-span-1">
          <CardHeader className="px-8 pt-8 pb-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Nuevo Pago Pendiente
            </CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Detalle del Pago</label>
                <Input 
                  type="text" 
                  value={detalle} 
                  onChange={(e) => setDetalle(e.target.value)} 
                  placeholder="Ej. Pago factura químicos BASF"
                  className="bg-muted/30 border-border rounded-xl h-11 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Monto ($ USD)</label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={monto} 
                    onChange={(e) => setMonto(e.target.value)} 
                    placeholder="0.00"
                    className="bg-muted/30 border-border rounded-xl h-11 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Fecha de Vencimiento</label>
                  <Input 
                    type="date" 
                    value={fechaPago} 
                    onChange={(e) => setFechaPago(e.target.value)} 
                    className="bg-muted/30 border-border rounded-xl h-11 text-xs text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Categoría / Tipo</label>
                <select 
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="w-full bg-muted/30 border border-border rounded-xl h-11 text-xs px-3 text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Banco">Banco</option>
                  <option value="Servicio">Servicio</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Químicos">Químicos</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>

              {/* SPECIFIC FIELDS FOR CHEQUE */}
              {tipo === "Cheque" && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/10 rounded-2xl border border-border/50 animate-in fade-in duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-emerald-500 tracking-widest">Nº Cheque</label>
                    <Input 
                      type="text" 
                      value={numeroCheque} 
                      onChange={(e) => setNumeroCheque(e.target.value)} 
                      placeholder="0001"
                      className="bg-muted/20 border-emerald-500/30 rounded-xl h-11 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-emerald-500 tracking-widest">Banco Emisor</label>
                    <Input 
                      type="text" 
                      value={bancoCheque} 
                      onChange={(e) => setBancoCheque(e.target.value)} 
                      placeholder="Ej. Pichincha"
                      className="bg-muted/20 border-emerald-500/30 rounded-xl h-11 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* OPCIÓN 1: PAGO RECURRENTE */}
              <div className="space-y-4 p-4 bg-muted/10 rounded-2xl border border-border/50">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest cursor-pointer select-none" htmlFor="recurrente-checkbox">
                    ¿Es pago recurrente mensual?
                  </label>
                  <input 
                    id="recurrente-checkbox"
                    type="checkbox" 
                    checked={esRecurrente}
                    onChange={(e) => setEsRecurrente(e.target.checked)}
                    className="h-4 w-4 rounded border-border bg-muted/30 text-primary focus:ring-primary outline-none accent-primary"
                  />
                </div>

                {esRecurrente && (
                  <div className="space-y-1.5 animate-in fade-in duration-300">
                    <label className="text-[9px] font-black uppercase text-primary tracking-widest">Meses a programar</label>
                    <Input 
                      type="number" 
                      min="1"
                      max="60"
                      value={mesesRepetir} 
                      onChange={(e) => setMesesRepetir(e.target.value)} 
                      placeholder="Ej. 12"
                      className="bg-muted/20 border-primary/30 rounded-xl h-11 text-xs"
                    />
                    <p className="text-[8px] font-bold text-muted-foreground/80 uppercase tracking-wide">
                      Se generarán {mesesRepetir} pagos mensuales sucesivos a partir de la fecha seleccionada.
                    </p>
                  </div>
                )}
              </div>

              <Button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black h-12 rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest text-xs mt-3 shadow-lg shadow-primary/10 transition-all active:scale-95"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Registrar Obligación
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* LIST / TABLE PANEL */}
        <Card className="bg-card border-border shadow-premium rounded-[2rem] overflow-hidden lg:col-span-2">
          <CardHeader className="px-8 pt-8 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">
              Listado de Obligaciones Financieras
            </CardTitle>
            <Badge className="bg-muted text-muted-foreground border-none font-bold uppercase text-[9px] px-3 py-1 rounded-full">
              {payments.length} Registros
            </Badge>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            {payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 border border-dashed border-border rounded-3xl">
                <AlertCircle className="h-12 w-12 text-muted-foreground/30" />
                <div>
                  <h4 className="text-xs font-black uppercase text-foreground">Agenda Vacía</h4>
                  <p className="text-[10px] text-muted-foreground mt-1 max-w-[240px]">
                    No se registran obligaciones pendientes en este momento.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-[9px] font-black uppercase text-muted-foreground tracking-widest text-left">
                      <th className="pb-4 pr-4">Categoría</th>
                      <th className="pb-4 pr-4">Detalle</th>
                      <th className="pb-4 pr-4">Fecha Pago</th>
                      <th className="pb-4 pr-4 text-right">Monto</th>
                      <th className="pb-4 pr-4 text-center">Estado</th>
                      <th className="pb-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => {
                      const cat = getCategoryDetails(p.tipo);
                      const IconComponent = cat.icon;
                      const isExpired = p.estado === "Pendiente" && new Date(p.fechaPago + "T23:59:59") < new Date();

                      return (
                        <tr key={p.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                          <td className="py-4 pr-4">
                            <div className="flex items-center gap-2.5">
                              <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${cat.color}`}>
                                <IconComponent className="h-4 w-4" />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-wider text-foreground">{p.tipo}</span>
                            </div>
                          </td>
                          <td className="py-4 pr-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-foreground">{p.detalle}</span>
                                {p.esRecurrente && (
                                  <Badge className="bg-primary/20 text-primary border border-primary/30 font-bold uppercase text-[7px] px-1.5 py-0.5 rounded-md">
                                    Recurrente
                                  </Badge>
                                )}
                              </div>
                              {p.tipo === "Cheque" && p.numeroCheque && (
                                <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                                  <span>Chq: {p.numeroCheque}</span>
                                  <span className="opacity-50">|</span>
                                  <span>Bco: {p.bancoCheque || "S/D"}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 pr-4">
                            <div className="space-y-0.5">
                              <span className={`text-xs font-bold ${isExpired ? 'text-rose-500' : 'text-foreground/80'}`}>
                                {p.fechaPago}
                              </span>
                              {isExpired && (
                                <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">
                                  Vencido
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 pr-4 text-right">
                            <span className="text-xs font-black text-foreground">
                              ${p.monto.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-4 pr-4 text-center">
                            <Badge 
                              className={`border-none font-bold uppercase text-[9px] px-3.5 py-1 rounded-full ${
                                p.estado === "Pagado" 
                                  ? "bg-emerald-500/10 text-emerald-600" 
                                  : "bg-amber-500/10 text-amber-600"
                              }`}
                            >
                              {p.estado}
                            </Badge>
                          </td>
                          <td className="py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {p.estado === "Pendiente" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleMarkAsPaid(p.id)}
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                  title="Marcar como Pagado"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(p.id)}
                                className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        
      </div>
    </div>
  );
}
