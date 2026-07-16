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
  X,
  Download,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown
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
import * as XLSX from "xlsx";

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
  const abonado = pagos.reduce((acc: number, p: any) => p.anulado ? acc : (p.tipoTransaccion === 'Reverso' ? acc - Number(p.monto || 0) : acc + Number(p.monto || 0)), 0);
  const saldo = Math.max(0, total - abonado);
  
  const d = toDate(inv.fechaFactura || inv.createdAt || inv.invoiceDate || Date.now());
  const fechaVencimiento = new Date(d ? d.getTime() : Date.now());
  const diasCredito = Number(inv.diasCredito || 0);
  fechaVencimiento.setDate(fechaVencimiento.getDate() + diasCredito);
  
  const isVencida = fechaVencimiento < new Date() && saldo > 0;

  if (saldo <= 0.01) {
    return { text: `FACTURA: ${num} PAGADA`, colors: "text-emerald-700 bg-emerald-50 border-emerald-200", isVencida: false };
  }
  if (abonado > 0.01 && saldo > 0.01) {
    if (isVencida) {
      return { text: `FACTURA VENCIDA: ${num} (P. PARCIAL)`, colors: "text-red-700 bg-red-50 border-red-200", isVencida: true };
    }
    return { text: `FACTURA: ${num} PAGO PARCIAL`, colors: "text-blue-700 bg-blue-50 border-blue-200", isVencida: false };
  }
  if (abonado <= 0.01 && isVencida) {
    return { text: `FACTURA VENCIDA: ${num}`, colors: "text-red-700 bg-red-50 border-red-200", isVencida: true };
  }
  return { text: `FACTURA: PENDIENTE`, colors: "text-amber-600 bg-amber-50 border-amber-200", isVencida: false };
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
  const isAdmin = authUser?.role === "admin" || (authUser?.role as any) === "administrador" || (authUser?.role as any) === "ADMIN";
  const isCobranzas = authUser?.role === "cobranzas" || (authUser?.role as any) === "COBRANZAS";
  // Rol contador: acceso completo a edición y eliminación de cobros en Historial
  const isContador = authUser?.role === "contador" || (authUser?.role as any) === "CONTADOR";
  const canManagePayments = isAdmin || isCobranzas || isContador;
  const isReadOnly = authUser?.role === "socio";
  
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [currentView, setCurrentView] = useState<"timeline" | "estado_cuenta">("timeline");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [openClientCombo, setOpenClientCombo] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"fecha" | "ingresoMaestro" | "numeroFactura">("fecha");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (field: "fecha" | "ingresoMaestro" | "numeroFactura") => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

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

  const getClientName = (clientId: string) => {
    const c = clients.find(cl => cl.id === clientId);
    return c ? c.displayName : "CLIENTE DESCONOCIDO";
  };

  const handleGenerateAudit = async () => {
    if (!selectedClientId) {
      toast({ variant: "destructive", title: "Atención", description: "Seleccione un cliente para auditar o elija Todos." });
      return;
    }

    setLoading(true);
    setAuditData(null);

    try {
      let clientInvoices: any[] = [];
      let clientEntries: any[] = [];
      let baseDebt = 0;
      let clientData: any = {};
      const timeline: any[] = [];

      if (selectedClientId === "all") {
        const [invoicesSnap, entriesSnap, clientsSnap] = await Promise.all([
          getDocs(collection(db, "facturas")),
          getDocs(collection(db, "entries")),
          getDocs(collection(db, "clients"))
        ]);
        clientInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        clientEntries = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Cargar saldos iniciales de clientes con saldo inicial
        clientsSnap.docs.forEach(cDoc => {
          const cData = cDoc.data() || {};
          const cBaseDebt = Number(cData.baseDebt || cData.saldoInicial || 0);
          if (cBaseDebt > 0) {
            const rawName = (cData.name || cData.nombre || "").trim().toUpperCase();
            timeline.push({
              type: "INITIAL_BALANCE_DOC",
              date: new Date("2026-01-01T12:00:00"),
              id: `initial-balance-${cDoc.id}`,
              number: `SALDO INICIAL ${rawName}`,
              monto: cBaseDebt,
              movimientos: cData?.pagosSaldoInicial || [],
              clientId: cDoc.id,
              description: `Saldo de apertura fiscal 2026 para ${rawName}.`
            });
          }
        });
      } else {
        const clientDoc = await getDoc(doc(db, "clients", selectedClientId));
        clientData = clientDoc.data() || {};
        baseDebt = Number(clientData.baseDebt || clientData.saldoInicial || 0);

        const qInvoicesClient = query(collection(db, "facturas"), where("clientId", "==", selectedClientId));
        const qInvoicesCliente = query(collection(db, "facturas"), where("clienteId", "==", selectedClientId));
        const [invoicesClientSnap, invoicesClienteSnap] = await Promise.all([
          getDocs(qInvoicesClient),
          getDocs(qInvoicesCliente)
        ]);
        
        const invoicesMap = new Map();
        invoicesClientSnap.docs.forEach(d => invoicesMap.set(d.id, { id: d.id, ...d.data() }));
        invoicesClienteSnap.docs.forEach(d => invoicesMap.set(d.id, { id: d.id, ...d.data() }));
        clientInvoices = Array.from(invoicesMap.values());

        const qEntriesClient = query(collection(db, "entries"), where("clientId", "==", selectedClientId));
        const qEntriesCliente = query(collection(db, "entries"), where("clienteId", "==", selectedClientId));
        const [entriesClientSnap, entriesClienteSnap] = await Promise.all([
          getDocs(qEntriesClient),
          getDocs(qEntriesCliente)
        ]);
        
        const entriesMap = new Map();
        entriesClientSnap.docs.forEach(d => entriesMap.set(d.id, { id: d.id, ...d.data() }));
        entriesClienteSnap.docs.forEach(d => entriesMap.set(d.id, { id: d.id, ...d.data() }));
        clientEntries = Array.from(entriesMap.values());

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
          if (!item.date) return false;
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

      let totalCobradoFacturas = 0;
      clientInvoices.forEach(inv => {
        const movimientos = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : []);
        movimientos.forEach((m: any) => {
          if (!m.anulado) {
            const d = toDate(m.fechaTransaccion || m.fecha || m.createdAt);
            if (d && d >= fromDate && d <= toDateObj) {
              if (m.tipoTransaccion === 'Reverso' || m.tipo === 'Reverso') {
                totalCobradoFacturas -= Number(m.monto || 0);
              } else {
                totalCobradoFacturas += Number(m.monto || 0);
              }
            }
          }
        });
      });

      let totalCobradoSI_Periodo = 0;
      let saldoInicialPendiente = 0;

      if (selectedClientId === "all") {
        const clientsSnap = await getDocs(collection(db, "clients"));
        clientsSnap.docs.forEach(cDoc => {
          const cData = cDoc.data() || {};
          const cBaseDebt = Number(cData.baseDebt || cData.saldoInicial || 0);
          
          let cPagosSIGlobal = 0;
          const cPagosSI = Array.isArray(cData?.pagosSaldoInicial) ? cData.pagosSaldoInicial : [];
          cPagosSI.forEach((m: any) => {
            if (!m.anulado) {
              const mAmount = Number(m.monto || 0);
              const isReverso = m.tipoTransaccion === 'Reverso' || m.tipo === 'Reverso';
              
              if (isReverso) cPagosSIGlobal -= mAmount;
              else cPagosSIGlobal += mAmount;

              const d = toDate(m.fechaTransaccion || m.fecha || m.createdAt);
              if (d && d >= fromDate && d <= toDateObj) {
                if (isReverso) totalCobradoSI_Periodo -= mAmount;
                else totalCobradoSI_Periodo += mAmount;
              }
            }
          });

          saldoInicialPendiente += Math.max(0, cBaseDebt - cPagosSIGlobal);
        });
      } else {
        let pagosSIGlobal = 0;
        const pagosSI = Array.isArray(clientData?.pagosSaldoInicial) ? clientData.pagosSaldoInicial : [];
        pagosSI.forEach((m: any) => {
          if (!m.anulado) {
            const mAmount = Number(m.monto || 0);
            const isReverso = m.tipoTransaccion === 'Reverso' || m.tipo === 'Reverso';
            
            if (isReverso) pagosSIGlobal -= mAmount;
            else pagosSIGlobal += mAmount;

            const d = toDate(m.fechaTransaccion || m.fecha || m.createdAt);
            if (d && d >= fromDate && d <= toDateObj) {
              if (isReverso) totalCobradoSI_Periodo -= mAmount;
              else totalCobradoSI_Periodo += mAmount;
            }
          }
        });
        saldoInicialPendiente = Math.max(0, baseDebt - pagosSIGlobal);
      }

      let saldoPendienteFacturas = 0;
      invoicesInPeriod.forEach(inv => {
        const total = Number(inv.totalFactura || inv.total || 0);
        let cobradoTotal = 0;
        const movimientos = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : []);
        movimientos.forEach((m: any) => {
          if (!m.anulado) {
            if (m.tipoTransaccion === 'Reverso' || m.tipo === 'Reverso') cobradoTotal -= Number(m.monto || 0);
            else cobradoTotal += Number(m.monto || 0);
          }
        });
        saldoPendienteFacturas += Math.max(0, total - cobradoTotal);
      });

      const totalCobrado = totalCobradoFacturas + totalCobradoSI_Periodo;
      const saldoPendienteGeneral = saldoPendienteFacturas + saldoInicialPendiente;

      // Compilar los items aplanados para la vista de "Estado de Cuenta"
      const estadoCuentaItems: any[] = [];

      filteredTimeline.forEach((item: any) => {
        if (item.type === "INITIAL_BALANCE_DOC") {
          let abonosSI = 0;
          const movimientos = Array.isArray(item.movimientos) ? item.movimientos : [];
          movimientos.forEach((m: any) => {
            if (!m.anulado) {
              const mAmount = Number(m.monto || 0);
              if (m.tipoTransaccion === 'Reverso' || m.tipo === 'Reverso') abonosSI -= mAmount;
              else abonosSI += mAmount;
            }
          });
          const saldo = Math.max(0, Number(item.monto || 0) - abonosSI);
          
          estadoCuentaItems.push({
            id: item.id,
            fecha: item.date,
            ingresoMaestro: "SALDO INICIAL",
            numeroFactura: "---",
            clienteNombre: item.number.replace("SALDO INICIAL ", ""),
            lotes: 0,
            prendas: 0,
            peso: 0,
            valorFacturado: Number(item.monto || 0),
            abonos: abonosSI,
            saldoPendiente: saldo,
            estado: saldo <= 0.01 ? "Pagada" : "Pago parcial",
            isSample: false,
            clientId: item.clientId
          });
        } else if (item.type === "entry") {
          const lotesCount = (item.data.lotes || []).length;
          const prendasCount = item.data.lotes ? item.data.lotes.reduce((acc: number, curr: any) => acc + Number(curr.cantidad || curr.quantity || 0), 0) : 0;
          const pesoTotal = item.data.lotes ? item.data.lotes.reduce((acc: number, curr: any) => acc + Number(curr.peso || curr.weight || 0), 0) : 0;
          const clienteNombre = item.data.clientName || item.data.clienteNombre || getClientName(item.data.clientId || item.data.clienteId);

          if (item.invoices && item.invoices.length > 0) {
            item.invoices.forEach((inv: any) => {
              const badge = getInvoiceBadgeInfo(inv);
              const totalVal = Number(inv.totalFactura || inv.total || 0);
              const payments = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : [];
              const abonosVal = payments.reduce((acc: number, p: any) => p.anulado ? acc : (p.tipoTransaccion === 'Reverso' ? acc - Number(p.monto || 0) : acc + Number(p.monto || 0)), 0);
              const saldoVal = Math.max(0, totalVal - abonosVal);

              let statusStr = "Pago parcial";
              if (inv.status === "Anulada" || inv.anulada) statusStr = "Anulada";
              else if (saldoVal <= 0.01) statusStr = "Pagada";
              else if (badge.isVencida) statusStr = "Factura vencida";

              estadoCuentaItems.push({
                id: inv.id,
                fecha: item.date,
                ingresoMaestro: item.number,
                numeroFactura: inv.numeroFactura || inv.id,
                clienteNombre,
                lotes: lotesCount,
                prendas: prendasCount,
                peso: pesoTotal,
                valorFacturado: totalVal,
                abonos: abonosVal,
                saldoPendiente: saldoVal,
                estado: statusStr,
                isSample: !!item.data.isSample || inv.isSample === true || inv.tipoFactura === "muestra",
                clientId: item.data.clientId || item.data.clienteId
              });
            });
          } else {
            estadoCuentaItems.push({
              id: item.id,
              fecha: item.date,
              ingresoMaestro: item.number,
              numeroFactura: "---",
              clienteNombre,
              lotes: lotesCount,
              prendas: prendasCount,
              peso: pesoTotal,
              valorFacturado: 0,
              abonos: 0,
              saldoPendiente: 0,
              estado: "Pendiente de facturar",
              isSample: !!item.data.isSample,
              clientId: item.data.clientId || item.data.clienteId
            });
          }
        } else if (item.type === "invoice_standalone") {
          const badge = getInvoiceBadgeInfo(item.data);
          const totalVal = Number(item.data.totalFactura || item.data.total || 0);
          const payments = Array.isArray(item.movimientos) ? item.movimientos : [];
          const abonosVal = payments.reduce((acc: number, p: any) => p.anulado ? acc : (p.tipoTransaccion === 'Reverso' ? acc - Number(p.monto || 0) : acc + Number(p.monto || 0)), 0);
          const saldoVal = Math.max(0, totalVal - abonosVal);
          const clienteNombre = item.data.clienteNombre || item.data.clientName || getClientName(item.data.clientId || item.data.clienteId);

          let statusStr = "Pago parcial";
          if (item.data.status === "Anulada" || item.data.anulada) statusStr = "Anulada";
          else if (saldoVal <= 0.01) statusStr = "Pagada";
          else if (badge.isVencida) statusStr = "Factura vencida";

          estadoCuentaItems.push({
            id: item.id,
            fecha: item.date,
            ingresoMaestro: "---",
            numeroFactura: item.number,
            clienteNombre,
            lotes: 0,
            prendas: 0,
            peso: 0,
            valorFacturado: totalVal,
            abonos: abonosVal,
            saldoPendiente: saldoVal,
            estado: statusStr,
            isSample: item.data.isSample === true || item.data.tipoFactura === "muestra",
            clientId: item.data.clientId || item.data.clienteId
          });
        }
      });

      estadoCuentaItems.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

      setAuditData({
        client: clientData,
        summary: {
          baseDebt,
          saldoInicialPendiente,
          totalFacturado,
          totalCobrado,
          saldoPendienteGeneral
        },
        timeline: filteredTimeline,
        estadoCuentaItems
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

  const filteredEstadoCuentaItems = useMemo(() => {
    if (!auditData || !auditData.estadoCuentaItems) return [];
    
    let items = auditData.estadoCuentaItems.filter((item: any) => {
      if (filterEstado === "facturadas") {
        return item.numeroFactura !== "---" && item.estado !== "Pendiente de facturar";
      }
      if (filterEstado === "pendientes") {
        return item.estado === "Pendiente de facturar";
      }
      if (filterEstado === "vencidas") {
        return item.estado === "Factura vencida";
      }
      if (filterEstado === "muestras") {
        return item.isSample === true;
      }
      return true;
    });

    if (invoiceSearchQuery.trim()) {
      const q = invoiceSearchQuery.toLowerCase().trim();
      items = items.filter((item: any) => 
        String(item.numeroFactura || "").toLowerCase().includes(q) ||
        String(item.ingresoMaestro || "").toLowerCase().includes(q)
      );
    }

    items = [...items].sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === "fecha") {
        const timeA = valA ? new Date(valA).getTime() : 0;
        const timeB = valB ? new Date(valB).getTime() : 0;
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      }

      const cleanA = String(valA || "").trim().toLowerCase();
      const cleanB = String(valB || "").trim().toLowerCase();

      const comparison = cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return items;
  }, [auditData, filterEstado, invoiceSearchQuery, sortField, sortDirection]);

  const estadoCuentaSummary = useMemo(() => {
    let totalFacturado = 0;
    let totalAbonado = 0;
    let totalSaldoPendiente = 0;
    let numFacturas = 0;
    let numFacturasVencidas = 0;

    filteredEstadoCuentaItems.forEach((item: any) => {
      const hasInvoiceNum = item.numeroFactura && item.numeroFactura !== "---";
      const isSaldoInicial = item.ingresoMaestro === "SALDO INICIAL";
      
      if (hasInvoiceNum || isSaldoInicial) {
        numFacturas += 1;
        totalFacturado += item.valorFacturado;
        totalAbonado += item.abonos;
        totalSaldoPendiente += item.saldoPendiente;
        
        if (item.estado === "Factura vencida") {
          numFacturasVencidas += 1;
        }
      }
    });

    return {
      totalFacturado,
      totalAbonado,
      totalSaldoPendiente,
      numFacturas,
      numFacturasVencidas
    };
  }, [filteredEstadoCuentaItems]);

  const handleExportExcel = () => {
    if (filteredEstadoCuentaItems.length === 0) {
      toast({ variant: "destructive", title: "Sin datos", description: "No hay filas para exportar." });
      return;
    }

    const dataToExport = filteredEstadoCuentaItems.map((item: any) => ({
      "Fecha": item.fecha ? format(toDate(item.fecha)!, 'dd/MM/yyyy') : "---",
      "Ingreso Maestro": item.ingresoMaestro,
      "N.º Factura": item.numeroFactura,
      "Cliente": item.clienteNombre,
      "Lotes": item.lotes,
      "Valor Facturado": item.valorFacturado,
      "Abonos": item.abonos,
      "Saldo Pendiente": item.saldoPendiente,
      "Estado": item.estado,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Estado de Cuenta");

    const maxLens = Object.keys(dataToExport[0]).map(key => {
      let max = key.length;
      dataToExport.forEach((row: any) => {
        const valStr = String(row[key] ?? "");
        if (valStr.length > max) max = valStr.length;
      });
      return { wch: max + 2 };
    });
    worksheet["!cols"] = maxLens;

    XLSX.writeFile(workbook, `Estado_de_Cuenta_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`);
    toast({ title: "Exportación exitosa", description: "El archivo Excel se ha descargado." });
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

          .print-view-timeline {
            display: ${currentView === "timeline" ? "block" : "none"} !important;
          }
          .print-view-estado-cuenta {
            display: ${currentView === "estado_cuenta" ? "block" : "none"} !important;
          }
        }
      `}</style>
      
      <div className="space-y-1">
        <h1 className="text-5xl font-black tracking-tighter uppercase">Historial de Auditoría</h1>
        <p className="text-primary text-xs font-black uppercase tracking-[0.3em]">Trazabilidad Cronológica Industrial 1.1</p>
        {isReadOnly && <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3 mt-2">Modo Solo Lectura</Badge>}
      </div>

      <div className="bg-card p-8 rounded-[2.5rem] border border-border shadow-premium space-y-8 print:hidden">
        <div className={cn("grid grid-cols-1 gap-8", currentView === "estado_cuenta" ? "md:grid-cols-4" : "md:grid-cols-3")}>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Socio Industrial</Label>
            <Popover open={openClientCombo} onOpenChange={setOpenClientCombo}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-12 erp-input bg-card justify-between text-left font-bold text-xs">
                  {selectedClientId === "all" ? "-- TODOS LOS CLIENTES --" : (clients.find(c => c.id === selectedClientId)?.displayName || "Elija un socio...")}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-primary" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-4 rounded-2xl bg-card border border-border shadow-2xl space-y-3 z-[100]" align="start">
                <Input
                  placeholder="Buscar socio..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  className="h-10 font-bold"
                />
                <ScrollArea className="h-[250px]">
                  <div className="space-y-1 pr-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelectedClientId("all");
                        setOpenClientCombo(false);
                        setClientSearchQuery("");
                      }}
                      className={cn(
                        "w-full justify-start font-black text-xs h-10 px-4 rounded-xl text-primary",
                        selectedClientId === "all" ? "bg-primary/10" : ""
                      )}
                    >
                      -- TODOS LOS CLIENTES --
                    </Button>
                    {clients
                      .filter(c => c.displayName.toLowerCase().includes(clientSearchQuery.toLowerCase()))
                      .map(c => (
                        <Button
                          key={c.id}
                          variant="ghost"
                          onClick={() => {
                            setSelectedClientId(c.id);
                            setOpenClientCombo(false);
                            setClientSearchQuery("");
                          }}
                          className={cn(
                            "w-full justify-start text-xs font-bold h-10 px-4 rounded-xl text-left truncate block",
                            selectedClientId === c.id ? "bg-primary text-white hover:bg-primary/95" : "hover:bg-muted/50"
                          )}
                        >
                          {c.displayName}
                        </Button>
                      ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
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

          {currentView === "estado_cuenta" && (
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Estado de Pago</Label>
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="erp-input h-12 font-bold">
                  <SelectValue placeholder="Todos los estados..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="all">TODOS LOS ESTADOS</SelectItem>
                  <SelectItem value="facturadas">FACTURADAS</SelectItem>
                  <SelectItem value="pendientes">PENDIENTES DE FACTURAR</SelectItem>
                  <SelectItem value="vencidas">FACTURAS VENCIDAS</SelectItem>
                  <SelectItem value="muestras">MUESTRAS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
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

      {/* Selector de Vistas */}
      {auditData && (
        <div className="flex justify-center md:justify-start gap-4 print:hidden my-2">
          <Button
            variant={currentView === "timeline" ? "default" : "outline"}
            onClick={() => setCurrentView("timeline")}
            className={cn("rounded-2xl font-black uppercase text-xs h-12 px-6 gap-2", currentView === "timeline" ? "bg-primary text-white hover:bg-primary/95" : "bg-card border border-border text-foreground hover:bg-muted/10")}
          >
            <HistoryIcon className="h-4 w-4" />
            Línea de Tiempo (Auditoría)
          </Button>
          <Button
            variant={currentView === "estado_cuenta" ? "default" : "outline"}
            onClick={() => setCurrentView("estado_cuenta")}
            className={cn("rounded-2xl font-black uppercase text-xs h-12 px-6 gap-2", currentView === "estado_cuenta" ? "bg-primary text-white hover:bg-primary/95" : "bg-card border border-border text-foreground hover:bg-muted/10")}
          >
            <FileText className="h-4 w-4" />
            Estado de Cuenta
          </Button>
        </div>
      )}

      {auditData && currentView === "timeline" && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500 print-view-timeline">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 print-grid-2x2">
            <div className="bg-card p-8 rounded-[2rem] border border-border text-center space-y-1 shadow-sm opacity-60">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Saldo Inicial Base</p>
              <p className="text-3xl font-black text-foreground">{formatCurrency(auditData.summary.baseDebt)}</p>
            </div>
            <div className="bg-primary/5 p-8 rounded-[2rem] border border-primary/20 text-center space-y-1 shadow-sm">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">Saldo Inicial Pendiente</p>
              <p className="text-3xl font-black text-primary">{formatCurrency(auditData.summary.saldoInicialPendiente)}</p>
            </div>
            <div className="bg-card p-8 rounded-[2rem] border border-border text-center space-y-1 shadow-sm">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Facturado</p>
              <p className="text-3xl font-black text-foreground">{formatCurrency(auditData.summary.totalFacturado)}</p>
            </div>
            <div className="bg-card p-8 rounded-[2rem] border border-border text-center space-y-1 shadow-sm">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Recaudación Lograda</p>
              <p className="text-3xl font-black text-emerald-600">{formatCurrency(auditData.summary.totalCobrado)}</p>
            </div>
            <div className="bg-primary/10 p-8 rounded-[2rem] border border-primary/30 text-center space-y-1 shadow-md">
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
                    event.type === 'INITIAL_BALANCE_DOC' ? "bg-amber-50/30 border-amber-200" : "bg-card border-border hover:border-muted-foreground/30"
                  )}>
                    <div className="flex items-start justify-between gap-6 print-flex-row">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0",
                          event.type === 'entry' ? "bg-primary/5 text-primary" : 
                          event.type === 'INITIAL_BALANCE_DOC' ? "bg-amber-100 text-amber-600" : "bg-primary/5 text-primary"
                        )}>
                          {event.type === 'entry' ? <Layers className="h-5 w-5" /> : 
                           event.type === 'INITIAL_BALANCE_DOC' ? <Wallet className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="font-black text-sm uppercase tracking-tight">
                              {event.type === 'INITIAL_BALANCE_DOC' ? event.number : 
                               event.type === 'entry' ? `Ingreso Maestro: ${event.number}` : `Factura Standalone: ${event.number}`}
                            </span>
                            
                            {/* Mostrar nombre del socio si se seleccionó "Todos los Clientes" */}
                            {selectedClientId === "all" && event.type !== 'INITIAL_BALANCE_DOC' && (
                              <span className="text-[9px] font-black uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                                {event.data?.clientName || event.data?.clienteNombre || getClientName(event.data?.clientId || event.data?.clienteId)}
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

      {auditData && currentView === "estado_cuenta" && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500 print-view-estado-cuenta">
          {/* Cabecera del resumen del Estado de Cuenta */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 print-grid-2x2">
            <div className="bg-card p-8 rounded-[2rem] border border-border text-center space-y-1 shadow-sm">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Facturado</p>
              <p className="text-3xl font-black text-foreground">{formatCurrency(estadoCuentaSummary.totalFacturado)}</p>
            </div>
            <div className="bg-card p-8 rounded-[2rem] border border-border text-center space-y-1 shadow-sm">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Abonado</p>
              <p className="text-3xl font-black text-emerald-600">{formatCurrency(estadoCuentaSummary.totalAbonado)}</p>
            </div>
            <div className="bg-primary/10 p-8 rounded-[2rem] border border-primary/30 text-center space-y-1 shadow-md">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">Saldo Pendiente</p>
              <p className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(estadoCuentaSummary.totalSaldoPendiente)}</p>
            </div>
            <div className="bg-card p-8 rounded-[2rem] border border-border text-center space-y-1 shadow-sm">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">N.º Facturas</p>
              <p className="text-3xl font-black text-foreground">{estadoCuentaSummary.numFacturas}</p>
            </div>
            <div className={cn(
              "p-8 rounded-[2rem] border text-center space-y-1 shadow-sm",
              estadoCuentaSummary.numFacturasVencidas > 0 ? "bg-red-50/50 border-red-200" : "bg-card border-border"
            )}>
              <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Facturas Vencidas</p>
              <p className={cn("text-3xl font-black", estadoCuentaSummary.numFacturasVencidas > 0 ? "text-red-600" : "text-foreground")}>
                {estadoCuentaSummary.numFacturasVencidas}
              </p>
            </div>
          </div>

          {/* Botones de acción específicos de la vista */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 gap-4">
            <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              Estado de Cuenta Detallado
            </h3>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 print:hidden w-full md:w-auto">
              <div className="relative w-full sm:w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar factura o ingreso..." 
                  className="pl-9 h-10 rounded-xl erp-input text-xs font-bold"
                  value={invoiceSearchQuery} 
                  onChange={(e) => setInvoiceSearchQuery(e.target.value)} 
                />
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleExportExcel} 
                  className="rounded-xl font-bold uppercase text-[10px] gap-2 h-10 px-4 border-emerald-300 text-emerald-700 hover:bg-emerald-50/50"
                >
                  <Download className="h-4 w-4" /> Exportar Excel
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.print()} 
                  className="rounded-xl font-bold uppercase text-[10px] gap-2 h-10 px-4"
                >
                  <Printer className="h-4 w-4" /> Exportar PDF
                </Button>
              </div>
            </div>
          </div>

          {/* Tabla de Estado de Cuenta */}
          <div className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-premium">
            <Table>
              <TableHeader className="bg-muted/50 border-b border-border">
                <TableRow>
                  <TableHead 
                    className="text-[9px] font-black uppercase py-5 pl-8 cursor-pointer select-none hover:text-primary transition-colors"
                    onClick={() => handleSort("fecha")}
                  >
                    <div className="flex items-center gap-1.5">
                      Fecha
                      {sortField === "fecha" ? (
                        sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5 text-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-[9px] font-black uppercase cursor-pointer select-none hover:text-primary transition-colors"
                    onClick={() => handleSort("ingresoMaestro")}
                  >
                    <div className="flex items-center gap-1.5">
                      Ingreso Maestro
                      {sortField === "ingresoMaestro" ? (
                        sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5 text-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-[9px] font-black uppercase cursor-pointer select-none hover:text-primary transition-colors"
                    onClick={() => handleSort("numeroFactura")}
                  >
                    <div className="flex items-center gap-1.5">
                      N.º Factura
                      {sortField === "numeroFactura" ? (
                        sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5 text-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-[9px] font-black uppercase">Cliente</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-center">Lotes</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-right">Valor Facturado</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-right">Abonos</TableHead>
                  <TableHead className="text-[9px] font-black uppercase text-right">Saldo Pendiente</TableHead>
                  <TableHead className="text-[9px] font-black uppercase pr-8">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEstadoCuentaItems.map((item: any, itemIdx: number) => {
                  let badgeColor = "bg-slate-50 text-slate-500 border-slate-100";
                  if (item.estado === "Pagada") {
                    badgeColor = "bg-emerald-50 text-emerald-700/90 border-emerald-100";
                  } else if (item.estado === "Pago parcial") {
                    badgeColor = "bg-amber-50 text-amber-700/90 border-amber-100";
                  } else if (item.estado === "Factura vencida") {
                    badgeColor = "bg-rose-50 text-rose-700/90 border-rose-100";
                  } else if (item.estado === "Pendiente de facturar") {
                    badgeColor = "bg-sky-50 text-sky-700/90 border-sky-100";
                  }

                  return (
                    <TableRow 
                      key={itemIdx} 
                      className={cn(
                        "border-b border-border hover:bg-muted/5 transition-colors", 
                        item.estado === "Anulada" && "opacity-50 italic"
                      )}
                    >
                      <TableCell className="pl-8 py-4 font-bold text-xs">
                        {item.fecha ? format(toDate(item.fecha)!, 'dd/MM/yyyy') : "---"}
                      </TableCell>
                      <TableCell className="font-black text-xs text-primary uppercase">
                        {item.ingresoMaestro}
                      </TableCell>
                      <TableCell className="font-bold text-xs uppercase">
                        {item.numeroFactura}
                      </TableCell>
                      <TableCell className="font-bold text-xs uppercase">
                        {item.clienteNombre}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">
                        {item.lotes}
                      </TableCell>
                      <TableCell className="text-right font-black text-xs text-slate-800">
                        {formatCurrency(item.valorFacturado)}
                      </TableCell>
                      <TableCell className="text-right font-black text-xs text-emerald-600">
                        {formatCurrency(item.abonos)}
                      </TableCell>
                      <TableCell className="text-right font-black text-xs text-primary">
                        {formatCurrency(item.saldoPendiente)}
                      </TableCell>
                      <TableCell className="pr-8">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest border px-2.5 py-1 rounded-md inline-block text-center min-w-[120px]", 
                            badgeColor
                          )}>
                            {item.estado === "Factura vencida" ? `Vencida: ${item.numeroFactura}` : item.estado}
                          </span>
                          {item.estado === "Factura vencida" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                window.location.href = `/cobranzas?clientId=${item.clientId}&invoiceId=${item.id}`;
                              }}
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full print:hidden"
                              title="Cobrar en Cobranzas"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredEstadoCuentaItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center opacity-20">
                        <FileText className="h-12 w-12 mb-4" />
                        <p className="text-sm font-black uppercase tracking-[0.2em]">Sin registros para mostrar con los filtros activos</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
