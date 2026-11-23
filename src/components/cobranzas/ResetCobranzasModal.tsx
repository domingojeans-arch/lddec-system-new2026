"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  RotateCcw,
  AlertTriangle,
  Calendar,
  DollarSign,
  Loader2,
  Users,
  CheckCircle2,
  Trash2
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
  query,
  where
} from "firebase/firestore";
import { toDate } from "@/lib/toDate";
import { formatClientName } from "@/lib/format-name";
import { useToast } from "@/hooks/use-toast";

interface ResetCobranzasModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: any;
  allClients?: any[];
  onSuccess?: () => void;
}

const MONTH_NAMES = [
  { id: "01", name: "Enero" },
  { id: "02", name: "Febrero" },
  { id: "03", name: "Marzo" },
  { id: "04", name: "Abril" },
  { id: "05", name: "Mayo" },
  { id: "06", name: "Junio" },
  { id: "07", name: "Julio" },
  { id: "08", name: "Agosto" },
  { id: "09", name: "Septiembre" },
  { id: "10", name: "Octubre" },
  { id: "11", name: "Noviembre" },
  { id: "12", name: "Diciembre" }
];

export function ResetCobranzasModal({
  isOpen,
  onClose,
  client,
  allClients = [],
  onSuccess
}: ResetCobranzasModalProps) {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [includeFamily, setIncludeFamily] = useState<boolean>(true);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Almacenar cobranzas encontradas para estadísticas por mes
  const [foundPayments, setFoundPayments] = useState<any[]>([]);

  // Resolver grupo familiar del cliente
  const familyGroup = useMemo(() => {
    if (!client) return [];
    const rootId = client.parentClientId || client.id;
    return allClients.filter(c => c.id === rootId || c.parentClientId === rootId || (client.parentClientId && c.id === client.parentClientId));
  }, [client, allClients]);

  const targetClients = useMemo(() => {
    if (!client) return [];
    if (includeFamily && familyGroup.length > 1) {
      return familyGroup;
    }
    return [client];
  }, [client, includeFamily, familyGroup]);

  // Cargar estadísticas de cobranzas existentes por mes
  useEffect(() => {
    if (!isOpen || !client || !db) return;

    let isMounted = true;
    const fetchPaymentsStats = async () => {
      setLoadingStats(true);
      try {
        const targetIds = targetClients.map(c => c.id);
        const targetNames = targetClients.flatMap(c => [
          c.name,
          c.nombre,
          formatClientName(c.name, c.firstName, c.lastName),
          `${c.firstName || ""} ${c.lastName || ""}`.trim(),
          `${c.lastName || ""} ${c.firstName || ""}`.trim()
        ].filter(Boolean).map(s => String(s).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")));

        const [pSnap, fSnap] = await Promise.all([
          getDocs(collection(db, "payments")),
          getDocs(collection(db, "facturas"))
        ]);

        const paymentsList: any[] = [];
        const seenKeys = new Set<string>();

        // 1. Pagos de la colección 'payments'
        pSnap.docs.forEach(d => {
          const data = d.data();
          const cid = data.clientId || data.clienteId;
          const cname = String(data.clienteNombre || data.clientName || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
          const matches = targetIds.includes(cid) || targetNames.some(tn => tn && (tn.includes(cname) || cname.includes(tn)));
          if (matches) {
            const pDate = toDate(data.fechaTransaccion || data.fecha || data.createdAt);
            if (pDate) {
              const key = `pay_${d.id}`;
              seenKeys.add(key);
              paymentsList.push({
                id: d.id,
                source: "payments",
                docId: d.id,
                monto: Number(data.monto || 0),
                fecha: pDate,
                year: pDate.getFullYear().toString(),
                month: String(pDate.getMonth() + 1).padStart(2, "0"),
                facturaId: data.facturaId || "",
                numeroFactura: data.numeroFactura || "",
                clienteId: cid
              });
            }
          }
        });

        // 2. Pagos embebidos en facturas
        fSnap.docs.forEach(d => {
          const inv = d.data();
          const cid = inv.clientId || inv.clienteId;
          const cname = String(inv.clienteNombre || inv.clientName || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
          const matches = targetIds.includes(cid) || targetNames.some(tn => tn && (tn.includes(cname) || cname.includes(tn)));
          if (matches) {
            const pagos = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : []);
            pagos.forEach((p: any, idx: number) => {
              if (p && !p.anulado) {
                const pDate = toDate(p.fechaTransaccion || p.fecha || p.createdAt);
                if (pDate) {
                  const key = `inv_${d.id}_${p.id || idx}`;
                  if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    paymentsList.push({
                      id: p.id || `${d.id}_${idx}`,
                      source: "factura",
                      docId: d.id,
                      monto: Number(p.monto || 0),
                      fecha: pDate,
                      year: pDate.getFullYear().toString(),
                      month: String(pDate.getMonth() + 1).padStart(2, "0"),
                      facturaId: d.id,
                      numeroFactura: inv.numeroFactura || "",
                      clienteId: cid
                    });
                  }
                }
              }
            });
          }
        });

        // 3. Pagos de Saldo Inicial en cliente
        targetClients.forEach(tc => {
          const pagosSI = Array.isArray(tc.pagosSaldoInicial) ? tc.pagosSaldoInicial : [];
          pagosSI.forEach((p: any, idx: number) => {
            if (p && !p.anulado) {
              const pDate = toDate(p.fechaTransaccion || p.fecha || p.createdAt);
              if (pDate) {
                const key = `si_${tc.id}_${p.id || idx}`;
                if (!seenKeys.has(key)) {
                  seenKeys.add(key);
                  paymentsList.push({
                    id: p.id || `${tc.id}_si_${idx}`,
                    source: "saldoInicial",
                    docId: tc.id,
                    monto: Number(p.monto || 0),
                    fecha: pDate,
                    year: pDate.getFullYear().toString(),
                    month: String(pDate.getMonth() + 1).padStart(2, "0"),
                    facturaId: "INITIAL_BALANCE_2026",
                    numeroFactura: "SALDO INICIAL",
                    clienteId: tc.id
                  });
                }
              }
            }
          });
        });

        if (isMounted) {
          setFoundPayments(paymentsList);
        }
      } catch (err) {
        console.error("Error cargando estadísticas de cobranzas:", err);
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    };

    fetchPaymentsStats();

    return () => {
      isMounted = false;
    };
  }, [isOpen, client, targetClients]);

  // Resumen de cobros por mes para el año seleccionado
  const monthStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {};
    MONTH_NAMES.forEach(m => {
      stats[m.id] = { count: 0, total: 0 };
    });

    foundPayments.forEach(p => {
      if (p.year === selectedYear && stats[p.month]) {
        stats[p.month].count += 1;
        stats[p.month].total += p.monto;
      }
    });

    return stats;
  }, [foundPayments, selectedYear]);

  // Meses que tienen cobranzas en el año seleccionado
  const monthsWithPayments = useMemo(() => {
    return MONTH_NAMES.filter(m => (monthStats[m.id]?.count || 0) > 0).map(m => m.id);
  }, [monthStats]);

  const handleToggleMonth = (monthId: string) => {
    setSelectedMonths(prev =>
      prev.includes(monthId) ? prev.filter(id => id !== monthId) : [...prev, monthId]
    );
  };

  const handleSelectAllWithPayments = () => {
    if (selectedMonths.length === monthsWithPayments.length && monthsWithPayments.length > 0) {
      setSelectedMonths([]);
    } else {
      setSelectedMonths([...monthsWithPayments]);
    }
  };

  // Conteo y total de las cobranzas que se van a eliminar
  const selectedDeletionSummary = useMemo(() => {
    const toDelete = foundPayments.filter(p => p.year === selectedYear && selectedMonths.includes(p.month));
    const totalMonto = toDelete.reduce((acc, p) => acc + p.monto, 0);
    return {
      count: toDelete.length,
      totalMonto
    };
  }, [foundPayments, selectedYear, selectedMonths]);

  // Ejecución del reinicio de cobranzas
  const handleExecuteReset = async () => {
    if (selectedMonths.length === 0) {
      toast({
        variant: "destructive",
        title: "Selecciona al menos un mes",
        description: "Debes seleccionar qué mes o meses deseas reiniciar."
      });
      return;
    }

    setIsProcessing(true);

    try {
      const targetIds = targetClients.map(c => c.id);
      const targetNames = targetClients.flatMap(c => [
        c.name,
        c.nombre,
        formatClientName(c.name, c.firstName, c.lastName),
        `${c.firstName || ""} ${c.lastName || ""}`.trim(),
        `${c.lastName || ""} ${c.firstName || ""}`.trim()
      ].filter(Boolean).map(s => String(s).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")));

      const monthsToMatch = selectedMonths.map(m => `${selectedYear}-${m}`);

      let batch = writeBatch(db);
      let batchCount = 0;
      let totalDeletedPayments = 0;
      let totalUpdatedInvoices = 0;
      let totalUpdatedClients = 0;

      // 1. Eliminar documentos en colección 'payments'
      const pSnap = await getDocs(collection(db, "payments"));
      pSnap.docs.forEach(pDoc => {
        const data = pDoc.data();
        const cid = data.clientId || data.clienteId;
        const cname = String(data.clienteNombre || data.clientName || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        const matches = targetIds.includes(cid) || targetNames.some(tn => tn && (tn.includes(cname) || cname.includes(tn)));

        if (matches) {
          const pDate = toDate(data.fechaTransaccion || data.fecha || data.createdAt);
          if (pDate) {
            const y = pDate.getFullYear().toString();
            const m = String(pDate.getMonth() + 1).padStart(2, "0");
            const key = `${y}-${m}`;
            if (monthsToMatch.includes(key)) {
              batch.delete(doc(db, "payments", pDoc.id));
              batchCount++;
              totalDeletedPayments++;
            }
          }
        }
      });

      // 2. Limpiar facturas (pagosYajustes / pagosAjustes) y restaurar saldos
      const fSnap = await getDocs(collection(db, "facturas"));
      for (const fDoc of fSnap.docs) {
        const inv = fDoc.data();
        const cid = inv.clientId || inv.clienteId;
        const cname = String(inv.clienteNombre || inv.clientName || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        const matches = targetIds.includes(cid) || targetNames.some(tn => tn && (tn.includes(cname) || cname.includes(tn)));

        if (matches) {
          const pagos = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : []);
          
          let hadDeletion = false;
          const remainingPagos = pagos.filter((p: any) => {
            if (!p) return false;
            const pDate = toDate(p.fechaTransaccion || p.fecha || p.createdAt);
            if (!pDate) return true;
            const y = pDate.getFullYear().toString();
            const m = String(pDate.getMonth() + 1).padStart(2, "0");
            const key = `${y}-${m}`;
            if (monthsToMatch.includes(key)) {
              hadDeletion = true;
              return false; // Eliminar este pago
            }
            return true;
          });

          if (hadDeletion) {
            // Recalcular saldo de la factura con los pagos restantes
            const totalAbonado = remainingPagos.reduce((acc: number, p: any) => {
              if (p.anulado) return acc;
              return p.tipoTransaccion === "Reverso" ? acc - Number(p.monto || 0) : acc + Number(p.monto || 0);
            }, 0);

            const originalTotal = Number(inv.totalFactura || inv.total || 0);
            const nuevoSaldo = Math.max(0, originalTotal - totalAbonado);
            let nuevoEstado = "Por Cobrar";
            if (nuevoSaldo <= 0.01) nuevoEstado = "Pagada";
            else if (totalAbonado > 0) nuevoEstado = "Parcialmente Cobrada";

            batch.update(doc(db, "facturas", fDoc.id), {
              pagosYajustes: remainingPagos,
              pagosAjustes: remainingPagos,
              saldoPendiente: nuevoSaldo,
              saldo: nuevoSaldo,
              estadoCobranza: nuevoEstado,
              estado: nuevoEstado,
              updatedAt: serverTimestamp()
            });

            batchCount++;
            totalUpdatedInvoices++;

            if (batchCount >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
            }
          }
        }
      }

      // 3. Limpiar pagosSaldoInicial de cada cliente afectado
      for (const tc of targetClients) {
        const cRef = doc(db, "clients", tc.id);
        const pagosSI = Array.isArray(tc.pagosSaldoInicial) ? tc.pagosSaldoInicial : [];
        let hadSIDeletion = false;

        const remainingSI = pagosSI.filter((p: any) => {
          if (!p) return false;
          const pDate = toDate(p.fechaTransaccion || p.fecha || p.createdAt);
          if (!pDate) return true;
          const y = pDate.getFullYear().toString();
          const m = String(pDate.getMonth() + 1).padStart(2, "0");
          const key = `${y}-${m}`;
          if (monthsToMatch.includes(key)) {
            hadSIDeletion = true;
            return false;
          }
          return true;
        });

        if (hadSIDeletion) {
          batch.update(cRef, {
            pagosSaldoInicial: remainingSI,
            updatedAt: serverTimestamp()
          });
          batchCount++;
          totalUpdatedClients++;

          if (batchCount >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      toast({
        title: "Cobranzas Reiniciadas con Éxito",
        description: `Se eliminaron las cobranzas de ${selectedMonths.length} mes(es) y se restauraron los saldos de ${totalUpdatedInvoices} factura(s).`
      });

      setSelectedMonths([]);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Error al reiniciar cobranzas:", err);
      toast({
        variant: "destructive",
        title: "Error al reiniciar cobranzas",
        description: err.message || "Ocurrió un error al actualizar la base de datos."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const clientFormattedName = client ? formatClientName(client.name, client.firstName, client.lastName) : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isProcessing) onClose(); }}>
      <DialogContent className="max-w-xl bg-card border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-black uppercase tracking-tight text-foreground">
                  Reiniciar Cobranzas por Mes
                </DialogTitle>
                <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-none text-[8px] font-black uppercase">
                  Solo Administradores
                </Badge>
              </div>
              <DialogDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
                Cliente: <strong className="text-foreground">{clientFormattedName}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Grupo Familiar si aplica */}
        {familyGroup.length > 1 && (
          <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Users className="h-4 w-4 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold text-blue-900 dark:text-blue-300">Cuenta Familiar Vinculada</span>
                <p className="text-[10px] text-blue-700/80 dark:text-blue-400">
                  {familyGroup.map(m => formatClientName(m.name, m.firstName, m.lastName)).join(" • ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-family"
                checked={includeFamily}
                onCheckedChange={(checked) => setIncludeFamily(Boolean(checked))}
              />
              <Label htmlFor="include-family" className="text-[10px] font-bold uppercase cursor-pointer">
                Incluir Familia
              </Label>
            </div>
          </div>
        )}

        {/* Selector de Año y Acciones Rápidas */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase">Año:</span>
            <Select value={selectedYear} onValueChange={(val) => { setSelectedYear(val); setSelectedMonths([]); }}>
              <SelectTrigger className="w-28 h-9 rounded-xl font-bold text-xs">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSelectAllWithPayments}
            disabled={monthsWithPayments.length === 0}
            className="text-[10px] font-bold uppercase text-primary hover:text-primary/80 h-8 px-2"
          >
            {selectedMonths.length === monthsWithPayments.length && monthsWithPayments.length > 0
              ? "Deseleccionar Todos"
              : "Seleccionar Meses con Cobros"}
          </Button>
        </div>

        {/* Cuadrícula de Meses */}
        {loadingStats ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Consultando cobranzas registradas...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
            {MONTH_NAMES.map((m) => {
              const stat = monthStats[m.id] || { count: 0, total: 0 };
              const isChecked = selectedMonths.includes(m.id);
              const hasPayments = stat.count > 0;

              return (
                <div
                  key={m.id}
                  onClick={() => handleToggleMonth(m.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 select-none ${
                    isChecked
                      ? "border-amber-500 bg-amber-500/10 shadow-sm"
                      : hasPayments
                      ? "border-border bg-card hover:border-primary/40"
                      : "border-border/40 opacity-60 bg-muted/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-foreground">{m.name}</span>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleToggleMonth(m.id)}
                      className="rounded-md"
                    />
                  </div>
                  <div>
                    {hasPayments ? (
                      <div className="flex items-center justify-between text-[10px] font-bold text-amber-700 dark:text-amber-400">
                        <span>{stat.count} cobro{stat.count > 1 ? "s" : ""}</span>
                        <span>${stat.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ) : (
                      <span className="text-[9px] text-muted-foreground uppercase font-medium">Sin cobros</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Alerta de advertencia del impacto */}
        <div className="p-4 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-900/40 rounded-2xl space-y-1.5 text-amber-900 dark:text-amber-300 text-xs">
          <div className="flex items-center gap-2 font-bold uppercase text-[11px]">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Impacto de esta operación</span>
          </div>
          <p className="text-[10px] leading-relaxed">
            Se <strong>eliminarán {selectedDeletionSummary.count} cobranza(s)</strong> de los meses seleccionados (por un total de <strong>${selectedDeletionSummary.totalMonto.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>).
            Los saldos pendientes de las facturas afectadas volverán a su estado anterior para que puedas ingresar los cobros correctamente.
          </p>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold uppercase text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleExecuteReset}
            disabled={isProcessing || selectedMonths.length === 0}
            className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold uppercase text-xs bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-lg shadow-amber-600/20"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Reiniciando Cobranzas...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Borrar Cobros Seleccionados ({selectedMonths.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
