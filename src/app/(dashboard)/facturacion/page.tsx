"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Search, List, Loader2, Edit3, X, Eye, Printer, Trash2, Calendar as CalendarIcon, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Invoice } from "@/types/invoice";
import { InvoiceTable } from "@/components/facturacion/invoice-table";
import { InvoiceForm } from "@/components/facturacion/invoice-form";
import { GroupedSamplesForm } from "@/components/facturacion/grouped-samples-form";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  doc,
  deleteDoc,
  limit
} from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from "@/components/ui/sheet";
import { InvoiceDetail } from "@/components/facturacion/invoice-detail";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function FacturacionPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [inputSearch, setInputSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [activeMode, setActiveMode] = useState("individual");
  
  const { toast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === "socio";

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    setDateFrom(`${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-${pad(firstDay.getDate())}`);
    setDateTo(`${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(inputSearch), 300);
    return () => clearTimeout(timer);
  }, [inputSearch]);

  useEffect(() => {
    if (!db) return;
    // Quitamos orderBy y limit para que Firestore no excluya documentos sin "fechaFactura"
    const q = query(collection(db, "facturas"));
    const unsubInvoices = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => {
        const d = docSnap.data();
        
        let parsedDate: Date | null = null;
        if (d.fechaFactura?.toDate) parsedDate = d.fechaFactura.toDate();
        else if (d.createdAt?.toDate) parsedDate = d.createdAt.toDate();
        else if (d.invoiceDate) parsedDate = new Date(d.invoiceDate);
        else if (d.date) parsedDate = new Date(d.date);
        else if (d.timestamp) parsedDate = new Date(d.timestamp);

        return {
          id: docSnap.id,
          ...d,
          rawDate: parsedDate,
          displayDate: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toLocaleDateString('es-EC') : 'S/F'
        } as any;
      });

      // Ordenar en memoria (descendente) de forma tolerante a fallos
      data.sort((a, b) => {
        const timeA = a.rawDate && !isNaN(a.rawDate.getTime()) ? a.rawDate.getTime() : 0;
        const timeB = b.rawDate && !isNaN(b.rawDate.getTime()) ? b.rawDate.getTime() : 0;
        return timeB - timeA;
      });

      setInvoices(data);
      setLoading(false);
    });

    const unsubClients = onSnapshot(collection(db, "clients"), (snap) => {
      const mapped = snap.docs.map(d => {
        const data = d.data();
        const firstName = data.firstName || data.nombre || "";
        const lastName = data.lastName || data.apellido || "";
        const name = (data.name || `${lastName} ${firstName}`).trim().toUpperCase();
        return {
          id: d.id,
          ...data,
          firstName,
          lastName,
          name: name || "SIN NOMBRE"
        };
      });
      const sorted = mapped.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      setClients(sorted);
    });

    return () => {
      unsubInvoices();
      unsubClients();
    };
  }, []);

  const filteredInvoices = useMemo(() => {
    const s = searchTerm.toLowerCase();
    let fromDate: Date | null = null;
    let toDateObj: Date | null = null;
    
    if (dateFrom) fromDate = new Date(dateFrom + "T00:00:00");
    if (dateTo) toDateObj = new Date(dateTo + "T23:59:59");

    return invoices.filter(inv => {
      const clientName = (inv as any).clienteNombre || inv.clientName || (inv as any).cliente || "";
      const matchesSearch = inv.numeroFactura?.toLowerCase().includes(s) || 
                            clientName.toLowerCase().includes(s) ||
                            inv.ingresoMaestroId?.toLowerCase().includes(s);
                            
      let matchesDate = true;
      if (fromDate || toDateObj) {
        const invDate = (inv as any).rawDate;
        if (!invDate) {
          matchesDate = false;
        } else {
          if (fromDate && invDate < fromDate) matchesDate = false;
          if (toDateObj && invDate > toDateObj) matchesDate = false;
        }
      }
      
      return matchesSearch && matchesDate;
    });
  }, [invoices, searchTerm, dateFrom, dateTo]);

  const totalFacturadoRango = useMemo(() => {
    return filteredInvoices.reduce((acc, inv) => acc + (Number(inv.totalFactura) || 0), 0);
  }, [filteredInvoices]);

  const handleFormSubmit = async (data: any) => {
    if (isReadOnly) return;
    try {
      if (editingInvoice) {
        const invoiceRef = doc(db, "facturas", editingInvoice.id);
        await updateDoc(invoiceRef, {
          ...data,
          updatedAt: serverTimestamp(),
          saldoPendiente: data.totalFactura - (editingInvoice.totalFactura - editingInvoice.saldoPendiente)
        });
        toast({ title: "Documento Actualizado" });
        setIsSheetOpen(false);
        setEditingInvoice(null);
      } else {
        const payload = {
          ...data,
          fechaFactura: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          estadoCobranza: data.estadoCobranza || "Por Cobrar",
          saldoPendiente: data.saldoPendiente !== undefined ? data.saldoPendiente : data.totalFactura,
          pagosYajustes: []
        };
        await addDoc(collection(db, "facturas"), payload);
        toast({ title: "Documento Emitido" });
      }
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast({ variant: "destructive", title: "Error al guardar" });
    }
  };

  const handleEdit = (invoice: Invoice) => {
    if (isReadOnly) return;
    setEditingInvoice(invoice);
    setIsSheetOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (isReadOnly || user?.role !== "administrador") {
      toast({ variant: "destructive", title: "Acceso Denegado" });
      return;
    }
    try {
      await deleteDoc(doc(db, "facturas", id));
      toast({ title: "Factura Anulada" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 space-y-10 animate-in fade-in duration-700">
      <div className="max-w-[1600px] mx-auto space-y-1">
        <h1 className="text-5xl font-black text-foreground tracking-tighter uppercase">Facturación Industrial</h1>
        <p className="text-primary text-xs font-black uppercase tracking-[0.3em]">Módulo de Emisión y Control Fiscal</p>
        {isReadOnly && <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3 mt-2">Modo Solo Lectura</Badge>}
      </div>

      {!isReadOnly && (
        <div className="max-w-[1600px] mx-auto">
          <Tabs value={activeMode} onValueChange={setActiveMode} className="w-full">
            <TabsList className="bg-muted/30 border border-border p-1 h-14 w-fit rounded-2xl gap-2 mb-10">
              <TabsTrigger value="individual" className="px-10 h-full rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-black text-[10px] uppercase tracking-widest transition-all">Facturar Individual</TabsTrigger>
              <TabsTrigger value="muestras" className="px-10 h-full rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-black text-[10px] uppercase tracking-widest transition-all">Facturar Muestras</TabsTrigger>
            </TabsList>
            <TabsContent value="individual" className="mt-0 outline-none"><InvoiceForm clients={clients} onSubmit={handleFormSubmit} onCancel={() => {}} /></TabsContent>
            <TabsContent value="muestras" className="mt-0 outline-none"><GroupedSamplesForm clients={clients} onSubmit={handleFormSubmit} onCancel={() => {}} /></TabsContent>
          </Tabs>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto pt-16 border-t border-border">
        <Card className="rounded-[2.5rem] border border-border shadow-premium overflow-hidden bg-card">
          <div className="p-10 space-y-10">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary"><List className="h-7 w-7" /></div>
                <div><h3 className="text-3xl font-black text-foreground tracking-tight uppercase">Historial de Facturas</h3></div>
              </div>
              
              <div className="flex flex-col md:flex-row items-end gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-muted-foreground ml-1">Desde</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full md:w-[150px] h-14 erp-input bg-background justify-start text-left font-bold text-xs">
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {dateFrom ? format(parseISO(dateFrom), "dd/MM/yyyy") : "Todas..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                      <Calendar mode="single" selected={dateFrom ? parseISO(dateFrom) : undefined} onSelect={(d) => setDateFrom(d ? format(d, "yyyy-MM-dd") : "")} locale={es} />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-muted-foreground ml-1">Hasta</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full md:w-[150px] h-14 erp-input bg-background justify-start text-left font-bold text-xs">
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {dateTo ? format(parseISO(dateTo), "dd/MM/yyyy") : "Todas..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                      <Calendar mode="single" selected={dateTo ? parseISO(dateTo) : undefined} onSelect={(d) => setDateTo(d ? format(d, "yyyy-MM-dd") : "")} locale={es} />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="relative w-full md:w-[280px] space-y-2">
                  <span className="text-[10px] font-black uppercase text-muted-foreground ml-1">Búsqueda Rápida</span>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Cliente, factura..." className="pl-12 erp-input h-14 rounded-2xl" value={inputSearch} onChange={e => setInputSearch(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-primary/5 p-6 rounded-3xl border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/20 rounded-xl flex items-center justify-center"><DollarSign className="h-5 w-5 text-primary" /></div>
                <p className="text-xs font-black text-primary uppercase tracking-widest">Total Facturado (Rango)</p>
              </div>
              <p className="text-3xl font-black text-primary">${totalFacturadoRango.toFixed(2)}</p>
            </div>
            <InvoiceTable 
              invoices={filteredInvoices} 
              onView={(inv) => { setViewingInvoice(inv); setIsDetailOpen(true); }} 
              onEdit={handleEdit} 
              onDelete={handleDelete} 
              onPrint={(inv) => { setViewingInvoice(inv); setIsDetailOpen(true); }} 
            />
          </div>
        </Card>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[1000px] bg-card border-border text-foreground p-0 overflow-hidden rounded-[2.5rem] shadow-premium-lg">
          <div className="max-h-[85vh] overflow-y-auto p-12">
            <DialogHeader className="mb-10 border-b border-border pb-6"><DialogTitle className="text-4xl font-black uppercase tracking-tight">Detalle de Factura</DialogTitle></DialogHeader>
            {viewingInvoice && <InvoiceDetail invoice={viewingInvoice} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}