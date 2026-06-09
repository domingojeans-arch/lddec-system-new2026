"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, ClipboardList, Edit3, ArrowUp, ArrowDown, ChevronsUpDown, Save, Trash2, ChevronLeft, ChevronRight, Loader2, AlertTriangle, ShieldAlert, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toDate } from "@/lib/toDate";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HandicraftsReviewTableProps {
  works: any[];
  onReview: (workId: string, status: 'aprobado' | 'rechazado' | 'pendiente', price?: number) => void;
  onUpdate?: (workId: string, data: any) => void;
  onDelete?: (workId: string) => void;
  isHistory?: boolean;
  sortKey?: string;
  sortDir?: string;
  onSort?: (key: string) => void;
}

export function HandicraftsReviewTable({ works, onReview, onUpdate, onDelete, isHistory, onSort, sortKey, sortDir }: HandicraftsReviewTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isReadOnly = user?.role === "socio";
  const canFullEdit = (user?.role === "administrador" || user?.role === "produccion") && !isReadOnly;
  
  const handleVolverAprobar = (workId: string) => {
    if (isReadOnly) return;
    onReview(workId, 'aprobado');
  };

  const handleVolverPendiente = (workId: string) => {
    if (isReadOnly) return;
    onReview(workId, 'pendiente');
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedWork, setSelectedWork] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [manualCatalog, setManualCatalog] = useState<string[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // MOTOR DE DETECCIÓN DE DUPLICADOS
  const duplicateAnalysis = useMemo(() => {
    const dupMap = new Map<string, number>();

    works.forEach(w => {
      if (w.estado !== 'pendiente') return; // Solo calcular duplicados para registros en la pestaña de PENDIENTES
      
      // FECHA, CLIENTE, MANUALIDAD, CANTIDAD, OPERARIO
      const key = `${w.fechaStr}-${w.clienteNombre}-${w.proceso}-${w.cantidad}-${w.operarioNombre}`.toUpperCase();
      dupMap.set(key, (dupMap.get(key) || 0) + 1);
    });

    return { dupMap };
  }, [works]);

  useEffect(() => {
    if (!db || !isDialogOpen) return;
    
    // VINCULACIÓN CON CATÁLOGO MAESTRO (LDDEC 1.6)
    const loadCatalogFromMaster = async () => {
      setLoadingCatalog(true);
      try {
        const q = query(collection(db, "catalogo_manualidades"), where("active", "==", true), orderBy("name", "asc"));
        const snap = await getDocs(q);
        setManualCatalog(snap.docs.map(d => d.data().name));
      } catch (e) {
        console.warn("Error cargando catálogo de manualidades:", e);
      } finally {
        setLoadingCatalog(false);
      }
    };

    loadCatalogFromMaster();
  }, [isDialogOpen]);

  const handleOpenEditDialog = (work: any) => {
    setSelectedWork(work);
    setEditForm({
      clienteNombre: work.clienteNombre || "",
      operarioNombre: work.operarioNombre || "",
      loteNumero: work.loteNumero || "",
      cantidad: work.cantidad || 0,
      tipoPrenda: work.tipoPrenda || "Adulto",
      especificacionPrenda: work.especificacionPrenda || "",
      precioUnitario: work.precioUnitario || 0,
      proceso: work.proceso || "",
      notes: work.notes || "",
      estado: work.estado || "pendiente",
      fechaStr: work.fechaStr || work.fecha || ""
    });
    setIsDialogOpen(true);
  };

  const handleSaveFullEdit = () => {
    if (!selectedWork || !onUpdate || isReadOnly) return;
    const qty = Number(editForm.cantidad) || 0;
    const price = Number(editForm.precioUnitario) || 0;
    const total = qty * price;
    
    // Recalcular propiedades de ordenamiento temporal para persistencia de filtros
    const dateParts = editForm.fechaStr.split("-");
    let newTimestamp = null;
    if (dateParts.length === 3) {
      // Forzar mediodía para evitar saltos de zona horaria
      const d = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]), 12, 0, 0);
      newTimestamp = Timestamp.fromDate(d);
    }

    const payload: any = { 
      ...editForm, 
      cantidad: qty, 
      precioUnitario: price, 
      total,
      loteNumero: String(editForm.loteNumero).toUpperCase().trim(),
      operarioNombre: String(editForm.operarioNombre).toUpperCase().trim(),
      proceso: String(editForm.proceso).toUpperCase().trim(),
      fecha: editForm.fechaStr,
      fechaStr: editForm.fechaStr,
      workDate: editForm.fechaStr
    };

    if (newTimestamp) {
      payload.createdAt = newTimestamp;
    }

    onUpdate(selectedWork.id, payload);
    toast({ title: "Registro actualizado correctamente", className: "bg-emerald-600 text-white border-none" });
    setIsDialogOpen(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xl transition-all">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead onClick={() => onSort?.("createdAt")} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-5 pl-8 cursor-pointer hover:bg-muted/80 transition-colors group">
                <div className="flex items-center">Fecha <SortIcon colKey="createdAt" /></div>
              </TableHead>
              <TableHead onClick={() => onSort?.("loteNumero")} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors group">
                <div className="flex items-center">Lote <SortIcon colKey="loteNumero" /></div>
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operario</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Manualidad</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Cant.</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">P. Unitario</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total</TableHead>
              {!isReadOnly && <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-8">Acción</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {works.length > 0 ? (
              works.map((work, idx) => {
                const subInfo = [work.tipoPrenda, work.especificacionPrenda].filter(Boolean).join(" - ");
                const dateObj = toDate(work.fecha || work.fechaStr || work.createdAt);
                const displayDate = dateObj ? dateObj.toLocaleDateString('es-EC') : "---";
                
                const dupKey = `${work.fechaStr}-${work.clienteNombre}-${work.proceso}-${work.cantidad}-${work.operarioNombre}`.toUpperCase();
                const isDuplicate = work.estado === 'pendiente' && (duplicateAnalysis.dupMap.get(dupKey) || 0) > 1;

                return (
                  <TableRow key={`${work.id}-${idx}`} className={cn("border-b border-border transition-colors relative group", isDuplicate ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20" : "hover:bg-muted/10")}>
                    <TableCell className="py-5 pl-8"><span className="text-xs text-muted-foreground font-medium">{displayDate}</span></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-primary">{work.loteNumero}</span>
                        {isDuplicate && <Badge variant="outline" className="h-4 px-1 text-[7px] font-black uppercase border-amber-500 text-amber-600 bg-amber-500/10">POSIBLE DUPLICADO</Badge>}
                      </div>
                    </TableCell>
                    <TableCell><span className="text-[10px] font-bold text-foreground uppercase truncate block max-w-[120px]">{work.clienteNombre}</span></TableCell>
                    <TableCell><span className="text-[10px] font-black text-muted-foreground uppercase">{work.operarioNombre}</span></TableCell>
                    <TableCell><div className="flex flex-col"><div className="font-bold text-[13px] uppercase text-foreground">{work.proceso || "S/D"}</div><div className="text-[11px] font-medium text-muted-foreground uppercase">{subInfo || "-"}</div></div></TableCell>
                    <TableCell className="text-center"><div className="flex flex-col items-center leading-tight"><span className="text-sm font-black text-foreground">{work.cantidad}</span>{work.loteOriginalCant !== undefined && <span className="text-[10px] text-primary/60 font-bold uppercase tracking-tighter mt-0.5">ORIGINAL: {work.loteOriginalCant}</span>}</div></TableCell>
                    <TableCell className="text-right"><span className="text-xs font-bold text-muted-foreground">{formatCurrency(work.precioUnitario || 0)}</span></TableCell>
                    <TableCell className="text-right"><span className="text-sm font-black text-emerald-600">{formatCurrency(work.total || 0)}</span></TableCell>
                    {!isReadOnly && (
                      <TableCell className="text-right pr-8">
                        <div className="flex items-center justify-end gap-2">
                          {!isHistory && (
                            <div className="flex gap-1 mr-2">
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-[10px] font-bold px-3 rounded-lg" onClick={() => onReview(work.id, 'aprobado')}>Aprobar</Button>
                              <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 h-8 text-[10px] font-bold px-3 rounded-lg" onClick={() => onReview(work.id, 'rechazado')}>Rechazar</Button>
                            </div>
                          )}
                          {work.estado === 'rechazado' && (
                            <div className="flex gap-1.5 mr-1 shrink-0">
                              <Button 
                                size="sm" 
                                className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 h-8 text-[10px] font-bold px-3 rounded-lg flex items-center gap-1 transition-colors" 
                                onClick={() => handleVolverAprobar(work.id)}
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Aprobar</span>
                              </Button>
                              <Button 
                                size="sm" 
                                className="bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 h-8 text-[10px] font-bold px-3 rounded-lg flex items-center gap-1 transition-colors" 
                                onClick={() => handleVolverPendiente(work.id)}
                              >
                                <Clock className="h-3.5 w-3.5" />
                                <span>Pendiente</span>
                              </Button>
                            </div>
                          )}
                          {(user?.displayName === 'EDGAR ADMIN' || user?.email === 'ugeofly@hotmail.com' || process.env.NODE_ENV === 'development') && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => handleOpenEditDialog(work)}><Edit3 className="h-3.5 w-3.5" /></Button>
                          )}
                          {onDelete && (user?.displayName === 'EDGAR ADMIN' || user?.email === 'ugeofly@hotmail.com' || process.env.NODE_ENV === 'development') && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors ml-1" 
                              onClick={() => onDelete(work.id)} 
                              title="Eliminar registro de lote de forma permanente"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            ) : (
              <TableRow><TableCell colSpan={isReadOnly ? 8 : 9} className="h-64 text-center"><div className="flex flex-col items-center justify-center space-y-4 opacity-20"><ClipboardList className="h-16 w-16" /><p className="text-sm font-black uppercase tracking-[0.3em]">Sin registros en esta categoría</p></div></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl rounded-[2rem] p-0 bg-card border-none shadow-premium-lg overflow-hidden">
          <DialogHeader className="p-6 pb-2 border-b border-border/50">
            <DialogTitle className="text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-3">
              <Edit3 className="h-5 w-5 text-primary" />
              Editor de Manualidad {isReadOnly && "(VISTA)"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Fecha</Label><Input readOnly={isReadOnly} type="date" value={editForm.fechaStr} onChange={e => setEditForm({...editForm, fechaStr: e.target.value})} className="erp-input h-9 text-xs font-bold" /></div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Socio Industrial</Label><Input readOnly={isReadOnly} value={editForm.clienteNombre} onChange={e => setEditForm({...editForm, clienteNombre: e.target.value.toUpperCase()})} className="erp-input h-9 text-xs font-bold" /></div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Operario</Label><Input readOnly={isReadOnly} value={editForm.operarioNombre} onChange={e => setEditForm({...editForm, operarioNombre: e.target.value.toUpperCase()})} className="erp-input h-9 text-xs font-bold" /></div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Lote</Label><Input readOnly={isReadOnly} value={editForm.loteNumero} onChange={e => setEditForm({...editForm, loteNumero: e.target.value.toUpperCase()})} className="erp-input h-9 text-xs font-black text-primary" /></div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">Manualidad</Label>
                <Select disabled={isReadOnly} value={editForm.proceso} onValueChange={v => setEditForm({...editForm, proceso: v})}>
                  <SelectTrigger className="erp-input h-9 text-xs font-bold bg-background"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                  <SelectContent className="rounded-xl shadow-2xl border-border z-[100]">
                    {loadingCatalog ? (
                      <div className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
                    ) : (
                      manualCatalog.map(p => (<SelectItem key={p} value={p} className="text-xs uppercase font-bold">{p}</SelectItem>))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Cantidad Real</Label><Input readOnly={isReadOnly} type="number" value={editForm.cantidad} onChange={e => setEditForm({...editForm, cantidad: parseInt(e.target.value) || 0})} className="erp-input h-9 text-sm font-black" /></div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase">P. Unitario ($)</Label><Input readOnly={isReadOnly} type="number" step="0.01" value={editForm.precioUnitario} onChange={e => setEditForm({...editForm, precioUnitario: parseFloat(e.target.value) || 0})} className="erp-input h-9 text-sm font-black text-emerald-600" /></div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase">Categoría</Label>
                <Select disabled={isReadOnly} value={editForm.tipoPrenda} onValueChange={v => setEditForm({...editForm, tipoPrenda: v})}>
                  <SelectTrigger className="erp-input h-9 text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Adulto" className="text-xs">Adulto</SelectItem><SelectItem value="Niño" className="text-xs">Niño</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Especificación</Label><Input readOnly={isReadOnly} value={editForm.especificacionPrenda} onChange={e => setEditForm({...editForm, especificacionPrenda: e.target.value.toUpperCase()})} className="erp-input h-9 text-xs font-bold" /></div>
            </div>
            <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex justify-between items-center"><p className="text-[9px] font-black uppercase text-primary">Total Resultante:</p><p className="text-lg font-black text-emerald-600">${(Number(editForm.cantidad || 0) * Number(editForm.precioUnitario || 0)).toFixed(2)}</p></div>
          </div>

          <DialogFooter className="p-6 pt-2 border-t border-border/50 flex gap-2">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="flex-1 font-bold uppercase text-[10px] h-9 rounded-xl">Cerrar</Button>
            {!isReadOnly && <Button onClick={handleSaveFullEdit} className="flex-1 bg-primary text-white font-bold uppercase text-[10px] h-9 rounded-xl shadow-lg gap-2"><Save className="h-3.5 w-3.5" />Guardar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
