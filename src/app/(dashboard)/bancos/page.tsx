"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Building, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Eye, 
  EyeOff,
  Trash2, 
  Wallet, 
  Loader2, 
  Calendar as CalendarIcon,
  Printer,
  ArrowRightLeft,
  X,
  AlertTriangle,
  Undo2
} from "lucide-react";
import { printHtml } from "@/lib/printHtml";
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
  DialogFooter,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  addDoc, 
  writeBatch, 
  serverTimestamp, 
  orderBy, 
  Timestamp,
  deleteDoc,
  updateDoc
} from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export default function BancosPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isContador = user?.role === "contador";
  const isReadOnly = user?.role === "socio";
  const cannotEdit = isContador || isReadOnly;
  
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [mostrarOcultas, setMostrarOcultas] = useState(false);

  // Form states
  const [txForm, setTxForm] = useState({ 
    accountId: "", 
    tipo: "Deposito", 
    fecha: new Date(), 
    numeroDocumento: "", 
    monto: "", 
    concepto: "" 
  });
  
  const [accForm, setAccForm] = useState({ 
    nombre: "", 
    tipo: "Banco", 
    saldoInicial: "0", 
  });

  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<any>(null);
  
  // Load Accounts
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "cuentas_bancarias"), (snap) => {
      const allAccounts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAccounts(allAccounts);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load Transactions for Selected Account
  useEffect(() => {
    if (!selectedAccount || !db) return;
    setHistoryLoading(true);
    const unsub = onSnapshot(
      query(collection(db, "cuentas_bancarias", selectedAccount.id, "transacciones"), orderBy("fecha", "desc")), 
      (snap) => {
        setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setHistoryLoading(false);
      }
    );
    return () => unsub();
  }, [selectedAccount]);

  // Cuenta activa reactiva sincronizada
  const activeAccount = useMemo(() => {
    if (!selectedAccount) return null;
    return accounts.find(a => a.id === selectedAccount.id) || selectedAccount;
  }, [selectedAccount, accounts]);

  // Cálculo dinámico cronológico del historial y saldos correlativos matemáticos
  const processedHistory = useMemo(() => {
    if (!history || history.length === 0) return [];

    const getMs = (val: any) => {
      if (!val) return 0;
      if (typeof val.toDate === "function") return val.toDate().getTime();
      if (val instanceof Date) return val.getTime();
      const d = new Date(val);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    // 1. Ordenar cronológicamente (ascendente: más antigua primero)
    const sortedAsc = [...history].sort((a, b) => {
      const timeA = getMs(a.fecha);
      const timeB = getMs(b.fecha);
      if (timeA !== timeB) return timeA - timeB;

      const regA = getMs(a.fechaRegistro);
      const regB = getMs(b.fechaRegistro);
      if (regA !== regB) return regA - regB;

      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    // 2. Acumular saldo desde el saldo inicial de la cuenta
    const saldoInicial = Number(activeAccount?.saldoInicial || 0);
    let runningBalance = saldoInicial;

    const withBalances = sortedAsc.map((tx) => {
      const isDeposito = tx.tipo === "Deposito";
      const montoNum = Number(tx.monto || 0);
      runningBalance = isDeposito ? runningBalance + montoNum : runningBalance - montoNum;

      return {
        ...tx,
        saldoCalculado: runningBalance
      };
    });

    // 3. Devolver orden descendente (más reciente arriba) para la vista del Estado de Cuenta
    return withBalances.reverse();
  }, [history, activeAccount]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cannotEdit) return;
    if (!accForm.nombre) {
      toast({ variant: "destructive", title: "Datos incompletos" });
      return;
    }

    try {
      const saldo = parseFloat(accForm.saldoInicial) || 0;
      await addDoc(collection(db, "cuentas_bancarias"), { 
        nombre: accForm.nombre.toUpperCase(), 
        tipo: accForm.tipo, 
        saldoInicial: saldo, 
        saldoActual: saldo, 
        fechaCreacion: serverTimestamp(), 
        activa: true 
      });
      
      setAccForm({ nombre: "", tipo: "Banco", saldoInicial: "0" });
      toast({ title: "Cuenta Maestro Creada" });
    } catch (e) { 
      toast({ variant: "destructive", title: "Error al crear cuenta" }); 
    }
  };

  const handleRegisterTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cannotEdit || processing) return;
    
    const { accountId, monto, tipo, concepto, numeroDocumento, fecha } = txForm;
    const montoNum = parseFloat(monto);
    
    if (!accountId || isNaN(montoNum) || !concepto) {
      toast({ variant: "destructive", title: "Complete los campos obligatorios" });
      return;
    }

    setProcessing(true);
    try {
      const batch = writeBatch(db);
      const accRef = doc(db, "cuentas_bancarias", accountId);
      const accSnap = accounts.find(a => a.id === accountId);
      
      if (!accSnap) throw new Error("Cuenta no encontrada");

      const impact = tipo === "Deposito" ? montoNum : -montoNum;
      const nuevoSaldo = (accSnap.saldoActual || 0) + impact;

      // 1. Crear documento de transacción
      const txRef = doc(collection(db, "cuentas_bancarias", accountId, "transacciones"));
      batch.set(txRef, {
        tipo,
        monto: montoNum,
        concepto: concepto.toUpperCase(),
        numeroDocumento: numeroDocumento.toUpperCase(),
        fecha: Timestamp.fromDate(fecha),
        fechaRegistro: serverTimestamp(),
        registradoPor: user?.displayName || user?.email,
        saldoPosterior: nuevoSaldo
      });

      // 2. Actualizar saldo maestro
      batch.update(accRef, { 
        saldoActual: nuevoSaldo,
        ultimaActividad: serverTimestamp()
      });

      await batch.commit();
      
      toast({ title: "Movimiento Registrado", description: `Saldo actualizado: $${nuevoSaldo.toFixed(2)}` });
      setIsRegisterOpen(false);
      setTxForm({ ...txForm, monto: "", concepto: "", numeroDocumento: "" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error en la transacción" });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete || !isAdmin) {
      toast({ variant: "destructive", title: "Acceso Denegado" });
      return;
    }
    try {
      await deleteDoc(doc(db, "cuentas_bancarias", accountToDelete.id));
      toast({ title: "Cuenta Eliminada", description: "El registro ha sido removido del sistema." });
      setIsDeleteOpen(false);
      setAccountToDelete(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  const handleToggleActive = async (account: any) => {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Acceso Denegado" });
      return;
    }
    try {
      await updateDoc(doc(db, "cuentas_bancarias", account.id), { activa: false });
      toast({ title: "Cuenta Desactivada" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const handleDeleteTransaction = async (tx: any) => {
    if (!isAdmin || !selectedAccount) {
      toast({ variant: "destructive", title: "Acceso Denegado" });
      return;
    }
    
    if (!window.confirm(`¿Estás seguro de eliminar esta transacción de $${tx.monto}? El saldo de la cuenta será recalculado automáticamente.`)) return;

    try {
      const batch = writeBatch(db);
      const accRef = doc(db, "cuentas_bancarias", selectedAccount.id);
      
      const freshAccount = accounts.find(a => a.id === selectedAccount.id) || selectedAccount;
      
      const impact = tx.tipo === "Deposito" ? -tx.monto : tx.monto;
      const nuevoSaldo = (freshAccount.saldoActual || 0) + impact;

      const txRef = doc(db, "cuentas_bancarias", selectedAccount.id, "transacciones", tx.id);
      batch.delete(txRef);
      
      batch.update(accRef, { saldoActual: nuevoSaldo });
      
      await batch.commit();
      
      toast({ title: "Movimiento Eliminado", description: `Saldo recalculado: $${nuevoSaldo.toFixed(2)}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar transacción" });
    }
  };

  const handleRestoreAccount = async (account: any) => {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Acceso Denegado" });
      return;
    }
    try {
      await updateDoc(doc(db, "cuentas_bancarias", account.id), { activa: true });
      toast({ title: "Cuenta Restaurada" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const handleExportPDF = () => {
    if (!selectedAccount) return;

    const fechaGenStr = format(new Date(), "dd/MM/yyyy HH:mm");
    const accountName = selectedAccount.nombre || "CUENTA BANCARIA";
    const accountBank = selectedAccount.banco || selectedAccount.tipo || "BANCO";
    const currentSaldo = (processedHistory.length > 0 
      ? processedHistory[0].saldoCalculado 
      : Number(selectedAccount.saldoActual || selectedAccount.saldoInicial || 0)
    ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let totalDebe = 0;
    let totalHaber = 0;
    processedHistory.forEach(tx => {
      if (tx.tipo === 'Deposito') {
        totalHaber += tx.monto || 0;
      } else {
        totalDebe += tx.monto || 0;
      }
    });

    // Incluir todos los movimientos con soporte multipágina A4
    const historyToPrint = processedHistory;

    const rowsHtml = historyToPrint.map(tx => {
      let fechaStr = "---";
      if (tx.fecha?.toDate) {
        fechaStr = format(tx.fecha.toDate(), "dd/MM/yy HH:mm");
      } else if (tx.fecha) {
        try {
          fechaStr = format(new Date(tx.fecha), "dd/MM/yy HH:mm");
        } catch {
          fechaStr = String(tx.fecha);
        }
      }

      const debeStr = tx.tipo !== 'Deposito' ? `$${(tx.monto || 0).toFixed(2)}` : '—';
      const haberStr = tx.tipo === 'Deposito' ? `$${(tx.monto || 0).toFixed(2)}` : '—';
      const saldoVal = tx.saldoCalculado !== undefined ? tx.saldoCalculado : (tx.saldoPosterior || 0);
      const saldoStr = `$${Number(saldoVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      return `
        <tr>
          <td style="padding: 3.5px 6px; border-bottom: 1px solid #e2e8f0; font-size: 7.5pt; color: #475569; white-space: nowrap;">${fechaStr}</td>
          <td style="padding: 3.5px 6px; border-bottom: 1px solid #e2e8f0; font-size: 7.5pt;">
            <div style="font-weight: 700; text-transform: uppercase; color: #0f172a; line-height: 1.1;">${tx.concepto || 'MOVIMIENTO'}</div>
            <div style="font-size: 6.5pt; color: #64748b; font-weight: 600;">Doc: ${tx.numeroDocumento || 'S/N'}</div>
          </td>
          <td style="padding: 3.5px 6px; border-bottom: 1px solid #e2e8f0; font-size: 7.5pt; text-align: right; font-weight: 700; color: #dc2626;">${debeStr}</td>
          <td style="padding: 3.5px 6px; border-bottom: 1px solid #e2e8f0; font-size: 7.5pt; text-align: right; font-weight: 700; color: #16a34a;">${haberStr}</td>
          <td style="padding: 3.5px 6px; border-bottom: 1px solid #e2e8f0; font-size: 7.5pt; text-align: right; font-weight: 800; color: #0f172a;">${saldoStr}</td>
        </tr>
      `;
    }).join("");

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>ESTADO DE CUENTA - ${accountName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 6mm 8mm 6mm 8mm !important;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #0f172a;
            background: #fff;
          }
          .page-box {
            width: 100%;
            max-width: 194mm;
            margin: 0 auto;
          }
          .header-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .brand-title {
            font-size: 13pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.3px;
            margin: 0;
            color: #0f172a;
          }
          .brand-sub {
            font-size: 7pt;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin: 1px 0 0 0;
          }
          .doc-title-block {
            text-align: right;
          }
          .doc-type {
            font-size: 11pt;
            font-weight: 900;
            text-transform: uppercase;
            color: #0284c7;
            margin: 0;
          }
          .doc-meta {
            font-size: 7pt;
            color: #64748b;
            font-weight: 600;
            margin: 1px 0 0 0;
          }
          .account-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 6px 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          }
          .account-card h3 {
            margin: 0 0 1px 0;
            font-size: 10pt;
            font-weight: 800;
            text-transform: uppercase;
            color: #0f172a;
          }
          .account-card p {
            margin: 0;
            font-size: 7pt;
            color: #64748b;
            font-weight: 600;
          }
          .balance-box {
            text-align: right;
          }
          .balance-label {
            font-size: 6.5pt;
            font-weight: 800;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 1px;
          }
          .balance-value {
            font-size: 13pt;
            font-weight: 900;
            color: #16a34a;
            line-height: 1;
          }
          .summary-kpi {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            margin-bottom: 8px;
          }
          .kpi-card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 5px;
            padding: 4px 8px;
            text-align: center;
          }
          .kpi-lbl {
            font-size: 6.5pt;
            font-weight: 800;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 1px;
          }
          .kpi-val {
            font-size: 9.5pt;
            font-weight: 800;
          }
          thead {
            display: table-header-group;
          }
          tbody {
            display: table-row-group;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 2px;
            page-break-inside: auto;
          }
          th {
            background: #f1f5f9;
            color: #334155;
            font-size: 7pt;
            font-weight: 800;
            text-transform: uppercase;
            padding: 5px 6px;
            border-bottom: 1.5px solid #cbd5e1;
            text-align: left;
          }
          th.right {
            text-align: right;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .footer-note {
            margin-top: 8px;
            padding-top: 4px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 6.5pt;
            color: #94a3b8;
            font-weight: 600;
            page-break-inside: avoid;
            break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <div class="page-box">
          <div class="header-container">
            <div>
              <h1 class="brand-title">LABORATORIO DEL DENIM ECUADOR</h1>
              <p class="brand-sub">LDDEC CÍA LTDA – GESTIÓN DE DISPONIBILIDADES Y BANCOS</p>
            </div>
            <div class="doc-title-block">
              <p class="doc-type">ESTADO DE CUENTA</p>
              <p class="doc-meta">Emisión: ${fechaGenStr}</p>
            </div>
          </div>

          <div class="account-card">
            <div>
              <h3>${accountName}</h3>
              <p><strong>Tipo / Entidad:</strong> ${accountBank} ${selectedAccount.numeroCuenta ? `&nbsp;|&nbsp; <strong>Cta:</strong> ${selectedAccount.numeroCuenta}` : ''}</p>
            </div>
            <div class="balance-box">
              <div class="balance-label">Saldo Disponible Actual</div>
              <div class="balance-value">$${currentSaldo}</div>
            </div>
          </div>

          <div class="summary-kpi">
            <div class="kpi-card">
              <div class="kpi-lbl">Total Egresos (Debe)</div>
              <div class="kpi-val" style="color: #dc2626;">$${totalDebe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-lbl">Total Ingresos (Haber)</div>
              <div class="kpi-val" style="color: #16a34a;">$${totalHaber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-lbl">Movimientos Registrados</div>
              <div class="kpi-val" style="color: #0284c7;">${processedHistory.length}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 100px;">Fecha</th>
                <th>Concepto / Referencia</th>
                <th class="right" style="width: 85px; color: #dc2626;">Debe (-)</th>
                <th class="right" style="width: 85px; color: #16a34a;">Haber (+)</th>
                <th class="right" style="width: 90px;">Saldo</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8; font-style: italic;">Sin movimientos registrados</td></tr>'}
            </tbody>
          </table>

          <div class="footer-note">
            <span>LDDEC Sistema Financiero – Documento Oficial A4</span>
            <span>Página 1 de 1</span>
          </div>
        </div>
      </body>
      </html>
    `;

    printHtml(html);
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Iniciando Tesorería...</p>
      </div>
    );
  }

  const txDate = txForm.fecha;

  const displayedAccounts = accounts.filter(a => mostrarOcultas ? true : a.activa !== false);

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-5xl font-black tracking-tighter uppercase">Bancos y Cajas</h1>
          <p className="text-primary text-xs font-black uppercase tracking-[0.3em]">
            Gestión de Disponibilidad {cannotEdit && "(MODO LECTURA)"}
          </p>
          {isReadOnly && <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3 mt-2">Modo Solo Lectura</Badge>}
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch checked={mostrarOcultas} onCheckedChange={setMostrarOcultas} id="mostrar-ocultas" />
            <Label htmlFor="mostrar-ocultas" className="text-xs font-bold uppercase cursor-pointer text-muted-foreground">
              Mostrar ocultas
            </Label>
          </div>
          {!cannotEdit && (
            <Button 
              onClick={() => setIsRegisterOpen(true)} 
              className="bg-primary hover:bg-primary/90 text-white font-black uppercase h-12 px-8 rounded-xl shadow-xl transition-all active:scale-95"
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Registrar Movimiento
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className={cn("space-y-6", cannotEdit ? "xl:col-span-12" : "xl:col-span-8")}>
          <div className="rounded-[2.5rem] border border-border bg-card overflow-hidden shadow-premium">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="py-6 pl-10">Cuenta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Saldo Actual</TableHead>
                  <TableHead className="text-right pr-10">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedAccounts.map((acc) => (
                  <TableRow key={acc.id} className={cn("border-b border-border hover:bg-muted/10 transition-colors group", acc.activa === false && "opacity-60 bg-muted/5")}>
                    <TableCell className="py-6 pl-10">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                          <Building className="h-4.5 w-4.5" />
                        </div>
                        <span className="font-black uppercase">{acc.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-primary/20 text-primary font-bold uppercase text-[9px] px-3">
                        {acc.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-black text-xl text-foreground tracking-tighter">
                        ${(acc.saldoActual || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-10">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 rounded-full hover:bg-primary/10 hover:text-primary"
                          onClick={() => { setSelectedAccount(acc); setIsModalOpen(true); }}
                        >
                          <Eye className="h-4.5 w-4.5" />
                        </Button>
                        {isAdmin && (
                          <>
                            {acc.activa !== false ? (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-10 w-10 rounded-full hover:bg-orange-50 hover:text-orange-600"
                                onClick={() => handleToggleActive(acc)}
                                title="Ocultar/Desactivar Cuenta"
                              >
                                <EyeOff className="h-4.5 w-4.5" />
                              </Button>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-10 w-10 rounded-full hover:bg-emerald-50 hover:text-emerald-600"
                                onClick={() => handleRestoreAccount(acc)}
                                title="Mostrar/Activar Cuenta"
                              >
                                <Undo2 className="h-4.5 w-4.5" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-10 w-10 rounded-full hover:bg-red-50 hover:text-red-600"
                              onClick={() => { setAccountToDelete(acc); setIsDeleteOpen(true); }}
                              title="Eliminar Cuenta"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {displayedAccounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-40 text-center opacity-30">
                      <Wallet className="h-12 w-12 mx-auto mb-2" />
                      <p className="font-black text-xs uppercase tracking-widest">No hay cuentas configuradas</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {!cannotEdit && (
          <div className="xl:col-span-4 space-y-6">
            <Card className="rounded-[2.5rem] border border-border shadow-premium overflow-hidden bg-card">
              <CardHeader className="bg-primary/5 border-b py-6">
                <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" /> Crear Cuenta Maestro
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <form onSubmit={handleCreateAccount} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nombre de Entidad</Label>
                    <Input 
                      type="text"
                      autoComplete="on"
                      autoCorrect="on"
                      spellCheck={true}
                      autoCapitalize="words"
                      placeholder="EJ: BCO. PICHINCHA - CORRIENTE" 
                      value={accForm.nombre} 
                      onChange={e => setAccForm({...accForm, nombre: e.target.value})} 
                      className="erp-input h-11 font-bold" 
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Tipo</Label>
                      <Select value={accForm.tipo} onValueChange={v => setAccForm({...accForm, tipo: v})}>
                        <SelectTrigger className="erp-input h-11 font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="Banco">Banco</SelectItem>
                          <SelectItem value="Caja">Caja Chica</SelectItem>
                          <SelectItem value="Inversion">Inversión</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Saldo Inicial</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={accForm.saldoInicial} 
                        onChange={e => setAccForm({...accForm, saldoInicial: e.target.value})} 
                        className="erp-input h-11 font-black text-emerald-600" 
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-black uppercase h-12 rounded-xl mt-4 shadow-lg">
                    Habilitar Cuenta
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* DIALOG: HISTORIAL / ESTADO DE CUENTA */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl p-0 rounded-[3rem] overflow-hidden border-none shadow-2xl bg-card">
          <div className="p-10 border-b border-border bg-muted/20 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/20">
                <Building className="h-7 w-7" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black uppercase tracking-tighter">Estado de Cuenta</DialogTitle>
                <p className="font-bold text-primary uppercase tracking-widest">{selectedAccount?.nombre}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Saldo Disponible</p>
              <p className="text-4xl font-black text-emerald-600 tracking-tighter">
                ${(processedHistory.length > 0 
                    ? processedHistory[0].saldoCalculado 
                    : Number(activeAccount?.saldoActual || activeAccount?.saldoInicial || 0)
                  ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="p-8">
            <div className="rounded-2xl border border-border overflow-hidden">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase py-4 pl-6">Fecha</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Concepto / Referencia</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-right text-red-600">Debe</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-right text-emerald-600">Haber</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-right pr-6">Saldo</TableHead>
                      {isAdmin && <TableHead className="w-10 pr-6"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLoading ? (
                      <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="h-40 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/30" /></TableCell></TableRow>
                    ) : processedHistory.map((tx) => (
                      <TableRow key={tx.id} className="border-b border-border hover:bg-muted/5 transition-colors">
                        <TableCell className="pl-6 py-4 text-xs font-medium text-muted-foreground">
                          {tx.fecha?.toDate ? format(tx.fecha.toDate(), "dd/MM/yy HH:mm") : "---"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-black uppercase text-foreground">{tx.concepto}</span>
                            <span className="text-[10px] font-bold text-muted-foreground">Doc: {tx.numeroDocumento || 'S/N'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {tx.tipo !== 'Deposito' ? (
                            <span className="flex items-center justify-end gap-1 font-black text-sm text-red-500">
                              <ArrowDownLeft className="h-3.5 w-3.5" />
                              ${tx.monto.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {tx.tipo === 'Deposito' ? (
                            <span className="flex items-center justify-end gap-1 font-black text-sm text-emerald-600">
                              <ArrowUpRight className="h-3.5 w-3.5" />
                              ${tx.monto.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        <TableCell className={cn("text-right font-bold text-xs text-foreground", !isAdmin && "pr-6")}>
                          ${(tx.saldoCalculado !== undefined ? tx.saldoCalculado : (tx.saldoPosterior || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="pr-4 py-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteTransaction(tx)}
                              className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {processedHistory.length === 0 && !historyLoading && (
                      <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="h-32 text-center text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest italic">Sin movimientos registrados</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>

          <div className="p-8 pt-0 flex justify-end gap-3">
             <Button 
               variant="outline" 
               onClick={handleExportPDF} 
               className="rounded-xl font-bold uppercase text-[10px] h-10 px-6 gap-2 border-border text-foreground hover:bg-muted active:scale-95 transition-all shadow-sm"
             >
                <Printer className="h-4 w-4 text-primary" /> Exportar PDF
             </Button>
             <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="rounded-xl font-bold uppercase text-[10px] h-10 px-6">
                Cerrar
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: REGISTRAR MOVIMIENTO */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="max-w-xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-card">
          <form onSubmit={handleRegisterTransaction}>
            <div className="p-8 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <ArrowRightLeft className="h-6 w-6" />
                </div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Registro de Movimiento</DialogTitle>
              </div>
              <button type="button" onClick={() => setIsRegisterOpen(false)} className="text-white/60 hover:text-white transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-10 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Cuenta Origen / Destino</Label>
                  <Select value={txForm.accountId} onValueChange={v => setTxForm({...txForm, accountId: v})}>
                    <SelectTrigger className="erp-input h-11 font-bold">
                      <SelectValue placeholder="Elija una cuenta..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl shadow-2xl">
                      {accounts.map(a => <SelectItem key={a.id} value={a.id} className="uppercase font-bold text-xs">{a.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Tipo de Operación</Label>
                  <Select value={txForm.tipo} onValueChange={v => setTxForm({...txForm, tipo: v})}>
                    <SelectTrigger className="erp-input h-11 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl shadow-2xl">
                      <SelectItem value="Deposito" className="text-emerald-600 font-black">(+) DEPÓSITO / ENTRADA</SelectItem>
                      <SelectItem value="Retiro" className="text-red-600 font-black">(-) RETIRO / SALIDA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Monto ($)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00"
                    value={txForm.monto}
                    onChange={e => setTxForm({...txForm, monto: e.target.value})}
                    className="erp-input h-14 text-2xl font-black text-primary text-center" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Número de Documento</Label>
                  <Input 
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    placeholder="CHQ-1234 / REF-..."
                    value={txForm.numeroDocumento}
                    onChange={e => setTxForm({...txForm, numeroDocumento: e.target.value})}
                    className="erp-input h-14 font-black text-center" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Concepto / Glosa</Label>
                <Input 
                  type="text"
                  autoComplete="on"
                  autoCorrect="on"
                  spellCheck={true}
                  autoCapitalize="sentences"
                  placeholder="MOTIVO DEL MOVIMIENTO BANCARIO..."
                  value={txForm.concepto}
                  onChange={e => setTxForm({...txForm, concepto: e.target.value})}
                  className="erp-input h-12 font-bold" 
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Fecha Operación</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-11 erp-input bg-background justify-start text-left font-bold text-xs rounded-xl">
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />
                      {txDate ? format(txDate, "dd/MM/yyyy HH:mm") : "Elegir fecha..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start">
                    <Calendar
                      mode="single"
                      selected={txDate}
                      onSelect={(d) => d && setTxForm({...txForm, fecha: d})}
                      locale={es}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <DialogFooter className="pt-6 border-t border-border gap-3">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsRegisterOpen(false)}
                  className="flex-1 rounded-xl h-14 font-black uppercase text-xs"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={processing}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl h-14 font-black uppercase text-xs shadow-xl shadow-primary/20"
                >
                  {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar Movimiento"}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG: ELIMINAR CUENTA */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 bg-card border-none shadow-2xl">
          <AlertDialogHeader className="items-center text-center">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight">Anular Cuenta Maestro</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium">
              ¿Estás seguro de eliminar la cuenta <strong>{accountToDelete?.nombre}</strong>? 
              Esta acción es irreversible y eliminará todo el historial de transacciones asociado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel className="flex-1 rounded-xl h-12 font-bold uppercase text-[10px] tracking-widest border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAccount}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-red-600/20"
            >
              Eliminar Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
