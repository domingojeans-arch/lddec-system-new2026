"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Shirt, 
  Users, 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  RefreshCcw,
  Clock,
  Receipt,
  Database,
  User,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Progress } from "@/components/ui/progress";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp, query, where, Timestamp } from "firebase/firestore";
import { toDate } from "@/lib/toDate";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

/**
 * CONSTANTES DE INGRESOS COMPARATIVOS
 */

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Resúmenes históricos anuales de 2025 (Datos congelados del año cerrado)
const PRODUCTION_2025 = [0, 0, 0, 0, 8816, 26435, 32510, 35551, 30322, 39278, 38521, 36543];
const DISPATCHES_2025 = [0, 0, 0, 0, 1338, 6340, 3807, 19292, 33299, 35130, 37983, 46371];
const BILLING_2025 = [0, 0, 0, 0, 610.56, 44861.27, 44945.98, 43005.19, 62531.70, 55965.07, 63056.00, 87224.98];


/**
 * INTERFAZ DE MÉTRICAS CACHEADAS
 */
interface CachedDashboardStats {
  metrics: {
    ingresadasMes: number;
    despachadasMes: number;
    avgDelivery: number;
    billingStats: any[];
    sampleStats: any[];
    collectionStats: any[];
    production2026?: number[];
    production2025?: number[];
    dispatches2026?: number[];
    dispatches2025?: number[];
    billing2026?: number[];
    billing2025?: number[];
  };
  charts: {
    topClients: any[];
    topGarments: any[];
  };
  lastUpdate: any;
  updatedBy: string;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<CachedDashboardStats | null>(null);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(new Date().getMonth());
  const currentYear = new Date().getFullYear();

  const handlePrevMonth = () => {
    setSelectedMonthIdx((prev) => (prev === 0 ? 11 : prev - 1));
  };
  const handleNextMonth = () => {
    setSelectedMonthIdx((prev) => (prev === 11 ? 0 : prev + 1));
  };

  const isReadOnly = user?.role === "socio";

  // 1. PROTECCIÓN DE RUTA
  useEffect(() => {
    if (!authLoading && user) {
      const allowedDashboardRoles = ["admin", "socio", "contador", "financiero", "facturacion", "colaboradora"];
      if (!allowedDashboardRoles.includes(user.role)) {
        if (user.role === 'operario_manualidades') router.replace('/manualidades');
        else if (user.role === 'produccion') router.replace('/produccion');
        else if (user.role === 'bodega') router.replace('/ingresos');
        else if (user.role === 'chofer') router.replace('/entregas');
        else if (user.role === 'bodega_quimicos') router.replace('/quimicos');
        else router.replace('/ingresos');
      }
    }
  }, [user, authLoading, router]);

  /**
   * CARGAR DATOS CONGELADOS (SNAPSHOT)
   * Solo lee el documento de caché, no consulta las colecciones transaccionales.
   */
  const loadCachedStats = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const cacheRef = doc(db, "configuracion", "dashboard_cache");
      const cacheSnap = await getDoc(cacheRef);
      
      if (cacheSnap.exists()) {
        setStats(cacheSnap.data() as CachedDashboardStats);
      }
    } catch (error) {
      console.warn("Error al cargar caché del dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCachedStats();
  }, []);

  /**
   * MOTOR DE PROCESAMIENTO MANUAL (CONTROLADO)
   * Usa getDocs con filtros de fecha para reducir costos.
   */
  const handleRefresh = async () => {
    if (!db || refreshing || isReadOnly) return;
    setRefreshing(true);
    
    try {
      console.log("🚀 Iniciando recálculo global de métricas...");
      
      const startOfYear = new Date(currentYear, 0, 1);
      const startOfYearTs = Timestamp.fromDate(startOfYear);

      // 1. Descarga Multicanal Filtrada (Solo el año actual en tiempo real para optimizar costos)
      const [entriesSnap, outputsSnap, legacySalidasSnap, legacyMuestrasSnap, invoicesSnap, paymentsSnap] = await Promise.all([
        getDocs(query(collection(db, "entries"), where("date", ">=", startOfYearTs))),
        getDocs(query(collection(db, "outputs"), where("date", ">=", startOfYearTs))),
        getDocs(query(collection(db, "salidas"), where("fechaSalida", ">=", startOfYearTs))),
        getDocs(query(collection(db, "muestras"), where("fecha", ">=", startOfYearTs))),
        getDocs(query(collection(db, "facturas"), where("fechaFactura", ">=", startOfYearTs))),
        getDocs(collection(db, "payments"))
      ]);

      const entriesRaw = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const outputsRaw = [
        ...outputsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)),
        ...legacySalidasSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)),
        ...legacyMuestrasSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))
      ];
      const invoicesRaw = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const paymentsRaw = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // 2. Cálculos de KPIs
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentMonthYear = today.getFullYear();

      const ingresadasMes = entriesRaw.filter(e => {
        const d = toDate(e.date || e.entryDate);
        return d && d.getMonth() === currentMonth && d.getFullYear() === currentMonthYear && e.isSample !== true;
      }).reduce((acc, e) => acc + (e.lotes || []).reduce((lAcc: number, l: any) => lAcc + (Number(l.cantidadConfirmada || l.quantity || l.cantidad || 0)), 0), 0);

      const despachadasMes = outputsRaw.filter(o => {
        const d = toDate(o.date || o.fechaSalida || o.createdAt);
        return d && d.getMonth() === currentMonth && d.getFullYear() === currentMonthYear;
      }).reduce((acc, o) => {
        const qty = Array.isArray(o.itemsDispatched) 
          ? o.itemsDispatched.reduce((itAcc: number, it: any) => itAcc + (Number(it.quantityToDispatch || it.quantity || it.quantity || 0)), 0)
          : Number(o.totalPrendas || o.total || 0);
        return acc + qty;
      }, 0);

      const getMonthlyStats = (isSample: boolean) => {
        const statsArr = [];
        
        // Indexar facturación para cruce rápido (Soporte individual, agrupado y por lote)
        const billedByEntryMap = new Map<string, any>();
        const billedLotsSet = new Set<string>();

        invoicesRaw.forEach(inv => {
          // A. Cruce por ID de ingreso directo
          if (inv.ingresoMaestroId) {
            billedByEntryMap.set(String(inv.ingresoMaestroId).toUpperCase(), inv);
          }
          
          // B. Cruce por arreglo de IDs (Facturación agrupada)
          if (Array.isArray(inv.ingresoMaestroIds)) {
            inv.ingresoMaestroIds.forEach((id: string) => billedByEntryMap.set(String(id).toUpperCase(), inv));
          }

          // C. Cruce por arreglo de ingresos (ingresos)
          if (Array.isArray(inv.ingresos)) {
            inv.ingresos.forEach((item: any) => {
              if (item) {
                const idStr = typeof item === 'string' ? item : (item.id || item.ingresoId || item.entryNumber || item.idIngreso);
                if (idStr) billedByEntryMap.set(String(idStr).toUpperCase(), inv);
              }
            });
          }

          // D. Cruce por arreglo de ingresosIds (ingresosIds)
          if (Array.isArray(inv.ingresosIds)) {
            inv.ingresosIds.forEach((item: any) => {
              if (item) {
                const idStr = typeof item === 'string' ? item : (item.id || item.ingresoId || item.entryNumber || item.idIngreso);
                if (idStr) billedByEntryMap.set(String(idStr).toUpperCase(), inv);
              }
            });
          }

          // E. Cruce Granular por Lote (Respaldo definitivo)
          if (Array.isArray(inv.lotesIncluidos)) {
            inv.lotesIncluidos.forEach((l: any) => {
              const lid = typeof l === 'string' ? l : (l.loteId || l.lotNumber || l.id);
              if (lid) billedLotsSet.add(String(lid).toUpperCase());
            });
          }
        });

        // Helper para resolver el nombre de lote visible
        const getVisibleLotNameLocal = (lote: any): string => {
          if (!lote) return "S/L";
          const candidates = [lote.lotNumber, lote.numeroLote, lote.loteId, lote.lote];
          for (const val of candidates) {
            if (val && String(val).trim()) return String(val).trim().toUpperCase();
          }
          return "S/L";
        };

        for (let i = 0; i < 5; i++) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const label = `${d.toLocaleString('es-ES', { month: 'long' })} ${d.getFullYear()}`.toUpperCase();
          
          const entriesInMonth = entriesRaw.filter(e => {
            const eDate = toDate(e.date || e.entryDate);
            return eDate && eDate.getMonth() === d.getMonth() && eDate.getFullYear() === d.getFullYear() && (isSample ? e.isSample === true : e.isSample !== true);
          });
          
          const total = entriesInMonth.length;
          
          const billed = entriesInMonth.filter(entry => {
            const entryId = String(entry.id).toUpperCase();
            const entryNum = String(entry.entryNumber || "").toUpperCase();
            
            // Determinar si está facturado cruzando todas las identidades posibles
            const invoiceFromId = billedByEntryMap.get(entryId);
            const invoiceFromNum = billedByEntryMap.get(entryNum);
            const invoice = invoiceFromId || invoiceFromNum;
            
            let isBilled = !!invoice || String(entry.estadoFacturacion || "").toUpperCase() === "FACTURADO";

            const rawLots = entry.lotes || entry.lots || [];
            // Si no hay match por ID maestro, verificar si al menos uno de los lotes está facturado
            if (!isBilled && rawLots.length > 0) {
              isBilled = rawLots.some((l: any) => billedLotsSet.has(getVisibleLotNameLocal(l)));
            }
            
            return isBilled;
          }).length;

          // Calcular cantidad total de prendas ingresadas en el mes
          const totalGarments = entriesInMonth.reduce((acc, e) => {
            const lotes = e.lotes || e.lots || [];
            return acc + lotes.reduce((lAcc: number, l: any) => lAcc + (Number(l.cantidadConfirmada || l.quantity || l.cantidad || 0)), 0);
          }, 0);

          // Calcular monto total facturado en el mes ($ USD) para esta categoría
          const invsInMonth = invoicesRaw.filter(inv => {
            if (!inv || inv.anulado) return false;
            const invDate = toDate(inv.fechaFactura || inv.createdAt || inv.invoiceDate || inv.date || inv.timestamp);
            const matchMonth = invDate && invDate.getMonth() === d.getMonth() && invDate.getFullYear() === d.getFullYear();
            
            const isSampleInvoice = 
              inv.isSample === true || 
              inv.tipoFactura === "muestra" || 
              (inv.ingresoMaestroId && entriesRaw.find(e => e.id === inv.ingresoMaestroId)?.isSample === true) ||
              (Array.isArray(inv.ingresoMaestroIds) && inv.ingresoMaestroIds.some((id: string) => entriesRaw.find(e => e.id === id)?.isSample === true));
              
            return matchMonth && (isSample ? isSampleInvoice : !isSampleInvoice);
          });
          const totalBilledAmount = invsInMonth.reduce((acc, inv) => acc + Number(inv.totalFactura || inv.total || 0), 0);

          statsArr.push({ 
            month: label, 
            count: `${billed}/${total}`, 
            pct: total > 0 ? Math.round((billed / total) * 100) : 0,
            totalGarments,
            totalBilledAmount
          });
        }
        return statsArr;
      };

      // 4. Tops
      const clientMap: Record<string, number> = {};
      const garmentMap: Record<string, number> = {};
      entriesRaw.forEach(e => {
        // Normalización de nombres de clientes para evitar duplicados invertidos (ej. OSCAR RECALDE vs RECALDE OSCAR)
        const rawName = String(e.clientName || "S/D").trim().toUpperCase();
        const words = rawName.split(/\s+/).filter(w => w.length > 0);
        words.sort();
        const name = words.length > 0 ? words.join(" ") : "S/D";

        const qty = (e.lotes || []).reduce((acc: number, l: any) => acc + (Number(l.cantidadConfirmada || l.quantity || l.cantidad || 0)), 0);
        clientMap[name] = (clientMap[name] || 0) + qty;
        (e.lotes || []).forEach((l: any) => {
          const type = (l.garmentType || "VARIOS").toUpperCase();
          garmentMap[type] = (garmentMap[type] || 0) + (Number(l.cantidadConfirmada || l.quantity || l.cantidad || 0));
        });
      });

      const topClients = Object.entries(clientMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
      const topGarments = Object.entries(garmentMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

      // 5. Cálculo Dinámico de "PROMEDIO ENTREGA"
      let totalDays = 0;
      let count = 0;

      outputsRaw.forEach(o => {
        const items = Array.isArray(o.itemsDispatched) ? o.itemsDispatched : (Array.isArray(o.lotes) ? o.lotes : []);
        
        if (items.length === 0) {
          const entryId = o.parentIngresoMaestro || o.entryNumber || o.numeroIngreso;
          if (entryId) {
            const parentEntry = entriesRaw.find(e => 
              String(e.id).toUpperCase() === String(entryId).toUpperCase() || 
              String(e.entryNumber || "").toUpperCase() === String(entryId).toUpperCase()
            );
            if (parentEntry) {
              const fechaIngreso = toDate(parentEntry.date || parentEntry.entryDate || parentEntry.createdAt);
              const fechaEntrega = toDate(o.date || o.fechaSalida || o.createdAt);
              if (fechaIngreso && fechaEntrega) {
                if (fechaEntrega.getMonth() === currentMonth && fechaEntrega.getFullYear() === currentMonthYear) {
                  const diffTime = fechaEntrega.getTime() - fechaIngreso.getTime();
                  const diffDays = diffTime / (1000 * 60 * 60 * 24);
                  if (diffDays >= 0) {
                    totalDays += diffDays;
                    count++;
                  }
                }
              }
            }
          }
          return;
        }

        items.forEach((item: any) => {
          if (!item) return;
          const entryId = item.parentIngresoMaestro || o.parentIngresoMaestro || o.entryNumber || o.numeroIngreso;
          if (!entryId) return;

          const parentEntry = entriesRaw.find(e => 
            String(e.id).toUpperCase() === String(entryId).toUpperCase() || 
            String(e.entryNumber || "").toUpperCase() === String(entryId).toUpperCase()
          );
          if (!parentEntry) return;

          const fechaIngreso = toDate(parentEntry.date || parentEntry.entryDate || parentEntry.createdAt);
          const outDateRaw = item.isClientDelivered && item.clientDeliveryTimestamp 
            ? item.clientDeliveryTimestamp 
            : (o.date || o.fechaSalida || o.createdAt);
          const fechaEntrega = toDate(outDateRaw);

          if (fechaIngreso && fechaEntrega) {
            if (fechaEntrega.getMonth() === currentMonth && fechaEntrega.getFullYear() === currentMonthYear) {
              const diffTime = fechaEntrega.getTime() - fechaIngreso.getTime();
              const diffDays = diffTime / (1000 * 60 * 60 * 24);
              if (diffDays >= 0) {
                totalDays += diffDays;
                count++;
              }
            }
          }
        });
      });

      const avgDeliveryCalculated = count > 0 ? Math.round(totalDays / count) : 0;

      // 5. Cálculo Dinámico de "ESTADO DE COBROS" (collectionStats)
      const getCollectionMonthlyStats = () => {
        const statsArr = [];
        const safePayments = paymentsRaw || [];

        for (let i = 0; i < 5; i++) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const label = `${d.toLocaleString('es-ES', { month: 'long' })} ${d.getFullYear()}`.toUpperCase();

          const invoicesInMonth = invoicesRaw.filter(inv => {
            const invDate = toDate(inv.fechaFactura || inv.createdAt || inv.invoiceDate || inv.date || inv.timestamp);
            return invDate && invDate.getMonth() === d.getMonth() && invDate.getFullYear() === d.getFullYear();
          });

          const total = invoicesInMonth.length;
          let paidCount = 0;

          invoicesInMonth.forEach(invoice => {
            const totalFactura = Number(invoice.totalFactura || invoice.total || 0);
            if (totalFactura <= 0) return;

            // Fusión y deduplicación de pagos para este invoice
            const uniqueMvs = new Map<string, any>();

            // 1. Pagos embebidos en el objeto factura
            const invoiceMovs = Array.isArray(invoice.pagosYajustes) 
              ? invoice.pagosYajustes 
              : (Array.isArray(invoice.pagosAjustes) ? invoice.pagosAjustes : []);
            
            invoiceMovs.forEach((m: any) => {
              if (!m || m.anulado) return;
              const pDate = toDate(m.fechaTransaccion || m.fecha || m.createdAt);
              const key = `${m.tipoTransaccion || m.tipo || 'PAGO'}-${Number(m.monto || 0)}-${pDate?.getTime() || 0}`;
              uniqueMvs.set(key, m);
            });

            // 2. Pagos globales en la colección 'payments' asociados a esta factura
            const globalPayDocs = safePayments.filter((p: any) => {
              if (!p || p.anulado) return false;
              const matchFacturaId = p.facturaId && invoice.id && String(p.facturaId).trim().toUpperCase() === String(invoice.id).trim().toUpperCase();
              const matchNumeroFactura = p.numeroFactura && invoice.numeroFactura && String(p.numeroFactura).trim().toUpperCase() === String(invoice.numeroFactura).trim().toUpperCase();
              return matchFacturaId || matchNumeroFactura;
            });

            globalPayDocs.forEach((p: any) => {
              if (!p) return;
              const pDate = toDate(p.fechaTransaccion || p.fecha || p.createdAt);
              const key = `${p.tipoTransaccion || 'PAGO'}-${Number(p.monto || 0)}-${pDate?.getTime() || 0}`;
              if (!uniqueMvs.has(key)) {
                uniqueMvs.set(key, p);
              }
            });

            const movimientos = Array.from(uniqueMvs.values());
            const totalCobrado = movimientos.reduce((acc: number, p: any) => {
              if (!p || p.anulado) return acc;
              const isReverso = p.tipoTransaccion === 'Reverso' || p.tipo === 'Reverso';
              return isReverso ? acc - Number(p.monto || 0) : acc + Number(p.monto || 0);
            }, 0);

            const saldo = totalFactura - totalCobrado;
            const isCobradaStatus = String(invoice.estadoCobranza || "").toUpperCase() === "COBRADA" || String(invoice.estadoCobranza || "").toUpperCase() === "PAGADA";
            if (saldo <= 0.01 || isCobradaStatus) {
              paidCount++;
            }
          });

          statsArr.push({
            month: label,
            count: `${paidCount}/${total}`,
            pct: total > 0 ? Math.round((paidCount / total) * 100) : 0
          });
        }
        return statsArr;
      };

      // 5. Cálculo de Ingresos Mensuales de Prendas (Producción)
      const production2026Calculated = Array(12).fill(0);

      entriesRaw.forEach(e => {
        const d = toDate(e.date || e.entryDate);
        if (d) {
          const year = d.getFullYear();
          const monthIdx = d.getMonth();
          const qty = (e.lotes || []).reduce((acc: number, l: any) => acc + (Number(l.cantidadConfirmada || l.quantity || l.cantidad || 0)), 0);
          
          if (year === currentYear) {
            production2026Calculated[monthIdx] += qty;
          }
        }
      });

      // 5.2 Cálculo de Salidas Mensuales (Prendas Despachadas)
      const dispatches2026Calculated = Array(12).fill(0);

      outputsRaw.forEach(o => {
        const d = toDate(o.date || o.fechaSalida || o.createdAt || o.fecha);
        if (d) {
          const year = d.getFullYear();
          const monthIdx = d.getMonth();
          const qty = Array.isArray(o.itemsDispatched) 
            ? o.itemsDispatched.reduce((itAcc: number, it: any) => itAcc + (Number(it.quantityToDispatch || it.quantity || 0)), 0)
            : Number(o.totalPrendas || o.total || 0);

          if (year === currentYear) {
            dispatches2026Calculated[monthIdx] += qty;
          }
        }
      });

      // 5.3 Cálculo de Facturación Mensual en USD (Venta Emitida)
      const billing2026Calculated = Array(12).fill(0);

      invoicesRaw.forEach(inv => {
        const d = toDate(inv.fechaFactura || inv.createdAt || inv.invoiceDate);
        if (d) {
          const year = d.getFullYear();
          const monthIdx = d.getMonth();
          const amount = Number(inv.totalFactura || inv.total || 0);

          if (year === currentYear) {
            billing2026Calculated[monthIdx] += amount;
          }
        }
      });

      // 6. Consolidación de Cache
      const newStats: CachedDashboardStats = {
        metrics: {
          ingresadasMes,
          despachadasMes,
          avgDelivery: avgDeliveryCalculated, 
          billingStats: getMonthlyStats(false),
          sampleStats: getMonthlyStats(true),
          collectionStats: getCollectionMonthlyStats(),
          production2026: production2026Calculated,
          production2025: PRODUCTION_2025,
          dispatches2026: dispatches2026Calculated,
          dispatches2025: DISPATCHES_2025,
          billing2026: billing2026Calculated,
          billing2025: BILLING_2025
        },
        charts: { topClients, topGarments },
        lastUpdate: new Date(),
        updatedBy: user?.displayName || user?.email || "System"
      };

      // Guardar en Firestore (Fuente de verdad estática)
      await setDoc(doc(db, "configuracion", "dashboard_cache"), {
        ...newStats,
        lastUpdate: serverTimestamp()
      });

      setStats(newStats);
      toast({ title: "Dashboard Actualizado", description: "Las métricas globales han sido recalculadas con éxito." });
    } catch (error) {
      console.warn("Error al refrescar dashboard:", error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Recuperando Snapshot de Control...</p>
      </div>
    );
  }

  // 7. Cálculos para comparativa anual de producción
  const currentMonthName = MONTH_NAMES[selectedMonthIdx];
  
  const production2026 = stats?.metrics?.production2026 || Array(12).fill(0);
  const production2025 = stats?.metrics?.production2025 || PRODUCTION_2025;
  
  const currentProduction2026 = production2026[selectedMonthIdx] || 0;
  const currentProduction2025 = production2025[selectedMonthIdx] || 0;
  
  const growthPct = currentProduction2025 > 0 
    ? ((currentProduction2026 - currentProduction2025) / currentProduction2025) * 100 
    : 0;

  const comparisonChartData = MONTH_NAMES.map((name, idx) => ({
    name: name.substring(0, 3).toUpperCase(),
    [String(currentYear - 1)]: production2025[idx],
    [String(currentYear)]: production2026[idx],
  }));

  // Métricas comparativas de Salidas
  const dispatches2026 = stats?.metrics?.dispatches2026 || Array(12).fill(0);
  const dispatches2025 = stats?.metrics?.dispatches2025 || DISPATCHES_2025;
  const currentDispatches2026 = dispatches2026[selectedMonthIdx] || 0;
  const currentDispatches2025 = dispatches2025[selectedMonthIdx] || 0;
  const dispatchesGrowthPct = currentDispatches2025 > 0 
    ? ((currentDispatches2026 - currentDispatches2025) / currentDispatches2025) * 100 
    : 0;

  const comparisonDispatchesChartData = MONTH_NAMES.map((name, idx) => ({
    name: name.substring(0, 3).toUpperCase(),
    [String(currentYear - 1)]: dispatches2025[idx],
    [String(currentYear)]: dispatches2026[idx],
  }));

  // Métricas comparativas de Facturación USD
  const billing2026 = stats?.metrics?.billing2026 || Array(12).fill(0);
  const billing2025 = stats?.metrics?.billing2025 || BILLING_2025;
  const currentBilling2026 = billing2026[selectedMonthIdx] || 0;
  const currentBilling2025 = billing2025[selectedMonthIdx] || 0;
  const billingGrowthPct = currentBilling2025 > 0 
    ? ((currentBilling2026 - currentBilling2025) / currentBilling2025) * 100 
    : 0;

  const comparisonBillingChartData = MONTH_NAMES.map((name, idx) => ({
    name: name.substring(0, 3).toUpperCase(),
    [String(currentYear - 1)]: billing2025[idx],
    [String(currentYear)]: billing2026[idx],
  }));

  return (
    <div className="min-h-screen bg-background -m-4 md:-m-8 lg:-m-12 p-4 md:p-8 lg:p-12 animate-in fade-in duration-700 overflow-x-hidden">
      
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <Database className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Snapshot Operativo</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3" />
              {stats ? `Actualizado el: ${toDate(stats.lastUpdate)?.toLocaleString('es-EC')}` : "Sin datos procesados"}
              {stats && (
                <span className="flex items-center gap-1.5 ml-2 border-l border-border pl-3">
                  <User className="h-3 w-3" /> {stats.updatedBy}
                </span>
              )}
            </p>
            {isReadOnly && <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-3 mt-2">Modo Solo Lectura</Badge>}
          </div>
        </div>

        {!isReadOnly && (
          <Button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-10 h-14 rounded-2xl shadow-xl shadow-primary/20 flex items-center gap-3 transition-all active:scale-95 uppercase tracking-widest text-xs"
          >
            {refreshing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCcw className="h-5 w-5" />}
            {refreshing ? "Recalculando..." : "Actualizar Datos Globales"}
          </Button>
        )}
      </div>

      {!stats ? (
        <div className="h-[50vh] flex flex-col items-center justify-center text-center space-y-6">
          <AlertCircle className="h-20 w-20 text-muted-foreground/20" />
          <div className="space-y-2">
            <h2 className="text-xl font-black uppercase">Dashboard sin inicializar</h2>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Presione el botón superior para calcular las métricas por primera vez.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8 max-w-[1600px] mx-auto animate-in slide-in-from-bottom-4 duration-700">
          {/* Fila 1: KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-card border-border shadow-premium rounded-3xl overflow-hidden group hover:border-primary/30 transition-all">
              <CardContent className="p-10 space-y-2">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] group-hover:text-primary transition-colors">INGRESADAS (MES)</p>
                <h3 className="text-5xl font-black text-foreground tracking-tighter">
                  {stats.metrics.ingresadasMes.toLocaleString('es-ES')}
                </h3>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-premium rounded-3xl overflow-hidden group hover:border-emerald-500/30 transition-all">
              <CardContent className="p-10 space-y-2">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] group-hover:text-emerald-600 transition-colors">DESPACHADAS (MES)</p>
                <h3 className="text-5xl font-black text-foreground tracking-tighter">
                  {stats.metrics.despachadasMes.toLocaleString('es-ES')}
                </h3>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-premium rounded-3xl overflow-hidden relative group hover:border-amber-500/30 transition-all">
              <div className="absolute top-8 right-8">
                <Clock className="h-5 w-5 text-muted-foreground/30 group-hover:text-amber-500/50 transition-colors" />
              </div>
              <CardContent className="p-10 space-y-2">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] group-hover:text-amber-600 transition-colors">PROMEDIO ENTREGA</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-5xl font-black text-foreground tracking-tighter">
                    {stats.metrics.avgDelivery > 0 ? stats.metrics.avgDelivery : "-"}
                  </h3>
                  {stats.metrics.avgDelivery > 0 && (
                    <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">días</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fila 2: Progreso */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="bg-card border-border shadow-premium rounded-[2.5rem] overflow-hidden">
              <CardHeader className="px-10 pt-10 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">Estado de Facturación (Producción)</CardTitle>
              </CardHeader>
              <CardContent className="px-10 pb-10 space-y-8">
                {stats.metrics.billingStats.map((item, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                      <span className="text-muted-foreground">{item.month}</span>
                      <span className="text-foreground/60">{item.count} <span className="text-[8px] opacity-50">({item.pct}%)</span></span>
                    </div>
                    <Progress value={item.pct} className="h-2 bg-muted rounded-full overflow-hidden" />
                    <div className="flex justify-between items-center text-[9px] font-bold text-muted-foreground/80 uppercase tracking-wider px-0.5">
                      <span>Prendas: {Number(item.totalGarments || 0).toLocaleString('es-EC')}</span>
                      <span>Facturado: ${(item.totalBilledAmount || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-premium rounded-[2.5rem] overflow-hidden">
              <CardHeader className="px-10 pt-10 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">Facturación de Muestras Técnicas</CardTitle>
              </CardHeader>
              <CardContent className="px-10 pb-10 space-y-8">
                {stats.metrics.sampleStats.map((item, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                      <span className="text-muted-foreground">{item.month}</span>
                      <span className="text-foreground/60">{item.count} <span className="text-[8px] opacity-50">({item.pct}%)</span></span>
                    </div>
                    <Progress value={item.pct} className="h-2 bg-muted rounded-full overflow-hidden" />
                    <div className="flex justify-between items-center text-[9px] font-bold text-muted-foreground/80 uppercase tracking-wider px-0.5">
                      <span>Prendas: {Number(item.totalGarments || 0).toLocaleString('es-EC')}</span>
                      <span>Facturado: ${(item.totalBilledAmount || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* NUEVA TARJETA: ESTADO DE COBROS */}
            <Card className="bg-card border-border shadow-premium rounded-[2.5rem] overflow-hidden">
              <CardHeader className="px-10 pt-10 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">ESTADO DE COBROS</CardTitle>
              </CardHeader>
              <CardContent className="px-10 pb-10 space-y-8">
                {stats.metrics.collectionStats.map((item, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                      <span className="text-muted-foreground">{item.month}</span>
                      <span className="text-foreground/60">{item.count} <span className="text-[8px] opacity-50">({item.pct}%)</span></span>
                    </div>
                    <Progress value={item.pct} className="h-2 bg-muted rounded-full overflow-hidden" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* NUEVO COMPARATIVO DE INGRESOS ANUALES (2025 vs 2026) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Indicador Visual / Barra de Estado Limpia */}
            <Card className="bg-card border-border shadow-premium rounded-[2.5rem] overflow-hidden lg:col-span-1 flex flex-col justify-between group hover:border-primary/30 transition-all">
              <CardHeader className="px-10 pt-10 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      {growthPct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <span>Crecimiento de Producción</span>
                  </div>
                  
                  {/* Controles de Mes Interactivo */}
                  <div className="flex items-center gap-1.5">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handlePrevMonth}
                      className="h-8 w-8 rounded-lg border-border hover:bg-muted text-foreground transition-all flex items-center justify-center font-bold"
                    >
                      ←
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handleNextMonth}
                      className="h-8 w-8 rounded-lg border-border hover:bg-muted text-foreground transition-all flex items-center justify-center font-bold"
                    >
                      →
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-10 pb-10 flex-1 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Mes Equivalente
                  </div>
                  <h4 className="text-xl font-bold uppercase text-foreground">
                    {currentMonthName} {currentYear} vs {currentYear - 1}
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Ingresos {currentYear}</span>
                      <p className="text-2xl font-black text-primary tracking-tight">
                        {currentProduction2026.toLocaleString('es-EC')} <span className="text-sm font-normal text-muted-foreground">unds</span>
                      </p>
                    </div>
                    <div className="space-y-1 border-l border-border pl-4">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Ingresos {currentYear - 1}</span>
                      <p className="text-2xl font-black text-muted-foreground/80 tracking-tight">
                        {currentProduction2025.toLocaleString('es-EC')} <span className="text-sm font-normal text-muted-foreground">unds</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tasa de Crecimiento</span>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1 ${growthPct >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                      {growthPct >= 0 ? "+" : ""}{growthPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="relative pt-1">
                    <div className="overflow-hidden h-3 text-xs flex rounded-full bg-muted">
                      {growthPct >= 0 ? (
                        <>
                          <div style={{ width: '50%' }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-muted-foreground/10"></div>
                          <div style={{ width: `${Math.min(50, growthPct)}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500 transition-all"></div>
                        </>
                      ) : (
                        <>
                          <div style={{ width: `${Math.max(0, 50 - Math.abs(growthPct))}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-muted"></div>
                          <div style={{ width: `${Math.min(50, Math.abs(growthPct))}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-rose-500 transition-all"></div>
                        </>
                      )}
                    </div>
                    <div className="flex justify-between text-[8px] font-black uppercase text-muted-foreground mt-1 tracking-widest">
                      <span>-50%</span>
                      <span>0% (Paridad)</span>
                      <span>+50%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de Comparación Anual */}
            <Card className="bg-card border-border shadow-premium rounded-[2.5rem] overflow-hidden lg:col-span-2 group hover:border-primary/30 transition-all">
              <CardHeader className="px-10 pt-10 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-3">
                  <div className="h-8 w-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  Comparativo de Ingreso de Prendas Mensual
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] px-10 pb-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonChartData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 10, fontWeight: '900' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 10, fontWeight: '900' }}
                      tickFormatter={(val) => val >= 1000 ? `${(val / 1000)}k` : val}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '16px', color: 'hsl(var(--foreground))', fontWeight: 'bold', fontSize: '12px' }}
                      formatter={(value: any) => [`${Number(value).toLocaleString('es-EC')} prendas`, '']}
                    />
                    <Bar dataKey={String(currentYear - 1)} fill="hsl(var(--muted-foreground)/0.4)" radius={[4, 4, 0, 0]} barSize={12} name={`${currentYear - 1} (Fijo)`} />
                    <Bar dataKey={String(currentYear)} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={12} name={`${currentYear} (Real)`} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* NUEVO COMPARATIVO DE SALIDAS ANUALES (2025 vs 2026) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="bg-card border-border shadow-premium rounded-[2.5rem] overflow-hidden lg:col-span-1 flex flex-col justify-between group hover:border-primary/30 transition-all">
              <CardHeader className="px-10 pt-10 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                      {dispatchesGrowthPct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <span>Crecimiento de Despachos</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-10 pb-10 flex-1 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Mes Equivalente
                  </div>
                  <h4 className="text-xl font-bold uppercase text-foreground">
                    {currentMonthName} {currentYear} vs {currentYear - 1}
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Salidas {currentYear}</span>
                      <p className="text-2xl font-black text-emerald-600 tracking-tight">
                        {currentDispatches2026.toLocaleString('es-EC')} <span className="text-sm font-normal text-muted-foreground">unds</span>
                      </p>
                    </div>
                    <div className="space-y-1 border-l border-border pl-4">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Salidas {currentYear - 1}</span>
                      <p className="text-2xl font-black text-muted-foreground/80 tracking-tight">
                        {currentDispatches2025.toLocaleString('es-EC')} <span className="text-sm font-normal text-muted-foreground">unds</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tasa de Crecimiento</span>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1 ${dispatchesGrowthPct >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                      {dispatchesGrowthPct >= 0 ? "+" : ""}{dispatchesGrowthPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="relative pt-1">
                    <div className="overflow-hidden h-3 text-xs flex rounded-full bg-muted">
                      {dispatchesGrowthPct >= 0 ? (
                        <>
                          <div style={{ width: '50%' }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-muted-foreground/10"></div>
                          <div style={{ width: `${Math.min(50, dispatchesGrowthPct)}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500 transition-all"></div>
                        </>
                      ) : (
                        <>
                          <div style={{ width: `${Math.max(0, 50 - Math.abs(dispatchesGrowthPct))}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-muted"></div>
                          <div style={{ width: `${Math.min(50, Math.abs(dispatchesGrowthPct))}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-rose-500 transition-all"></div>
                        </>
                      )}
                    </div>
                    <div className="flex justify-between text-[8px] font-black uppercase text-muted-foreground mt-1 tracking-widest">
                      <span>-50%</span>
                      <span>0% (Paridad)</span>
                      <span>+50%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de Comparación Anual Salidas */}
            <Card className="bg-card border-border shadow-premium rounded-[2.5rem] overflow-hidden lg:col-span-2 group hover:border-primary/30 transition-all">
              <CardHeader className="px-10 pt-10 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-3">
                  <div className="h-8 w-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  Comparativo de Despacho de Prendas Mensual
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] px-10 pb-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonDispatchesChartData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 10, fontWeight: '900' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 10, fontWeight: '900' }}
                      tickFormatter={(val) => val >= 1000 ? `${(val / 1000)}k` : val}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '16px', color: 'hsl(var(--foreground))', fontWeight: 'bold', fontSize: '12px' }}
                      formatter={(value: any) => [`${Number(value).toLocaleString('es-EC')} prendas`, '']}
                    />
                    <Bar dataKey={String(currentYear - 1)} fill="hsl(var(--muted-foreground)/0.4)" radius={[4, 4, 0, 0]} barSize={12} name={`${currentYear - 1} (Fijo)`} />
                    <Bar dataKey={String(currentYear)} fill="hsl(var(--emerald-500))" radius={[4, 4, 0, 0]} barSize={12} name={`${currentYear} (Real)`} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* NUEVO COMPARATIVO DE FACTURACIÓN USD ANUAL (2025 vs 2026) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="bg-card border-border shadow-premium rounded-[2.5rem] overflow-hidden lg:col-span-1 flex flex-col justify-between group hover:border-primary/30 transition-all">
              <CardHeader className="px-10 pt-10 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600">
                      {billingGrowthPct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <span>Crecimiento de Facturación USD</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-10 pb-10 flex-1 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Mes Equivalente
                  </div>
                  <h4 className="text-xl font-bold uppercase text-foreground">
                    {currentMonthName} {currentYear} vs {currentYear - 1}
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Facturado {currentYear}</span>
                      <p className="text-2xl font-black text-blue-600 tracking-tight">
                        ${currentBilling2026.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="space-y-1 border-l border-border pl-4">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Facturado {currentYear - 1}</span>
                      <p className="text-2xl font-black text-muted-foreground/80 tracking-tight">
                        ${currentBilling2025.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tasa de Crecimiento</span>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1 ${billingGrowthPct >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                      {billingGrowthPct >= 0 ? "+" : ""}{billingGrowthPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="relative pt-1">
                    <div className="overflow-hidden h-3 text-xs flex rounded-full bg-muted">
                      {billingGrowthPct >= 0 ? (
                        <>
                          <div style={{ width: '50%' }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-muted-foreground/10"></div>
                          <div style={{ width: `${Math.min(50, billingGrowthPct)}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500 transition-all"></div>
                        </>
                      ) : (
                        <>
                          <div style={{ width: `${Math.max(0, 50 - Math.abs(billingGrowthPct))}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-muted"></div>
                          <div style={{ width: `${Math.min(50, Math.abs(billingGrowthPct))}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-rose-500 transition-all"></div>
                        </>
                      )}
                    </div>
                    <div className="flex justify-between text-[8px] font-black uppercase text-muted-foreground mt-1 tracking-widest">
                      <span>-50%</span>
                      <span>0% (Paridad)</span>
                      <span>+50%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de Comparación Anual Facturación USD */}
            <Card className="bg-card border-border shadow-premium rounded-[2.5rem] overflow-hidden lg:col-span-2 group hover:border-primary/30 transition-all">
              <CardHeader className="px-10 pt-10 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-3">
                  <div className="h-8 w-8 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  Comparativo de Facturación Mensual (USD)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] px-10 pb-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonBillingChartData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 10, fontWeight: '900' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 10, fontWeight: '900' }}
                      tickFormatter={(val) => val >= 1000 ? `${(val / 1000)}k` : val}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '16px', color: 'hsl(var(--foreground))', fontWeight: 'bold', fontSize: '12px' }}
                      formatter={(value: any) => [`$${Number(value).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '']}
                    />
                    <Bar dataKey={String(currentYear - 1)} fill="hsl(var(--muted-foreground)/0.4)" radius={[4, 4, 0, 0]} barSize={12} name={`${currentYear - 1} (Fijo)`} />
                    <Bar dataKey={String(currentYear)} fill="hsl(var(--blue-500))" radius={[4, 4, 0, 0]} barSize={12} name={`${currentYear} (Real)`} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Fila 3: Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
            <Card className="bg-card border-border shadow-premium rounded-[2.5rem] overflow-hidden">
              <CardHeader className="px-10 pt-10">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-3">
                  <div className="h-8 w-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary"><Users className="h-4 w-4" /></div>
                  Top 5 Clientes por Volumen
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[350px] px-10 pb-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={stats.charts.topClients} margin={{ left: 20, right: 40, top: 20, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 10, fontWeight: '900' }} 
                      width={140}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '16px', color: 'hsl(var(--foreground))', fontWeight: 'bold', fontSize: '12px' }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-premium rounded-[2.5rem] overflow-hidden">
              <CardHeader className="px-10 pt-10">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-3">
                  <div className="h-8 w-8 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600"><Shirt className="h-4 w-4" /></div>
                  Concentración de Prendas por Tipo
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[350px] px-10 pb-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={stats.charts.topGarments} margin={{ left: 20, right: 40, top: 20, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 10, fontWeight: '900' }} 
                      width={140}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '16px', color: 'hsl(var(--foreground))', fontWeight: 'bold', fontSize: '12px' }}
                    />
                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
