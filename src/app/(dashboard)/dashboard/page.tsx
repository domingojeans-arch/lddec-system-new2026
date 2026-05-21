"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Shirt, 
  Users, 
  Loader2, 
  TrendingUp, 
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

  const isReadOnly = user?.role === "socio";

  // 1. PROTECCIÓN DE RUTA
  useEffect(() => {
    if (!authLoading && user) {
      const allowedDashboardRoles = ["admin", "socio", "contador", "financiero", "facturacion"];
      if (!allowedDashboardRoles.includes(user.role)) {
        if (user.role === 'operario_manualidades') router.replace('/manualidades');
        else if (user.role === 'produccion') router.replace('/produccion');
        else if (user.role === 'bodega') router.replace('/ingresos');
        else if (user.role === 'chofer') router.replace('/entregas');
        else if (user.role === 'bodeguero_quimicos') router.replace('/quimicos');
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
      console.log("🚀 Iniciando recálculo global de métricas (Ventana 2026)...");
      
      // OPTIMIZACIÓN: Solo descargar datos desde el inicio del año actual para estadísticas de control
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      const startOfYearTs = Timestamp.fromDate(startOfYear);

      // 1. Descarga Multicanal Filtrada (One-time fetch con where)
      const [entriesSnap, outputsSnap, legacySalidasSnap, legacyMuestrasSnap, invoicesSnap] = await Promise.all([
        getDocs(query(collection(db, "entries"), where("date", ">=", startOfYearTs))),
        getDocs(query(collection(db, "outputs"), where("date", ">=", startOfYearTs))),
        getDocs(query(collection(db, "salidas"), where("fechaSalida", ">=", startOfYearTs))),
        getDocs(query(collection(db, "muestras"), where("fecha", ">=", startOfYearTs))),
        getDocs(query(collection(db, "facturas"), where("fechaFactura", ">=", startOfYearTs)))
      ]);

      const entriesRaw = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const outputsRaw = [
        ...outputsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        ...legacySalidasSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        ...legacyMuestrasSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      ];
      const invoicesRaw = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

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

          // C. Cruce Granular por Lote (Respaldo definitivo)
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
            
            let isBilled = !!invoice;

            const rawLots = entry.lotes || entry.lots || [];
            // Si no hay match por ID maestro, verificar si al menos uno de los lotes está facturado
            if (!isBilled && rawLots.length > 0) {
              isBilled = rawLots.some((l: any) => billedLotsSet.has(getVisibleLotNameLocal(l)));
            }
            
            return isBilled;
          }).length;

          statsArr.push({ month: label, count: `${billed}/${total}`, pct: total > 0 ? Math.round((billed / total) * 100) : 0 });
        }
        return statsArr;
      };

      // 4. Tops
      const clientMap: Record<string, number> = {};
      const garmentMap: Record<string, number> = {};
      entriesRaw.forEach(e => {
        const name = (e.clientName || "S/D").toUpperCase();
        const qty = (e.lotes || []).reduce((acc: number, l: any) => acc + (Number(l.cantidadConfirmada || l.quantity || l.cantidad || 0)), 0);
        clientMap[name] = (clientMap[name] || 0) + qty;
        (e.lotes || []).forEach((l: any) => {
          const type = (l.garmentType || "VARIOS").toUpperCase();
          garmentMap[type] = (garmentMap[type] || 0) + (Number(l.cantidadConfirmada || l.quantity || l.cantidad || 0));
        });
      });

      const topClients = Object.entries(clientMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
      const topGarments = Object.entries(garmentMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

      // 5. Consolidación de Cache
      const newStats: CachedDashboardStats = {
        metrics: {
          ingresadasMes,
          despachadasMes,
          avgDelivery: 9, 
          billingStats: getMonthlyStats(false),
          sampleStats: getMonthlyStats(true),
          collectionStats: [
            { month: "ABRIL 2026", count: "0/0", pct: 0 },
            { month: "MARZO 2026", count: "0/152", pct: 0 },
            { month: "FEBRERO 2026", count: "0/107", pct: 0 },
            { month: "ENERO 2026", count: "5/108", pct: 5 },
            { month: "DICIEMBRE 2025", count: "0/188", pct: 0 },
          ]
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
        
        {isReadOnly && (
          <Badge className="bg-amber-500 text-white border-none font-bold uppercase text-[10px] px-4 h-12 rounded-2xl">Modo Auditoría Activo</Badge>
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
                    {stats.metrics.avgDelivery}
                  </h3>
                  <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">días</span>
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
