
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Users, 
  Settings, 
  Calendar, 
  Plus, 
  Database, 
  Beaker, 
  Edit3, 
  Trash2, 
  Save, 
  UserPlus, 
  ShieldCheck, 
  Loader2,
  X,
  AlertTriangle,
  Zap,
  Info,
  Search,
  Download,
  Terminal,
  RefreshCcw,
  Layers,
  Wrench,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Shirt,
  ShieldAlert,
  DollarSign,
  ArrowRight,
  Shield,
  Scissors,
  Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { 
  doc, onSnapshot, updateDoc, 
  collection, getDocs, getDoc, serverTimestamp,
  query, where, setDoc, addDoc, deleteDoc, orderBy, limit, arrayUnion, arrayRemove, writeBatch, Timestamp
} from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { SystemRole } from "@/types/lddec";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toDate } from "@/lib/toDate";

import { useRouter } from "next/navigation";

const SYSTEM_ROLES: SystemRole[] = [
  "admin", 
  "bodega", 
  "bodega_quimicos",
  "produccion", 
  "chofer", 
  "contador", 
  "banco", 
  "facturacion", 
  "cobranzas", 
  "financiero",
  "operario_manualidades", 
  "socio",
  "colaboradora"
];

const MASTER_USER_SYNC_LIST = [
  { email: "ugeofly@hotmail.com", uid: "7ff7JqAWEcQRhxHBMz03klibS4f2", role: "admin" },
  { email: "diegoazogue1999@gmail.com", uid: "TTmVPv5q6RS7Mqhm9Jdu5eJep4F2", role: "socio" },
  { email: "premiumdenimecuaador@gmail.com", uid: "qpGvSzUVBxWsozOaRW6TaW6pSzH2", role: "socio" },
  { email: "laboratorioec@gmail.com", uid: "5aVvv1k050fVg1vLMXcv0zikY4O2", role: "socio" },
  { email: "jrsanchez1712@hotmail.com", uid: "O5EBLxUcYxarPhGy3yPYa07KBMt1", role: "socio" },
  { email: "milton.miranda1977@hotmail.com", uid: "VXKHGUjHKdfTlU0K3XuUJp856F92", role: "socio" },
  { email: "llogorro@yahoo.es", uid: "xodFFiO4ONgLEpXXN73d0BwEA1J2", role: "socio" },
  { email: "mariorolandomp@gmail.com", uid: "S1nAdd6NpROHj7tyEkormo4EN0X2", role: "socio" },
  { email: "marisolfreire93@gmail.com", uid: "hlxFqbM5AMS4RAOza1RUCgXIpM63", role: "socio" },
  { email: "livintong.cz@gmail.com", uid: "h9kjgNoPgUZK5HSOxCq120O02MY2", role: "socio" },
  { email: "domingojeans@gmail.com", uid: "ZcANxd5tJZhYOl0LlkCOGYHxvQ22", role: "socio" }
];

export default function MantenimientoPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin" || (user?.role as any) === "administrador" || (user as any)?.displayName === "EDGAR ADMIN";
  
  useEffect(() => {
    if (user && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [user, isAdmin, router]);

  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [syncingMaestro, setSyncingMaestro] = useState(false);
  
  // Data States
  const [users, setUsers] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [chemMaestro, setChemMaestro] = useState<any[]>([]);
  
  // TARIFARIO DE MANUALIDADES (LDDEC 1.6)
  const [manualTariffs, setManualTariffs] = useState<any[]>([]);
  const [loadingTariffs, setLoadingTariffs] = useState(false);
  const [isEditingTariff, setIsEditingTariff] = useState<string | null>(null);
  const [tariffForm, setTariffForm] = useState({
    manualidad: "",
    precioAdulto: "",
    precioNino: ""
  });
  
  // CATÁLOGOS MAESTROS (LDDEC 1.6)
  const [mantenimientoProcesos, setMantenimientoProcesos] = useState<any[]>([]);
  const [catalogoPrendas, setCatalogoPrendas] = useState<any[]>([]);
  const [catalogoManualidades, setCatalogoManualidades] = useState<any[]>([]);
  
  // Inputs y Búsquedas
  const [newMantenimientoProc, setNewMantenimientoProc] = useState("");
  const [searchMantenimientoProc, setSearchMantenimientoProc] = useState("");
  
  const [newPrenda, setNewPrenda] = useState("");
  const [searchPrenda, setSearchPrenda] = useState("");
  
  const [newManualidad, setNewManualidad] = useState("");
  const [searchManualidad, setSearchManualidad] = useState("");

  const [newWorker, setNewWorker] = useState("");
  const [searchWorker, setSearchWorker] = useState("");

  const [loadingProcs, setLoadingProcs] = useState(false);
  const [loadingPrendas, setLoadingPrendas] = useState(false);
  const [loadingManual, setLoadingManual] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // UI Control
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // --- MOTOR DE CARGA (getDocs) ---
  const loadUsers = async () => {
    if (!db) return;
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, "roles_usuarios"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers((list as any[]).sort((a,b) => (a.nombre||"").localeCompare(b.nombre||"")));
    } catch (e) {
      console.error("Error loading users:", e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadCatalogoProcesos = async () => {
    if (!db) return;
    setLoadingProcs(true);
    try {
      const q = query(collection(db, "procesos_tecnicos"), where("active", "==", true), orderBy("name", "asc"));
      const snap = await getDocs(q);
      setMantenimientoProcesos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); } finally { setLoadingProcs(false); }
  };

  const loadCatalogoPrendas = async () => {
    if (!db) return;
    setLoadingPrendas(true);
    try {
      const q = query(collection(db, "catalogo_prendas"), where("active", "==", true), orderBy("name", "asc"));
      const snap = await getDocs(q);
      setCatalogoPrendas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); } finally { setLoadingPrendas(false); }
  };

  const loadCatalogoManualidades = async () => {
    if (!db) return;
    setLoadingManual(true);
    try {
      const q = query(collection(db, "catalogo_manualidades"), where("active", "==", true), orderBy("name", "asc"));
      const snap = await getDocs(q);
      setCatalogoManualidades(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); } finally { setLoadingManual(false); }
  };

  const loadManualTariffs = async () => {
    if (!db) return;
    setLoadingTariffs(true);
    try {
      // Usar colección sincronizada con Manualidades (Producción)
      const q = query(collection(db, "manualidad_tarifas"), orderBy("manualidad", "asc"));
      const snap = await getDocs(q);
      setManualTariffs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error loading tariffs:", e);
    } finally {
      setLoadingTariffs(false);
    }
  };

  // --- HANDLERS DE USUARIOS ---
  const handleToggleUserActive = async (id: string, currentVal: boolean) => {
    try {
      await updateDoc(doc(db, "roles_usuarios", id), {
        activo: !currentVal,
        updatedAt: serverTimestamp()
      });
      toast({ title: `Usuario ${!currentVal ? 'Activado' : 'Desactivado'}` });
      loadUsers();
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar estado" });
    }
  };

  const handleDeactivateUser = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este usuario? El registro permanecerá pero el acceso será bloqueado definitivamente.")) return;
    try {
      await updateDoc(doc(db, "roles_usuarios", id), {
        activo: false,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Acceso Bloqueado" });
      loadUsers();
    } catch (e) {
      toast({ variant: "destructive", title: "Error al desactivar" });
    }
  };

  const handleOpenEditDialog = (u: any) => {
    setSelectedUser({ ...u });
    setIsEditUserOpen(true);
  };

  const handleSaveUserEdit = async () => {
    if (!selectedUser || !db) return;
    try {
      await updateDoc(doc(db, "roles_usuarios", selectedUser.id), {
        nombre: selectedUser.nombre.toUpperCase(),
        role: selectedUser.role,
        activo: selectedUser.activo,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Perfil Actualizado" });
      setIsEditUserOpen(false);
      loadUsers();
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar cambios" });
    }
  };

  // --- HANDLERS DE ADICIÓN ---
  const handleAddProceso = async () => {
    if (!newMantenimientoProc.trim()) return;
    const name = newMantenimientoProc.toUpperCase().trim();
    const id = name.replace(/\//g, '-');
    try {
      await setDoc(doc(db, "procesos_tecnicos", id), { name, active: true, createdAt: serverTimestamp() });
      setNewMantenimientoProc("");
      loadCatalogoProcesos();
      toast({ title: "Proceso agregado" });
    } catch (e) { toast({ variant: "destructive", title: "Error al guardar" }); }
  };

  const handleAddPrenda = async () => {
    if (!newPrenda.trim()) return;
    const name = newPrenda.toUpperCase().trim();
    const id = name.replace(/\//g, '-');
    try {
      await setDoc(doc(db, "catalogo_prendas", id), { name, active: true, createdAt: serverTimestamp() });
      setNewPrenda("");
      loadCatalogoPrendas();
      toast({ title: "Prenda agregada al catálogo" });
    } catch (e) { toast({ variant: "destructive", title: "Error al guardar" }); }
  };

  const handleAddManualidad = async () => {
    if (!newManualidad.trim()) return;
    const name = newManualidad.toUpperCase().trim();
    const id = name.replace(/\//g, '-');
    try {
      await setDoc(doc(db, "catalogo_manualidades", id), { name, active: true, createdAt: serverTimestamp() });
      setNewManualidad("");
      loadCatalogoManualidades();
      toast({ title: "Manualidad agregada al catálogo" });
    } catch (e) { toast({ variant: "destructive", title: "Error al guardar" }); }
  };

  const handleAddWorker = async () => {
    if (!newWorker.trim()) return;
    const nombre = newWorker.toUpperCase().trim();
    try {
      await addDoc(collection(db, "trabajadores_manualidades"), { nombre, activo: true, createdAt: serverTimestamp() });
      setNewWorker("");
      toast({ title: "Trabajador agregado" });
    } catch (e) { toast({ variant: "destructive", title: "Error al agregar" }); }
  };

  const handleToggleWorkerStatus = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, "trabajadores_manualidades", id), { activo: !current });
      toast({ title: `Trabajador ${!current ? 'Activado' : 'Desactivado'}` });
    } catch (e) { toast({ variant: "destructive", title: "Error al actualizar" }); }
  };

  const handleDeleteWorker = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este trabajador? Solo hazlo si no tiene registros históricos.")) return;
    try {
      await deleteDoc(doc(db, "trabajadores_manualidades", id));
      toast({ title: "Trabajador eliminado" });
    } catch (e) { toast({ variant: "destructive", title: "Error al eliminar" }); }
  };

  // --- HANDLERS DE TARIFARIO ---
  const handleSaveTariff = async () => {
    const { manualidad, precioAdulto, precioNino } = tariffForm;
    const pAdulto = parseFloat(precioAdulto);
    const pNino = parseFloat(precioNino);

    if (!manualidad.trim() || isNaN(pAdulto) || isNaN(pNino) || pAdulto < 0 || pNino < 0) {
      toast({ variant: "destructive", title: "Datos inválidos", description: "Selecciona una manualidad e ingresa precios válidos." });
      return;
    }

    try {
      // Sanitizar ID: Firestore no permite '/', '.', '..', ni secuencias doble '//' en IDs
      const sanitizedId = manualidad
        .toUpperCase()
        .trim()
        .replace(/\//g, "-")
        .replace(/\.{1,2}$/g, "_")
        .replace(/[#\[\]\*\?]/g, "_");

      const manualidadNormalizada = manualidad.toUpperCase().trim();

      const payload = {
        manualidad: manualidadNormalizada,
        // Guardar en ambos formatos para máxima compatibilidad
        precioAdulto: pAdulto,
        precioNino: pNino,
        adultPrice: pAdulto,
        childPrice: pNino,
        // Requerido para compatibilidad con filtros del sistema
        activo: true,
        updatedAt: serverTimestamp()
      };

      if (isEditingTariff) {
        await updateDoc(doc(db, "manualidad_tarifas", isEditingTariff), payload);
        toast({ title: "✅ Tarifa Actualizada", description: manualidadNormalizada });
      } else {
        await setDoc(doc(db, "manualidad_tarifas", sanitizedId), {
          ...payload,
          createdAt: serverTimestamp()
        });
        toast({ title: "✅ Tarifa Registrada", description: manualidadNormalizada });
      }

      setTariffForm({ manualidad: "", precioAdulto: "", precioNino: "" });
      setIsEditingTariff(null);
      loadManualTariffs();
    } catch (e: any) {
      console.error("[handleSaveTariff] Error al guardar tarifa:", e?.code, e?.message, e);
      toast({
        variant: "destructive",
        title: "Error al guardar tarifa",
        description: e?.code === "permission-denied"
          ? "Sin permisos. Verifica tu rol en el sistema."
          : (e?.message || "Error desconocido. Revisa la consola.")
      });
    }
  };

  const handleEditTariff = (t: any) => {
    setIsEditingTariff(t.id);
    setTariffForm({
      manualidad: t.manualidad,
      precioAdulto: (t.precioAdulto || t.adultPrice || 0).toString(),
      precioNino: (t.precioNino || t.childPrice || 0).toString()
    });
    // Scroll suave al formulario
    const el = document.getElementById("tariff-form");
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteTariff = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta tarifa?")) return;
    try {
      await deleteDoc(doc(db, "manualidad_tarifas", id));
      toast({ title: "Tarifa eliminada definitivamente" });
      loadManualTariffs();
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  // --- HANDLERS DE ELIMINACIÓN ---
  const handleDeleteItem = async (col: string, id: string, refreshFn: () => void) => {
    try {
      await deleteDoc(doc(db, col, id));
      refreshFn();
      toast({ title: "Registro eliminado" });
    } catch (e) { toast({ variant: "destructive", title: "Error al eliminar" }); }
  };

  useEffect(() => {
    if (!db) return;
    loadCatalogoProcesos();
    loadCatalogoPrendas();
    loadCatalogoManualidades();
    loadManualTariffs();
    loadUsers();

    const unsubs = [
      onSnapshot(collection(db, "trabajadores_manualidades"), (snap) => {
        setWorkers((snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]).sort((a,b) => (a.nombre||"").localeCompare(b.nombre||"")));
      }),
      onSnapshot(collection(db, "quimicos_procesos_maestro"), (snap) => {
        setChemMaestro((snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]).sort((a,b) => (a.proceso||"").localeCompare(b.proceso||"")));
      })
    ];
    setLoading(false);
    return () => unsubs.forEach(unsub => unsub());
  }, []);

  const handleMasterUserSync = async () => {
    if (syncingMaestro || !db) return;
    setSyncingMaestro(true);
    try {
      const batch = writeBatch(db);
      for (const item of MASTER_USER_SYNC_LIST) {
        batch.set(doc(db, "roles_usuarios", item.uid), { uid: item.uid, email: item.email.toLowerCase().trim(), role: item.role, activo: true, nombre: item.email.split('@')[0].toUpperCase(), updatedAt: serverTimestamp() }, { merge: true });
      }
      await batch.commit();
      loadUsers();
      toast({ title: "Sincronización Exitosa" });
    } catch (e) { toast({ variant: "destructive", title: "Error Sync" }); } finally { setSyncingMaestro(false); }
  };

  const handleExportBackup = async () => {
    setBackingUp(true);
    const zip = new JSZip();
    const cols = ["clients", "entries", "outputs", "facturas", "manualidades", "roles_usuarios", "quimicos_stock", "quimicos_kardex", "procesos_tecnicos", "trabajadores_manualidades", "manualidad_tarifas", "catalogo_prendas", "catalogo_manualidades", "tarifario_manualidades"];
    try {
      for (const col of cols) {
        const snap = await getDocs(collection(db, col));
        zip.file(`${col}.json`, JSON.stringify(snap.docs.map(d => ({ id: d.id, ...d.data() })), null, 2));
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `LDDEC_BACKUP_${new Date().getTime()}.zip`);
    } catch (e) { toast({ variant: "destructive", title: "Error Backup" }); } finally { setBackingUp(false); }
  };

  const handleExportExcel = async () => {
    if (!isAdmin) return;
    setExportingExcel(true);
    try {
      const { utils, writeFile } = await import("xlsx");
      const workbook = utils.book_new();

      // 1. Obtener Datos de Firestore
      const [snapInvoices, snapManualidades, snapSalidas, snapClients, snapQuimicos] = await Promise.all([
        getDocs(collection(db, "facturas")),
        getDocs(collection(db, "manualidades")),
        getDocs(collection(db, "agenda_pagos")),
        getDocs(collection(db, "clients")),
        getDocs(collection(db, "quimicos_stock"))
      ]);

      // 2. Mapear Datos para cada Hoja
      // Hoja Ingresos: Fecha, Cliente, Concepto/Documento, Subtotal, IVA, Total, Estado
      const dataIngresos = snapInvoices.docs.map(docSnap => {
        const inv = docSnap.data();
        const total = Number(inv.totalFactura || inv.total || 0);
        const subtotal = Number(inv.subtotal || (total / 1.15));
        const iva = Number(inv.iva || inv.valorIva || (total - subtotal));
        let fechaStr = "S/F";
        const f = toDate(inv.fechaFactura || inv.date || inv.createdAt);
        if (f) fechaStr = f.toLocaleDateString('es-EC');

        return {
          "Fecha": fechaStr,
          "Cliente": (inv.clienteNombre || inv.clientName || "Socio").toUpperCase(),
          "Concepto/Documento": inv.numeroFactura || inv.numero || docSnap.id,
          "Subtotal": Number(subtotal.toFixed(2)),
          "IVA": Number(iva.toFixed(2)),
          "Total": Number(total.toFixed(2)),
          "Estado": inv.estado || inv.estadoCobranza || "Pendiente"
        };
      });

      // Hoja Manualidades: Fecha, Lote, Operario, Proceso/Manualidad, Cantidad, Tarifa Unit., Total a Pagar, Estado
      const dataManualidades = snapManualidades.docs.map(docSnap => {
        const m = docSnap.data();
        const cant = Number(m.cantidad || 0);
        const tarifa = Number(m.tarifa || m.valorUnitario || 0);
        const total = Number(m.total || m.totalPagar || (cant * tarifa));
        let fechaStr = "S/F";
        const f = toDate(m.fecha || m.createdAt);
        if (f) fechaStr = f.toLocaleDateString('es-EC');

        return {
          "Fecha": fechaStr,
          "Lote": m.loteNumero || m.loteId || "S/L",
          "Operario": (m.operarioNombre || "Varios").toUpperCase(),
          "Proceso/Manualidad": m.proceso || "S/P",
          "Cantidad": cant,
          "Tarifa Unit.": Number(tarifa.toFixed(4)),
          "Total a Pagar": Number(total.toFixed(2)),
          "Estado": m.estado || "Pendiente"
        };
      });

      // Hoja Salidas (Egresos): Fecha, Categoría de Gasto, Descripción, Proveedor, Total Monto
      const dataSalidas = snapSalidas.docs.map(docSnap => {
        const s = docSnap.data();
        const monto = Number(s.monto || s.total || 0);
        let fechaStr = "S/F";
        const f = toDate(s.fechaPago || s.createdAt);
        if (f) fechaStr = f.toLocaleDateString('es-EC');

        return {
          "Fecha": fechaStr,
          "Categoría de Gasto": s.tipo || "Otros",
          "Descripción": s.detalle || s.description || "Gasto general",
          "Proveedor": s.proveedor || s.supplier || s.bancoCheque || "-",
          "Total Monto": Number(monto.toFixed(2))
        };
      });

      // Hoja Clientes: Código, Nombre del Cliente, Tipo, Teléfono, Saldo Inicial, Saldo Actual
      const dataClientes = snapClients.docs.map(docSnap => {
        const c = docSnap.data();
        return {
          "Código": c.code || c.codigo || docSnap.id,
          "Nombre del Cliente": (c.name || c.clienteNombre || "").toUpperCase(),
          "Tipo": c.classification || c.tipo || "nacional",
          "Teléfono": c.phone || c.telefono || "-",
          "Saldo Inicial": Number((c.baseDebt || c.saldoInicial || 0).toFixed(2)),
          "Saldo Actual": Number((c.saldoActual || c.saldo || 0).toFixed(2))
        };
      });

      // Hoja Químicos: Código P., Nombre del Producto, Categoría, Stock, Unidad, Costo Unit., Valor Total
      const dataQuimicos = snapQuimicos.docs.map(docSnap => {
        const q = docSnap.data();
        const stock = Number(q.stock || q.cantidad || 0);
        const cost = Number(q.cost || q.costoUnitario || 0);
        const total = Number(q.valorTotal || (stock * cost));

        return {
          "Código P.": q.code || docSnap.id,
          "Nombre del Producto": (q.name || q.nombre || "").toUpperCase(),
          "Categoría": q.category || q.categoria || "Químicos",
          "Stock": stock,
          "Unidad": q.unit || q.unidad || "kg",
          "Costo Unit.": Number(cost.toFixed(4)),
          "Valor Total": Number(total.toFixed(2))
        };
      });

      // 3. Crear Hoja Resumen General con Fórmulas
      const wsResumen = utils.aoa_to_sheet([
        ["RESUMEN GENERAL CONSOLIDADO - LDDEC"],
        [],
        ["Indicador", "Valor Consolidado", "Fórmula"],
        ["Total Ingresos (Facturación)", 0, "=SUM(Ingresos!F2:F100000)"],
        ["Total Liquidación Manualidades", 0, "=SUM(Manualidades!G2:G100000)"],
        ["Total Salidas (Egresos)", 0, "=SUM(Salidas!E2:E100000)"],
        [],
        ["Balance Operativo (Neto)", 0, "=B4-B5-B6"]
      ]);

      // Insertar fórmulas reales en SheetJS
      wsResumen["B4"] = { t: "n", f: "SUM(Ingresos!F2:F100000)" };
      wsResumen["B5"] = { t: "n", f: "SUM(Manualidades!G2:G100000)" };
      wsResumen["B6"] = { t: "n", f: "SUM(Salidas!E2:E100000)" };
      wsResumen["B8"] = { t: "n", f: "B4-B5-B6" };

      // 4. Crear Hojas Normales
      const wsIngresos = utils.json_to_sheet(dataIngresos.length > 0 ? dataIngresos : [{}]);
      const wsManualidades = utils.json_to_sheet(dataManualidades.length > 0 ? dataManualidades : [{}]);
      const wsSalidas = utils.json_to_sheet(dataSalidas.length > 0 ? dataSalidas : [{}]);
      const wsClientes = utils.json_to_sheet(dataClientes.length > 0 ? dataClientes : [{}]);
      const wsQuimicos = utils.json_to_sheet(dataQuimicos.length > 0 ? dataQuimicos : [{}]);

      // 5. Autoajuste de Ancho de Columnas para Mejor Diseño
      const applyColumnWidths = (ws: any, dataRows: any[]) => {
        if (!ws || dataRows.length === 0) return;
        const keys = Object.keys(dataRows[0]);
        ws["!cols"] = keys.map(key => {
          let maxLen = key.toString().length;
          dataRows.forEach(row => {
            const val = row[key];
            if (val !== undefined && val !== null) {
              maxLen = Math.max(maxLen, val.toString().length);
            }
          });
          return { wch: maxLen + 4 };
        });
      };

      applyColumnWidths(wsIngresos, dataIngresos);
      applyColumnWidths(wsManualidades, dataManualidades);
      applyColumnWidths(wsSalidas, dataSalidas);
      applyColumnWidths(wsClientes, dataClientes);
      applyColumnWidths(wsQuimicos, dataQuimicos);

      // Ancho para Resumen General
      wsResumen["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 30 }];

      // 6. Ensamblar en el Workbook
      utils.book_append_sheet(workbook, wsResumen, "Resumen General");
      utils.book_append_sheet(workbook, wsIngresos, "Ingresos");
      utils.book_append_sheet(workbook, wsManualidades, "Manualidades");
      utils.book_append_sheet(workbook, wsSalidas, "Salidas");
      utils.book_append_sheet(workbook, wsClientes, "Clientes");
      utils.book_append_sheet(workbook, wsQuimicos, "Químicos");

      writeFile(workbook, `LDDEC_EXPORT_CONSOLIDADO_${new Date().getFullYear()}.xlsx`);
      toast({ title: "Excel consolidado exportado exitosamente" });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al exportar Excel" });
    } finally {
      setExportingExcel(false);
    }
  };

  if (loading) return <div className="h-[60vh] flex flex-col items-center justify-center gap-4"><Loader2 className="h-10 w-10 animate-spin text-primary/30" /><p className="text-[10px] font-black uppercase tracking-[0.3em]">Cargando mantenimiento...</p></div>;

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-5xl font-black tracking-tighter uppercase">Configuración Maestra</h1>
          <p className="text-primary text-xs font-black uppercase tracking-[0.3em]">Gestión de Catálogos e Integridad DenimLab 2.0</p>
        </div>
        <div className="flex gap-3">
           {isAdmin && (
             <Button onClick={handleExportExcel} disabled={exportingExcel} className="bg-emerald-600 border-border text-white hover:bg-emerald-700 font-black uppercase h-12 px-6 rounded-xl shadow-sm gap-2">
               {exportingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Exportar Excel Completo
             </Button>
           )}
           <Button onClick={handleExportBackup} disabled={backingUp} className="bg-card border-border text-foreground hover:bg-muted font-black uppercase h-12 px-6 rounded-xl shadow-sm gap-2">{backingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Respaldo Total</Button>
           <Button onClick={handleMasterUserSync} disabled={syncingMaestro} className="bg-primary hover:bg-primary/90 text-white font-black uppercase h-12 px-6 rounded-xl shadow-xl gap-2">{syncingMaestro ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Sincronizar Usuarios</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* DIRECTORIO DE USUARIOS */}
        <div className="lg:col-span-12">
          <Card className="rounded-[2.5rem] border border-border shadow-premium overflow-hidden bg-card">
            <CardHeader className="bg-muted/30 border-b py-6 px-8 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black uppercase flex items-center gap-3"><Users className="h-5 w-5 text-primary" /> Directorio de Usuarios</CardTitle>
              <Button onClick={loadUsers} disabled={loadingUsers} variant="ghost" className="h-10 text-[10px] font-black uppercase tracking-widest gap-2">
                {loadingUsers ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Actualizar Lista
              </Button>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase py-4 pl-8">UID / ID</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Correo / Nombre</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Rol</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">Acceso</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right pr-8">Acciones Administrativas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id} className={cn("hover:bg-muted/5", !u.activo && "opacity-50 grayscale")}>
                      <TableCell className="pl-8 py-4 font-mono text-[9px] font-bold">{u.id}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-black uppercase text-foreground">{u.nombre || "SIN NOMBRE"}</span>
                          <span className="text-[10px] font-bold text-muted-foreground">{u.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-blue-500/10 text-blue-600 border-none text-[9px] font-black px-3 h-6 uppercase">{u.role}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-3">
                          <Switch 
                            checked={Boolean(u.activo ?? true)} 
                            onCheckedChange={() => handleToggleUserActive(u.id, Boolean(u.activo ?? true))}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                          <Badge className={cn("text-[9px] font-black px-3 h-6 uppercase border-none", Boolean(u.activo ?? true) ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
                            {Boolean(u.activo ?? true) ? "ACTIVO" : "BLOQUEADO"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleOpenEditDialog(u)} 
                            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeactivateUser(u.id)} 
                            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* --- CATÁLOGO DE PROCESOS --- */}
        <div className="lg:col-span-12">
          <Card className="rounded-[2.5rem] border border-border shadow-premium overflow-hidden bg-card">
            <CardHeader className="bg-muted/30 border-b py-6 px-8 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black uppercase flex items-center gap-3"><Wrench className="h-6 w-6 text-primary" /> CATÁLOGO MAESTRO: PROCESOS TÉCNICOS</CardTitle>
              <Button variant="ghost" size="sm" onClick={loadCatalogoProcesos} className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 gap-2">{loadingProcs ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />} Restaurar</Button>
            </CardHeader>
            <CardContent className="p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nuevo Proceso</Label><div className="flex gap-2"><Input placeholder="Ej. STONE WASH..." value={newMantenimientoProc} onChange={e => setNewMantenimientoProc(e.target.value.toUpperCase())} className="erp-input h-14 font-bold" /><Button onClick={handleAddProceso} className="bg-primary hover:bg-primary/90 text-white font-bold h-14 px-8 rounded-2xl"><Plus className="h-6 w-6" /></Button></div></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Buscar en Catálogo</Label><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Filtrar..." value={searchMantenimientoProc} onChange={e => setSearchMantenimientoProc(e.target.value)} className="pl-12 erp-input h-14" /></div></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {mantenimientoProcesos.filter(p => p.name?.toLowerCase().includes(searchMantenimientoProc.toLowerCase())).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border group hover:bg-primary/5 transition-all min-h-[40px]">
                    <span className="text-[9px] font-black uppercase leading-tight mr-1 truncate">{p.name}</span>
                    <button onClick={() => handleDeleteItem("procesos_tecnicos", p.id, loadCatalogoProcesos)} className="h-5 w-5 shrink-0 rounded-md bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all hover:bg-red-500 hover:text-white"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- CATÁLOGO DE PRENDAS --- */}
        <div className="lg:col-span-12">
          <Card className="rounded-[2.5rem] border border-border shadow-premium overflow-hidden bg-card">
            <CardHeader className="bg-muted/30 border-b py-6 px-8 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black uppercase flex items-center gap-3"><Shirt className="h-6 w-6 text-primary" /> CATÁLOGO MAESTRO: PRENDAS</CardTitle>
              <Button variant="ghost" size="sm" onClick={loadCatalogoPrendas} className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 gap-2">{loadingPrendas ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />} Restaurar</Button>
            </CardHeader>
            <CardContent className="p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nueva Prenda</Label><div className="flex gap-2"><Input placeholder="Ej. PANTALÓN HOMBRE..." value={newPrenda} onChange={e => setNewPrenda(e.target.value.toUpperCase())} className="erp-input h-14 font-bold" /><Button onClick={handleAddPrenda} className="bg-primary hover:bg-primary/90 text-white font-bold h-14 px-8 rounded-2xl"><Plus className="h-6 w-6" /></Button></div></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Buscar Prenda</Label><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Filtrar..." value={searchPrenda} onChange={e => setSearchPrenda(e.target.value)} className="pl-12 erp-input h-14" /></div></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {catalogoPrendas.filter(p => p.name?.toLowerCase().includes(searchPrenda.toLowerCase())).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border group hover:bg-primary/5 transition-all min-h-[40px]">
                    <span className="text-[9px] font-black uppercase leading-tight mr-1 truncate">{p.name}</span>
                    <button onClick={() => handleDeleteItem("catalogo_prendas", p.id, loadCatalogoPrendas)} className="h-5 w-5 shrink-0 rounded-md bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all hover:bg-red-500 hover:text-white"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- TRABAJADORES Y TARIFARIO (PARALELO) --- */}
        <div className="lg:col-span-6">
          <Card className="rounded-[2.5rem] border border-border shadow-premium overflow-hidden bg-card h-full">
            <CardHeader className="bg-muted/30 border-b py-6 px-8 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black uppercase flex items-center gap-3"><Users className="h-6 w-6 text-primary" /> TRABAJADORES</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-4">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nuevo Trabajador</Label><div className="flex gap-2"><Input placeholder="JUAN PÉREZ..." value={newWorker} onChange={e => setNewWorker(e.target.value.toUpperCase())} className="erp-input h-12 font-bold" /><Button onClick={handleAddWorker} className="bg-primary hover:bg-primary/90 text-white font-bold h-12 px-6 rounded-xl"><Plus className="h-5 w-5" /></Button></div></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Buscar</Label><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Filtrar..." value={searchWorker} onChange={e => setSearchWorker(e.target.value)} className="pl-10 erp-input h-10 text-xs" /></div></div>
              </div>
              <div className="rounded-2xl border border-border overflow-hidden bg-background">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-[9px] font-black uppercase py-3 pl-6">Nombre</TableHead>
                      <TableHead className="text-[9px] font-black uppercase text-center">Estado</TableHead>
                      <TableHead className="text-[9px] font-black uppercase text-right pr-6">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workers.filter(w => (w.nombre||"").toLowerCase().includes(searchWorker.toLowerCase())).map(w => (
                      <TableRow key={w.id} className={cn("hover:bg-muted/5", w.activo === false && "opacity-50")}>
                        <TableCell className="pl-6 py-3 font-bold text-[11px] uppercase">{w.nombre}</TableCell>
                        <TableCell className="text-center">
                          <Switch checked={w.activo !== false} onCheckedChange={() => handleToggleWorkerStatus(w.id, w.activo !== false)} className="data-[state=checked]:bg-emerald-500 scale-75" />
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteWorker(w.id)} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-6" id="tariff-form">
          <Card className="rounded-[2.5rem] border border-border shadow-premium overflow-hidden bg-card h-full">
            <CardHeader className="bg-muted/30 border-b py-6 px-8 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black uppercase flex items-center gap-3"><Calculator className="h-6 w-6 text-primary" /> TARIFARIO MANUALIDADES</CardTitle>
              <Button variant="ghost" size="sm" onClick={loadManualTariffs} className="h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-primary/10 gap-1.5">{loadingTariffs ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />} Restaurar</Button>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="bg-muted/20 p-6 rounded-[2rem] border border-border space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Manualidad</Label>
                    <Select value={tariffForm.manualidad} onValueChange={v => setTariffForm({...tariffForm, manualidad: v})}>
                      <SelectTrigger className="erp-input h-10 font-bold text-xs"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {catalogoManualidades.map(m => (
                          <SelectItem key={m.id} value={m.name} className="uppercase font-bold text-[10px]">{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">P. Adulto ($)</Label>
                      <Input type="number" step="0.001" placeholder="0.000" value={tariffForm.precioAdulto} onChange={e => setTariffForm({...tariffForm, precioAdulto: e.target.value})} className="erp-input h-10 font-black text-xs text-primary" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">P. Niño ($)</Label>
                      <Input type="number" step="0.001" placeholder="0.000" value={tariffForm.precioNino} onChange={e => setTariffForm({...tariffForm, precioNino: e.target.value})} className="erp-input h-10 font-bold text-xs text-emerald-600" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  {isEditingTariff && (
                    <Button variant="ghost" onClick={() => { setIsEditingTariff(null); setTariffForm({ manualidad: "", precioAdulto: "", precioNino: "" }); }} className="h-10 px-4 font-bold uppercase text-[9px]">X</Button>
                  )}
                  <Button onClick={handleSaveTariff} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase h-10 px-6 rounded-xl shadow-lg shadow-emerald-500/20 gap-2 text-[10px]">
                    <Save className="h-3.5 w-3.5" /> {isEditingTariff ? "Actualizar Tarifa" : "Guardar Tarifa"}
                  </Button>
                </div>
              </div>

              <div className="rounded-[2rem] border border-border overflow-hidden bg-background">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="py-4 pl-8 text-[9px] font-black uppercase">Manualidad</TableHead>
                      <TableHead className="text-[9px] font-black uppercase text-center">Prenda Adulto / Prenda Grande</TableHead>
                      <TableHead className="text-[9px] font-black uppercase text-center">Prenda Niño / Prenda Pequeña</TableHead>
                      <TableHead className="text-[9px] font-black uppercase text-right pr-8">Acc.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualTariffs.map(t => (
                      <TableRow key={t.id} className="hover:bg-muted/5 border-b border-border/50">
                        <TableCell className="py-4 pl-8"><span className="font-black text-[10px] uppercase text-foreground">{t.manualidad}</span></TableCell>
                        <TableCell className="text-center"><span className="font-black text-sm text-primary">${(t.precioAdulto || t.adultPrice || 0).toFixed(3)}</span></TableCell>
                        <TableCell className="text-center"><span className="font-black text-sm text-emerald-600">${(t.precioNino || t.childPrice || 0).toFixed(3)}</span></TableCell>
                        <TableCell className="text-right pr-8">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditTariff(t)} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary"><Edit3 className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteTariff(t.id)} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- CONCENTRACIONES TÉCNICAS (QUÍMICOS) --- */}
        <div className="lg:col-span-12"><Card className="rounded-[2.5rem] border border-border shadow-premium overflow-hidden bg-card"><CardHeader className="bg-muted/30 border-b py-6 px-8 flex flex-row items-center justify-between"><CardTitle className="text-sm font-black uppercase flex items-center gap-3"><Beaker className="h-5 w-5 text-primary" /> Concentraciones Técnicas (Químicos)</CardTitle></CardHeader><CardContent className="p-8 space-y-10"><div className="rounded-[2rem] border border-border overflow-hidden bg-background"><Table><TableHeader className="bg-muted/50"><TableRow><TableHead className="py-6 pl-10 text-[10px] font-black uppercase">Proceso Técnico</TableHead><TableHead className="text-[10px] font-black uppercase">Sustancia / Químico</TableHead><TableHead className="text-[10px] font-black uppercase text-center">Min (gr/L)</TableHead><TableHead className="text-[10px] font-black uppercase text-center">Max (gr/L)</TableHead><TableHead className="text-[10px] font-black uppercase text-right pr-10">Acción</TableHead></TableRow></TableHeader><TableBody>{chemMaestro.map(cm => (<TableRow key={cm.id} className="hover:bg-muted/5 border-b border-border/50"><TableCell className="py-6 pl-10"><span className="font-black text-xs uppercase text-primary">{cm.proceso}</span></TableCell><TableCell><span className="font-bold text-xs uppercase">{cm.sustancia}</span></TableCell><TableCell className="text-center"><Badge variant="outline" className="font-black text-emerald-600 border-emerald-200 bg-emerald-50 h-7 px-4 rounded-lg">{cm.min} gr/L</Badge></TableCell><TableCell className="text-center"><Badge variant="outline" className="font-black text-red-600 border-red-200 bg-red-50 h-7 px-4 rounded-lg">{cm.max} gr/L</Badge></TableCell><TableCell className="text-right pr-10"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={() => {}} className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary"><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, "quimicos_procesos_maestro", cm.id))} className="h-9 w-9 rounded-xl text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card></div>

      </div>

      {/* MODAL DE EDICIÓN DE USUARIO */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-card max-w-md">
          <div className="p-8 border-b border-border bg-primary/5">
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <Edit3 className="h-6 w-6 text-primary" />
              Editar Perfil
            </DialogTitle>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Nombre Completo</Label>
              <Input 
                value={selectedUser?.nombre || ""} 
                onChange={e => setSelectedUser({...selectedUser, nombre: e.target.value.toUpperCase()})} 
                className="erp-input h-12 font-bold" 
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Rol de Acceso</Label>
              <Select value={selectedUser?.role} onValueChange={v => setSelectedUser({...selectedUser, role: v})}>
                <SelectTrigger className="erp-input h-12 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl shadow-2xl">
                  {SYSTEM_ROLES.map(r => (
                    <SelectItem key={r} value={r} className="uppercase text-[10px] font-bold">{r.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/20 p-5 rounded-2xl border border-border flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold uppercase cursor-pointer">Estado de Acceso</Label>
                <p className="text-[10px] text-muted-foreground font-medium">Habilitar/Bloquear entrada al sistema</p>
              </div>
              <Switch 
                checked={Boolean(selectedUser?.activo ?? true)} 
                onCheckedChange={v => setSelectedUser({...selectedUser, activo: v})} 
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>

            <DialogFooter className="gap-3 pt-4 border-t border-border/50">
              <Button variant="ghost" onClick={() => setIsEditUserOpen(false)} className="flex-1 rounded-xl h-12 font-bold uppercase text-xs">
                CANCELAR
              </Button>
              <Button onClick={handleSaveUserEdit} className="flex-1 bg-primary text-white rounded-xl h-12 font-black uppercase text-xs shadow-lg shadow-primary/20">
                GUARDAR PERFIL
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
