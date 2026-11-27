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
  TrendingUp,
  Users,
  RotateCcw,
  FileMinus,
  Trash2
} from "lucide-react";
import { ResetCobranzasModal } from "@/components/cobranzas/ResetCobranzasModal";
import { CrearNotaCreditoModal } from "@/components/cobranzas/CrearNotaCreditoModal";
import { GestionarNotasCreditoModal } from "@/components/cobranzas/GestionarNotasCreditoModal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, writeBatch, doc, Timestamp, serverTimestamp, query, where, arrayUnion, getDocs, getDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { FacturaPendienteRow } from "@/components/cobranzas/FacturaPendienteRow";
import { CobranzaForm } from "@/components/cobranzas/CobranzaForm";
import { PagoDetalle, EstadoCobranza } from "@/types/lddec";
import { useSearchParams } from "next/navigation";
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
  const isAdmin = user?.role === "admin";
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isNotaCreditoModalOpen, setIsNotaCreditoModalOpen] = useState(false);
  const [isManageNCModalOpen, setIsManageNCModalOpen] = useState(false);
  const [directPayments, setDirectPayments] = useState<any[]>([]);
  const searchParams = useSearchParams();

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
  const [clientComboOpen, setClientComboOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");

  const [isConsolidated, setIsConsolidated] = useState<boolean>(true);

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
        return { 
          id: d.id, 
          ...data, 
          displayName: rawName,
          parentClientId: data.parentClientId || "",
          parentClientName: data.parentClientName || ""
        };
      });
      
      const sorted = mapped.sort((a, b) => 
        a.displayName.localeCompare(b.displayName, 'es', { sensitivity: 'base' })
      );

      setClients(sorted);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const cid = searchParams.get("clientId");
    if (cid && clients.length > 0) {
      const match = clients.find(c => c.id === cid);
      if (match) {
        setSelectedClientId(cid);
        setIsGenerated(true);
      }
    }
  }, [searchParams, clients]);

  useEffect(() => {
    if (selectedClientId) {
      setCurrentClient(clients.find(c => c.id === selectedClientId));
      setIsGenerated(false); // Resetear al cambiar cliente
    }
  }, [selectedClientId, clients]);

  // Identificación del Grupo Familiar Vinculado
  const familyGroup = useMemo(() => {
    if (!selectedClientId || clients.length === 0) return [];
    const target = clients.find(c => c.id === selectedClientId);
    if (!target) return [];

    const rootTitularId = target.parentClientId || target.id;
    return clients.filter(c => c.id === rootTitularId || c.parentClientId === rootTitularId);
  }, [selectedClientId, clients]);

  // IDs de clientes a consultar según modo consolidado o individual
  const activeClientIds = useMemo(() => {
    if (isConsolidated && familyGroup.length > 1) {
      return familyGroup.map(c => c.id);
    }
    return selectedClientId ? [selectedClientId] : [];
  }, [isConsolidated, familyGroup, selectedClientId]);

  useEffect(() => {
    if (!db || activeClientIds.length === 0) { setAllInvoices([]); return; }
    setLoading(true);

    const invoicesMap = new Map<string, any>();
    const paymentsMap = new Map<string, any>();

    const unsubsPayments = activeClientIds.flatMap((cid) => {
      const q1 = query(collection(db, "payments"), where("clienteId", "==", cid));
      const q2 = query(collection(db, "payments"), where("clientId", "==", cid));
      const u1 = onSnapshot(q1, (snap) => {
        snap.docs.forEach(d => paymentsMap.set(d.id, { id: d.id, ...d.data() }));
        setDirectPayments(Array.from(paymentsMap.values()));
      });
      const u2 = onSnapshot(q2, (snap) => {
        snap.docs.forEach(d => paymentsMap.set(d.id, { id: d.id, ...d.data() }));
        setDirectPayments(Array.from(paymentsMap.values()));
      });
      return [u1, u2];
    });

    const unsubs = activeClientIds.map((cid) => {
      const qInvoices = query(collection(db, "facturas"), where("clientId", "==", cid));
      return onSnapshot(qInvoices, async (snap) => {
        snap.docs.forEach(d => {
          const data = d.data();
          const ownerClient = clients.find(c => c.id === (data.clientId || data.clienteId));
          invoicesMap.set(d.id, { 
            id: d.id, 
            ...data,
            _ownerClientName: ownerClient ? (ownerClient.displayName || ownerClient.name) : (data.clienteNombre || data.clientName || "")
          });
        });

        try {
          const snapAlt = await getDocs(query(collection(db, "facturas"), where("clienteId", "==", cid)));
          snapAlt.docs.forEach(d => {
            const data = d.data();
            const ownerClient = clients.find(c => c.id === (data.clientId || data.clienteId));
            invoicesMap.set(d.id, { 
              id: d.id, 
              ...data,
              _ownerClientName: ownerClient ? (ownerClient.displayName || ownerClient.name) : (data.clienteNombre || data.clientName || "")
            });
          });
        } catch {
          // fallback
        }

        const finalInvoices = Array.from(invoicesMap.values());
        setAllInvoices(finalInvoices);
        setLoading(false);

        const targetInvId = searchParams.get("invoiceId");
        if (targetInvId) {
          const belongs = finalInvoices.some((f: any) => f.id === targetInvId);
          if (belongs) {
            setSelectedInvoices([targetInvId]);
            setPaymentLines(prev => {
              const exists = prev.some(line => line.invoiceId === targetInvId);
              if (!exists) {
                return [{
                  id: Math.random().toString(36).substr(2, 9),
                  monto: 0,
                  tipoTransaccion: "Pago",
                  fechaTransaccion: new Date(),
                  invoiceId: targetInvId
                }];
              }
              return prev;
            });
          }
        }
      });
    });

    return () => {
      unsubs.forEach((unsub: any) => unsub());
      unsubsPayments.forEach((unsub: any) => unsub());
    };
  }, [activeClientIds, clients, searchParams]);

  const accountMetrics = useMemo(() => {
    if (!isGenerated || !selectedClientId || !currentClient || !dateFrom || !dateTo) return null;

    if (isConsolidated && familyGroup.length > 1) {
      const totalBaseDebt = familyGroup.reduce((acc, c) => acc + Number(c.baseDebt || c.saldoInicial || 0), 0);
      const allFamilyPagosSI = familyGroup.flatMap(c => Array.isArray(c.pagosSaldoInicial) ? c.pagosSaldoInicial : []);
      const syntheticFamilyClient = {
        ...currentClient,
        baseDebt: totalBaseDebt,
        pagosSaldoInicial: allFamilyPagosSI
      };

      return calculateClientAccountingMetrics(
        totalBaseDebt, 
        dateFrom, 
        dateTo, 
        allInvoices, 
        allInvoices.flatMap(inv => Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : [])), 
        syntheticFamilyClient
      );
    }

    return calculateClientAccountingMetrics(
      Number(currentClient.baseDebt || 0), 
      dateFrom, 
      dateTo, 
      allInvoices, 
      allInvoices.flatMap(inv => Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : [])), 
      currentClient
    );
  }, [allInvoices, currentClient, dateFrom, dateTo, selectedClientId, isGenerated, isConsolidated, familyGroup]);

  /**
   * MOTOR DE RESOLUCIÓN DE PENDIENTES LDDEC 1.3
   * Inyecta saldo inicial base 2026 y garantiza visibilidad de deudas activas.
   * Ahora controlado por isGenerated y compatible con Cuentas Familiares Unificadas.
   */
  const invoicesWithBalance = useMemo(() => {
    if (!isGenerated || !currentClient) return [];

    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : new Date();
    const to = dateTo ? new Date(dateTo + "T23:59:59") : new Date();

    const result: any[] = [];

    // 1. Process initial balance 2026 (virtual row) with date filter
    const baseDebt = (isConsolidated && familyGroup.length > 1)
      ? familyGroup.reduce((acc, c) => acc + Number(c.baseDebt || c.saldoInicial || 0), 0)
      : Number(currentClient.baseDebt || currentClient.saldoInicial || 0);

    const pagosSI = (isConsolidated && familyGroup.length > 1)
      ? familyGroup.flatMap(c => Array.isArray(c.pagosSaldoInicial) ? c.pagosSaldoInicial : [])
      : (Array.isArray(currentClient.pagosSaldoInicial) ? currentClient.pagosSaldoInicial : []);
    
    // EL SALDO PENDIENTE DEL "SALDO INICIAL" ES GLOBAL. NO DEBE FILTRARSE POR FECHAS PARA EL CÁLCULO.
    const totalAbonadoSIGlobal = pagosSI.reduce((acc: number, p: any) => {
      if (p.anulado) return acc;
      return p.tipoTransaccion === 'Reverso' ? acc - Number(p.monto || 0) : acc + Number(p.monto || 0);
    }, 0);
    
    const saldoSI = Math.max(0, baseDebt - totalAbonadoSIGlobal);
    
    if (saldoSI > 0.01) {
      result.push({
        id: "INITIAL_BALANCE_2026",
        isInitialBalance: true,
        _normalizedNumero: "SALDO INICIAL 2026",
        _normalizedTotal: baseDebt,
        _normalizedSaldo: saldoSI,
        _normalizedDate: FECHA_BASE_2026,
        _ownerClientName: isConsolidated && familyGroup.length > 1 ? "FAMILIAR CONSOLIDADO" : (currentClient.displayName || currentClient.name),
        estadoCobranza: totalAbonadoSIGlobal > 0 ? "Parcialmente Cobrada" : "Por Cobrar"
      });
    }

    // 2. Process real invoices (2026+)
    const facturaRows = allInvoices.map(inv => {
      const invDate = toDate(inv.fechaFactura || inv.date);
      const pagos = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : []);
      const filteredPagos = pagos.filter((p: any) => !p.anulado);
      const totalAbonado = filteredPagos.reduce((acc: any, p: any) => p.tipoTransaccion === 'Reverso' || p.tipo === 'Reverso' ? acc - Number(p.monto || 0) : acc + Number(p.monto || 0), 0);
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
  }, [allInvoices, dateFrom, dateTo, currentClient, isGenerated, isConsolidated, familyGroup]);

  // Recopilación completa de Notas de Crédito del cliente (tanto directas como en facturas)
  const allCreditNotes = useMemo(() => {
    const result: any[] = [];
    
    // 1. Pagos directos en payments
    directPayments.forEach(p => {
      const isNC = (
        (p.tipoTransaccion || "").toLowerCase().includes("crédito") ||
        (p.tipoTransaccion || "").toLowerCase().includes("credito") ||
        (p.tipoTransaccion || "").toLowerCase().includes("ajuste") ||
        (p.metodoPago || "").toLowerCase().includes("crédito") ||
        (p.metodoPago || "").toLowerCase().includes("credito") ||
        (p.formaPago || "").toLowerCase().includes("crédito") ||
        (p.formaPago || "").toLowerCase().includes("credito") ||
        (p.numeroDocumento || "").toUpperCase().startsWith("NC") ||
        (p.numeroFactura || "").toUpperCase().startsWith("NC") ||
        p.origen === "directo"
      );
      if (isNC && !p.anulado) {
        result.push({
          id: p.id,
          isDirectPayment: true,
          sourceType: "payments",
          numero: p.numeroDocumento || p.numeroFactura || "NOTA DE CRÉDITO DIRECTA",
          fecha: toDate(p.fechaTransaccion || p.fecha || p.createdAt),
          monto: Number(p.monto || 0),
          descripcion: p.descripcion || "Nota de crédito directa a la cuenta",
          registradoPor: p.registradoPor || "Usuario",
          facturaId: p.facturaId || ""
        });
      }
    });

    // 2. Notas de crédito dentro de facturas (pagosYajustes)
    allInvoices.forEach(inv => {
      const pagos = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : []);
      pagos.forEach((p: any) => {
        const isNC = (
          (p.tipoTransaccion || "").toLowerCase().includes("crédito") ||
          (p.tipoTransaccion || "").toLowerCase().includes("credito") ||
          (p.tipoTransaccion || "").toLowerCase().includes("ajuste") ||
          (p.metodoPago || "").toLowerCase().includes("crédito") ||
          (p.metodoPago || "").toLowerCase().includes("credito") ||
          (p.formaPago || "").toLowerCase().includes("crédito") ||
          (p.formaPago || "").toLowerCase().includes("credito") ||
          (p.numeroDocumento || "").toUpperCase().startsWith("NC")
        );
        if (isNC && !p.anulado) {
          const already = result.some(r => r.id === p.id);
          if (!already) {
            result.push({
              id: p.id,
              isDirectPayment: false,
              sourceType: "factura",
              facturaId: inv.id,
              numeroFactura: inv.numeroFactura || inv.id,
              numero: p.numeroDocumento || `NC Factura #${inv.numeroFactura || inv.id}`,
              fecha: toDate(p.fechaTransaccion || p.fecha || p.createdAt),
              monto: Number(p.monto || 0),
              descripcion: p.descripcion || `Aplicada a Factura #${inv.numeroFactura || inv.id}`,
              registradoPor: p.registradoPor || "Usuario"
            });
          }
        }
      });
    });

    return result.sort((a, b) => (b.fecha?.getTime?.() || 0) - (a.fecha?.getTime?.() || 0));
  }, [directPayments, allInvoices]);

  // Sumatoria en tiempo real de facturas seleccionadas para cobrar a primera vista
  const selectedTotals = useMemo(() => {
    const selected = invoicesWithBalance.filter(inv => selectedInvoices.includes(inv.id));
    const count = selected.length;
    const totalSaldo = selected.reduce((sum, inv) => sum + Number(inv._normalizedSaldo !== undefined ? inv._normalizedSaldo : (inv.saldoPendiente || 0)), 0);
    const totalMontoOriginal = selected.reduce((sum, inv) => sum + Number(inv._normalizedTotal !== undefined ? inv._normalizedTotal : (inv.totalFactura || 0)), 0);
    return {
      count,
      totalSaldo,
      totalMontoOriginal
    };
  }, [invoicesWithBalance, selectedInvoices]);

    const handleDeleteCreditNote = async (itemOrId: any) => {
    if (isReadOnly) return;
    const item = typeof itemOrId === 'object' ? itemOrId : allCreditNotes.find(n => n.id === itemOrId) || { id: itemOrId };
    const montoDisplay = Number(item.monto || 0).toFixed(2);
    if (!confirm(`¿Seguro que deseas eliminar esta Nota de Crédito por ${montoDisplay}? Esta acción la removerá del sistema y restaurará el saldo del socio.`)) return;

    try {
      const batch = writeBatch(db);
      const nowServer = serverTimestamp();

      // 1. Eliminar de colección payments si existe
      try {
        const pRef = doc(db, "payments", item.id);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          batch.delete(pRef);
        }
      } catch {}

      // 2. Si vino de una factura o tiene facturaId, revertir en la factura
      const targetFacturaId = item.facturaId;
      if (targetFacturaId && targetFacturaId !== "SIN_FACTURA") {
        const invRef = doc(db, "facturas", targetFacturaId);
        const invSnap = await getDoc(invRef);
        if (invSnap.exists()) {
          const invData = invSnap.data();
          const currentPagos = Array.isArray(invData.pagosYajustes) ? invData.pagosYajustes : (Array.isArray(invData.pagosAjustes) ? invData.pagosAjustes : []);
          const updatedPagos = currentPagos.filter((p: any) => p.id !== item.id);
          const totalAbonado = updatedPagos.reduce((acc: number, p: any) => {
            if (p.anulado) return acc;
            return p.tipoTransaccion === 'Reverso' ? acc - Number(p.monto || 0) : acc + Number(p.monto || 0);
          }, 0);
          const originalTotal = Number(invData.totalFactura || invData.total || 0);
          const nuevoSaldo = Math.max(0, originalTotal - totalAbonado);
          let nuevoEstado: EstadoCobranza = "Por Cobrar";
          if (nuevoSaldo <= 0.01) nuevoEstado = "Pagada";
          else if (totalAbonado > 0) nuevoEstado = "Parcialmente Cobrada";

          batch.update(invRef, {
            pagosYajustes: updatedPagos,
            saldoPendiente: nuevoSaldo,
            estadoCobranza: nuevoEstado,
            updatedAt: nowServer
          });
        }
      }

      await batch.commit();
      setDirectPayments(prev => prev.filter(p => p.id !== item.id));
      toast({ title: "Nota de Crédito Eliminada", description: `Se eliminó la Nota de Crédito por ${montoDisplay} y se restauró el saldo.` });
    } catch (error: any) {
      console.error("Error al eliminar nota de crédito:", error);
      toast({ variant: "destructive", title: "Error al eliminar", description: error?.message || "Ocurrió un error en la base de datos." });
    }
  };

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

        const inv = allInvoices.find(i => i.id === line.invoiceId);
        const invClientId = inv?.clientId || inv?.clienteId || selectedClientId;
        const invClientName = inv?._ownerClientName || inv?.clienteNombre || inv?.clientName || currentClient?.displayName || currentClient?.name || "Socio";

        const globalPaymentRef = doc(collection(db, "payments"));
        const globalPaymentData: any = {
          ...newPayment,
          clienteId: invClientId,
          clienteNombre: invClientName,
          origen: "factura",
          migrado: false,
          createdAt: nowServer
        };

        if (line.invoiceId === "INITIAL_BALANCE_2026") {
          globalPaymentData.origen = "saldoInicial";
          globalPaymentData.facturaId = "INITIAL_BALANCE_2026";
          globalPaymentData.numeroFactura = "SALDO INICIAL 2026";
          batch.set(globalPaymentRef, globalPaymentData);

          const targetClientForSI = (isConsolidated && familyGroup.length > 1)
            ? (familyGroup.find(c => Number(c.baseDebt || c.saldoInicial || 0) > 0) || currentClient)
            : currentClient;

          const clientRef = doc(db, "clients", targetClientForSI.id);
          const currentPagosSI = Array.isArray(targetClientForSI.pagosSaldoInicial) ? targetClientForSI.pagosSaldoInicial : [];
          batch.update(clientRef, {
            pagosSaldoInicial: [...currentPagosSI, newPayment],
            updatedAt: nowServer
          });
        } 
        else {
          if (!inv) continue;

          globalPaymentData.facturaId = inv.id;
          globalPaymentData.numeroFactura = inv.numeroFactura || inv.id;
          batch.set(globalPaymentRef, globalPaymentData);

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
            <Popover open={clientComboOpen} onOpenChange={setClientComboOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-12 erp-input bg-card justify-between text-left font-bold text-xs">
                  {clients.find(c => c.id === selectedClientId)?.displayName || "Seleccione un socio..."}
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
                    {clients
                      .filter(c => c.displayName.toLowerCase().includes(clientSearchQuery.toLowerCase()))
                      .map(c => (
                        <Button
                          key={c.id}
                          variant="ghost"
                          onClick={() => {
                            setSelectedClientId(c.id);
                            setSelectedInvoices([]);
                            setPaymentLines([]);
                            setIsGenerated(false);
                            setClientComboOpen(false);
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

        {familyGroup.length > 1 && (
          <div className="p-5 bg-primary/5 border border-primary/20 rounded-3xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black shadow-inner">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-primary">Grupo Familiar Vinculado</span>
                  <Badge className="bg-primary/20 text-primary border-none text-[9px] font-black py-0 h-4 uppercase">
                    {familyGroup.length} Miembros
                  </Badge>
                </div>
                <p className="text-xs font-black text-foreground uppercase tracking-tight mt-0.5">
                  {familyGroup.map(m => m.displayName || m.name).join("  •  ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-card px-4 py-2.5 rounded-2xl border border-border shadow-sm">
              <Label htmlFor="toggle-consolidado" className="text-xs font-bold uppercase cursor-pointer text-foreground">
                {isConsolidated ? "Vista Consolidada Unificada" : "Solo Cuenta Individual"}
              </Label>
              <Switch
                id="toggle-consolidado"
                checked={isConsolidated}
                onCheckedChange={(checked) => {
                  setIsConsolidated(checked);
                  setIsGenerated(false);
                }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end pt-4 border-t border-border/50 gap-3">
          {currentClient && !isReadOnly && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNotaCreditoModalOpen(true)}
                className="border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 font-black uppercase text-xs tracking-wider h-14 px-5 rounded-2xl gap-2 shadow-sm"
              >
                <FileMinus className="h-4 w-4" />
                Nueva Nota de Crédito
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsManageNCModalOpen(true)}
                className="border-red-400 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-black uppercase text-xs tracking-wider h-14 px-5 rounded-2xl gap-2 shadow-sm"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
                Ver / Eliminar N/C ({allCreditNotes.length})
              </Button>
            </>
          )}
          {isAdmin && currentClient && (
            <Button 
              type="button"
              variant="outline"
              onClick={() => setIsResetModalOpen(true)}
              className="border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-black uppercase text-xs tracking-wider h-14 px-6 rounded-2xl gap-2 shadow-sm"
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar Cobros por Mes
            </Button>
          )}
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/50 pb-5">
          <div className="flex flex-wrap items-center gap-4">
            <h4 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <Receipt className="h-6 w-6 text-primary" /> Cartera Pendiente
            </h4>
            {selectedTotals.count > 0 && (
              <div className="flex items-center gap-3 bg-emerald-500/10 border-2 border-emerald-500/30 px-5 py-2 rounded-2xl shadow-sm animate-in zoom-in-95">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  {selectedTotals.count} {selectedTotals.count === 1 ? 'Factura Seleccionada' : 'Facturas Seleccionadas'}:
                </span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  ${selectedTotals.totalSaldo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {invoicesWithBalance.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (selectedInvoices.length === invoicesWithBalance.length) {
                    setSelectedInvoices([]);
                  } else {
                    setSelectedInvoices(invoicesWithBalance.map(inv => inv.id));
                  }
                }}
                className="text-xs font-bold text-muted-foreground hover:text-foreground h-11 px-4 rounded-xl hover:bg-muted"
              >
                {selectedInvoices.length === invoicesWithBalance.length ? "Deseleccionar Todas" : "Seleccionar Todas"}
              </Button>
            )}
            {currentClient && !isReadOnly && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNotaCreditoModalOpen(true)}
                  className="border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 font-black uppercase text-xs tracking-wider h-11 px-5 rounded-2xl gap-2 shadow-sm"
                >
                  <FileMinus className="h-4 w-4" />
                  Nueva N/C
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsManageNCModalOpen(true)}
                  className="border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-black uppercase text-xs tracking-wider h-11 px-4 rounded-2xl gap-2 shadow-sm"
                  title="Ver y eliminar notas de crédito"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                  Eliminar N/C ({allCreditNotes.length})
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="rounded-[2rem] border border-border overflow-hidden min-h-[250px]">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-12 pl-6">
                  {invoicesWithBalance.length > 0 && (
                    <Checkbox
                      checked={selectedInvoices.length === invoicesWithBalance.length && invoicesWithBalance.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedInvoices(invoicesWithBalance.map(inv => inv.id));
                        } else {
                          setSelectedInvoices([]);
                        }
                      }}
                      title="Seleccionar todas"
                      className="border-border data-[state=checked]:bg-primary"
                    />
                  )}
                </TableHead>
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
            {isGenerated && invoicesWithBalance.length > 0 && (
              <TableFooter className="bg-emerald-50/50 dark:bg-emerald-950/20 border-t-2 border-emerald-500/20 tabular-nums">
                <TableRow>
                  <TableCell colSpan={3} className="pl-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black uppercase tracking-wider text-foreground">
                        Total Seleccionado:
                      </span>
                      <Badge className="bg-emerald-600 text-white font-black text-[10px] px-2.5 py-0.5 border-none">
                        {selectedTotals.count} de {invoicesWithBalance.length} {invoicesWithBalance.length === 1 ? 'factura' : 'facturas'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold text-muted-foreground py-4">
                    {selectedTotals.count > 0 ? `${selectedTotals.totalMontoOriginal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                  </TableCell>
                  <TableCell className="text-right py-4">
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black uppercase text-emerald-800 dark:text-emerald-400 tracking-wider">
                        Suma a Cobrar
                      </span>
                      <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                        ${selectedTotals.totalSaldo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="pr-8"></TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </div>

      {/* SECCIÓN DE NOTAS DE CRÉDITO REGISTRADAS DEL SOCIO */}
      {selectedClientId && (
        <div className="bg-card p-8 rounded-[2.5rem] border border-border shadow-premium space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                <FileMinus className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xl font-black uppercase tracking-tight text-foreground">
                  Notas de Crédito Registradas
                </h4>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                  Abonos y ajustes aplicados a favor de este socio
                </p>
              </div>
            </div>
            {!isReadOnly && (
              <Button
                type="button"
                onClick={() => setIsNotaCreditoModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-xs rounded-xl h-11 px-6 gap-2 shadow-md shadow-purple-600/20"
              >
                <FileMinus className="h-4 w-4" />
                Nueva Nota de Crédito
              </Button>
            )}
          </div>

          {allCreditNotes.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-border rounded-2xl">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                No hay notas de crédito registradas para este socio en este periodo
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="pl-6">Documento / N°</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto / Motivo</TableHead>
                    <TableHead className="text-right">Monto ($)</TableHead>
                    <TableHead>Registrado Por</TableHead>
                    <TableHead className="text-center pr-6 w-24">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allCreditNotes.map((pago) => {
                      const fechaStr = pago.fecha instanceof Date 
                        ? pago.fecha.toLocaleDateString('es-EC') 
                        : (pago.fecha ? String(pago.fecha) : "S/F");
                      return (
                        <TableRow key={pago.id} className="border-b border-border/60 hover:bg-muted/20">
                          <TableCell className="font-black text-xs uppercase text-purple-700 dark:text-purple-300 pl-6">
                            {pago.numero || "NOTA DE CRÉDITO"}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{fechaStr}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {pago.descripcion || "Nota de crédito directa a favor"}
                          </TableCell>
                          <TableCell className="text-right font-black text-sm text-purple-600 dark:text-purple-400">
                            ${Number(pago.monto || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{pago.registradoPor || "Usuario"}</TableCell>
                          <TableCell className="text-center pr-6">
                            {!isReadOnly && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCreditNote(pago)}
                                className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                                title="Eliminar esta Nota de Crédito"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

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
              <div className="text-center space-y-1 w-full border-t border-b border-border py-3 my-1">
                <h5 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total a Cobrar</h5>
                <p className="text-2xl font-black text-emerald-600 tracking-tighter">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(paymentLines.reduce((acc, curr) => acc + Number(curr.monto || 0), 0))}
                </p>
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
      {currentClient && (
        <ResetCobranzasModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          client={currentClient}
          allClients={clients}
          onSuccess={() => {
            setIsGenerated(false);
            setTimeout(() => {
              handleGenerateClick();
            }, 300);
          }}
        />
      )}
      <CrearNotaCreditoModal
        isOpen={isNotaCreditoModalOpen}
        onClose={() => setIsNotaCreditoModalOpen(false)}
        client={currentClient}
        allClients={clients}
        invoices={allInvoices}
        onSuccess={() => {
          setIsGenerated(false);
          setTimeout(() => {
            handleGenerateClick();
          }, 300);
        }}
      />
      <GestionarNotasCreditoModal
        isOpen={isManageNCModalOpen}
        onClose={() => setIsManageNCModalOpen(false)}
        creditNotes={allCreditNotes}
        onDelete={handleDeleteCreditNote}
        clientName={currentClient?.displayName || currentClient?.name || ""}
        isReadOnly={isReadOnly}
      />
    </div>
  );
}
