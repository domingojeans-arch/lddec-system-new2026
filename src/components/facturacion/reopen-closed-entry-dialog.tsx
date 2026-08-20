"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, RotateCcw, ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp, limit } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";

interface ReopenClosedEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onSuccess?: () => void;
}

export function ReopenClosedEntryDialog({
  isOpen,
  onClose,
  user,
  onSuccess
}: ReopenClosedEntryDialogProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  
  const [foundEntry, setFoundEntry] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [existingInvoiceInfo, setExistingInvoiceInfo] = useState<string | null>(null);

  const handleSearch = async () => {
    const rawTerm = searchTerm.trim().toUpperCase();
    if (!rawTerm) return;

    setLoading(true);
    setValidationError(null);
    setFoundEntry(null);
    setExistingInvoiceInfo(null);

    try {
      let entryDoc: any = null;
      let entryData: any = null;

      // 1. Buscar en entries por entryNumber o numeroIngreso o ID
      const qVariants = [
        query(collection(db, "entries"), where("entryNumber", "==", rawTerm), limit(1)),
        query(collection(db, "entries"), where("numeroIngreso", "==", rawTerm), limit(1))
      ];

      for (const q of qVariants) {
        const snap = await getDocs(q);
        if (!snap.empty) {
          entryDoc = snap.docs[0];
          entryData = entryDoc.data();
          break;
        }
      }

      if (!entryDoc) {
        const entryRef = doc(db, "entries", rawTerm);
        const entrySnap = await getDoc(entryRef);
        if (entrySnap.exists()) {
          entryDoc = entrySnap;
          entryData = entrySnap.data();
        }
      }

      if (!entryDoc) {
        setValidationError(`No se encontró ningún ingreso registrado con el número "${rawTerm}". Verifique el número e intente nuevamente.`);
        setLoading(false);
        return;
      }

      const entryId = entryDoc.id;
      const visibleNum = entryData.entryNumber || entryData.numeroIngreso || entryId;

      // 2. VALIDACIÓN MANDATORIA: Verificar si ya existe factura registrada en `facturas` para este ingreso
      const qFacturas = collection(db, "facturas");
      const facturasSnap = await getDocs(qFacturas);
      
      const linkedInvoice = facturasSnap.docs.find(d => {
        const dData = d.data();
        const refId = String(dData.ingresoMaestroId || "").toUpperCase();
        const refs = Array.isArray(dData.ingresoMaestroIds) 
          ? dData.ingresoMaestroIds.map(id => String(id).toUpperCase()) 
          : [];
        return refId === String(entryId).toUpperCase() || 
               refId === visibleNum.toUpperCase() || 
               refs.includes(String(entryId).toUpperCase()) || 
               refs.includes(visibleNum.toUpperCase());
      });

      const isBilledInField = entryData.estadoFacturacion === "FACTURADO" || 
        (entryData.numeroFactura && entryData.numeroFactura !== "-" && entryData.numeroFactura !== "Cerrada sin facturar" && entryData.numeroFactura !== "Cierre Admin.");

      if (linkedInvoice || isBilledInField) {
        const invNum = linkedInvoice ? (linkedInvoice.data().numeroFactura || linkedInvoice.id) : (entryData.numeroFactura || "FACTURADO");
        const invDate = linkedInvoice?.data()?.fechaFactura?.toDate 
          ? linkedInvoice.data().fechaFactura.toDate().toLocaleDateString('es-EC') 
          : "";

        setExistingInvoiceInfo(`BLOQUEO DE SEGURIDAD: El ingreso ${visibleNum} ya cuenta con la Factura Nº ${invNum}${invDate ? ` emitida el ${invDate}` : ''}. No se permite reabrir un ingreso que ya tiene una factura vinculada o registrada en el sistema.`);
        setLoading(false);
        return;
      }

      // 3. Verificar que esté en estado "Cerrada sin facturar"
      const isClosedUnbilled = entryData.status === "closed_unbilled" || 
                               String(entryData.estadoFacturacion || "").toUpperCase() === "CERRADA SIN FACTURAR" || 
                               entryData.isClosedUnbilled === true;

      if (!isClosedUnbilled) {
        setValidationError(`El ingreso ${visibleNum} se encuentra actualmente en estado "${entryData.estadoFacturacion || entryData.status || 'Activo'}". Solo se pueden reabrir ingresos en estado "Cerrada sin facturar".`);
        setLoading(false);
        return;
      }

      // Validación exitosa
      setFoundEntry({
        id: entryId,
        visibleNum,
        ...entryData
      });

    } catch (error) {
      console.error("Error al buscar ingreso para reabrir:", error);
      setValidationError("Ocurrió un error al consultar la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReopen = async () => {
    if (!foundEntry) return;

    setIsReopening(true);
    try {
      const reabiertoPor = user?.displayName || user?.email || "Administrador";
      const reabiertoPorUid = user?.uid || "";
      const fechaActualIso = new Date().toISOString();

      const auditoriaPrevia = Array.isArray(foundEntry.historialAuditoriaFacturacion) 
        ? foundEntry.historialAuditoriaFacturacion 
        : [];

      const eventoAuditoria = {
        evento: "REAPERTURA_PARA_FACTURAR",
        fechaReaperturaIso: fechaActualIso,
        reabiertoPor,
        reabiertoPorUid,
        cierrePrevio: {
          cerradoPor: foundEntry.cerradoPor || "N/A",
          cerradoPorUid: foundEntry.cerradoPorUid || "",
          fechaCierre: foundEntry.fechaCierreIso || foundEntry.fechaCierre || "N/A",
          motivoCierre: foundEntry.motivoCierre || "N/A"
        }
      };

      const entryRef = doc(db, "entries", foundEntry.id);
      await updateDoc(entryRef, {
        status: "active",
        estadoFacturacion: "PENDIENTE",
        isClosedUnbilled: false,
        fueCerradoSinFactura: true,
        historialAuditoriaFacturacion: [...auditoriaPrevia, eventoAuditoria],
        updatedAt: serverTimestamp()
      });

      toast({
        title: "Ingreso Reabierto Exitosamente",
        description: `El ingreso ${foundEntry.visibleNum} ahora está disponible entre los pendientes para facturar.`
      });

      if (onSuccess) onSuccess();
      setFoundEntry(null);
      setSearchTerm("");
      onClose();
    } catch (error) {
      console.error("Error al reabrir ingreso:", error);
      toast({
        variant: "destructive",
        title: "Error de Reapertura",
        description: "No se pudo reabrir el ingreso seleccionado."
      });
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl rounded-3xl p-8 bg-card border border-border shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <RotateCcw className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Reabrir Ingreso para Facturar</DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground">
                Recupera un ingreso cerrado sin factura para permitir su facturación normal.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* BÚSQUEDA DE INGRESO */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-foreground">
              Buscar por Nº de Ingreso o Muestra:
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Ejemplo: MUEST-1566 o 4825"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
                className="erp-input h-12 flex-1 text-sm uppercase font-bold"
              />
              <Button 
                type="button" 
                onClick={handleSearch} 
                disabled={loading || !searchTerm.trim()} 
                className="h-12 px-6 rounded-xl font-bold bg-primary text-white hover:bg-primary/90"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Buscar
              </Button>
            </div>
          </div>

          {/* ALERTA DE FACTURA EXISTENTE (REGLA MANDATORIA) */}
          {existingInvoiceInfo && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-red-600 font-black text-sm uppercase">
                <ShieldAlert className="h-5 w-5 flex-shrink-0" />
                <span>Bloqueo de Seguridad</span>
              </div>
              <p className="text-xs font-semibold text-red-700 dark:text-red-300 leading-relaxed">
                {existingInvoiceInfo}
              </p>
            </div>
          )}

          {/* ALERTA DE ERROR GENERAL */}
          {validationError && !existingInvoiceInfo && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 animate-in fade-in">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 leading-relaxed">
                {validationError}
              </p>
            </div>
          )}

          {/* VISTA PREVIA DEL INGRESO ENCONTRADO */}
          {foundEntry && (
            <div className="p-6 rounded-2xl bg-muted/30 border border-border space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h4 className="text-lg font-black uppercase text-foreground">Ingreso #{foundEntry.visibleNum}</h4>
                  <p className="text-xs font-bold text-muted-foreground uppercase">{foundEntry.clientName || foundEntry.nombreCliente || "Cliente General"}</p>
                </div>
                <Badge className="bg-amber-500/10 text-amber-600 border-none font-black text-[10px] uppercase px-3 py-1">
                  Cerrada sin facturar
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-black uppercase text-muted-foreground block">Cerrado Por:</span>
                  <span className="font-bold text-foreground uppercase">{foundEntry.cerradoPor || "Administrador"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-muted-foreground block">Fecha de Cierre:</span>
                  <span className="font-bold text-foreground">
                    {foundEntry.fechaCierreIso ? new Date(foundEntry.fechaCierreIso).toLocaleString('es-EC') : "N/D"}
                  </span>
                </div>
              </div>

              {foundEntry.motivoCierre && (
                <div className="p-3 rounded-xl bg-background border border-border text-xs">
                  <span className="text-[10px] font-black uppercase text-muted-foreground block mb-1">Motivo de Cierre Original:</span>
                  <p className="italic text-muted-foreground font-medium">"{foundEntry.motivoCierre}"</p>
                </div>
              )}

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>Al reabrir, este ingreso se quitará del cierre administrativo y aparecerá entre los pendientes por facturar. No se modificará ningún lote ni dato histórico.</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose} 
            disabled={isReopening}
            className="rounded-xl font-bold text-xs"
          >
            Cancelar
          </Button>

          {foundEntry && (
            <Button
              type="button"
              onClick={handleConfirmReopen}
              disabled={isReopening}
              className="rounded-xl font-bold text-xs bg-amber-600 text-white hover:bg-amber-700"
            >
              {isReopening ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Reabrir para facturar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
