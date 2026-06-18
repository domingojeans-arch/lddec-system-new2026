"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  FileText,
  TrendingUp,
  Loader2,
  Calendar as CalendarIcon,
  User,
  Users,
  Beaker
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InventorySummaryReport } from "./inventory-summary-report";
import { StatementOfAccountsReport } from "./statement-of-accounts-report";
import { StatementOfAccountsDetailed } from "./statement-of-accounts-detailed";
import { EntriesVsBillingReport } from "./entries-vs-billing-report";
import { BillingVsCollectionsReport } from "./billing-vs-collections-report";
import { ManualWorksDetailedReport } from "./manual-works-detailed-report";
import { filterPaymentsByDate } from "@/lib/accounting-motor";
import { toDate } from "@/lib/toDate";
import { OperatorPayoutReport } from "./operator-payout-report";
import { BankMovementsReport } from "./bank-movements-report";
import { CollectionsDetailedReport } from "./collections-detailed-report";
import { EntriesDetailedReport } from "./entries-detailed-report";
import { OutputsDetailedReport } from "./outputs-detailed-report";
import { ChemicalMovementsDetailedReport } from "./chemical-movements-detailed-report";
import { SalesDetailedReport } from "./sales-detailed-report";
import { calculateInventorySummary } from "@/lib/inventoryEngine";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where, Timestamp, limit, doc, onSnapshot } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const ALL_REPORT_TYPES = [
  "Resumen Operativo Mes a Mes",
  "Informe de Ingresos Detallado",
  "Informe de Salidas Detallado",
  "Informe de Ingresos vs. Facturación",
  "Informe de Facturación vs. Cobranzas",
  "Informe Detallado de Ventas (Libro de Ventas)",
  "Estado de Cuentas por Cliente a Fecha de Corte",
  "Estado de Cuenta Detallado (Formato Contable)",
  "Informe Detallado de Cobranzas",
  "Informe de Movimientos Bancarios",
  "Informe Detallado de Manualidades",
  "Liquidación de Pagos a Operarios",
  "Informe Detallado de Movimientos Químicos"
];

const normalizeSustancia = (s: string) =>
  String(s || "").trim().toUpperCase().replace(/\s+/g, " ");

interface ReportGeneratorPanelProps {
  clients: any[];
}

export function ReportGeneratorPanel({ clients }: ReportGeneratorPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [operators, setOperators] = useState<string[]>([]);
  const [chemicalList, setChemicals] = useState<string[]>([]);

  const [reportData, setReportData] = useState<any>({
    entries: [],
    outputs: [],
    invoices: [],
    payments: [],
    manualidades: [],
    cuentas: [],
    bankTransactions: [],
    chemicalMovements: [],
    chemicalsStock: [],
    allEntries: [],
    allOutputs: [],
    allInvoices: []
  });

  const [isFromOpen, setIsFromOpen] = useState(false);
  const [isToOpen, setIsToOpen] = useState(false);

  // Determinar reportes permitidos por rol
  const reportTypes = useMemo(() => {
    const role = user?.role || "socio";
    if (role === "admin" || role === "contador" || role === "financiero" || role === "socio") return ALL_REPORT_TYPES;
    if (role === "bodega") return ["Resumen Operativo Mes a Mes", "Informe de Ingresos Detallado", "Informe de Salidas Detallado"];
    if (role === "bodega_quimicos") return ["Informe Detallado de Movimientos Químicos"];
    if (role === "facturacion") return ["Informe de Ingresos vs. Facturación", "Informe de Salidas Detallado", "Informe Detallado de Ventas (Libro de Ventas)"];
    if (role === "produccion") return ["Informe Detallado de Manualidades", "Liquidación de Pagos a Operarios", "Informe Detallado de Movimientos Químicos"];
    if (role === "banco") return ["Informe de Movimientos Bancarios"];
    return ["Resumen Operativo Mes a Mes"];
  }, [user?.role]);

  const [filters, setFilters] = useState({
    type: reportTypes[0] || ALL_REPORT_TYPES[0],
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    clientId: "all",
    operatorName: "all",
    accountId: "all",
    chemicalId: "all"
  });

  // Cargar catálogos dinámicos para filtros especializados
  useEffect(() => {
    if (!db) return;
    const unsubs = [
      onSnapshot(collection(db, "trabajadores_manualidades"), (snap) => {
        setOperators(snap.docs.map(d => String(d.data().nombre).toUpperCase()).sort());
      }),
      onSnapshot(collection(db, "quimicos_procesos_maestro"), (snap) => {
        const unique = Array.from(new Set(snap.docs.map(d => normalizeSustancia(d.data().sustancia)))).sort();
        setChemicals(unique);
      })
    ];
    return () => unsubs.forEach(fn => fn());
  }, []);

  const handleGenerate = async () => {
    if (filters.type === "Estado de Cuenta Detallado (Formato Contable)" && filters.clientId === "all") {
      toast({ variant: "destructive", title: "Seleccione un socio industrial para generar el estado de cuenta." });
      return;
    }

    setLoading(true);
    setReportGenerated(false);

    try {
      const from = Timestamp.fromDate(new Date(filters.dateFrom + "T00:00:00"));
      const to = Timestamp.fromDate(new Date(filters.dateTo + "T23:59:59"));

      const data: any = {
        entries: [],
        outputs: [],
        invoices: [],
        payments: [],
        manualidades: [],
        cuentas: [],
        bankTransactions: [],
        chemicalMovements: [],
        chemicalsStock: [],
        allEntries: [],
        allOutputs: [],
        allInvoices: []
      };

      // MOTOR DE CONSULTA SELECTIVO (Tolerante a esquemas legacy)
      const fromDate = from.toDate();
      const toDateObj = to.toDate();

      const typeLower = filters.type.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const isResumen = typeLower.includes("resumen operativo");
      const isIngresos = typeLower.includes("ingreso") || isResumen;
      const isSalidas = typeLower.includes("salida") || isResumen;
      const isFacturacion = typeLower.includes("factur") || typeLower.includes("venta") || typeLower.includes("cuenta") || typeLower.includes("cobranza") || isResumen;
      const isManualidades = typeLower.includes("manualidad") || typeLower.includes("operario");
      const isBancos = typeLower.includes("banc");
      const isQuimicos = typeLower.includes("quimic");

      const hasClientFilter = !typeLower.includes("operario") && !isQuimicos;

      if (isIngresos || isFacturacion) {
        const snap = await getDocs(collection(db, "entries"));
        let raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (hasClientFilter && filters.clientId !== "all") {
          raw = raw.filter((d: any) => d.clientId === filters.clientId || d.clienteId === filters.clientId);
        }

        data.allEntries = raw;
        data.entries = raw.filter((d: any) => {
          let parsedDate = d.date?.toDate ? d.date.toDate() : d.entryDate?.toDate ? d.entryDate.toDate() : d.createdAt?.toDate ? d.createdAt.toDate() : d.fecha ? new Date(d.fecha) : null;
          return parsedDate && parsedDate >= fromDate && parsedDate <= toDateObj;
        });
      }

      if (isSalidas) {
        const [snapOutputs, snapSalidas, snapMuestras] = await Promise.all([
          getDocs(collection(db, "outputs")),
          getDocs(collection(db, "salidas")),
          getDocs(collection(db, "muestras"))
        ]);

        let rawOutputs = [
          ...snapOutputs.docs.map(d => ({ id: d.id, ...d.data() })),
          ...snapSalidas.docs.map(d => ({ id: d.id, ...d.data() })),
          ...snapMuestras.docs.map(d => ({ id: d.id, ...d.data() }))
        ];

        if (hasClientFilter && filters.clientId !== "all") {
          rawOutputs = rawOutputs.filter((d: any) => d.clientId === filters.clientId || d.clienteId === filters.clientId);
        }

        data.allOutputs = rawOutputs;

        data.outputs = rawOutputs.filter((d: any) => {
          let parsedDate = d.date?.toDate ? d.date.toDate() : d.fechaSalida?.toDate ? d.fechaSalida.toDate() : d.fecha?.toDate ? d.fecha.toDate() : d.createdAt?.toDate ? d.createdAt.toDate() : d.timestamp ? new Date(d.timestamp) : null;
          if (!parsedDate && (d.date || d.fechaSalida || d.fecha)) parsedDate = new Date(d.date || d.fechaSalida || d.fecha);
          return parsedDate && parsedDate >= fromDate && parsedDate <= toDateObj;
        });
      }

      if (isFacturacion) {
        const snap = await getDocs(collection(db, "facturas"));
        let raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (hasClientFilter && filters.clientId !== "all") {
          raw = raw.filter((d: any) => d.clientId === filters.clientId || d.clienteId === filters.clientId);
        }

        data.allInvoices = raw;
        data.invoices = raw.filter((d: any) => {
          let parsedDate = d.fechaFactura?.toDate ? d.fechaFactura.toDate() : d.createdAt?.toDate ? d.createdAt.toDate() : d.invoiceDate ? new Date(d.invoiceDate) : d.date ? new Date(d.date) : d.timestamp ? new Date(d.timestamp) : null;
          return parsedDate && parsedDate >= fromDate && parsedDate <= toDateObj;
        });
        // Fetch payments dynamically from facturas and clients
        const allFacturaPayments = raw.flatMap((inv: any) => {
           const pagos = Array.isArray(inv.pagosYajustes) ? inv.pagosYajustes : (Array.isArray(inv.pagosAjustes) ? inv.pagosAjustes : []);
           return pagos.map((p: any) => ({
               ...p,
               clienteId: inv.clientId || inv.clienteId || "",
               clienteNombre: inv.clienteNombre || inv.clientName || "",
               facturaId: inv.id,
               numeroFactura: inv.numeroFactura || ""
           }));
        });

        const clientsSnap = await getDocs(collection(db, "clients"));
        let rawClients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (hasClientFilter && filters.clientId !== "all") {
            rawClients = rawClients.filter((c: any) => c.id === filters.clientId);
        }
        let filteredPayments = [...allFacturaPayments];
        data.payments = filterPaymentsByDate(filteredPayments, new Date("2026-01-01T00:00:00"), toDateObj);

      }

      if (isManualidades) {
        // 1. Consulta limpia a Firestore filtrando únicamente por estado 'aprobado'
        const q = query(collection(db, "manualidades"), where("estado", "==", "aprobado"));
        const snap = await getDocs(q);
        let allManualidades = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (hasClientFilter && filters.clientId !== "all") {
          allManualidades = allManualidades.filter((d: any) => d.clienteId === filters.clientId || d.clientId === filters.clientId);
        }

        // 2. Filtrado local por fechas en el cliente (JavaScript)
        data.manualidades = allManualidades.filter((work: any) => {
          const fechaStr = work.fecha || work.fechaStr || "";

          // Si el campo fecha viene en formato texto "DD/MM/YYYY", lo separamos y convertimos
          if (typeof fechaStr === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(fechaStr)) {
            const [day, month, year] = fechaStr.split("/");
            // Crear objeto Date nativo de JS (mediodía para evitar desfases de zona horaria)
            const workDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
            return workDate >= fromDate && workDate <= toDateObj;
          }

          // Fallback para Timestamps u otros formatos
          const d = toDate(work.fecha || work.fechaStr || work.workDate || work.createdAt);
          return d && d >= fromDate && d <= toDateObj;
        });
      }

      if (filters.type === "Informe de Movimientos Bancarios") {
        const accSnap = await getDocs(collection(db, "cuentas_bancarias"));
        data.cuentas = accSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const allTxs: any[] = [];
        for (const acc of data.cuentas) {
          const tSnap = await getDocs(query(collection(db, "cuentas_bancarias", acc.id, "transacciones"), where("fecha", ">=", from), where("fecha", "<=", to)));
          tSnap.docs.forEach(d => allTxs.push({ id: d.id, accountId: acc.id, ...d.data() }));
        }
        data.bankTransactions = allTxs;
      }

      if (filters.type === "Informe Detallado de Movimientos Químicos") {
        const qKardex = query(collection(db, "quimicos_kardex"), where("fecha", ">=", from), where("fecha", "<=", to));
        const [snapKardex, stockSnap] = await Promise.all([
          getDocs(qKardex),
          getDocs(collection(db, "quimicos_stock"))
        ]);
        data.chemicalMovements = snapKardex.docs.map(d => ({ id: d.id, ...d.data() }));
        data.chemicalsStock = stockSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      setReportData(data);
      setReportGenerated(true);
      toast({ title: "Informe Generado con éxito" });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al generar reporte" });
    } finally {
      setLoading(false);
    }
  };

  const inventoryMetrics = useMemo(() => {
    if (!reportGenerated || filters.type !== "Resumen Operativo Mes a Mes") return null;
    return calculateInventorySummary(reportData.allEntries || [], reportData.allOutputs || [], reportData.allInvoices || [], filters.dateFrom, filters.dateTo);
  }, [reportData, filters, reportGenerated]);

  const dateFromObj = filters.dateFrom ? parseISO(filters.dateFrom) : undefined;
  const dateToObj = filters.dateTo ? parseISO(filters.dateTo) : undefined;

  return (
    <div className="space-y-10">
      <div className="bg-card p-10 rounded-[2.5rem] border border-border shadow-premium space-y-8 print:hidden">
        <h2 className="text-2xl font-black uppercase tracking-tight">Filtros de Reporte</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">1. Tipo de Informe</Label>
            <Select value={filters.type} onValueChange={(v) => { setFilters({ ...filters, type: v }); setReportGenerated(false); }}>
              <SelectTrigger className="erp-input h-12 font-bold"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-2xl shadow-2xl">
                {reportTypes.map(t => <SelectItem key={t} value={t} className="text-xs uppercase font-bold">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">2. Rango de Fechas</Label>
            <div className="flex gap-2">
              <Popover open={isFromOpen} onOpenChange={setIsFromOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="erp-input h-12 text-xs font-bold flex-1 justify-start px-3">
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {dateFromObj && isValid(dateFromObj) ? format(dateFromObj, "dd/MM/yyyy") : "Desde"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden border-none shadow-2xl z-[100]" align="start">
                  <Calendar mode="single" selected={dateFromObj} onSelect={(d) => { setFilters({ ...filters, dateFrom: d ? format(d, "yyyy-MM-dd") : "" }); setIsFromOpen(false); }} locale={es} initialFocus />
                </PopoverContent>
              </Popover>
              <Popover open={isToOpen} onOpenChange={setIsToOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="erp-input h-12 text-xs font-bold flex-1 justify-start px-3">
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {dateToObj && isValid(dateToObj) ? format(dateToObj, "dd/MM/yyyy") : "Hasta"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden border-none shadow-2xl z-[100]" align="end">
                  <Calendar mode="single" selected={dateToObj} onSelect={(d) => { setFilters({ ...filters, dateTo: d ? format(d, "yyyy-MM-dd") : "" }); setIsToOpen(false); }} locale={es} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">
              {filters.type === "Liquidación de Pagos a Operarios" ? "3. Operario" : (filters.type.includes("Químicos") ? "3. Sustancia" : "3. Socio Industrial")}
            </Label>
            {filters.type === "Liquidación de Pagos a Operarios" ? (
              <Select value={filters.operatorName} onValueChange={(v) => setFilters({ ...filters, operatorName: v })}>
                <SelectTrigger className="erp-input h-12 font-bold"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent className="rounded-2xl max-h-[300px]">
                  <SelectItem value="all">TODOS LOS OPERARIOS</SelectItem>
                  {operators.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : filters.type.includes("Químicos") ? (
              <Select value={filters.chemicalId} onValueChange={(v) => setFilters({ ...filters, chemicalId: v })}>
                <SelectTrigger className="erp-input h-12 font-bold"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent className="rounded-2xl max-h-[300px]">
                  <SelectItem value="all">TODOS LOS INSUMOS</SelectItem>
                  {chemicalList.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Select value={filters.clientId} onValueChange={(v) => setFilters({ ...filters, clientId: v })}>
                <SelectTrigger className="erp-input h-12 font-bold"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent className="rounded-2xl max-h-[300px]">
                  <SelectItem value="all">TODOS LOS CLIENTES</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{(c.name || c.nombre || "").toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <div className="flex justify-end pt-4 border-t border-border/50">
          <Button onClick={handleGenerate} disabled={loading} className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] px-14 h-14 rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 group">
            {loading ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : <TrendingUp className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />}
            Consultar y Generar
          </Button>
        </div>
      </div>

      {reportGenerated && (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
          {filters.type === "Resumen Operativo Mes a Mes" && inventoryMetrics && <InventorySummaryReport metrics={inventoryMetrics} dateFrom={filters.dateFrom} dateTo={filters.dateTo} />}
          {filters.type === "Informe de Ingresos Detallado" && <EntriesDetailedReport entries={reportData.entries} dateFrom={filters.dateFrom} dateTo={filters.dateTo} />}
          {filters.type === "Informe de Salidas Detallado" && <OutputsDetailedReport prodOutputs={reportData.outputs} sampleOutputs={[]} totals={{ prodPrendas: 0, samplePrendas: 0, totalGeneral: 0 }} dateFrom={filters.dateFrom} dateTo={filters.dateTo} />}
          {filters.type === "Informe Detallado de Ventas (Libro de Ventas)" && <SalesDetailedReport invoices={reportData.invoices} dateFrom={filters.dateFrom} dateTo={filters.dateTo} />}
          {filters.type === "Informe de Ingresos vs. Facturación" && <EntriesVsBillingReport entries={reportData.entries} invoices={reportData.invoices} dateFrom={filters.dateFrom} dateTo={filters.dateTo} />}
          {filters.type === "Informe de Facturación vs. Cobranzas" && <BillingVsCollectionsReport entries={reportData.allEntries || reportData.entries} invoices={reportData.allInvoices || reportData.invoices} payments={reportData.payments} dateFrom={filters.dateFrom} dateTo={filters.dateTo} />}
          {filters.type === "Informe Detallado de Manualidades" && <ManualWorksDetailedReport manualWorks={reportData.manualidades} dateFrom={filters.dateFrom} dateTo={filters.dateTo} />}
          {filters.type === "Liquidación de Pagos a Operarios" && <OperatorPayoutReport manualWorks={reportData.manualidades} dateFrom={filters.dateFrom} dateTo={filters.dateTo} selectedOperator={filters.operatorName} />}
          {filters.type === "Informe Detallado de Movimientos Químicos" && <ChemicalMovementsDetailedReport movements={reportData.chemicalMovements} chemicals={reportData.chemicalsStock} dateFrom={filters.dateFrom} dateTo={filters.dateTo} selectedSubstance={filters.chemicalId} />}
          {filters.type === "Informe de Movimientos Bancarios" && <BankMovementsReport accounts={reportData.cuentas} transactions={reportData.bankTransactions} dateFrom={filters.dateFrom} dateTo={filters.dateTo} />}
          {filters.type === "Estado de Cuentas por Cliente a Fecha de Corte" && (
            <StatementOfAccountsReport 
              clients={filters.clientId === "all" ? clients : clients.filter(c => c.id === filters.clientId)} 
              invoices={reportData.allInvoices || reportData.invoices} 
              payments={reportData.payments} 
              dateFrom={filters.dateFrom} 
              dateTo={filters.dateTo} 
            />
          )}
          {filters.type === "Estado de Cuenta Detallado (Formato Contable)" && <StatementOfAccountsDetailed client={clients.find(c => c.id === filters.clientId) || {}} invoices={reportData.allInvoices || reportData.invoices} dateFrom={filters.dateFrom} dateTo={filters.dateTo} />}
          {filters.type === "Informe Detallado de Cobranzas" && <CollectionsDetailedReport collections={[...(reportData.payments || []), ...(reportData.allInvoices || reportData.invoices || [])]} dateFrom={filters.dateFrom} dateTo={filters.dateTo} client={filters.clientId === "all" ? null : clients.find(c => c.id === filters.clientId)} />}
        </div>
      )}
    </div>
  );
}
