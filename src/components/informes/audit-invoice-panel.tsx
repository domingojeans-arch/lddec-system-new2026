"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { Receipt, Search, Loader2, Calendar, Building2, Layers, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuditInvoicePanel() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const { toast } = useToast();

  const handleSearch = async () => {
    const term = searchTerm.trim().toUpperCase();
    if (!term) return;

    setSearching(true);
    setResult(null);

    try {
      const q = query(
        collection(db, "facturas"),
        where("numeroFactura", "==", term)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        toast({ title: "Factura no encontrada", variant: "destructive" });
        setResult({ error: "No se encontró ninguna factura con ese número." });
      } else {
        const invoiceData = snap.docs[0].data();
        let fetchedClientName = invoiceData.clientName;
        
        if (!fetchedClientName && invoiceData.clientId) {
          try {
            const clientSnap = await getDoc(doc(db, "clients", invoiceData.clientId));
            if (clientSnap.exists()) {
              fetchedClientName = clientSnap.data().name || clientSnap.data().nombre || invoiceData.clientId;
            }
          } catch (err) {
            console.error("Error fetching client", err);
          }
        }
        
        setResult({ ...invoiceData, id: snap.docs[0].id, clientName: fetchedClientName });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error en la búsqueda", variant: "destructive" });
      setResult({ error: "Error técnico al procesar la auditoría de factura." });
    } finally {
      setSearching(false);
    }
  };

  return (
    <Card className="rounded-[2.5rem] border border-border shadow-premium overflow-hidden bg-card">
      <CardHeader className="bg-primary/5 border-b border-border p-8">
        <CardTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
          <Receipt className="h-6 w-6 text-primary" /> Auditoría de Factura
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Número de Factura (Ej: 001-001-12345)..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="pl-12 erp-input h-14 text-lg font-black" 
            />
          </div>
          <Button onClick={handleSearch} disabled={searching} className="bg-primary hover:bg-primary/90 text-white font-black uppercase h-14 px-10 rounded-2xl shadow-xl">
            {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Auditar Factura"}
          </Button>
        </div>

        {result && !result.error && (
          <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
            {/* RESUMEN DE LA FACTURA */}
            <div className="bg-muted/20 p-8 rounded-[2.5rem] border border-border space-y-6">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Expediente de Facturación</p>
                  <h3 className="text-4xl font-black tracking-tighter">{result.numeroFactura || "SIN NÚMERO"}</h3>
                  <div className="flex flex-wrap gap-6 mt-4">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase">
                      <Building2 className="h-4 w-4 text-muted-foreground" /> {result.clientName || result.clientId || "N/A"}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold uppercase">
                      <Calendar className="h-4 w-4 text-muted-foreground" /> {result.fechaFactura ? (result.fechaFactura?.toDate ? result.fechaFactura.toDate().toLocaleDateString('es-EC') : new Date(result.fechaFactura).toLocaleDateString('es-EC')) : "N/A"}
                    </div>
                    {result.numeroSalida && (
                      <div className="flex items-center gap-2 text-sm font-bold uppercase">
                        <Layers className="h-4 w-4 text-muted-foreground" /> Salida: {result.numeroSalida}
                      </div>
                    )}
                    {(result.ingresoMaestroId || result.numeroIngreso) && (
                      <div className="flex items-center gap-2 text-sm font-bold uppercase">
                        <Layers className="h-4 w-4 text-muted-foreground" /> Ingreso: {result.ingresoMaestroId || result.numeroIngreso}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-border/50">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Subtotal
                  </p>
                  <p className="text-2xl font-black text-primary">${Number(result.subtotal || 0).toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> IVA
                  </p>
                  <p className="text-2xl font-black text-emerald-600">${Number(result.iva || 0).toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Total Facturado
                  </p>
                  <p className="text-2xl font-black">${(Number(result.subtotal || 0) + Number(result.iva || 0)).toFixed(2)}</p>
                </div>
              </div>

              {result.notes && (
                <div className="pt-6 border-t border-border/50">
                  <p className="text-[9px] font-black text-muted-foreground uppercase mb-2">Notas / Observaciones</p>
                  <p className="text-sm font-medium">{result.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
