"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  DollarSign, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Receipt, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  Eye, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Calendar, 
  Building2, 
  Users, 
  Tag, 
  Lock, 
  RefreshCcw, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Landmark,
  ShieldAlert,
  Loader2,
  FileText
} from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from "recharts";
import { collection, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  PrivateMovement, 
  MovementType, 
  PrivateContact, 
  PrivateCategory,
  PAYMENT_METHODS,
  COMMON_BANKS,
  INITIAL_EXPENSE_CATEGORIES
} from "@/types/private-financial";
import { 
  savePrivateMovement, 
  annulPrivateMovement, 
  findPotentialDuplicate, 
  seedInitialCategories,
  addPrivateCategory,
  addPrivateContact
} from "@/lib/private-financial-service";
import { exportPrivateFinancialExcel } from "@/lib/private-financial-excel";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const CHART_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", 
  "#06b6d4", "#f97316", "#84cc16", "#14b8a6", "#6366f1", 
  "#d946ef", "#64748b", "#ef4444", "#a855f7"
];

export default function ControlFinancieroPrivadoPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Redirección si no es administrador
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  // Estados de datos
  const [movements, setMovements] = useState<PrivateMovement[]>([]);
  const [contacts, setContacts] = useState<PrivateContact[]>([]);
  const [categories, setCategories] = useState<PrivateCategory[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filtros de periodo
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentMonth)); // "all" o "1".."12"

  // Filtros de tabla
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showAnnulled, setShowAnnulled] = useState(false);

  // Estados de modales
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<PrivateMovement | null>(null);
  const [annullingMovement, setAnnullingMovement] = useState<PrivateMovement | null>(null);
  const [annulReason, setAnnulReason] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<{ match: PrivateMovement; pendingPayload: any } | null>(null);

  // Estados del formulario de registro
  const [formType, setFormType] = useState<MovementType>("cobro_cliente");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formContact, setFormContact] = useState("");
  const [formCategory, setFormCategory] = useState("Otros");
  const [formConcept, setFormConcept] = useState("");
  const [formAmount, setFormAmount] = useState<string>("");
  const [formMethod, setFormMethod] = useState("Transferencia Bancaria");
  const [formBank, setFormBank] = useState("");
  const [formReference, setFormReference] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [savingRecord, setSavingRecord] = useState(false);

  // Estado para nueva categoría rápida
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Estado para consultas por contacto
  const [consultType, setConsultType] = useState<"cliente" | "proveedor">("cliente");
  const [selectedContactName, setSelectedContactName] = useState<string>("");

  // Pestaña activa principal
  const [activeTab, setActiveTab] = useState("movimientos");


  // Carga reactiva de datos desde Firestore
  useEffect(() => {
    if (!user || user.role !== "admin") return;

    // Inicializar categorías si están vacías
    seedInitialCategories(user.email || "admin");

    // Movimientos
    const qMov = query(collection(db, "private_financial_movements"), orderBy("date", "desc"));
    const unsubMov = onSnapshot(qMov, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as PrivateMovement));
      setMovements(list);
      setLoadingData(false);
    }, (err) => {
      console.error("Error al cargar movimientos privados:", err);
      setLoadingData(false);
    });

    // Contactos
    const qCont = query(collection(db, "private_financial_contacts"), orderBy("name", "asc"));
    const unsubCont = onSnapshot(qCont, (snap) => {
      setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() } as PrivateContact)));
    });

    // Categorías
    const qCat = query(collection(db, "private_financial_categories"), orderBy("name", "asc"));
    const unsubCat = onSnapshot(qCat, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as PrivateCategory)));
    });

    return () => {
      unsubMov();
      unsubCont();
      unsubCat();
    };
  }, [user]);

  // Lista de años disponibles para filtrar
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>([String(currentYear)]);
    movements.forEach(m => {
      if (m.date) {
        const y = m.date.split("-")[0];
        if (y && y.length === 4) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort().reverse();
  }, [movements, currentYear]);

  // Movimientos filtrados por año y mes
  const periodMovements = useMemo(() => {
    return movements.filter(m => {
      if (!m.date) return false;
      const [y, mth] = m.date.split("-");
      if (selectedYear !== "all" && y !== selectedYear) return false;
      if (selectedMonth !== "all" && String(parseInt(mth)) !== selectedMonth) return false;
      return true;
    });
  }, [movements, selectedYear, selectedMonth]);

  // Movimientos activos en el periodo para totales (excluye anulados)
  const activePeriodMovements = useMemo(() => {
    return periodMovements.filter(m => m.status === "ACTIVO");
  }, [periodMovements]);

  // Cálculos de Resumen Mensual (Exclusión Mutua)
  const totals = useMemo(() => {
    let totalCobrado = 0;
    let totalPagadoProveedores = 0;
    let totalGastosGenerales = 0;
    let cobrosCount = 0;
    let pagosCount = 0;
    let gastosCount = 0;

    activePeriodMovements.forEach(m => {
      const val = Number(m.amount) || 0;
      if (m.type === "cobro_cliente") {
        totalCobrado += val;
        cobrosCount++;
      } else if (m.type === "pago_proveedor") {
        totalPagadoProveedores += val;
        pagosCount++;
      } else if (m.type === "gasto_general") {
        totalGastosGenerales += val;
        gastosCount++;
      }
    });

    const totalSalidas = totalPagadoProveedores + totalGastosGenerales;
    const balanceNeto = totalCobrado - totalSalidas;
    const totalCount = activePeriodMovements.length;

    return {
      totalCobrado,
      totalPagadoProveedores,
      totalGastosGenerales,
      totalSalidas,
      balanceNeto,
      totalCount,
      cobrosCount,
      pagosCount,
      gastosCount
    };
  }, [activePeriodMovements]);

  // Movimientos para la tabla de historial con filtros aplicados
  const filteredHistory = useMemo(() => {
    return periodMovements.filter(m => {
      if (!showAnnulled && m.status === "ANULADO") return false;
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      if (categoryFilter !== "all" && m.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const contact = (m.contactName || "").toLowerCase();
        const concept = (m.concept || "").toLowerCase();
        const ref = (m.reference || "").toLowerCase();
        const bank = (m.bank || "").toLowerCase();
        const cat = (m.category || "").toLowerCase();
        const notes = (m.notes || "").toLowerCase();
        return (
          contact.includes(q) ||
          concept.includes(q) ||
          ref.includes(q) ||
          bank.includes(q) ||
          cat.includes(q) ||
          notes.includes(q)
        );
      }
      return true;
    });
  }, [periodMovements, showAnnulled, typeFilter, categoryFilter, searchQuery]);

  // Distribución de gastos generales por categoría para gráficos
  const expenseByCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    activePeriodMovements
      .filter(m => m.type === "gasto_general")
      .forEach(m => {
        const cat = m.category || "Otros";
        map[cat] = (map[cat] || 0) + (Number(m.amount) || 0);
      });

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activePeriodMovements]);

  // Comparativa mensual para el año seleccionado (12 meses)
  const monthlyComparisonData = useMemo(() => {
    const targetYear = selectedYear === "all" ? String(currentYear) : selectedYear;
    const data = MONTH_NAMES.map((month, idx) => ({
      month: month.substring(0, 3),
      monthIndex: idx + 1,
      Ingresos: 0,
      Egresos: 0,
      Balance: 0
    }));

    movements
      .filter(m => m.status === "ACTIVO" && m.date && m.date.startsWith(targetYear))
      .forEach(m => {
        const mth = parseInt(m.date.split("-")[1], 10);
        if (mth >= 1 && mth <= 12) {
          const val = Number(m.amount) || 0;
          if (m.type === "cobro_cliente") {
            data[mth - 1].Ingresos += val;
          } else {
            data[mth - 1].Egresos += val;
          }
        }
      });

    data.forEach(d => {
      d.Balance = d.Ingresos - d.Egresos;
    });

    return data;
  }, [movements, selectedYear, currentYear]);

  // Lista de contactos según el tipo de consulta seleccionada
  const filteredContactsList = useMemo(() => {
    return contacts.filter(c => c.type === consultType);
  }, [contacts, consultType]);

  // Movimientos del contacto seleccionado en consultas
  const contactConsultMovements = useMemo(() => {
    if (!selectedContactName) return [];
    const norm = selectedContactName.trim().toUpperCase();
    return movements.filter(m => {
      const matchName = (m.contactName || "").trim().toUpperCase() === norm;
      const matchType = consultType === "cliente" ? m.type === "cobro_cliente" : m.type === "pago_proveedor";
      return matchName && matchType;
    });
  }, [movements, selectedContactName, consultType]);

  const contactConsultTotals = useMemo(() => {
    const actives = contactConsultMovements.filter(m => m.status === "ACTIVO");
    const total = actives.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    return {
      total,
      count: actives.length,
      annulledCount: contactConsultMovements.length - actives.length
    };
  }, [contactConsultMovements]);

  // Reset del formulario
  const resetForm = () => {
    setFormType("cobro_cliente");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormContact("");
    setFormCategory(categories[0]?.name || "Otros");
    setFormConcept("");
    setFormAmount("");
    setFormMethod("Transferencia Bancaria");
    setFormBank("");
    setFormReference("");
    setFormNotes("");
    setEditingMovement(null);
  };

  // Abrir modal para crear
  const handleOpenCreate = (initialType?: MovementType) => {
    resetForm();
    if (initialType) setFormType(initialType);
    setIsRegisterOpen(true);
  };

  // Abrir modal para editar
  const handleOpenEdit = (m: PrivateMovement) => {
    setEditingMovement(m);
    setFormType(m.type);
    setFormDate(m.date);
    setFormContact(m.contactName);
    setFormCategory(m.category || categories[0]?.name || "Otros");
    setFormConcept(m.concept);
    setFormAmount(String(m.amount));
    setFormMethod(m.paymentMethod || "Transferencia Bancaria");
    setFormBank(m.bank || "");
    setFormReference(m.reference || "");
    setFormNotes(m.notes || "");
    setIsRegisterOpen(true);
  };

  // Procesar guardado con verificación de duplicados
  const handleSubmitRecord = async (forceSave = false) => {
    if (!formContact.trim()) {
      toast({ variant: "destructive", title: "Campo requerido", description: "Ingrese el nombre del cliente, proveedor o beneficiario." });
      return;
    }
    if (!formConcept.trim()) {
      toast({ variant: "destructive", title: "Campo requerido", description: "Ingrese el concepto del movimiento." });
      return;
    }
    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ variant: "destructive", title: "Valor inválido", description: "Ingrese un valor numérico mayor a cero." });
      return;
    }

    const payload: any = {
      type: formType,
      date: formDate,
      contactName: formContact.trim().toUpperCase(),
      concept: formConcept.trim(),
      amount: amountNum,
      paymentMethod: formMethod,
    };

    if (formBank.trim()) payload.bank = formBank.trim();
    if (formReference.trim()) payload.reference = formReference.trim().toUpperCase();
    if (formType === "gasto_general" && formCategory) payload.category = formCategory;
    if (formNotes.trim()) payload.notes = formNotes.trim();

    if (editingMovement) {
      payload.id = editingMovement.id;
    }

    // 1. Verificación de duplicado (si no es actualización y no se forzó)
    if (!editingMovement && !forceSave) {
      const duplicate = findPotentialDuplicate(movements, {
        date: formDate,
        contactName: formContact,
        amount: amountNum,
        reference: formReference
      });

      if (duplicate) {
        setDuplicateWarning({ match: duplicate, pendingPayload: payload });
        return;
      }
    }

    setSavingRecord(true);
    try {
      await savePrivateMovement(payload, user?.email || "admin");
      toast({ 
        title: editingMovement ? "Movimiento Actualizado" : "Movimiento Registrado", 
        description: `${formContact.toUpperCase()} - $${amountNum.toFixed(2)}` 
      });
      setIsRegisterOpen(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: "destructive", 
        title: "Error al guardar", 
        description: err.message || "Ocurrió un error en Firestore." 
      });
    } finally {
      setSavingRecord(false);
      setDuplicateWarning(null);
    }
  };

  // Confirmar anulación
  const handleConfirmAnnul = async () => {
    if (!annullingMovement) return;
    if (!annulReason.trim()) {
      toast({ variant: "destructive", title: "Motivo requerido", description: "Debe ingresar el motivo de la anulación para auditoría." });
      return;
    }

    try {
      await annulPrivateMovement(annullingMovement.id, annulReason, user?.email || "admin");
      toast({ title: "Movimiento Anulado", description: "El registro ha sido excluido de los balances contables." });
      setAnnullingMovement(null);
      setAnnulReason("");
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error al anular", description: err.message });
    }
  };

  // Crear nueva categoría rápida
  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await addPrivateCategory(newCatName, user?.email || "admin");
      setFormCategory(newCatName.trim());
      setNewCatName("");
      setIsNewCatModalOpen(false);
      toast({ title: "Categoría Agregada", description: newCatName.trim() });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  // Exportar Excel
  const handleExportExcel = async () => {
    try {
      const label = selectedMonth === "all" 
        ? `Año_${selectedYear}` 
        : `${MONTH_NAMES[parseInt(selectedMonth) - 1]}_${selectedYear}`;
      await exportPrivateFinancialExcel(periodMovements, label);
      toast({ title: "Excel Generado con Éxito", description: `Reporte ${label} descargado.` });
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error al exportar", description: err.message });
    }
  };

  // Etiqueta de periodo legible
  const periodLabelText = useMemo(() => {
    if (selectedMonth === "all") return `Todo el Año ${selectedYear}`;
    const mIdx = parseInt(selectedMonth, 10) - 1;
    return `${MONTH_NAMES[mIdx]} ${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  if (authLoading || !user || user.role !== "admin") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Verificando credenciales de administrador...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-500 max-w-7xl mx-auto px-2 sm:px-4">
      {/* HEADER DE MÓDULO PRIVADO */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 bg-card border border-border/70 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner shrink-0">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
                Control Financiero Privado
              </h1>
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-black text-[10px] uppercase tracking-wider">
                Solo Administrador
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Libro manual independiente de cobros, pagos a proveedores y gastos generales de LDDEC.
            </p>
          </div>
        </div>

        {/* CONTROLES DE PERIODO Y ACCIONES PRINCIPALES */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Selector de Mes */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-11 w-36 bg-background rounded-xl font-black text-xs uppercase border-border">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold uppercase text-xs">Todo el Año</SelectItem>
              {MONTH_NAMES.map((m, idx) => (
                <SelectItem key={idx} value={String(idx + 1)} className="font-bold uppercase text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Selector de Año */}
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-11 w-28 bg-background rounded-xl font-black text-xs uppercase border-border">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(y => (
                <SelectItem key={y} value={y} className="font-bold uppercase text-xs">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Botón Exportar Excel */}
          <Button 
            onClick={handleExportExcel}
            variant="outline"
            className="h-11 px-4 rounded-xl font-black text-xs uppercase tracking-wide gap-2 border-border hover:bg-muted"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </Button>

          {/* Botón Registrar Movimiento */}
          <Button 
            onClick={() => handleOpenCreate()}
            className="h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-wide gap-2 shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            Registrar Movimiento
          </Button>
        </div>
      </div>

      {/* TARJETAS RESUMEN MENSUAL (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL COBRADO A CLIENTES */}
        <Card className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
              Cobros a Clientes
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
              ${totals.totalCobrado.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] font-bold text-muted-foreground mt-1">
              {totals.cobrosCount} {totals.cobrosCount === 1 ? "cobro registrado" : "cobros registrados"}
            </p>
          </CardContent>
        </Card>

        {/* TOTAL PAGOS A PROVEEDORES */}
        <Card className="rounded-3xl border border-amber-500/20 bg-amber-500/5 shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">
              Pagos a Proveedores
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight">
              ${totals.totalPagadoProveedores.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] font-bold text-muted-foreground mt-1">
              {totals.pagosCount} {totals.pagosCount === 1 ? "pago registrado" : "pagos registrados"}
            </p>
          </CardContent>
        </Card>

        {/* TOTAL GASTOS GENERALES */}
        <Card className="rounded-3xl border border-indigo-500/20 bg-indigo-500/5 shadow-sm overflow-hidden">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
              Gastos Generales
            </span>
            <div className="h-8 w-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
              <Receipt className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl sm:text-3xl font-black text-indigo-600 tracking-tight">
              ${totals.totalGastosGenerales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] font-bold text-muted-foreground mt-1">
              {totals.gastosCount} {totals.gastosCount === 1 ? "gasto registrado" : "gastos registrados"}
            </p>
          </CardContent>
        </Card>

        {/* BALANCE NETO (INGRESOS - SALIDAS) */}
        <Card className={`rounded-3xl border shadow-sm overflow-hidden ${
          totals.balanceNeto >= 0 
            ? "border-emerald-500/30 bg-emerald-500/10" 
            : "border-red-500/30 bg-red-500/10"
        }`}>
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-foreground">
              Diferencia Neta ({periodLabelText})
            </span>
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
              totals.balanceNeto >= 0 ? "bg-emerald-500/20 text-emerald-600" : "bg-red-500/20 text-red-600"
            }`}>
              {totals.balanceNeto >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className={`text-2xl sm:text-3xl font-black tracking-tight ${
              totals.balanceNeto >= 0 ? "text-emerald-600" : "text-red-600"
            }`}>
              ${totals.balanceNeto.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground mt-1">
              <span>Salidas Totales:</span>
              <span className="text-red-600 font-black">
                ${totals.totalSalidas.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PESTAÑAS PRINCIPALES DE NAVEGACIÓN INTERNA */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border border-border p-1.5 rounded-2xl h-auto flex flex-wrap gap-1">
          <TabsTrigger 
            value="movimientos" 
            className="rounded-xl px-4 py-2.5 font-black text-xs uppercase data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            Historial de Movimientos ({filteredHistory.length})
          </TabsTrigger>
          <TabsTrigger 
            value="resumen" 
            className="rounded-xl px-4 py-2.5 font-black text-xs uppercase data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            Resumen & Gráficos
          </TabsTrigger>
          <TabsTrigger 
            value="consultas" 
            className="rounded-xl px-4 py-2.5 font-black text-xs uppercase data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            Consultas por Contacto
          </TabsTrigger>
          <TabsTrigger 
            value="catalogos" 
            className="rounded-xl px-4 py-2.5 font-black text-xs uppercase data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            Catálogos Privados
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* PESTAÑA 1: HISTORIAL DE MOVIMIENTOS */}
        {/* ============================================================== */}
        <TabsContent value="movimientos" className="space-y-4 m-0">
          {/* BARRA DE HERRAMIENTAS Y FILTROS */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-4 bg-card border border-border rounded-2xl">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              {/* Buscador de texto */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por cliente, proveedor, concepto, referencia..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 rounded-xl bg-background border-border text-xs font-bold erp-input"
                />
              </div>

              {/* Filtro por Tipo */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-10 w-44 rounded-xl bg-background border-border font-bold text-xs uppercase">
                  <SelectValue placeholder="Tipo de Movimiento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-bold uppercase text-xs">Todos los Tipos</SelectItem>
                  <SelectItem value="cobro_cliente" className="font-bold uppercase text-xs text-emerald-600">Cobros a Clientes</SelectItem>
                  <SelectItem value="pago_proveedor" className="font-bold uppercase text-xs text-amber-600">Pagos a Proveedores</SelectItem>
                  <SelectItem value="gasto_general" className="font-bold uppercase text-xs text-indigo-600">Gastos Generales</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro por Categoría de Gasto */}
              {typeFilter === "gasto_general" && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-10 w-48 rounded-xl bg-background border-border font-bold text-xs uppercase">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="font-bold uppercase text-xs">Todas las Categorías</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.name} className="font-bold uppercase text-xs">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Checkbox para Ver Anulados */}
            <div className="flex items-center gap-3 shrink-0">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-muted-foreground hover:text-foreground">
                <input 
                  type="checkbox" 
                  checked={showAnnulled} 
                  onChange={e => setShowAnnulled(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span>Mostrar Anulados</span>
              </label>
            </div>
          </div>

          {/* TABLA DE HISTORIAL */}
          <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
            {loadingData ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cargando movimientos privados...</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-3 p-8 text-center">
                <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center text-muted-foreground">
                  <FileText className="h-6 w-6" />
                </div>
                <p className="text-sm font-black uppercase text-foreground">No se encontraron movimientos</p>
                <p className="text-xs text-muted-foreground max-w-sm font-medium">
                  No hay registros en el periodo seleccionado ({periodLabelText}) con los filtros actuales.
                </p>
                <Button 
                  onClick={() => handleOpenCreate()} 
                  className="rounded-xl h-10 px-5 bg-primary text-white text-xs font-black uppercase gap-2 mt-2"
                >
                  <Plus className="h-3.5 w-3.5" /> Registrar Primer Movimiento
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-border">
                      <TableHead className="py-4 pl-6 text-[10px] font-black uppercase text-muted-foreground tracking-wider">Fecha</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Tipo</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Beneficiario / Contacto</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Concepto</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Forma Pago / Banco</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase text-muted-foreground tracking-wider">Valor ($)</TableHead>
                      <TableHead className="text-right pr-6 text-[10px] font-black uppercase text-muted-foreground tracking-wider">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((m) => {
                      const isAnnulled = m.status === "ANULADO";
                      return (
                        <TableRow 
                          key={m.id} 
                          className={`border-b border-border transition-colors hover:bg-muted/10 ${
                            isAnnulled ? "opacity-40 bg-muted/20 line-through" : ""
                          }`}
                        >
                          {/* Fecha */}
                          <TableCell className="py-3.5 pl-6 font-bold text-xs">
                            {m.date}
                          </TableCell>

                          {/* Tipo */}
                          <TableCell>
                            {m.type === "cobro_cliente" && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-black text-[9px] uppercase tracking-wider">
                                Cobro Cliente
                              </Badge>
                            )}
                            {m.type === "pago_proveedor" && (
                              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-black text-[9px] uppercase tracking-wider">
                                Pago Proveedor
                              </Badge>
                            )}
                            {m.type === "gasto_general" && (
                              <div className="flex flex-col gap-0.5">
                                <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 font-black text-[9px] uppercase tracking-wider w-fit">
                                  Gasto General
                                </Badge>
                                {m.category && (
                                  <span className="text-[9px] font-black uppercase text-muted-foreground">
                                    {m.category}
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>

                          {/* Contacto */}
                          <TableCell className="font-black text-xs uppercase text-foreground max-w-[200px] truncate">
                            {m.contactName}
                          </TableCell>

                          {/* Concepto */}
                          <TableCell className="text-xs font-medium text-muted-foreground max-w-[220px] truncate">
                            {m.concept}
                            {m.reference && (
                              <span className="block text-[10px] font-bold text-muted-foreground/80 mt-0.5">
                                Ref: {m.reference}
                              </span>
                            )}
                          </TableCell>

                          {/* Forma de Pago & Banco */}
                          <TableCell className="text-xs font-bold text-muted-foreground">
                            <div>{m.paymentMethod}</div>
                            {m.bank && <div className="text-[10px] font-medium text-muted-foreground/70">{m.bank}</div>}
                          </TableCell>

                          {/* Valor ($) */}
                          <TableCell className={`text-right font-black text-sm ${
                            isAnnulled ? "text-muted-foreground" :
                            m.type === "cobro_cliente" ? "text-emerald-600" : "text-red-600"
                          }`}>
                            {m.type === "cobro_cliente" ? "+" : "-"}${Number(m.amount).toFixed(2)}
                          </TableCell>

                          {/* Acciones */}
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1">
                              {!isAnnulled ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenEdit(m)}
                                    className="h-8 w-8 rounded-full hover:text-amber-600"
                                    title="Editar Movimiento"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { setAnnullingMovement(m); setAnnulReason(""); }}
                                    className="h-8 w-8 rounded-full hover:text-red-600"
                                    title="Anular Movimiento"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <Badge variant="outline" className="text-[9px] text-muted-foreground border-border font-bold uppercase">
                                  Anulado ({m.annulReason || "S/M"})
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ============================================================== */}
        {/* PESTAÑA 2: RESUMEN & GRÁFICOS */}
        {/* ============================================================== */}
        <TabsContent value="resumen" className="space-y-6 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GRÁFICO: DISTRIBUCIÓN DE GASTOS POR CATEGORÍA */}
            <Card className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black uppercase text-foreground">
                  Distribución de Gastos Generales ({periodLabelText})
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Porcentaje de egresos por cada rubro operativo
                </p>
              </div>

              {expenseByCategoryData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Sin gastos registrados en el periodo</p>
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseByCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {expenseByCategoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(val: any) => [`$${Number(val).toFixed(2)}`, "Valor"]} 
                        contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px", color: "#fff", fontWeight: "bold", fontSize: "12px" }}
                      />
                      <Legend 
                        layout="horizontal" 
                        verticalAlign="bottom" 
                        align="center"
                        wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* GRÁFICO: COMPARATIVA MENSUAL DE INGRESOS VS EGRESOS */}
            <Card className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black uppercase text-foreground">
                  Ingresos vs Egresos por Mes ({selectedYear})
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Flujo de caja comparado a lo largo de los 12 meses del año
                </p>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyComparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: "bold" }} />
                    <YAxis tick={{ fontSize: 10, fontWeight: "bold" }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip 
                      formatter={(val: any) => [`$${Number(val).toFixed(2)}`]}
                      contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px", color: "#fff", fontWeight: "bold", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }} />
                    <Bar dataKey="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Egresos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* TABLA DETALLE DE GASTOS POR CATEGORÍA */}
          <Card className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 className="text-base font-black uppercase text-foreground">
              Desglose de Gastos por Categoría ({periodLabelText})
            </h3>
            <div className="rounded-2xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase pl-6">Categoría</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">Subtotal ($)</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase pr-6">% del Total de Gastos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseByCategoryData.map((row, i) => {
                    const pct = totals.totalGastosGenerales > 0 
                      ? ((row.value / totals.totalGastosGenerales) * 100).toFixed(1) 
                      : "0.0";
                    return (
                      <TableRow key={i} className="border-border">
                        <TableCell className="pl-6 font-bold text-xs uppercase flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          {row.name}
                        </TableCell>
                        <TableCell className="text-right font-black text-xs text-indigo-600">
                          ${row.value.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right pr-6 font-bold text-xs text-muted-foreground">
                          {pct}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {expenseByCategoryData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground font-bold">
                        Sin gastos registrados en este periodo
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* PESTAÑA 3: CONSULTAS POR CONTACTO */}
        {/* ============================================================== */}
        <TabsContent value="consultas" className="space-y-6 m-0">
          <Card className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black uppercase text-foreground">
                  Consultas por Cliente o Proveedor
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Consulta todo el historial financiero consolidado de un contacto en particular
                </p>
              </div>

              {/* Selector Cliente / Proveedor */}
              <div className="flex bg-muted p-1 rounded-xl">
                <Button
                  size="sm"
                  variant={consultType === "cliente" ? "default" : "ghost"}
                  onClick={() => { setConsultType("cliente"); setSelectedContactName(""); }}
                  className="rounded-lg font-black text-xs uppercase h-8 px-4"
                >
                  Clientes
                </Button>
                <Button
                  size="sm"
                  variant={consultType === "proveedor" ? "default" : "ghost"}
                  onClick={() => { setConsultType("proveedor"); setSelectedContactName(""); }}
                  className="rounded-lg font-black text-xs uppercase h-8 px-4"
                >
                  Proveedores
                </Button>
              </div>
            </div>

            {/* Selector de Contacto */}
            <div className="max-w-md">
              <Label className="text-[10px] font-black uppercase text-muted-foreground mb-1.5 block">
                Seleccione {consultType === "cliente" ? "un Cliente" : "un Proveedor"}
              </Label>
              <Select value={selectedContactName} onValueChange={setSelectedContactName}>
                <SelectTrigger className="h-12 rounded-xl bg-background border-border font-black text-xs uppercase">
                  <SelectValue placeholder={`Elegir ${consultType}...`} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {filteredContactsList.map(c => (
                    <SelectItem key={c.id} value={c.name} className="font-bold text-xs uppercase">
                      {c.name}
                    </SelectItem>
                  ))}
                  {filteredContactsList.length === 0 && (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      No hay {consultType}s registrados aún
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* RESULTADOS DE LA CONSULTA */}
            {selectedContactName ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* KPIs del Contacto */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="rounded-2xl border border-border bg-background p-4">
                    <span className="text-[9px] font-black uppercase text-muted-foreground block">
                      Total {consultType === "cliente" ? "Cobrado Acumulado" : "Pagado Acumulado"}
                    </span>
                    <span className={`text-2xl font-black mt-1 block ${
                      consultType === "cliente" ? "text-emerald-600" : "text-amber-600"
                    }`}>
                      ${contactConsultTotals.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </Card>
                  <Card className="rounded-2xl border border-border bg-background p-4">
                    <span className="text-[9px] font-black uppercase text-muted-foreground block">
                      Movimientos Activos
                    </span>
                    <span className="text-2xl font-black text-foreground mt-1 block">
                      {contactConsultTotals.count}
                    </span>
                  </Card>
                  <Card className="rounded-2xl border border-border bg-background p-4">
                    <span className="text-[9px] font-black uppercase text-muted-foreground block">
                      Promedio por Transacción
                    </span>
                    <span className="text-2xl font-black text-foreground mt-1 block">
                      ${contactConsultTotals.count > 0 ? (contactConsultTotals.total / contactConsultTotals.count).toFixed(2) : "0.00"}
                    </span>
                  </Card>
                </div>

                {/* Tabla de Movimientos del Contacto */}
                <div className="rounded-2xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase pl-6">Fecha</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Concepto</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Método / Banco</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Referencia</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase">Valor ($)</TableHead>
                        <TableHead className="text-right pr-6 text-[10px] font-black uppercase">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contactConsultMovements.map((m) => (
                        <TableRow key={m.id} className="border-border">
                          <TableCell className="pl-6 font-bold text-xs">{m.date}</TableCell>
                          <TableCell className="font-bold text-xs max-w-[200px] truncate">{m.concept}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-medium">
                            {m.paymentMethod} {m.bank ? `(${m.bank})` : ""}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-bold">{m.reference || "-"}</TableCell>
                          <TableCell className={`text-right font-black text-xs ${
                            m.status === "ANULADO" ? "text-muted-foreground line-through" :
                            consultType === "cliente" ? "text-emerald-600" : "text-amber-600"
                          }`}>
                            ${Number(m.amount).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Badge className={`text-[9px] font-black uppercase ${
                              m.status === "ACTIVO" 
                                ? "bg-emerald-500/10 text-emerald-600 border-none" 
                                : "bg-red-500/10 text-red-600 border-none"
                            }`}>
                              {m.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {contactConsultMovements.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground font-bold">
                            No hay movimientos registrados para este contacto.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border rounded-2xl">
                <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs font-bold text-muted-foreground uppercase">
                  Selecciona un {consultType} para ver su consolidado histórico
                </p>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* PESTAÑA 4: CATÁLOGOS PRIVADOS */}
        {/* ============================================================== */}
        <TabsContent value="catalogos" className="space-y-6 m-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Clientes Privados */}
            <Card className="rounded-3xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black uppercase text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600" /> Clientes Privados
                </h4>
                <Badge variant="outline" className="font-bold text-[10px]">
                  {contacts.filter(c => c.type === "cliente").length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                Nombres registrados para registrar cobros independientes.
              </p>
              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                {contacts.filter(c => c.type === "cliente").map(c => (
                  <div key={c.id} className="p-2.5 rounded-xl bg-background border border-border text-xs font-black uppercase text-foreground">
                    {c.name}
                  </div>
                ))}
                {contacts.filter(c => c.type === "cliente").length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Sin clientes registrados aún.</p>
                )}
              </div>
            </Card>

            {/* Proveedores Privados */}
            <Card className="rounded-3xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black uppercase text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-amber-600" /> Proveedores Privados
                </h4>
                <Badge variant="outline" className="font-bold text-[10px]">
                  {contacts.filter(c => c.type === "proveedor").length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                Proveedores y talleres registrados para pagos manuales.
              </p>
              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                {contacts.filter(c => c.type === "proveedor").map(c => (
                  <div key={c.id} className="p-2.5 rounded-xl bg-background border border-border text-xs font-black uppercase text-foreground">
                    {c.name}
                  </div>
                ))}
                {contacts.filter(c => c.type === "proveedor").length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Sin proveedores registrados aún.</p>
                )}
              </div>
            </Card>

            {/* Categorías de Gastos */}
            <Card className="rounded-3xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black uppercase text-foreground flex items-center gap-2">
                  <Tag className="h-4 w-4 text-indigo-600" /> Categorías de Gastos
                </h4>
                <Button
                  size="sm"
                  onClick={() => setIsNewCatModalOpen(true)}
                  className="h-7 px-2.5 rounded-lg bg-primary text-white font-black text-[10px] uppercase gap-1"
                >
                  <Plus className="h-3 w-3" /> Nueva
                </Button>
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                Rubros para clasificar egresos operativos.
              </p>
              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                {categories.map(cat => (
                  <div key={cat.id} className="p-2.5 rounded-xl bg-background border border-border text-xs font-bold uppercase text-foreground flex items-center justify-between">
                    <span>{cat.name}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ============================================================== */}
      {/* MODAL: REGISTRAR / EDITAR MOVIMIENTO */}
      {/* ============================================================== */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="max-w-2xl p-0 rounded-3xl overflow-hidden border-none shadow-2xl bg-card">
          {/* Header con pestañas de tipo */}
          <div className="p-6 pb-4 bg-muted/30 border-b border-border space-y-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-black uppercase tracking-tight text-foreground">
                {editingMovement ? "Editar Movimiento Financiero" : "Registrar Movimiento Financiero"}
              </DialogTitle>
              <Badge variant="outline" className="text-[10px] font-black uppercase">
                {editingMovement ? "Modo Edición" : "Nuevo Registro"}
              </Badge>
            </div>

            {/* Selector de Tipo */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-background rounded-2xl border border-border">
              <button
                type="button"
                onClick={() => setFormType("cobro_cliente")}
                className={`py-2 px-3 rounded-xl font-black text-xs uppercase transition-all flex items-center justify-center gap-1.5 ${
                  formType === "cobro_cliente"
                    ? "bg-emerald-600 text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowDownLeft className="h-3.5 w-3.5" /> Cobro Cliente
              </button>
              <button
                type="button"
                onClick={() => setFormType("pago_proveedor")}
                className={`py-2 px-3 rounded-xl font-black text-xs uppercase transition-all flex items-center justify-center gap-1.5 ${
                  formType === "pago_proveedor"
                    ? "bg-amber-600 text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowUpRight className="h-3.5 w-3.5" /> Pago Proveedor
              </button>
              <button
                type="button"
                onClick={() => setFormType("gasto_general")}
                className={`py-2 px-3 rounded-xl font-black text-xs uppercase transition-all flex items-center justify-center gap-1.5 ${
                  formType === "gasto_general"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Receipt className="h-3.5 w-3.5" /> Gasto General
              </button>
            </div>
          </div>

          {/* Cuerpo del Formulario */}
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Fila: Fecha y Valor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Fecha del Movimiento *</Label>
                <Input 
                  type="date" 
                  value={formDate} 
                  onChange={e => setFormDate(e.target.value)}
                  className="h-11 rounded-xl bg-background border-border font-bold text-xs erp-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Valor en Dólares ($) *</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0.01"
                  placeholder="0.00"
                  value={formAmount} 
                  onChange={e => setFormAmount(e.target.value)}
                  className="h-11 rounded-xl bg-background border-border font-black text-base text-primary erp-input"
                />
              </div>
            </div>

            {/* Fila: Contacto / Beneficiario */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">
                {formType === "cobro_cliente" ? "Nombre del Cliente *" :
                 formType === "pago_proveedor" ? "Nombre del Proveedor *" :
                 "Establecimiento / Beneficiario *"}
              </Label>
              <div className="relative">
                <Input 
                  placeholder={
                    formType === "cobro_cliente" ? "Ej: Oscar Recalde..." :
                    formType === "pago_proveedor" ? "Ej: Tintorería Industrial..." :
                    "Ej: Ferretería El Maestro, Empresa Eléctrica..."
                  }
                  value={formContact} 
                  onChange={e => setFormContact(e.target.value)}
                  list="contacts-suggestions"
                  className="h-11 rounded-xl bg-background border-border font-bold text-xs uppercase erp-input"
                />
                <datalist id="contacts-suggestions">
                  {contacts
                    .filter(c => {
                      if (formType === "cobro_cliente") return c.type === "cliente";
                      if (formType === "pago_proveedor") return c.type === "proveedor";
                      return true;
                    })
                    .map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
            </div>

            {/* Categoría (solo para Gasto General) */}
            {formType === "gasto_general" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Categoría del Gasto *</Label>
                  <button
                    type="button"
                    onClick={() => setIsNewCatModalOpen(true)}
                    className="text-[10px] font-black uppercase text-primary hover:underline"
                  >
                    + Nueva Categoría
                  </button>
                </div>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="h-11 rounded-xl bg-background border-border font-bold text-xs uppercase">
                    <SelectValue placeholder="Seleccionar Categoría" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.name} className="font-bold text-xs uppercase">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Concepto */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Concepto del Movimiento *</Label>
              <Input 
                placeholder="Ej: Pago de lote 25488, Compra de químicos, Pago quincena..."
                value={formConcept} 
                onChange={e => setFormConcept(e.target.value)}
                className="h-11 rounded-xl bg-background border-border font-bold text-xs erp-input"
              />
            </div>

            {/* Fila: Forma de Pago y Banco */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Forma de Pago / Cobro</Label>
                <Select value={formMethod} onValueChange={setFormMethod}>
                  <SelectTrigger className="h-11 rounded-xl bg-background border-border font-bold text-xs uppercase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m} value={m} className="font-bold text-xs uppercase">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Banco (si corresponde)</Label>
                <div className="relative">
                  <Input 
                    placeholder="Ej: Banco Pichincha..."
                    value={formBank} 
                    onChange={e => setFormBank(e.target.value)}
                    list="banks-suggestions"
                    className="h-11 rounded-xl bg-background border-border font-bold text-xs erp-input"
                  />
                  <datalist id="banks-suggestions">
                    {COMMON_BANKS.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>
              </div>
            </div>

            {/* N° Factura / Referencia */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">N° Factura o Referencia (Opcional)</Label>
              <Input 
                placeholder="Ej: FAC-0012, Transf #99281, Recibo 45..."
                value={formReference} 
                onChange={e => setFormReference(e.target.value)}
                className="h-11 rounded-xl bg-background border-border font-bold text-xs uppercase erp-input"
              />
            </div>

            {/* Observaciones */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Observaciones (Opcional)</Label>
              <textarea 
                rows={2}
                placeholder="Detalles adicionales, acuerdos o notas..."
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                className="w-full p-3 rounded-xl bg-background border border-border font-medium text-xs erp-input resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="p-6 bg-muted/20 border-t border-border flex gap-3">
            <Button
              variant="ghost"
              disabled={savingRecord}
              onClick={() => setIsRegisterOpen(false)}
              className="flex-1 rounded-xl h-11 font-bold text-xs uppercase"
            >
              Cancelar
            </Button>
            <Button
              disabled={savingRecord}
              onClick={() => handleSubmitRecord()}
              className="flex-1 rounded-xl h-11 bg-primary text-white font-black text-xs uppercase tracking-wide gap-2 shadow-lg"
            >
              {savingRecord ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {editingMovement ? "Actualizar Movimiento" : "Guardar Movimiento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL: ADVERTENCIA DE POSIBLE DUPLICADO (REQUISITO 10) */}
      {/* ============================================================== */}
      <AlertDialog open={!!duplicateWarning} onOpenChange={() => setDuplicateWarning(null)}>
        <AlertDialogContent className="rounded-3xl p-6 bg-card border-none shadow-2xl max-w-md">
          <AlertDialogHeader className="items-center text-center">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-lg font-black uppercase text-foreground">
              Posible Registro Duplicado
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground font-medium text-left space-y-2 mt-2">
              <p>
                Ya existe un movimiento idéntico registrado en el sistema con los siguientes datos:
              </p>
              <div className="p-3 bg-muted rounded-xl text-xs space-y-1 font-bold text-foreground">
                <p>Fecha: <span className="font-normal">{duplicateWarning?.match.date}</span></p>
                <p>Beneficiario: <span className="font-normal">{duplicateWarning?.match.contactName}</span></p>
                <p>Concepto: <span className="font-normal">{duplicateWarning?.match.concept}</span></p>
                <p>Valor: <span className="font-black text-primary">${duplicateWarning?.match.amount.toFixed(2)}</span></p>
                {duplicateWarning?.match.reference && (
                  <p>Referencia: <span className="font-normal">{duplicateWarning.match.reference}</span></p>
                )}
              </div>
              <p className="font-bold text-amber-600">
                ¿Está seguro de que desea registrar este movimiento nuevamente?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="flex-1 rounded-xl h-11 text-xs font-bold uppercase">
              Cancelar y Revisar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (duplicateWarning?.pendingPayload) {
                  handleSubmitRecord(true);
                }
              }}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-11 text-xs font-black uppercase"
            >
              Sí, Guardar de Todos Modos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============================================================== */}
      {/* MODAL: ANULAR MOVIMIENTO */}
      {/* ============================================================== */}
      <Dialog open={!!annullingMovement} onOpenChange={() => setAnnullingMovement(null)}>
        <DialogContent className="max-w-md p-6 rounded-3xl bg-card border-none shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-black uppercase text-foreground">Anular Movimiento</DialogTitle>
              <p className="text-xs text-muted-foreground font-medium">
                {annullingMovement?.contactName} - ${annullingMovement?.amount.toFixed(2)}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground font-medium">
            El registro quedará archivado en el historial de auditoría pero será excluido de todos los balances contables.
          </p>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Motivo de Anulación *</Label>
            <Input 
              placeholder="Ej: Registro duplicado, Error en valor, Pago cancelado..."
              value={annulReason} 
              onChange={e => setAnnulReason(e.target.value)}
              className="h-11 rounded-xl bg-background border-border font-bold text-xs erp-input"
            />
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button
              variant="ghost"
              onClick={() => setAnnullingMovement(null)}
              className="flex-1 rounded-xl h-10 font-bold text-xs uppercase"
            >
              Volver
            </Button>
            <Button
              onClick={handleConfirmAnnul}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl h-10 font-black text-xs uppercase"
            >
              Confirmar Anulación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL: CREAR NUEVA CATEGORÍA RÁPIDA */}
      {/* ============================================================== */}
      <Dialog open={isNewCatModalOpen} onOpenChange={setIsNewCatModalOpen}>
        <DialogContent className="max-w-sm p-6 rounded-3xl bg-card border-none shadow-2xl space-y-4">
          <DialogTitle className="text-sm font-black uppercase text-foreground">
            Nueva Categoría de Gasto
          </DialogTitle>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Nombre de la Categoría</Label>
            <Input 
              placeholder="Ej: Publicidad, Honorarios Legales..."
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              className="h-11 rounded-xl bg-background border-border font-bold text-xs uppercase erp-input"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsNewCatModalOpen(false)}
              className="flex-1 rounded-xl h-10 font-bold text-xs uppercase"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCategory}
              className="flex-1 bg-primary text-white rounded-xl h-10 font-black text-xs uppercase"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
