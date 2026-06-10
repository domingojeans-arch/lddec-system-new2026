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
  Save,
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

/**
 * Verifica si un pago califica para confirmación automática por antigüedad (9 días o más).
 * Retorna true si es 'no confirmado', no anulado y han transcurrido 9 días o más desde su fecha de creación.
 */
function checkPaymentAutoConfirm(pago: any): { isAutoConfirmed: boolean; daysDiff: number } {
  if (pago.anulado || pago.confirmado) {
    return { isAutoConfirmed: false, daysDiff: 0 };
  }

  // La fecha puede estar en fechaTransaccion, fecha, fechaPago o createdAt
  const rawDate = pago.fechaTransaccion || pago.fecha || pago.fechaPago || pago.createdAt;
  if (!rawDate) return { isAutoConfirmed: false, daysDiff: 0 };

  const parsedDate = toDate(rawDate);
  if (!parsedDate) return { isAutoConfirmed: false, daysDiff: 0 };

  const today = new Date();
  
  // Limpiar horas para comparar solo días naturales completos
  const todayClean = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateClean = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());

  const diffTime = todayClean.getTime() - dateClean.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return {
    isAutoConfirmed: diffDays >= 9,
    daysDiff: diffDays
  };
}

export default function HistorialPage() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === "administrador" || authUser?.role === "admin" || authUser?.role === "ADMIN";
  const isCobranzas = authUser?.role === "cobranzas" || authUser?.role === "COBRANZAS";
  // Rol contador: acceso completo a edición y eliminación de cobros en Historial
  const isContador = authUser?.role === "contador" || authUser?.role === "CONTADOR";
  const canManagePayments = isAdmin || isCobranzas || isContador;
  
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);

  // Estados para el Modal de Detalles (Ojito)
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Estados para el Modal de EDICIÓN de pago (Contador / Admin)
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false);
  const [editingPaymentData, setEditingPaymentData] = useState<{
    docId: string;
    paymentId: string;
    isInitialBalance: boolean;
    monto: number;
    tipo: string;
  } | null>(null);
  const [editPaymentDate, setEditPaymentDate] = useState<Date | undefined>(undefined);
  const [savingEditPayment, setSavingEditPayment] = useState(false);

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

      // 1. Obtener facturas filtradas por clientId y clienteId en paralelo
      const qInvoicesClient = query(collection(db, "facturas"), where("clientId", "==", selectedClientId));
      const qInvoicesCliente = query(collection(db, "facturas"), where("clienteId", "==", selectedClientId));
      const [invoicesClientSnap, invoicesClienteSnap] = await Promise.all([
        getDocs(qInvoicesClient),
        getDocs(qInvoicesCliente)
      ]);
      
      const invoicesMap = new Map();
      invoicesClientSnap.docs.forEach(d => invoicesMap.set(d.id, { id: d.id, ...d.data() }));
      invoicesClienteSnap.docs.forEach(d => invoicesMap.set(d.id, { id: d.id, ...d.data() }));
      const clientInvoices = Array.from(invoicesMap.values());

      // 2. Obtener ingresos (entries) filtrados por clientId y clienteId en paralelo
      const qEntriesClient = query(collection(db, "entries"), where("clientId", "==", selectedClientId));
      const qEntriesCliente = query(collection(db, "entries"), where("clienteId", "==", selectedClientId));
      const [entriesClientSnap, entriesClienteSnap] = await Promise.all([
        getDocs(qEntriesClient),
        getDocs(qEntriesCliente)
      ]);
      
      const entriesMap = new Map();
      entriesClientSnap.docs.forEach(d => entriesMap.set(d.id, { id: d.id, ...d.data() }));
      entriesClienteSnap.docs.forEach(d => entriesMap.set(d.id, { id: d.id, ...d.data() }));
      const clientEntries = Array.from(entriesMap.values());

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
            ...(Array.isArray(inv.ingresoMaestroIds) ? inv.ingresoMaestroIds : []),
            ...(Array.isArray(inv.ingresos) ? inv.ingresos.map((item: any) => typeof item === 'string' ? item : (item.id || item.ingresoId || item.entryNumber || item.idIngreso)) : []),
            ...(Array.isArray(inv.ingresosIds) ? inv.ingresosIds.map((item: any) => typeof item === 'string' ? item : (item.id || item.ingresoId || item.entryNumber || item.idIngreso)) : [])
          ].filter(Boolean).map(String).map(s => s.trim().toUpperCase());

          const targetId = String(entryId).trim().toUpperCase();
          const targetVisible = String(entryVisible).trim().toUpperCase();

          return checkIds.includes(targetId) || checkIds.includes(targetVisible);
        });

        const entryDate = toDate(entry.date || entry.entryDate || entry.createdAt) || new Date();

        timeline.push({
          type: "entry",
          date: entryDate,
          id: entryId,
          number: entry.entryNumber || entryId,
          data: entry,
          invoices: associatedInvoices.map(inv => {
            const invDate = toDate(inv.fechaFactura || inv.createdAt || inv.invoiceDate) || new Date();
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
          ...(Array.isArray(inv.ingresoMaestroIds) ? inv.ingresoMaestroIds : []),
          ...(Array.isArray(inv.ingresos) ? inv.ingresos.map((item: any) => typeof item === 'string' ? item : (item.id || item.ingresoId || item.entryNumber || item.idIngreso)) : []),
          ...(Array.isArray(inv.ingresosIds) ? inv.ingresosIds.map((item: any) => typeof item === 'string' ? item : (item.id || item.ingresoId || item.entryNumber || item.idIngreso)) : [])
        ].filter(Boolean).map(String).map(s => s.trim().toUpperCase());

        const isLinked = clientEntries.some(e => {
          const eVisible = getEntryVisible(e, e.id);
          const targetId = String(e.id).trim().toUpperCase();
          const targetVisible = String(eVisible).trim().toUpperCase();
          return checkIds.includes(targetId) || checkIds.includes(targetVisible);
        });

        if (!isLinked) {
          const invDate = toDate(inv.fechaFactura || inv.createdAt || inv.invoiceDate) || new Date();
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
        const startTime = start.getTime();
        const endTime = end.getTime();
        filteredTimeline = timeline.filter(item => {
          const itemTime = item.date.getTime();
          return itemTime >= startTime && itemTime <= endTime;
        });
      }

      filteredTimeline.sort((a, b) => b.date.getTime() - a.date.getTime());

      const fromDate = new Date((dateFrom || "2026-01-01") + "T00:00:00");
      const toDateObj = new Date((dateTo || new Date().toISOString().split('T')[0]) + "T23:59:59");

      // Filtrar facturas dentro del rango
      const invoicesInPeriod = clientInvoices.filter(inv => {
        const d = toDate(inv.fechaFactura || inv.date);
        return d && d >= fromDate && d <= toDateObj;
      });

      const totalFacturado = invoicesInPeriod.reduce((acc, inv) => acc + Number(inv.totalFactura || inv.total || 0), 0);

      let totalCobrado = 0;
      invoicesInPeriod.forEach(inv => {
        const movimientos = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : []);
        movimientos.forEach((m: any) => {
          if (!m.anulado) {
            if (m.tipoTransaccion === 'Reverso' || m.tipo === 'Reverso') {
              totalCobrado -= Number(m.monto || 0);
            } else {
              totalCobrado += Number(m.monto || 0);
            }
          }
        });
      });

      // Sumar pagos al saldo inicial que correspondan al periodo
      const pagosSI = Array.isArray(clientData?.pagosSaldoInicial) ? clientData.pagosSaldoInicial : [];
      pagosSI.forEach((m: any) => {
        const d = toDate(m.fechaTransaccion || m.fecha || m.createdAt);
        if (d && d >= fromDate && d <= toDateObj && !m.anulado) {
          if (m.tipoTransaccion === 'Reverso' || m.tipo === 'Reverso') {
            totalCobrado -= Number(m.monto || 0);
          } else {
            totalCobrado += Number(m.monto || 0);
          }
        }
      });

      const saldoPendienteGeneral = (baseDebt + totalFacturado) - totalCobrado;

      setAuditData({
        client: clientData,
        summary: {
          baseDebt,
          totalFacturado,
          totalCobrado,
          saldoPendienteGeneral
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
    // Permiso: admin puede todo; cobranzas y contador pueden anular pagos no confirmados explícitamente
    const canDelete = isAdmin || ((isCobranzas || isContador) && !pagoConfirmado);
    if (!canDelete) {
      toast({ variant: "destructive", title: "Acceso Denegado", description: "No tienes permisos para eliminar este pago." });
      return;
    }

    if (!confirm("¿Seguro que deseas eliminar este pago? Esta acción recalculará los saldos de forma definitiva.")) return;

    try {
      if (isInitialBalance) {
        // ── SALDO INICIAL DE CLIENTE ──────────────────────────────
        const clientRef = doc(db, "clients", docId);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) {
          toast({ variant: "destructive", title: "Error", description: "No se encontró el cliente." });
          return;
        }
        const currentPagos: any[] = clientSnap.data().pagosSaldoInicial || [];
        const idx = currentPagos.findIndex((p: any) => p.id === paymentId);
        if (idx === -1) {
          console.error("[handleAnnullPayment] Pago no encontrado en saldo inicial. paymentId:", paymentId);
          toast({ variant: "destructive", title: "Error", description: "No se encontró el pago en el saldo inicial." });
          return;
        }
        const updatedPagos = currentPagos.map((p: any) =>
          p.id === paymentId
            ? { ...p, anulado: true, anuladoAt: new Date().toISOString(), anuladoPor: authUser?.displayName || "Admin" }
            : p
        );
        await updateDoc(clientRef, { pagosSaldoInicial: updatedPagos, updatedAt: serverTimestamp() });

      } else {
        // ── PAGO VINCULADO A FACTURA ─────────────────────────────
        const invRef = doc(db, "facturas", docId);
        const invSnap = await getDoc(invRef);
        if (!invSnap.exists()) {
          console.error("[handleAnnullPayment] Factura no encontrada. docId:", docId);
          toast({ variant: "destructive", title: "Error", description: "No se encontró la factura en la base de datos." });
          return;
        }

        const data = invSnap.data();
        const currentPagos: any[] = data.pagosYajustes || [];

        // Verificar que el pago realmente existe antes de modificar
        const pagoIndex = currentPagos.findIndex((p: any) => p.id === paymentId);
        if (pagoIndex === -1) {
          console.error("[handleAnnullPayment] Pago no encontrado. paymentId:", paymentId, "IDs disponibles:", currentPagos.map((p: any) => p.id));
          toast({ variant: "destructive", title: "Error", description: "No se encontró el pago dentro de la factura. Recarga e inténtalo de nuevo." });
          return;
        }

        // Marcar el pago como anulado (soft-delete)
        const updatedPagos = currentPagos.map((p: any) =>
          p.id === paymentId
            ? { ...p, anulado: true, anuladoAt: new Date().toISOString(), anuladoPor: authUser?.displayName || "Admin" }
            : p
        );

        // ── RECALCULAR SALDO DESDE CERO ──────────────────────────
        // Solo cuentan pagos cuyo campo `anulado` NO sea truthy
        const activePagos = updatedPagos.filter((p: any) => !p.anulado);
        const totalAbonado = activePagos.reduce((acc: number, p: any) =>
          p.tipoTransaccion === "Reverso"
            ? acc - Number(p.monto || 0)
            : acc + Number(p.monto || 0)
        , 0);
        const originalTotal = Number(data.totalFactura || data.total || 0);
        const nuevoSaldo = Math.max(0, originalTotal - totalAbonado);

        // ── DETERMINAR NUEVO ESTADO DE COBRANZA ─────────────────
        let nuevoEstado: string;
        if (nuevoSaldo <= 0.01) {
          // Factura completamente cubierta por los pagos restantes
          nuevoEstado = "Pagada";
        } else if (activePagos.length > 0 && totalAbonado > 0.01) {
          // Hay pagos activos que cubren parte del total
          nuevoEstado = "Parcialmente Cobrada";
        } else {
          // Sin pagos activos válidos: vuelve a pendiente
          nuevoEstado = "Por Cobrar";
        }

        console.log("[handleAnnullPayment] Recálculo →", {
          docId, paymentId,
          pagoEliminadoMonto: currentPagos[pagoIndex]?.monto,
          activePagosRestantes: activePagos.length,
          totalAbonado, originalTotal, nuevoSaldo, nuevoEstado
        });

        // ── PERSISTIR EN FIRESTORE ───────────────────────────────
        await updateDoc(invRef, {
          pagosYajustes: updatedPagos,
          saldoPendiente: nuevoSaldo,
          estadoCobranza: nuevoEstado,
          updatedAt: serverTimestamp()
        });
      }

      toast({
        title: "✅ Pago eliminado",
        description: "La factura fue recalculada y actualizada en Firestore."
      });
      setIsDetailOpen(false);
      // Esperar el re-fetch completo antes de continuar
      await handleGenerateAudit();

    } catch (error: any) {
      console.error("[handleAnnullPayment] Error:", error?.code, error?.message, error);
      const msg = error?.code === "permission-denied"
        ? "Sin permisos de escritura en Firestore. Contacta al administrador."
        : (error?.message || "No se pudo anular el pago.");
      toast({ variant: "destructive", title: "Error técnico", description: msg });
    }
  };

  // --- EDICIÓN DE FECHA DE PAGO (Contador / Admin) ---
  const handleOpenEditPayment = (docId: string, paymentId: string, pago: any, isInitialBalance = false) => {
    const currentDate = toDate(pago.fechaTransaccion || pago.fecha || pago.fechaPago) || new Date();
    setEditingPaymentData({
      docId,
      paymentId,
      isInitialBalance,
      monto: Number(pago.monto || 0),
      tipo: pago.tipoTransaccion || 'Pago'
    });
    setEditPaymentDate(currentDate);
    setIsEditPaymentOpen(true);
  };

  const handleSaveEditedPayment = async () => {
    if (!editingPaymentData || !editPaymentDate) return;
    setSavingEditPayment(true);
    try {
      const { docId, paymentId, isInitialBalance } = editingPaymentData;
      const newTimestamp = Timestamp.fromDate(editPaymentDate);

      if (isInitialBalance) {
        const clientRef = doc(db, "clients", docId);
        const clientSnap = await getDoc(clientRef);
        if (!clientSnap.exists()) return;
        const updatedPagos = (clientSnap.data().pagosSaldoInicial || []).map((p: any) =>
          p.id === paymentId
            ? { ...p, fechaTransaccion: newTimestamp, editadoPor: authUser?.displayName || 'Usuario', editadoAt: new Date().toISOString() }
            : p
        );
        await updateDoc(clientRef, { pagosSaldoInicial: updatedPagos, updatedAt: serverTimestamp() });
      } else {
        const invRef = doc(db, "facturas", docId);
        const invSnap = await getDoc(invRef);
        if (!invSnap.exists()) return;
        const updatedPagos = (invSnap.data().pagosYajustes || []).map((p: any) =>
          p.id === paymentId
            ? { ...p, fechaTransaccion: newTimestamp, editadoPor: authUser?.displayName || 'Usuario', editadoAt: new Date().toISOString() }
            : p
        );
        await updateDoc(invRef, { pagosYajustes: updatedPagos, updatedAt: serverTimestamp() });
      }

      toast({ title: "\u2705 Fecha de pago actualizada", description: `Nueva fecha: ${format(editPaymentDate, 'dd/MM/yyyy', { locale: es })}` });
      setIsEditPaymentOpen(false);
      setEditingPaymentData(null);
      handleGenerateAudit();
    } catch (error: any) {
      console.error("[handleSaveEditedPayment] Error:", error);
      toast({ variant: "destructive", title: "Error al editar pago", description: error?.message || "Error técnico." });
    } finally {
      setSavingEditPayment(false);
    }
  };

  const handleConfirmPayment = async (docId: string, paymentId: string, isInitialBalance = false) => {
    if (!canManagePayments) {
      toast({ variant: "destructive", title: "Acceso Denegado", description: "Solo cobranzas, contador o administradores pueden confirmar pagos." });
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
    <div className="max-w-[1400px] mx-auto space-y-10 animate-in fade-in duration-700 pb-20 main-history-container">
      <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 15mm !important;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Ocultar barra lateral, cabeceras, botones y elementos no imprimibles */
          aside, nav, header, footer, button,
          .print-hidden,
          [class*="print:hidden"],
          [class*="sidebar"],
          [class*="navbar"],
          [class*="navigation"] {
            display: none !important;
          }
          
          /* Ajustar contenedor principal al ancho completo */
          body {
            background: white !important;
            color: black !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .main-history-container {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          
          /* Cuadrícula limpia 2x2 para las 4 tarjetas superiores de saldos */
          .print-grid-2x2 {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
            margin-bottom: 20px !important;
          }
          
          .print-grid-2x2 > div {
            padding: 12px !important;
            border-radius: 12px !important;
            border: 1px solid #cbd5e1 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            text-align: center !important;
          }
          
          .print-grid-2x2 p {
            font-size: 8pt !important;
          }
          
          .print-grid-2x2 .text-3xl,
          .print-grid-2x2 .text-4xl {
            font-size: 15pt !important;
          }
          
          /* Línea de tiempo operativa optimizada para no cortarse entre hojas */
          .print-timeline-container {
            before {
              border-color: #cbd5e1 !important;
            }
          }
          
          .print-timeline-item {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 15px !important;
            padding-left: 45px !important;
          }
          
          .print-timeline-dot {
            left: 18px !important;
          }
          
          /* Acomodar bloques en horizontal para aprovechar el ancho de la hoja */
          .print-flex-row {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: center !important;
            width: 100% !important;
            gap: 12px !important;
          }
          
          .print-flex-row > div:first-child {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 12px !important;
            text-align: left !important;
          }
          
          .print-flex-row .flex-wrap {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            gap: 4px !important;
          }
          
          .print-flex-row button, 
          .print-flex-row .h-9.w-9 {
            display: none !important; /* ocultar botón del ojo en impresión */
          }
        }
      `}</style>
      
      <div className="space-y-1">
        <h1 className="text-5xl font-black tracking-tighter uppercase">Historial de Auditoría</h1>
        <p className="text-primary text-xs font-black uppercase tracking-[0.3em]">Trazabilidad Cronológica Industrial 1.1</p>
        {isReadOnly && <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3 mt-2">Modo Solo Lectura</Badge>}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print-grid-2x2">
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

          <div className="space-y-4 relative before:absolute before:left-8 before:top-0 before:bottom-0 before:w-0.5 before:bg-muted/50 print-timeline-container">
            {auditData.timeline.map((event: any, idx: number) => (
              <div key={idx} className="relative pl-20 group print-timeline-item">
                <div className={cn(
                  "absolute left-[30px] top-[22px] h-4 w-4 rounded-full border-4 border-background z-10 transition-transform group-hover:scale-125 print-timeline-dot",
                  event.type === 'entry' ? "bg-primary" : 
                  event.type === 'INITIAL_BALANCE_DOC' ? "bg-amber-500" : "bg-primary"
                )} />

                <div className="space-y-4">
                  <div className={cn(
                    "py-3.5 px-6 rounded-2xl border shadow-premium transition-all",
                    event.type === 'entry' ? "bg-card border-border" : "bg-amber-50/10 border-amber-200"
                  )}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print-flex-row">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
                          event.type === 'entry' ? "bg-primary/5 text-primary" : "bg-amber-500/5 text-amber-600"
                        )}>
                          {event.type === 'entry' ? <ArrowDownCircle className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                            {event.type === 'entry' ? 'INGRESO MAESTRO' : 'DOCUMENTO VIRTUAL BASE'}
                          </p>
                          <div className="flex items-center flex-wrap gap-2 mt-0.5">
                            <h4 className="text-sm font-black text-foreground tracking-tight">
                              {event.number}
                            </h4>
                            {event.type === 'entry' && (!event.invoices || event.invoices.length === 0) && (
                              <span className="text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-md text-amber-600 bg-amber-50 border-amber-200">
                                FACTURA: PENDIENTE
                              </span>
                            )}
                            {event.type === 'entry' && event.invoices && event.invoices.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
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
                              <div className="flex flex-wrap gap-1.5">
                                <span className={cn("text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-md", getInvoiceBadgeInfo(event.data).colors)}>
                                  {getInvoiceBadgeInfo(event.data).text}
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5">
                            {event.date.toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {event.type === 'entry' && (
                          <div className="bg-muted/30 px-4 py-1.5 rounded-xl border border-border text-center flex-shrink-0">
                            <p className="text-[8px] font-black text-muted-foreground uppercase mb-0.5">Volumen</p>
                            <p className="text-xs font-black text-primary">{(event.data.lotes || []).length} <span className="text-[10px] font-normal">lotes</span></p>
                          </div>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => { setSelectedEvent(event); setIsDetailOpen(true); }}
                          className="h-9 w-9 rounded-full hover:bg-muted"
                        >
                          <Eye className="h-[18px] w-[18px] text-muted-foreground" />
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
                                 {inv.movimientos.map((pago: any, pIdx: number) => {
                                   const autoConfirm = checkPaymentAutoConfirm(pago);
                                   const isAutoConfirmed = autoConfirm.isAutoConfirmed;

                                   return (
                                     <TableRow key={pIdx} className={cn("border-border/50", pago.anulado && "opacity-40 italic")}>
                                       <TableCell className="pl-6 py-3 text-xs">{formatDateRow(pago.fechaTransaccion)}</TableCell>
                                       <TableCell className="text-xs uppercase font-bold">
                                         {pago.tipoTransaccion} 
                                         {pago.anulado && <span className="text-red-500 ml-2">(ANULADO)</span>}
                                         {!pago.anulado && pago.confirmado && <span className="text-emerald-600 ml-2 text-[9px]">(CONFIRMADO)</span>}
                                         {!pago.anulado && !pago.confirmado && (
                                           isAutoConfirmed ? (
                                             <span className="text-emerald-600 ml-2 text-[9px]">(CONFIRMADO AUTOMÁTICAMENTE)</span>
                                           ) : (
                                             <span className="text-amber-600 ml-2 text-[9px]">(NO CONFIRMADO)</span>
                                           )
                                         )}
                                       </TableCell>
                                       <TableCell className="text-right font-black text-emerald-600">${Number(pago.monto).toFixed(2)}</TableCell>
                                       <TableCell className="text-right pr-6">
                                         <div className="flex items-center justify-end gap-2">
                                           {/* Confirmar: roles habilitados, pago no anulado ni confirmado ni auto-confirmado */}
                                           {!pago.anulado && !pago.confirmado && !isAutoConfirmed && canManagePayments && (
                                             <Button variant="ghost" size="icon" onClick={() => handleConfirmPayment(inv.id, pago.id)} className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" title="Confirmar Pago">
                                               <CheckCircle2 className="h-4 w-4" />
                                             </Button>
                                           )}
                                           {/* Editar fecha: admin y contador, incluso en auto-confirmados */}
                                           {!pago.anulado && (isAdmin || isContador) && (
                                             <Button variant="ghost" size="icon" onClick={() => handleOpenEditPayment(inv.id, pago.id, pago, false)} className="h-7 w-7 text-blue-500 hover:bg-blue-50" title="Editar Fecha de Pago">
                                               <Edit3 className="h-3.5 w-3.5" />
                                             </Button>
                                           )}
                                           {/* Eliminar: admin siempre; contador incluso auto-confirmados; cobranzas solo no confirmados y no auto-confirmados */}
                                           {!pago.anulado && (isAdmin || isContador || (!isAutoConfirmed && isCobranzas && !pago.confirmado)) && (
                                             <Button variant="ghost" size="icon" onClick={() => handleAnnullPayment(inv.id, pago.id, false, pago.confirmado)} className="h-7 w-7 text-red-500 hover:bg-red-50" title="Eliminar Pago">
                                               <Trash2 className="h-3.5 w-3.5" />
                                             </Button>
                                           )}
                                         </div>
                                       </TableCell>
                                     </TableRow>
                                   );
                                 })}
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
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
                              {selectedEvent.movimientos?.map((pago: any, pIdx: number) => {
                                 const autoConfirm = checkPaymentAutoConfirm(pago);
                                 const isAutoConfirmed = autoConfirm.isAutoConfirmed;

                                 return (
                                   <TableRow key={pIdx} className={cn(pago.anulado && "opacity-40 italic")}>
                                     <TableCell className="pl-8 py-4 text-xs">{formatDateRow(pago.fechaTransaccion || pago.fecha)}</TableCell>
                                     <TableCell className="text-xs uppercase font-bold">
                                       {pago.tipoTransaccion || "PAGO"} 
                                       {pago.anulado && <span className="text-red-500 ml-2">(ANULADO)</span>}
                                       {!pago.anulado && pago.confirmado && <span className="text-emerald-600 ml-2 text-[9px]">(CONFIRMADO)</span>}
                                       {!pago.anulado && !pago.confirmado && (
                                         isAutoConfirmed ? (
                                           <span className="text-emerald-600 ml-2 text-[9px]">(CONFIRMADO AUTOMÁTICAMENTE)</span>
                                         ) : (
                                           <span className="text-amber-600 ml-2 text-[9px]">(NO CONFIRMADO)</span>
                                         )
                                       )}
                                     </TableCell>
                                     <TableCell className="text-right font-black text-emerald-600">${Number(pago.monto).toFixed(2)}</TableCell>
                                     <TableCell className="text-right pr-8">
                                       <div className="flex items-center justify-end gap-2">
                                          {/* Confirmar */}
                                          {!pago.anulado && !pago.confirmado && !isAutoConfirmed && canManagePayments && (
                                            <Button variant="ghost" size="icon" onClick={() => handleConfirmPayment(selectedEvent.type === 'INITIAL_BALANCE_DOC' ? selectedEvent.clientId : selectedEvent.id, pago.id, selectedEvent.type === 'INITIAL_BALANCE_DOC')} className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="Confirmar Pago">
                                              <CheckCircle2 className="h-4 w-4" />
                                            </Button>
                                          )}
                                          {/* Editar fecha: admin y contador, incluso en auto-confirmados */}
                                          {!pago.anulado && (isAdmin || isContador) && (
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenEditPayment(selectedEvent.type === 'INITIAL_BALANCE_DOC' ? selectedEvent.clientId : selectedEvent.id, pago.id, pago, selectedEvent.type === 'INITIAL_BALANCE_DOC')} className="h-8 w-8 text-blue-500 hover:bg-blue-50" title="Editar Fecha de Pago">
                                              <Edit3 className="h-4 w-4" />
                                            </Button>
                                          )}
                                          {/* Eliminar */}
                                          {!pago.anulado && (isAdmin || isContador || (!isAutoConfirmed && isCobranzas && !pago.confirmado)) && (
                                            <Button variant="ghost" size="icon" onClick={() => handleAnnullPayment(selectedEvent.type === 'INITIAL_BALANCE_DOC' ? selectedEvent.clientId : selectedEvent.id, pago.id, selectedEvent.type === 'INITIAL_BALANCE_DOC', pago.confirmado)} className="h-8 w-8 text-red-500 hover:bg-red-50" title="Eliminar Pago">
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          )}
                                        </div>
                                     </TableCell>
                                   </TableRow>
                                 );
                               })}
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

      {/* ====== MODAL: EDITAR FECHA DE PAGO (Admin / Contador) ====== */}
      <Dialog open={isEditPaymentOpen} onOpenChange={(open) => { if (!open) { setIsEditPaymentOpen(false); setEditingPaymentData(null); } }}>
        <DialogContent className="max-w-sm p-0 rounded-[2.5rem] overflow-hidden border-none shadow-2xl bg-card">
          <div className="p-8 border-b border-border bg-blue-500/5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500 text-white flex items-center justify-center">
                <Edit3 className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Editar Fecha de Pago</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                  {editingPaymentData ? `${editingPaymentData.tipo} • $${editingPaymentData.monto.toFixed(2)}` : ""}
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Nueva Fecha del Pago</Label>
              <div className="border border-border rounded-2xl overflow-hidden">
                <Calendar
                  mode="single"
                  selected={editPaymentDate}
                  onSelect={(d) => { if (d) setEditPaymentDate(d); }}
                  locale={es}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="rounded-2xl"
                />
              </div>
              {editPaymentDate && (
                <p className="text-center text-xs font-black text-primary uppercase tracking-widest">
                  Fecha seleccionada: {format(editPaymentDate, "dd 'de' MMMM yyyy", { locale: es })}
                </p>
              )}
            </div>
          </div>

          <div className="p-6 border-t border-border bg-muted/20 flex gap-3">
            <Button
              variant="ghost"
              onClick={() => { setIsEditPaymentOpen(false); setEditingPaymentData(null); }}
              className="flex-1 rounded-xl h-12 font-bold uppercase text-[10px] tracking-widest"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEditedPayment}
              disabled={savingEditPayment || !editPaymentDate}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20 gap-2"
            >
              {savingEditPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Cambio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}