"use client";

import React, { useState, useEffect } from "react";
import { 
  Building, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Eye, 
  Trash2, 
  Wallet, 
  Loader2, 
  Calendar as CalendarIcon,
  Printer,
  ArrowRightLeft,
  X,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  deleteDoc
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
  const isAdmin = user?.role === "administrador";
  const isContador = user?.role === "contador";
  const isReadOnly = user?.role === "socio";
  const cannotEdit = isContador || isReadOnly;
  
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

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
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
    if (!accountToDelete || !isAdmin) return;
    try {
      await deleteDoc(doc(db, "cuentas_bancarias", accountToDelete.id));
      toast({ title: "Cuenta Eliminada", description: "El registro ha sido removido del sistema." });
      setIsDeleteOpen(false);
      setAccountToDelete(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
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

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-5xl font-black tracking-tighter uppercase">Bancos y Cajas</h1>
          <p className="text-primary text-xs font-black uppercase tracking-[0.3em]">
            Gestión de Disponibilidad {cannotEdit && "(MODO LECTURA)"}
          </p>
        </div>
        {!cannotEdit && (
          <div className="flex gap-3">
            <Button 
              onClick={() => setIsRegisterOpen(true)} 
              className="bg-primary hover:bg-primary/90 text-white font-black uppercase h-12 px-8 rounded-xl shadow-xl transition-all active:scale-95"
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Registrar Movimiento
            </Button>
          </div>
        )}
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
                {accounts.map((acc) => (
                  <TableRow key={acc.id} className="border-b border-border hover:bg-muted/10 transition-colors group">
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
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 rounded-full hover:bg-red-50 hover:text-red-600"
                            onClick={() => { setAccountToDelete(acc); setIsDeleteOpen(true); }}
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {accounts.length === 0 && (
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
                      placeholder="EJ: BCO. PICHINCHA - CORRIENTE" 
                      value={accForm.nombre} 
                      onChange={e => setAccForm({...accForm, nombre: e.target.value.toUpperCase()})} 
                      className="erp-input h-11 font-bold" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                ${(selectedAccount?.saldoActual || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                      <TableHead className="text-[10px] font-black uppercase text-right">Monto</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-right pr-6">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLoading ? (
                      <TableRow><TableCell colSpan={4} className="h-40 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/30" /></TableCell></TableRow>
                    ) : history.map((tx) => (
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
                          <div className={cn(
                            "flex items-center justify-end gap-1.5 font-black text-sm",
                            tx.tipo === 'Deposito' ? "text-emerald-600" : "text-red-500"
                          )}>
                            {tx.tipo === 'Deposito' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownLeft className="h-3.5 w-3.5" />}
                            ${tx.monto.toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6 font-bold text-xs text-foreground">
                          ${tx.saldoPosterior?.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {history.length === 0 && !historyLoading && (
                      <TableRow><TableCell colSpan={4} className="h-32 text-center text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest italic">Sin movimientos registrados</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>

          <div className="p-8 pt-0 flex justify-end gap-3">
             <Button variant="outline" className="rounded-xl font-bold uppercase text-[10px] h-10 px-6 gap-2 border-border text-muted-foreground">
                <Printer className="h-4 w-4" /> Exportar PDF
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
                    placeholder="CHQ-1234 / REF-..."
                    value={txForm.numeroDocumento}
                    onChange={e => setTxForm({...txForm, numeroDocumento: e.target.value.toUpperCase()})}
                    className="erp-input h-14 font-black text-center" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Concepto / Glosa</Label>
                <Input 
                  placeholder="MOTIVO DEL MOVIMIENTO BANCARIO..."
                  value={txForm.concepto}
                  onChange={e => setTxForm({...txForm, concepto: e.target.value.toUpperCase()})}
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
