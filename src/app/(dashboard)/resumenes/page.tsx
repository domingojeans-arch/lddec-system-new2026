
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Receipt, 
  Wallet, 
  LayoutDashboard, 
  Shirt, 
  Zap, 
  Beaker,
  Loader2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateOperationalMetrics, filterByRange } from "@/lib/reports-helpers";
import { ReportFilters } from "@/types/reports";
import { Entry } from "@/types/lddec";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";

import { OperationalSummary } from "@/components/informes/operational-summary";
import { EntriesReport } from "@/components/informes/entries-report";
import { OutputsReport } from "@/components/informes/outputs-report";
import { InvoicesReport } from "@/components/informes/invoices-report";
import { CollectionsReport } from "@/components/informes/collections-report";
import { ProductionReport } from "@/components/informes/production-report";
import { ManualWorksReport } from "@/components/informes/manual-works-report";
import { ChemicalsReport } from "@/components/informes/chemicals-report";
import { ReportsFilters } from "@/components/informes/reports-filters";

function getVisibleLotNumber(lot: any): string {
  if (!lot) return "S/L";
  const candidates = [lot.lotNumber, lot.numeroLote, lot.loteId, lot.lote, lot.loteNumero, lot.numLote, lot.id];
  for (const val of candidates) {
    const s = String(val ?? "").trim();
    if (s && s.length < 25 && s !== "[object Object]" && s.toLowerCase() !== "undefined") return s.toUpperCase();
  }
  return "S/L";
}

function getEntryVisible(item: any, id: string): string {
  const candidates = [
    item.entryNumber, 
    item.numeroIngreso, 
    item.numeroIngresoMaestro, 
    item.numero,
    item.entryID
  ];
  for (const val of candidates) {
    const v = String(val ?? "").trim();
    if (v && v.length < 18 && v !== "undefined" && v !== "[object Object]") return v.toUpperCase();
  }
  return id && id.length < 18 ? String(id).toUpperCase() : "INGRESO S/N";
}

function mapFirestoreToEntry(docSnap: any): Entry {
  const data = docSnap.data();
  const id = docSnap.id;
  let entryDate = "";
  if (data.date?.toDate) entryDate = data.date.toDate().toISOString().split('T')[0];
  else if (data.entryDate && data.entryDate.includes('-')) entryDate = data.entryDate;
  const visibleNumber = getEntryVisible(data, id);
  const mappedLots = (data.lotes || []).map((lot: any) => ({ ...lot, id: lot.id || getVisibleLotNumber(lot), lotNumber: getVisibleLotNumber(lot) }));
  const totalGarments = mappedLots.reduce((acc: number, lot: any) => acc + (Number(lot.cantidad || lot.quantity || lot.cantidadConfirmada || 0)), 0);
  return { id, entryNumber: visibleNumber, clientId: data.clientId || "", clientName: data.clientName || "Socio", entryDate, responsible: data.responsible || "N/A", isSample: !!data.isSample, status: data.status || "active", totalGarments, lots: mappedLots, notes: data.notes || "" } as any as Entry;
}

export default function ResumenesPage() {
  const [activeTab, setActiveTab] = useState("resumen");
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: "",
    dateTo: "",
    clientId: "",
    status: "all"
  });

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [rawOutputs, setRawOutputs] = useState<any[]>([]);
  const [rawSalidas, setRawSalidas] = useState<any[]>([]);
  const [rawMuestras, setRawMuestras] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [manualWorks, setManualWorks] = useState<any[]>([]);
  const [chemicals, setChemicals] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);

  const handleFilterChange = (newFilters: Partial<ReportFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const startOfYearTs = Timestamp.fromDate(new Date("2026-01-01T00:00:00"));

        const safeQuery = async (colName: string, dateField: string) => {
          try {
            const q = query(collection(db, colName), where(dateField, ">=", startOfYearTs));
            return await getDocs(q);
          } catch {
            return await getDocs(collection(db, colName));
          }
        };

        const [
          clientsSnap,
          entriesSnap,
          outputsSnap,
          salidasSnap,
          muestrasSnap,
          invoicesSnap,
          paymentsSnap,
          manualSnap,
          quimicosSnap,
          recipesSnap
        ] = await Promise.all([
          getDocs(collection(db, "clients")),
          safeQuery("entries", "date"),
          safeQuery("outputs", "date"),
          safeQuery("salidas", "fechaSalida"),
          safeQuery("muestras", "fecha"),
          safeQuery("facturas", "fechaFactura"),
          safeQuery("payments", "fechaTransaccion"),
          safeQuery("manualidades", "createdAt"),
          getDocs(collection(db, "quimicos_stock")),
          getDocs(collection(db, "quimicos_recetas"))
        ]);

        setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), clientId: doc.id })));
        setEntries(entriesSnap.docs.map(mapFirestoreToEntry));
        setRawOutputs(outputsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), clientId: doc.data().clientId || doc.data().clienteId || "" })));
        setRawSalidas(salidasSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), clientId: doc.data().clientId || doc.data().clienteId || "" })));
        setRawMuestras(muestrasSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), clientId: doc.data().clientId || doc.data().clienteId || "" })));
        setInvoices(invoicesSnap.docs.map(doc => {
          const data = doc.data();
          const total = Number(data.totalFactura || data.total || 0);
          return { id: doc.id, ...data, total, totalFactura: total, clientId: data.clientId || data.clienteId || "" };
        }));
        setCollections(paymentsSnap.docs.map(doc => {
          const data = doc.data();
          const dateStr = data.fechaTransaccion?.toDate ? data.fechaTransaccion.toDate().toISOString().split('T')[0] : data.collectionDate || new Date().toISOString().split('T')[0];
          const monto = Number(data.monto || data.totalReceived || 0);
          return {
            id: doc.id,
            collectionNumber: data.numeroFactura ? `PAGO-FACT-${data.numeroFactura}` : `PAGO-${doc.id.substring(0,6)}`,
            collectionDate: dateStr,
            clientId: data.clienteId || data.clientId || "",
            clientName: data.clienteNombre || "Socio",
            paymentMethod: data.metodoPago || "N/A",
            notes: data.descripcion || "",
            status: "completed",
            totalReceived: monto,
            totalApplied: monto,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            ...data
          };
        }));
        setManualWorks(manualSnap.docs.map(doc => {
          const data = doc.data();
          const total = Number(data.total || data.totalCost || 0);
          return { id: doc.id, ...data, totalCost: total, total: total, clientId: data.clienteId || data.clientId || "" };
        }));
        setChemicals(quimicosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setRecipes(recipesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error al cargar datos en informes:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const outputs = useMemo(() => {
    const combineOutput = (d: any) => {
      let totalDispatched = 0;
      if (d.totalDispatched !== undefined) totalDispatched = Number(d.totalDispatched);
      else if (d.totalDespachadoReal !== undefined) totalDispatched = Number(d.totalDespachadoReal);
      else if (d.itemsDispatched) {
        totalDispatched = d.itemsDispatched.reduce((sum: number, it: any) => sum + Number(it.quantityToDispatch || it.quantity || 0), 0);
      } else if (d.lotes) {
        totalDispatched = d.lotes.reduce((sum: number, it: any) => sum + Number(it.cantidad || it.quantity || 0), 0);
      }
      
      let outputDate = "";
      if (d.date?.toDate) outputDate = d.date.toDate().toISOString().split('T')[0];
      else if (d.fechaSalida?.toDate) outputDate = d.fechaSalida.toDate().toISOString().split('T')[0];
      else if (d.fecha?.toDate) outputDate = d.fecha.toDate().toISOString().split('T')[0];
      else if (d.createdAt?.toDate) outputDate = d.createdAt.toDate().toISOString().split('T')[0];
      
      if (!outputDate && (d.date || d.fechaSalida || d.fecha)) {
        try {
          outputDate = new Date(d.date || d.fechaSalida || d.fecha).toISOString().split('T')[0];
        } catch (_) {}
      }

      return {
        id: d.id,
        outputNumber: d.numeroSalida || d.outputNumber || d.id,
        clientId: d.clientId || d.clienteId || "",
        clientName: d.clientName || d.clienteNombre || "Socio",
        outputDate,
        totalDispatched,
        ...d
      };
    };

    return [
      ...rawOutputs.map(combineOutput),
      ...rawSalidas.map(combineOutput),
      ...rawMuestras.map(combineOutput)
    ];
  }, [rawOutputs, rawSalidas, rawMuestras]);

  const clearFilters = () => {
    setFilters({ dateFrom: "", dateTo: "", clientId: "", status: "all" });
  };

  // Process filtered data
  const filteredData = useMemo(() => {
    const applyCommonFilters = (items: any[]) => {
      let filtered = items;
      if (filters.clientId) {
        filtered = filtered.filter((item: any) => item.clientId === filters.clientId);
      }
      return filterByRange(filtered, filters.dateFrom, filters.dateTo);
    };

    return {
      entries: applyCommonFilters(entries),
      outputs: applyCommonFilters(outputs),
      invoices: applyCommonFilters(invoices),
      collections: applyCommonFilters(collections),
      manualWorks: applyCommonFilters(manualWorks),
      chemicals: chemicals, // Inventory usually isn't date filtered same way
      recipes: applyCommonFilters(recipes)
    };
  }, [filters, entries, outputs, invoices, collections, manualWorks, chemicals, recipes]);

  const metrics = useMemo(() => {
    return calculateOperationalMetrics(
      clients,
      filteredData.entries,
      filteredData.outputs,
      filteredData.invoices,
      filteredData.collections,
      filteredData.manualWorks,
      filteredData.chemicals,
      filteredData.recipes
    );
  }, [clients, filteredData]);

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Consolidando Auditoría Financiera y Operativa...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 animate-in fade-in duration-700">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-accent font-black text-[10px] uppercase tracking-[0.3em] mb-1">
            <BarChart3 className="h-3.5 w-3.5" />
            Business Intelligence
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-primary">
            Resúmenes Analíticos
          </h1>
          <p className="text-muted-foreground text-base max-w-xl leading-relaxed font-medium">
            Visualización avanzada de métricas clave y rendimiento operativo de DenimLab.
          </p>
        </div>
      </div>

      <ReportsFilters 
        filters={filters} 
        onChange={handleFilterChange} 
        onClear={clearFilters} 
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/30 p-1.5 rounded-2xl h-auto flex flex-wrap gap-1 border border-muted/20">
          {[
            { id: "resumen", label: "Dashboard", icon: LayoutDashboard },
            { id: "ingresos", label: "Ingresos", icon: ArrowDownCircle },
            { id: "salidas", label: "Salidas", icon: ArrowUpCircle },
            { id: "facturacion", label: "Facturas", icon: Receipt },
            { id: "cobranzas", label: "Cobros", icon: Wallet },
            { id: "produccion", label: "Producción", icon: Shirt },
            { id: "manualidades", label: "Manualidades", icon: Zap },
            { id: "quimicos", label: "Químicos", icon: Beaker },
          ].map((tab) => (
            <TabsTrigger 
              key={tab.id} 
              value={tab.id}
              className="rounded-xl px-5 py-2.5 font-bold text-xs gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md transition-all"
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-10">
          <TabsContent value="resumen">
            <OperationalSummary metrics={metrics} />
          </TabsContent>
          <TabsContent value="ingresos">
            <EntriesReport entries={filteredData.entries} />
          </TabsContent>
          <TabsContent value="salidas">
            <OutputsReport outputs={filteredData.outputs} />
          </TabsContent>
          <TabsContent value="facturacion">
            <InvoicesReport invoices={filteredData.invoices} />
          </TabsContent>
          <TabsContent value="cobranzas">
            <CollectionsReport collections={filteredData.collections} />
          </TabsContent>
          <TabsContent value="produccion">
            <ProductionReport entries={filteredData.entries} />
          </TabsContent>
          <TabsContent value="manualidades">
            <ManualWorksReport works={filteredData.manualWorks} />
          </TabsContent>
          <TabsContent value="quimicos">
            <ChemicalsReport chemicals={filteredData.chemicals} recipes={filteredData.recipes} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
