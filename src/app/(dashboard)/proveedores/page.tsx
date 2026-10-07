"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Store, 
  Receipt, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign, 
  CreditCard, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Building2, 
  Phone, 
  Tag, 
  TrendingUp, 
  BarChart3, 
  CalendarDays, 
  Loader2, 
  FileText,
  Trash2,
  Edit,
  ArrowUpRight,
  BadgeAlert,
  ChevronRight,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  where,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { 
  Supplier, 
  PurchaseInvoice, 
  SupplierPayment, 
  PURCHASE_CATEGORIES, 
  PurchaseCategory 
} from "@/types/proveedores";
import { InvoiceFormDialog } from "@/components/proveedores/invoice-form-dialog";
import { SupplierFormDialog } from "@/components/proveedores/supplier-form-dialog";
import { PaymentDialog } from "@/components/proveedores/payment-dialog";
import { SupplierLedgerDialog } from "@/components/proveedores/supplier-ledger-dialog";
import { InvoicePaymentsDialog } from "@/components/proveedores/invoice-payments-dialog";
import { 
  startOfWeek, 
  endOfWeek, 
  subWeeks, 
  startOfMonth, 
  endOfMonth, 
  format, 
  isWithinInterval, 
  parseISO, 
  differenceInDays,
  isBefore,
  startOfDay
} from "date-fns";
import { es } from "date-fns/locale";

export default function ProveedoresPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = 
    user?.role === "admin" || 
    user?.role === "facturacion" || 
    user?.role === "contador" || 
    user?.role === "financiero";

  // Datos de Firestore
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modales
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<PurchaseInvoice | null>(null);

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<PurchaseInvoice | null>(null);

  const [isPaymentsViewModalOpen, setIsPaymentsViewModalOpen] = useState(false);
  const [selectedInvoiceForPaymentsView, setSelectedInvoiceForPaymentsView] = useState<PurchaseInvoice | null>(null);

  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [selectedSupplierForLedger, setSelectedSupplierForLedger] = useState<Supplier | null>(null);

  // Filtros de facturas
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("TODAS");
  const [filterStatus, setFilterStatus] = useState<string>("TODOS");
  const [filterCondition, setFilterCondition] = useState<string>("TODAS");

  // Filtros de proveedores
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");

  // Filtro semanal del Dashboard
  const [weekFilter, setWeekFilter] = useState<"CURRENT" | "PREVIOUS" | "MONTH" | "CUSTOM">("CURRENT");
  const [customStartDate, setCustomStartDate] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));

  // 1. Suscripción a Proveedores
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "suppliers"), orderBy("nombre", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Supplier));
      setSuppliers(list);
    }, (err) => console.warn("Error cargando proveedores:", err));
    return () => unsub();
  }, []);

  // 2. Suscripción a Facturas de Compra
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "purchase_invoices"), orderBy("fechaEmision", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          montoTotal: Number(data.montoTotal || 0),
          totalAbonado: Number(data.totalAbonado || 0),
          saldoPendiente: Number(data.saldoPendiente !== undefined ? data.saldoPendiente : (data.montoTotal - (data.totalAbonado || 0))),
        } as PurchaseInvoice;
      });
      setInvoices(list);
      setLoading(false);
    }, (err) => {
      console.warn("Error cargando facturas de compra:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 3. Suscripción a Pagos de Proveedores
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "supplier_payments"), orderBy("fechaPago", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          _docId: d.id,
          ...data,
          id: d.id,
          paymentCode: data.id || d.id,
        };
      });
      setAllPayments(list);
    }, (err) => console.warn("Error cargando pagos:", err));
    return () => unsub();
  }, []);

  // Rango de fechas activo según el filtro semanal seleccionado
  const activeDateRange = useMemo(() => {
    const now = new Date();
    if (weekFilter === "CURRENT") {
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
        label: "Esta Semana (Lun - Dom)",
      };
    }
    if (weekFilter === "PREVIOUS") {
      const prev = subWeeks(now, 1);
      return {
        start: startOfWeek(prev, { weekStartsOn: 1 }),
        end: endOfWeek(prev, { weekStartsOn: 1 }),
        label: "Semana Anterior",
      };
    }
    if (weekFilter === "MONTH") {
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
        label: "Este Mes (" + format(now, "MMMM", { locale: es }) + ")",
      };
    }
    // CUSTOM
    try {
      return {
        start: parseISO(customStartDate),
        end: parseISO(customEndDate),
        label: "Rango Personalizado",
      };
    } catch {
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
        label: "Rango",
      };
    }
  }, [weekFilter, customStartDate, customEndDate]);

  // Facturas y métricas de la semana seleccionada
  const weeklyInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      try {
        if (!inv.fechaEmision) return false;
        const d = parseISO(inv.fechaEmision);
        return isWithinInterval(d, { start: activeDateRange.start, end: activeDateRange.end });
      } catch {
        return false;
      }
    });
  }, [invoices, activeDateRange]);

  // Pagos efectuados en la semana seleccionada
  const weeklyPayments = useMemo(() => {
    return allPayments.filter((p) => {
      try {
        if (!p.fechaPago) return false;
        const d = parseISO(p.fechaPago);
        return isWithinInterval(d, { start: activeDateRange.start, end: activeDateRange.end });
      } catch {
        return false;
      }
    });
  }, [allPayments, activeDateRange]);

  // Métricas Calculadas
  const totalWeeklyPurchases = useMemo(() => {
    return weeklyInvoices.reduce((sum, inv) => sum + (inv.montoTotal || 0), 0);
  }, [weeklyInvoices]);

  const totalWeeklyPaid = useMemo(() => {
    return weeklyPayments.reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
  }, [weeklyPayments]);

  const totalGlobalPendingBalance = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (inv.saldoPendiente || 0), 0);
  }, [invoices]);

  const overdueInvoices = useMemo(() => {
    const today = startOfDay(new Date());
    return invoices.filter((inv) => {
      if (inv.saldoPendiente <= 0) return false;
      try {
        const due = parseISO(inv.fechaVencimiento);
        return isBefore(due, today);
      } catch {
        return false;
      }
    });
  }, [invoices]);

  const totalOverdueAmount = useMemo(() => {
    return overdueInvoices.reduce((sum, inv) => sum + (inv.saldoPendiente || 0), 0);
  }, [overdueInvoices]);

  // Desglose de compras por categoría en la semana activa
  const weeklyCategoryBreakdown = useMemo(() => {
    const breakdown: Record<string, { total: number; count: number }> = {};
    weeklyInvoices.forEach((inv) => {
      const catKey = inv.categoria || "OTROS";
      if (!breakdown[catKey]) {
        breakdown[catKey] = { total: 0, count: 0 };
      }
      breakdown[catKey].total += inv.montoTotal || 0;
      breakdown[catKey].count += 1;
    });

    return Object.entries(breakdown).map(([catKey, data]) => {
      const catInfo = PURCHASE_CATEGORIES.find((c) => c.id === catKey);
      return {
        key: catKey,
        label: catInfo ? catInfo.label : catKey,
        total: data.total,
        count: data.count,
        percent: totalWeeklyPurchases > 0 ? (data.total / totalWeeklyPurchases) * 100 : 0,
      };
    }).sort((a, b) => b.total - a.total);
  }, [weeklyInvoices, totalWeeklyPurchases]);

  // Facturas filtradas para la pestaña de Facturas
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch = 
        (inv.numeroFactura || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.proveedorNombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.descripcion || "").toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (filterCategory !== "TODAS" && inv.categoria !== filterCategory) return false;

      if (filterCondition !== "TODAS") {
        if (filterCondition === "CONTADO" && inv.condicionPago !== "CONTADO") return false;
        if (filterCondition === "CREDITO" && inv.condicionPago !== "CREDITO") return false;
      }

      if (filterStatus !== "TODOS") {
        if (filterStatus === "VENCIDAS") {
          const isOverdue = overdueInvoices.some((ov) => ov.id === inv.id);
          if (!isOverdue) return false;
        } else if (inv.estado !== filterStatus) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, searchTerm, filterCategory, filterStatus, filterCondition, overdueInvoices]);

  // Proveedores filtrados
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((sup) => {
      const term = supplierSearchTerm.toLowerCase();
      return (
        (sup.nombre || "").toLowerCase().includes(term) ||
        (sup.ruc || "").toLowerCase().includes(term) ||
        (sup.contacto || "").toLowerCase().includes(term)
      );
    });
  }, [suppliers, supplierSearchTerm]);

  // Saldos calculados por proveedor
  const supplierBalances = useMemo(() => {
    const balances: Record<string, { saldo: number; totalFacturas: number }> = {};
    invoices.forEach((inv) => {
      if (!balances[inv.proveedorId]) {
        balances[inv.proveedorId] = { saldo: 0, totalFacturas: 0 };
      }
      balances[inv.proveedorId].saldo += inv.saldoPendiente || 0;
      balances[inv.proveedorId].totalFacturas += 1;
    });
    return balances;
  }, [invoices]);

  // Manejador para eliminar un pago / abono y recalcular saldos
  const handleDeletePayment = async (p: any, targetInv?: PurchaseInvoice) => {
    if (!canEdit) return;

    const monto = Number(p.monto || 0);
    const numFactura = p.invoiceNumber || targetInv?.numeroFactura || "";
    const prov = p.proveedorNombre || targetInv?.proveedorNombre || "proveedor";

    const mensaje = `¿Estás seguro de eliminar este pago de $${monto.toFixed(2)}${numFactura ? ` para la factura #${numFactura}` : ''} (${prov})?\n\nEsta acción recalculará y restablecerá el saldo pendiente de la factura.`;

    if (!confirm(mensaje)) return;

    try {
      // 1. Eliminar de la colección 'supplier_payments'
      const firestoreDocId = p._docId || (p.invoiceNumber ? p.id : null);
      let deletedFromCol = false;

      if (firestoreDocId) {
        try {
          const docRef = doc(db, "supplier_payments", firestoreDocId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            await deleteDoc(docRef);
            deletedFromCol = true;
          }
        } catch (err) {
          console.warn("No se pudo borrar directo de supplier_payments por ID:", err);
        }
      }

      // Si no se borró directo, buscar por paymentCode o id interno
      const paymentCode = p.paymentCode || p.id;
      if (!deletedFromCol && paymentCode) {
        const qPay = query(collection(db, "supplier_payments"), where("id", "==", paymentCode));
        const qSnap = await getDocs(qPay);
        for (const d of qSnap.docs) {
          await deleteDoc(doc(db, "supplier_payments", d.id));
          deletedFromCol = true;
        }
      }

      // Si aún no, buscar por invoiceNumber y monto/fecha
      if (!deletedFromCol && (p.invoiceNumber || targetInv?.numeroFactura)) {
        const searchInvoiceNum = p.invoiceNumber || targetInv?.numeroFactura;
        const qPay2 = query(collection(db, "supplier_payments"), where("invoiceNumber", "==", searchInvoiceNum));
        const qSnap2 = await getDocs(qPay2);
        for (const d of qSnap2.docs) {
          const dData = d.data();
          if (Math.abs(Number(dData.monto) - monto) < 0.01 && dData.fechaPago === p.fechaPago) {
            await deleteDoc(doc(db, "supplier_payments", d.id));
            break;
          }
        }
      }

      // 2. Actualizar la factura en 'purchase_invoices'
      let targetInvoiceId = p.invoiceId || targetInv?.id;
      let invoiceData: any = null;

      if (targetInvoiceId) {
        const invSnap = await getDoc(doc(db, "purchase_invoices", targetInvoiceId));
        if (invSnap.exists()) {
          invoiceData = { id: invSnap.id, ...invSnap.data() };
        }
      }

      // Si no se encontró por ID directo, buscar por número de factura
      if (!invoiceData && numFactura) {
        const qInv = query(collection(db, "purchase_invoices"), where("numeroFactura", "==", numFactura));
        const qInvSnap = await getDocs(qInv);
        if (!qInvSnap.empty) {
          const fDoc = qInvSnap.docs[0];
          targetInvoiceId = fDoc.id;
          invoiceData = { id: fDoc.id, ...fDoc.data() };
        }
      }

      if (invoiceData && targetInvoiceId) {
        const prevPagos: any[] = Array.isArray(invoiceData.pagos) ? invoiceData.pagos : [];
        let removed = false;

        const updatedPagos = prevPagos.filter((pay: any) => {
          if (!removed && (pay.id === paymentCode || pay.id === p.id || pay.id === p._docId)) {
            removed = true;
            return false;
          }
          if (!removed && Math.abs(Number(pay.monto) - monto) < 0.01 && pay.fechaPago === p.fechaPago) {
            removed = true;
            return false;
          }
          return true;
        });

        const newTotalAbonado = Number(
          updatedPagos.reduce((acc: number, curr: any) => acc + Number(curr.monto || 0), 0).toFixed(2)
        );
        const montoTotal = Number(invoiceData.montoTotal || 0);
        const newSaldoPendiente = Math.max(0, Number((montoTotal - newTotalAbonado).toFixed(2)));

        let nuevoEstado: "PENDIENTE" | "ABONADA" | "PAGADA" = "PENDIENTE";
        if (newTotalAbonado > 0) {
          nuevoEstado = newSaldoPendiente <= 0 ? "PAGADA" : "ABONADA";
        }

        await updateDoc(doc(db, "purchase_invoices", targetInvoiceId), {
          pagos: updatedPagos,
          totalAbonado: newTotalAbonado,
          saldoPendiente: newSaldoPendiente,
          estado: nuevoEstado,
          updatedAt: serverTimestamp(),
        });
      }

      toast({
        title: "Pago eliminado con éxito ✅",
        description: `Se eliminó el abono de $${monto.toFixed(2)} y se actualizó el saldo pendiente de la factura.`,
        className: "bg-emerald-600 text-white font-bold",
      });
    } catch (e: any) {
      console.error("Error al eliminar pago:", e);
      toast({
        variant: "destructive",
        title: "Error al eliminar pago",
        description: e.message || "Ocurrió un error inesperado al eliminar el pago.",
      });
    }
  };

  // Manejador para eliminar factura
  const handleDeleteInvoice = async (inv: PurchaseInvoice) => {
    if (!canEdit) return;
    if (confirm(`¿Estás seguro de eliminar la factura ${inv.numeroFactura} de ${inv.proveedorNombre}?`)) {
      try {
        // Limpiar pagos de esta factura en supplier_payments
        const qPay = query(collection(db, "supplier_payments"), where("invoiceId", "==", inv.id));
        const paySnap = await getDocs(qPay);
        for (const d of paySnap.docs) {
          await deleteDoc(doc(db, "supplier_payments", d.id));
        }

        await deleteDoc(doc(db, "purchase_invoices", inv.id));
        toast({
          title: "Factura eliminada",
          description: `Se eliminó la factura ${inv.numeroFactura}.`,
          className: "bg-red-600 text-white font-bold",
        });
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error al eliminar factura", description: e.message });
      }
    }
  };

  // Manejador para eliminar proveedor
  const handleDeleteSupplier = async (sup: Supplier) => {
    if (!canEdit) return;
    const supInvoices = invoices.filter((i) => i.proveedorId === sup.id);
    if (supInvoices.length > 0) {
      const confirmInvoices = confirm(
        `El proveedor "${sup.nombre}" tiene ${supInvoices.length} factura(s) de compra asociada(s).\n\n¿Deseas eliminar este proveedor junto con sus facturas asociadas?`
      );
      if (!confirmInvoices) return;

      try {
        for (const inv of supInvoices) {
          await deleteDoc(doc(db, "purchase_invoices", inv.id));
        }
        await deleteDoc(doc(db, "suppliers", sup.id));
        toast({
          title: "Proveedor y facturas eliminados ✅",
          description: `Se eliminó a ${sup.nombre} y sus facturas asociadas.`,
          className: "bg-red-600 text-white font-bold",
        });
        if (isSupplierModalOpen) setIsSupplierModalOpen(false);
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error al eliminar", description: e.message });
      }
      return;
    }

    if (confirm(`¿Deseas eliminar definitivamente el proveedor "${sup.nombre}"?`)) {
      try {
        await deleteDoc(doc(db, "suppliers", sup.id));
        toast({
          title: "Proveedor eliminado ✅",
          description: `Se eliminó a ${sup.nombre} del sistema.`,
          className: "bg-red-600 text-white font-bold",
        });
        if (isSupplierModalOpen) setIsSupplierModalOpen(false);
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error al eliminar", description: e.message });
      }
    }
  };

  return (
    <div className="max-w-[1650px] mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-700 pb-24 px-3 sm:px-6">
      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-2xl sm:text-4xl font-black text-foreground tracking-tighter uppercase flex items-center gap-2.5">
              <Store className="h-7 w-7 sm:h-9 sm:w-9 text-primary" />
              Proveedores y Compras
            </h1>
            <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs font-black uppercase px-3 py-1 rounded-xl">
              Módulo de Compras & Cuentas por Pagar
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium">
            Control de facturas de compra semanales, compras a crédito (hasta 120 días) y pagos a proveedores.
          </p>
        </div>

        {/* BOTONES DE ACCIÓN RÁPIDA */}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => {
                setSupplierToEdit(null);
                setIsSupplierModalOpen(true);
              }}
              variant="outline"
              className="h-11 px-4 rounded-2xl font-black text-xs uppercase gap-2 border-border shadow-sm hover:bg-muted"
            >
              <Building2 className="h-4 w-4 text-primary" /> + Nuevo Proveedor
            </Button>

            <Button
              onClick={() => {
                setInvoiceToEdit(null);
                setIsInvoiceModalOpen(true);
              }}
              className="h-11 px-6 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black text-xs uppercase gap-2 shadow-lg hover:shadow-primary/25 transition-all"
            >
              <Receipt className="h-4 w-4" /> + Registrar Factura
            </Button>
          </div>
        )}
      </div>

      {/* PESTAÑAS PRINCIPALES */}
      <Tabs defaultValue="semanal" className="w-full space-y-6">
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 rounded-2xl p-1.5 bg-muted/60 border border-border h-auto">
          <TabsTrigger value="semanal" className="rounded-xl font-black text-xs uppercase py-2.5 gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> 1. Resumen Semanal
          </TabsTrigger>
          <TabsTrigger value="facturas" className="rounded-xl font-black text-xs uppercase py-2.5 gap-2">
            <Receipt className="h-4 w-4 text-primary" /> 2. Facturas de Compra ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="proveedores" className="rounded-xl font-black text-xs uppercase py-2.5 gap-2">
            <Store className="h-4 w-4 text-primary" /> 3. Proveedores ({suppliers.length})
          </TabsTrigger>
          <TabsTrigger value="pagos" className="rounded-xl font-black text-xs uppercase py-2.5 gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> 4. Historial Pagos ({allPayments.length})
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* PESTAÑA 1: RESUMEN SEMANAL & ANÁLISIS DE COMPRAS                          */}
        {/* ========================================================================= */}
        <TabsContent value="semanal" className="space-y-6">
          {/* BARRA DE FILTRO DE SEMANA */}
          <div className="p-4 rounded-3xl bg-card border border-border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase text-foreground">Período de Análisis de Compras</h3>
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {activeDateRange.label} ({format(activeDateRange.start, "dd/MM/yyyy")} - {format(activeDateRange.end, "dd/MM/yyyy")})
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Button
                size="sm"
                variant={weekFilter === "CURRENT" ? "default" : "outline"}
                className="rounded-xl text-xs font-black uppercase h-9"
                onClick={() => setWeekFilter("CURRENT")}
              >
                Esta Semana
              </Button>
              <Button
                size="sm"
                variant={weekFilter === "PREVIOUS" ? "default" : "outline"}
                className="rounded-xl text-xs font-black uppercase h-9"
                onClick={() => setWeekFilter("PREVIOUS")}
              >
                Semana Anterior
              </Button>
              <Button
                size="sm"
                variant={weekFilter === "MONTH" ? "default" : "outline"}
                className="rounded-xl text-xs font-black uppercase h-9"
                onClick={() => setWeekFilter("MONTH")}
              >
                Este Mes
              </Button>

              {weekFilter === "CUSTOM" ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    className="erp-input h-9 text-xs font-bold w-36"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                  <span className="text-xs font-bold text-muted-foreground">-</span>
                  <Input
                    type="date"
                    className="erp-input h-9 text-xs font-bold w-36"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl text-xs font-black uppercase text-muted-foreground h-9"
                  onClick={() => setWeekFilter("CUSTOM")}
                >
                  Personalizado...
                </Button>
              )}
            </div>
          </div>

          {/* 4 TARJETAS MÉTRICAS EJECUTIVAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Compras de la semana */}
            <Card className="rounded-3xl border border-border shadow-sm bg-gradient-to-br from-card to-primary/5">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    Compras en Período
                  </span>
                  <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Receipt className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  ${totalWeeklyPurchases.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                    {weeklyInvoices.length} factura(s)
                  </Badge>
                  en la semana
                </div>
              </CardContent>
            </Card>

            {/* 2. Pagos de la semana */}
            <Card className="rounded-3xl border border-border shadow-sm bg-gradient-to-br from-card to-emerald-500/5">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Pagos / Abonos Realizados
                  </span>
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <CreditCard className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  ${totalWeeklyPaid.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono bg-emerald-500/10 text-emerald-600">
                    {weeklyPayments.length} abono(s)
                  </Badge>
                  desembolsados
                </div>
              </CardContent>
            </Card>

            {/* 3. Saldo pendiente global */}
            <Card className="rounded-3xl border border-border shadow-sm bg-gradient-to-br from-card to-amber-500/5">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Cuentas por Pagar Totales
                  </span>
                  <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
                  ${totalGlobalPendingBalance.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] font-bold text-muted-foreground">
                  Saldo pendiente con todos los proveedores
                </div>
              </CardContent>
            </Card>

            {/* 4. Facturas vencidas */}
            <Card className={`rounded-3xl border shadow-sm ${overdueInvoices.length > 0 ? "border-red-500/30 bg-red-500/5" : "border-border bg-card"}`}>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-red-700 dark:text-red-300">
                    Facturas Vencidas
                  </span>
                  <div className="h-8 w-8 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400">
                  ${totalOverdueAmount.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] font-bold text-red-600/80 flex items-center gap-1.5">
                  <Badge variant="destructive" className="px-1.5 py-0 text-[10px] font-mono">
                    {overdueInvoices.length} factura(s)
                  </Badge>
                  fuera de plazo
                </div>
              </CardContent>
            </Card>
          </div>

          {/* DESGLOSE POR CATEGORÍA Y LISTA DE COMPRAS SEMANALES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* DESGLOSE POR CATEGORÍA */}
            <div className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" /> Compras por Categoría
                </h3>
                <span className="text-[11px] font-bold text-muted-foreground">
                  {weeklyCategoryBreakdown.length} categorías
                </span>
              </div>

              {weeklyCategoryBreakdown.length > 0 ? (
                <div className="space-y-3.5">
                  {weeklyCategoryBreakdown.map((cat) => (
                    <div key={cat.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground truncate max-w-[200px]">{cat.label}</span>
                        <span className="font-mono font-black text-primary">
                          ${cat.total.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(4, cat.percent))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                        <span>{cat.count} factura(s)</span>
                        <span>{cat.percent.toFixed(1)}% del total</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground space-y-2 opacity-60">
                  <Tag className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-xs font-bold uppercase">Sin compras registradas en este período</p>
                </div>
              )}
            </div>

            {/* TABLA RÁPIDA DE FACTURAS DE ESTA SEMANA */}
            <div className="lg:col-span-2 p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" /> Facturas Emitidas en esta Semana ({weeklyInvoices.length})
                </h3>
              </div>

              <div className="rounded-2xl border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase">Fecha</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Proveedor</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">N° Factura</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-right">Monto Total</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-right">Saldo</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyInvoices.length > 0 ? (
                      weeklyInvoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="text-xs font-bold text-muted-foreground">
                            {format(parseISO(inv.fechaEmision), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-xs font-black uppercase truncate max-w-[200px]">
                            {inv.proveedorNombre}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-primary">
                            {inv.numeroFactura}
                          </TableCell>
                          <TableCell className="text-xs font-black text-right">
                            ${inv.montoTotal.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs font-black text-right text-amber-600 dark:text-amber-400">
                            ${inv.saldoPendiente.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              className={`text-[9px] font-black uppercase border-none px-2 py-0.5 rounded-full ${
                                inv.estado === "PAGADA"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                  : inv.estado === "ABONADA"
                                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              }`}
                            >
                              {inv.estado}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground font-semibold">
                          No se registraron compras en este rango de fechas.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* PESTAÑA 2: LISTA DE FACTURAS DE COMPRA (CUENTAS POR PAGAR)                */}
        {/* ========================================================================= */}
        <TabsContent value="facturas" className="space-y-4">
          {/* BARRA DE BÚSQUEDA Y FILTROS */}
          <div className="p-4 rounded-3xl bg-card border border-border shadow-sm flex flex-col lg:flex-row items-center justify-between gap-3">
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por N° factura, proveedor o detalle..."
                className="pl-10 erp-input h-10 text-xs font-bold"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              {/* Filtro por Categoría */}
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-10 text-xs font-bold rounded-xl erp-input w-44">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="TODAS">Todas las categorías</SelectItem>
                  {PURCHASE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro por Condición de Pago */}
              <Select value={filterCondition} onValueChange={setFilterCondition}>
                <SelectTrigger className="h-10 text-xs font-bold rounded-xl erp-input w-36">
                  <SelectValue placeholder="Condición" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="TODAS">Todo tipo</SelectItem>
                  <SelectItem value="CONTADO">Contado</SelectItem>
                  <SelectItem value="CREDITO">Crédito</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro por Estado */}
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-10 text-xs font-bold rounded-xl erp-input w-36">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="TODOS">Todos los estados</SelectItem>
                  <SelectItem value="PENDIENTE">Pendientes</SelectItem>
                  <SelectItem value="ABONADA">Abonadas</SelectItem>
                  <SelectItem value="PAGADA">Pagadas</SelectItem>
                  <SelectItem value="VENCIDAS">⚠️ Vencidas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* TABLA DE FACTURAS */}
          <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase py-4 pl-5">Emisión</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Vencimiento / Plazo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Proveedor</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">N° Factura</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Categoría</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right">Monto Total</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right">Abonado</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right">Saldo Pendiente</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">Estado</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right pr-5">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-48 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/30" />
                        <span className="text-xs font-bold uppercase text-muted-foreground mt-2 block">
                          Cargando facturas de compra...
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : filteredInvoices.length > 0 ? (
                    filteredInvoices.map((inv) => {
                      const isOverdue = overdueInvoices.some((ov) => ov.id === inv.id);
                      const catInfo = PURCHASE_CATEGORIES.find((c) => c.id === inv.categoria);
                      
                      let daysLeftText = "";
                      if (inv.saldoPendiente > 0 && inv.fechaVencimiento) {
                        try {
                          const days = differenceInDays(parseISO(inv.fechaVencimiento), startOfDay(new Date()));
                          if (days < 0) {
                            daysLeftText = `(Venció hace ${Math.abs(days)}d)`;
                          } else if (days === 0) {
                            daysLeftText = "(Vence hoy)";
                          } else {
                            daysLeftText = `(${days} días rest.)`;
                          }
                        } catch {}
                      }

                      return (
                        <TableRow key={inv.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="pl-5 text-xs font-bold text-muted-foreground whitespace-nowrap">
                            {format(parseISO(inv.fechaEmision), "dd/MM/yyyy")}
                          </TableCell>

                          <TableCell className="whitespace-nowrap">
                            <span className="text-xs font-bold block">
                              {format(parseISO(inv.fechaVencimiento), "dd/MM/yyyy")}
                            </span>
                            <span className={`text-[10px] font-semibold block ${isOverdue ? "text-red-600 font-black" : "text-muted-foreground"}`}>
                              {inv.condicionPago === "CONTADO" ? "Contado" : `${inv.diasCredito || 30}d crédito ${daysLeftText}`}
                            </span>
                          </TableCell>

                          <TableCell className="max-w-[220px]">
                            <span className="text-xs font-black uppercase text-foreground block truncate">
                              {inv.proveedorNombre}
                            </span>
                            {inv.descripcion && (
                              <span className="text-[11px] text-muted-foreground truncate block max-w-[200px]">
                                {inv.descripcion}
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="font-mono text-xs font-black text-primary whitespace-nowrap">
                            {inv.numeroFactura}
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold border-none px-2 py-0.5 whitespace-nowrap ${catInfo?.bgLight || "bg-muted text-foreground"}`}
                            >
                              {catInfo?.label || inv.categoria}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right text-xs font-black whitespace-nowrap">
                            ${inv.montoTotal.toFixed(2)}
                          </TableCell>

                          <TableCell className="text-right text-xs font-bold text-emerald-600 whitespace-nowrap">
                            {((inv.totalAbonado || 0) > 0 || (inv.pagos && inv.pagos.length > 0)) ? (
                              <button
                                type="button"
                                className="hover:underline font-black text-emerald-600 inline-flex items-center gap-1 cursor-pointer"
                                title="Ver abonos realizados a esta factura"
                                onClick={() => {
                                  setSelectedInvoiceForPaymentsView(inv);
                                  setIsPaymentsViewModalOpen(true);
                                }}
                              >
                                ${(inv.totalAbonado || 0).toFixed(2)}
                              </button>
                            ) : (
                              <span>${(inv.totalAbonado || 0).toFixed(2)}</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right whitespace-nowrap">
                            <span className={`text-xs font-black ${inv.saldoPendiente > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                              ${inv.saldoPendiente.toFixed(2)}
                            </span>
                          </TableCell>

                          <TableCell className="text-center whitespace-nowrap">
                            <Badge
                              className={`text-[9px] font-black uppercase border-none px-2.5 py-1 rounded-full ${
                                isOverdue
                                  ? "bg-red-500/20 text-red-700 dark:text-red-300"
                                  : inv.estado === "PAGADA"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                  : inv.estado === "ABONADA"
                                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              }`}
                            >
                              {isOverdue ? "⚠️ Vencida" : inv.estado}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right pr-5 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {((inv.totalAbonado || 0) > 0 || (inv.pagos && inv.pagos.length > 0)) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs font-bold text-muted-foreground hover:text-foreground rounded-xl px-2.5 gap-1 border-border"
                                  title="Ver y administrar abonos de esta factura"
                                  onClick={() => {
                                    setSelectedInvoiceForPaymentsView(inv);
                                    setIsPaymentsViewModalOpen(true);
                                  }}
                                >
                                  <Receipt className="h-3.5 w-3.5 text-primary" /> Pagos ({inv.pagos?.length || 0})
                                </Button>
                              )}

                              {canEdit && inv.saldoPendiente > 0 && (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-3 shadow-sm gap-1"
                                  onClick={() => {
                                    setSelectedInvoiceForPayment(inv);
                                    setIsPaymentModalOpen(true);
                                  }}
                                >
                                  <CreditCard className="h-3.5 w-3.5" /> Abonar
                                </Button>
                              )}

                              {canEdit && (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      setInvoiceToEdit(inv);
                                      setIsInvoiceModalOpen(true);
                                    }}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-xl text-muted-foreground hover:text-red-600"
                                    onClick={() => handleDeleteInvoice(inv)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="h-40 text-center text-xs text-muted-foreground font-semibold">
                        No se encontraron facturas con los filtros seleccionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* PESTAÑA 3: DIRECTORIO DE PROVEEDORES                                      */}
        {/* ========================================================================= */}
        <TabsContent value="proveedores" className="space-y-4">
          <div className="p-4 rounded-3xl bg-card border border-border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar proveedor por nombre, RUC o contacto..."
                className="pl-10 erp-input h-10 text-xs font-bold"
                value={supplierSearchTerm}
                onChange={(e) => setSupplierSearchTerm(e.target.value)}
              />
            </div>

            {canEdit && (
              <Button
                onClick={() => {
                  setSupplierToEdit(null);
                  setIsSupplierModalOpen(true);
                }}
                className="h-10 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase gap-2"
              >
                <Plus className="h-4 w-4" /> Agregar Proveedor
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.length > 0 ? (
              filteredSuppliers.map((sup) => {
                const bal = supplierBalances[sup.id] || { saldo: 0, totalFacturas: 0 };
                const catInfo = PURCHASE_CATEGORIES.find((c) => c.id === sup.categoriaPrincipal);

                return (
                  <Card key={sup.id} className="rounded-3xl border border-border hover:border-primary/40 transition-all shadow-sm group">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h4 className="font-black text-sm text-foreground uppercase tracking-tight group-hover:text-primary transition-colors">
                            {sup.nombre}
                          </h4>
                          <span className="text-[11px] font-mono text-muted-foreground block">
                            RUC: {sup.ruc || "S/N"}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-black border-none px-2 py-0.5 rounded-full ${catInfo?.bgLight || "bg-muted"}`}
                        >
                          {catInfo?.label || "PROVEEDOR"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-muted/40 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground block uppercase">Facturas</span>
                          <span className="font-black text-foreground">{bal.totalFacturas} regist.</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground block uppercase">Saldo por pagar</span>
                          <span className={`font-black ${bal.saldo > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                            ${bal.saldo.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-muted-foreground">
                        {sup.contacto && (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">Contacto:</span> {sup.contacto}
                          </div>
                        )}
                        {sup.telefono && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-primary" /> {sup.telefono}
                          </div>
                        )}
                        {sup.diasCreditoHabitual && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-muted-foreground" /> {sup.diasCreditoHabitual} días de crédito habitual
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-[11px] font-black uppercase rounded-xl flex-1 gap-1"
                          onClick={() => {
                            setSelectedSupplierForLedger(sup);
                            setIsLedgerModalOpen(true);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" /> Estado de Cuenta
                        </Button>

                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                              title="Editar proveedor"
                              onClick={() => {
                                setSupplierToEdit(sup);
                                setIsSupplierModalOpen(true);
                              }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                              title="Eliminar proveedor"
                              onClick={() => handleDeleteSupplier(sup)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full py-16 text-center text-muted-foreground space-y-2 opacity-60">
                <Store className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-xs font-bold uppercase">No se encontraron proveedores registrados</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* PESTAÑA 4: HISTORIAL DE PAGOS REALIZADOS                                  */}
        {/* ========================================================================= */}
        <TabsContent value="pagos" className="space-y-4">
          <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                Todos los Pagos y Abonos Efectuados a Proveedores ({allPayments.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase py-4 pl-5">Fecha de Pago</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Proveedor</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">N° Factura</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Método de Pago</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Banco / Referencia</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Registrado Por</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right">Monto Pagado ($)</TableHead>
                    {canEdit && (
                      <TableHead className="text-[10px] font-black uppercase text-right pr-5">Acciones</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPayments.length > 0 ? (
                    allPayments.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="pl-5 text-xs font-bold text-muted-foreground whitespace-nowrap">
                          {p.fechaPago ? format(parseISO(p.fechaPago), "dd/MM/yyyy") : "---"}
                        </TableCell>
                        <TableCell className="text-xs font-black uppercase text-foreground">
                          {p.proveedorNombre || "PROVEEDOR"}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-primary">
                          {p.invoiceNumber || "---"}
                        </TableCell>
                        <TableCell className="text-xs uppercase font-bold text-muted-foreground">
                          {p.metodoPago}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-bold block">{p.bancoOrigen || "---"}</span>
                          {p.numeroReferencia && (
                            <span className="font-mono text-[10px] text-muted-foreground block">
                              Ref: {p.numeroReferencia}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.registradoPor || "Sistema"}
                        </TableCell>
                        <TableCell className="text-right font-black text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          +${Number(p.monto || 0).toFixed(2)}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right pr-5 whitespace-nowrap">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                              title="Eliminar este pago y restablecer saldo de la factura"
                              onClick={() => {
                                const targetInv = invoices.find(i => i.id === p.invoiceId || i.numeroFactura === p.invoiceNumber);
                                handleDeletePayment(p, targetInv);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 8 : 7} className="h-40 text-center text-xs text-muted-foreground font-semibold">
                        Aún no hay pagos a proveedores registrados en el sistema.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO REGISTRAR / EDITAR FACTURA */}
      <InvoiceFormDialog
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        suppliers={suppliers}
        invoiceToEdit={invoiceToEdit}
        onOpenNewSupplierModal={() => {
          setSupplierToEdit(null);
          setIsSupplierModalOpen(true);
        }}
      />

      {/* DIÁLOGO REGISTRAR / EDITAR PROVEEDOR */}
      <SupplierFormDialog
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        supplierToEdit={supplierToEdit}
        onDeleteSupplier={handleDeleteSupplier}
      />

      {/* DIÁLOGO REGISTRAR PAGO / ABONO */}
      <PaymentDialog
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        invoice={selectedInvoiceForPayment}
      />

      {/* DIÁLOGO ESTADO DE CUENTA PROVEEDOR */}
      <SupplierLedgerDialog
        isOpen={isLedgerModalOpen}
        onClose={() => setIsLedgerModalOpen(false)}
        supplier={selectedSupplierForLedger}
        invoices={invoices}
        onOpenPaymentDialog={(inv) => {
          setIsLedgerModalOpen(false);
          setSelectedInvoiceForPayment(inv);
          setIsPaymentModalOpen(true);
        }}
        onDeletePayment={handleDeletePayment}
        canEdit={canEdit}
      />

      {/* DIÁLOGO CONSULTA Y ELIMINACIÓN DE PAGOS / ABONOS DE FACTURA */}
      <InvoicePaymentsDialog
        isOpen={isPaymentsViewModalOpen}
        onClose={() => {
          setIsPaymentsViewModalOpen(false);
          setSelectedInvoiceForPaymentsView(null);
        }}
        invoice={
          selectedInvoiceForPaymentsView 
            ? (invoices.find(i => i.id === selectedInvoiceForPaymentsView.id) || selectedInvoiceForPaymentsView)
            : null
        }
        onDeletePayment={handleDeletePayment}
        canEdit={canEdit}
      />
    </div>
  );
}
