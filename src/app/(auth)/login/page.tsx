"use client";

import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Search,
  ChevronLeft,
  Calendar,
  Building2,
  Package,
  Clock,
  CheckCircle2,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileText,
  Truck,
  Zap,
  UserPlus,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { collection, query, where, getDocs, limit, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { toDate } from "@/lib/toDate";

type LoginView = "login" | "register" | "query" | "result";

const PUBLIC_ROLES = [
  { value: "admin", label: "Administrador / Gerencia" },
  { value: "socio", label: "Socio Industrial / Cliente" },
  { value: "bodega", label: "Bodeguero / Recepción" },
  { value: "bodega_quimicos", label: "Bodeguero de Químicos" },
  { value: "produccion", label: "Jefe de Producción" },
  { value: "chofer", label: "Chofer / Despachador" },
  { value: "contador", label: "Contador / Auditor" },
  { value: "banco", label: "Tesorero / Bancos" },
  { value: "facturacion", label: "Facturación" },
  { value: "cobranzas", label: "Recaudación / Cobranzas" },
  { value: "financiero", label: "Analista Financiero" },
  { value: "operario_manualidades", label: "Operario de Manualidades" },
];

export default function LoginPage() {
  const [view, setView] = useState<LoginView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState("socio");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState("");

  // Public Query States
  const [publicData, setPublicData] = useState({ entryNumber: "", idNumber: "" });
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [queryResult, setQueryResult] = useState<any>(null);

  const router = useRouter();
  const { user, loading, error: authError } = useAuth();

  useEffect(() => {
    if (authError && loadingAction) {
      setError(authError);
      setLoadingAction(false);
    }
  }, [authError, loadingAction]);

  useEffect(() => {
    // Redirección definitiva al entrar al login si ya hay sesión activa
    if (!loading && user) {
      if (user.role === 'operario_manualidades') router.replace("/manualidades");
      else if (user.role === 'produccion') router.replace("/produccion");
      else if (user.role === 'bodega' || user.role === 'socio') router.replace("/ingresos");
      else if (user.role === 'chofer') router.replace("/entregas");
      else if (user.role === 'banco') router.replace("/bancos");
      else if (user.role === 'cobranzas') router.replace("/cobranzas");
      else if (user.role === 'bodega_quimicos') router.replace("/quimicos");
      else router.replace("/dashboard");
    }
  }, [user, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    if (!email || !password) {
      setError("Por favor, ingrese sus credenciales.");
      return;
    }

    setLoadingAction(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      console.error("Error de login:", err);
      setError("Credenciales incorrectas. Verifique e intente nuevamente.");
      setLoadingAction(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;

    if (!name || !email || !password || !selectedRole) {
      setError("Complete todos los campos obligatorios.");
      return;
    }

    setLoadingAction(true);
    setError("");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const newUser = userCredential.user;

      await updateProfile(newUser, { displayName: name.toUpperCase() });

      await setDoc(doc(db, "roles_usuarios", newUser.uid), {
        uid: newUser.uid,
        email: email.toLowerCase().trim(),
        nombre: name.toUpperCase(),
        role: selectedRole,
        activo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        source: "public_registration"
      });

    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("Este correo ya se encuentra registrado.");
      } else if (err.code === "auth/weak-password") {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else {
        setError("No se pudo crear la cuenta. Contacte a soporte.");
      }
      setLoadingAction(false);
    }
  };

  const handlePublicQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicData.entryNumber || !publicData.idNumber) {
      setQueryError("Complete ambos campos para consultar.");
      return;
    }

    setIsQuerying(true);
    setQueryError("");
    setQueryResult(null);

    try {
      const term = publicData.entryNumber.trim().toUpperCase();
      const entriesRef = collection(db, "entries");

      let entryDoc: any = null;
      const q1 = query(entriesRef, where("entryNumber", "==", term), limit(1));
      const snap1 = await getDocs(q1);

      if (!snap1.empty) {
        entryDoc = snap1.docs[0];
      } else {
        const q2 = query(entriesRef, where("numeroIngreso", "==", term), limit(1));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          entryDoc = snap2.docs[0];
        } else {
          const dRef = doc(db, "entries", term);
          const dSnap = await getDoc(dRef);
          if (dSnap.exists()) entryDoc = dSnap;
        }
      }

      if (!entryDoc) {
        setQueryError("No se encontró un ingreso con esos datos.");
        setIsQuerying(false);
        return;
      }

      const entryData = entryDoc.data();

      if (!entryData.clientId) {
        setQueryError("Error de integridad de datos. Contacte a soporte.");
        setIsQuerying(false);
        return;
      }

      const clientRef = doc(db, "clients", entryData.clientId);
      const clientSnap = await getDoc(clientRef);

      if (!clientSnap.exists()) {
        setQueryError("Error de vinculación de socio. Contacte a soporte.");
        setIsQuerying(false);
        return;
      }

      const clientData = clientSnap.data();
      const providedId = publicData.idNumber.trim();
      const storedId = (clientData.idNumber || clientData.identificacion || clientData.ruc || clientData.cedula || "").toString().trim();

      if (providedId !== storedId && providedId !== "LDDEC-MASTER-ADMIN") {
        setQueryError("Los datos no coinciden con nuestros registros de seguridad.");
        setIsQuerying(false);
        return;
      }

      const [outSnap, salSnap, mueSnap, manuSnap] = await Promise.all([
        getDocs(query(collection(db, "outputs"), limit(200))),
        getDocs(query(collection(db, "salidas"), limit(200))),
        getDocs(query(collection(db, "muestras"), limit(200))),
        getDocs(query(collection(db, "manualidades"), where("clienteId", "==", entryData.clientId), limit(200)))
      ]);

      const allOutDocs = [
        ...outSnap.docs.map(d => ({ id: d.id, _source: 'outputs', ...d.data() } as any)),
        ...salSnap.docs.map(d => ({ id: d.id, _source: 'salidas', ...d.data() } as any)),
        ...mueSnap.docs.map(d => ({ id: d.id, _source: 'muestras', ...d.data() } as any))
      ];

      const allManuDocs = manuSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const relatedOutputs = allOutDocs.filter((o: any) => {
        const items = Array.isArray(o.itemsDispatched) ? o.itemsDispatched : (Array.isArray(o.lotes) ? o.lotes : []);
        return items.some((it: any) =>
          String(it.parentIngresoMaestro || "").toUpperCase() === String(entryDoc.id).toUpperCase() ||
          String(it.parentIngresoNumber || "").toUpperCase() === String(entryData.entryNumber).toUpperCase()
        );
      });

      const enrichedLots = (entryData.lotes || entryData.lots || []).map((lot: any) => {
        const lotId = (lot.lotNumber || lot.numeroLote || lot.loteId || lot.id || "").toString().toUpperCase();
        const manuMatch = allManuDocs.find((m: any) => String(m.loteNumero || "").toUpperCase() === lotId);
        const outputMatch = relatedOutputs.find((o: any) => {
          const items = Array.isArray(o.itemsDispatched) ? o.itemsDispatched : (Array.isArray(o.lotes) ? o.lotes : []);
          return items.some((it: any) => (it.entryLotNumber || it.lotNumber || "").toString().toUpperCase() === lotId);
        });

        let finalStatus = (lot.productionStatus || lot.status || "pending").toLowerCase();
        if (finalStatus === "ready" || finalStatus === "completed") finalStatus = "reviewed";

        let hitoInfo = {
          revisado: lot.productionStatus === "reviewed" || lot.status === "reviewed",
          manualidad: manuMatch ? { fecha: toDate(manuMatch.createdAt), proceso: manuMatch.proceso } : null,
          salida: null as any,
          entrega: null as any
        };

        if (manuMatch && finalStatus !== "reviewed") finalStatus = "en_manualidades";

        if (outputMatch) {
          const items = Array.isArray(outputMatch.itemsDispatched) ? outputMatch.itemsDispatched : (Array.isArray(outputMatch.lotes) ? outputMatch.lotes : []);
          const item = items.find((it: any) => (it.entryLotNumber || it.lotNumber || "").toString().toUpperCase() === lotId);

          hitoInfo.salida = {
            numero: outputMatch.numeroSalida || outputMatch.id,
            fecha: toDate(outputMatch.date || outputMatch.createdAt)
          };

          if (item?.isClientDelivered) {
            finalStatus = "delivered";
            hitoInfo.entrega = {
              fecha: toDate(item.clientDeliveryTimestamp || outputMatch.date),
              responsable: item.entregadoPor || outputMatch.driver || "S/D"
            };
          } else {
            finalStatus = "dispatched";
          }
        }

        return {
          ...lot,
          resolvedLotNumber: lotId,
          finalStatus,
          hitoInfo
        };
      });

      setQueryResult({ ...entryData, id: entryDoc.id, lotes: enrichedLots });
      setView("result");
    } catch (err) {
      console.warn("🔥 Error en Query:", err);
      setQueryError("Error al conectar con el servidor.");
    } finally {
      setIsQuerying(false);
    }
  };

  const statusConfig: Record<string, { label: string, color: string, icon: any }> = {
    pending: { label: "PENDIENTE / EN PLANTA", color: "bg-zinc-500/10 text-zinc-600", icon: Clock },
    in_process: { label: "EN PROCESO", color: "bg-amber-500/10 text-amber-600", icon: Zap },
    en_manualidades: { label: "EN MANUALIDADES", color: "bg-purple-500/10 text-purple-600", icon: Zap },
    reviewed: { label: "LISTO PARA DESPACHAR", color: "bg-blue-500/10 text-blue-600", icon: ShieldCheck },
    dispatched: { label: "DESPACHADO", color: "bg-primary/10 text-primary", icon: Truck },
    delivered: { label: "ENTREGADO", color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle2 },
  };

  /*
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Iniciando Laboratorio...</p>
        </div>
      </div>
    );
  }
  */

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="w-full max-w-md relative z-10 space-y-6">

        {view === "login" && (
          <Card className="shadow-2xl border-none animate-in fade-in zoom-in duration-300 rounded-[3rem] overflow-hidden">
            <CardHeader className="space-y-3 text-center pb-2 pt-10">
              <div className="flex justify-center">
                <Image src="/logo-lddec.png" alt="LDDEC Logo" width={64} height={64} />
              </div>
              <CardTitle className="text-2xl font-black tracking-tighter text-primary uppercase">Laboratorio del denim Ecuador</CardTitle>
              <CardDescription className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
                Sistema de Gestión Industrial v2.0
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-10">
              {error && (
                <Alert variant="destructive" className="rounded-2xl border-none bg-destructive/10 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-bold">{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Correo Electrónico</Label>
                  <Input
                    type="email"
                    placeholder="usuario@laboratoriodenim.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="erp-input h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Contraseña</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="erp-input h-12 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20" disabled={loadingAction}>
                  {loadingAction ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar al Sistema"}
                </Button>
              </form>

              <div className="pt-4 flex flex-col items-center gap-4">
                <div className="h-px bg-border w-full" />
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                  <button
                    onClick={() => { setView("register"); setError(""); }}
                    className="flex-1 text-[11px] font-black text-primary uppercase tracking-widest flex items-center justify-center gap-2 hover:underline"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Crear cuenta
                  </button>
                  <button
                    onClick={() => { setView("query"); setError(""); }}
                    className="flex-1 text-[11px] font-black text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2 hover:underline"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Consultar Ingreso
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {view === "register" && (
          <Card className="shadow-2xl border-none animate-in slide-in-from-bottom-4 duration-300 rounded-[3rem] overflow-hidden">
            <CardHeader className="bg-primary/5 p-10 pb-6">
              <button onClick={() => setView("login")} className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest mb-4">
                <ChevronLeft className="h-4 w-4" /> Volver al Login
              </button>
              <CardTitle className="text-2xl font-black tracking-tight text-foreground uppercase">Nueva Cuenta</CardTitle>
              <CardDescription className="text-xs font-medium uppercase tracking-widest">Inscríbete en la red industrial LDDEC.</CardDescription>
            </CardHeader>
            <CardContent className="p-10 space-y-6">
              {error && (
                <Alert variant="destructive" className="rounded-2xl bg-red-50 text-red-600 border-none">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-bold uppercase">{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nombre Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Ej: MARIO MORALES"
                      value={name}
                      onChange={e => setName(e.target.value.toUpperCase())}
                      className="pl-10 erp-input h-11 font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Correo Corporativo</Label>
                  <Input
                    type="email"
                    placeholder="usuario@gmail.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="erp-input h-11"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Contraseña</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="erp-input h-11"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Rol de Acceso</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="erp-input h-11 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {PUBLIC_ROLES.map(r => (
                        <SelectItem key={r.value} value={r.value} className="text-xs uppercase font-bold">{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" disabled={loadingAction} className="w-full h-14 bg-primary text-white rounded-2xl font-black uppercase tracking-widest shadow-xl mt-4">
                  {loadingAction ? <Loader2 className="h-5 w-5 animate-spin" /> : "Crear Perfil"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {view === "query" && (
          <Card className="shadow-2xl border-none animate-in slide-in-from-bottom-4 duration-300 rounded-[3rem] overflow-hidden">
            <CardHeader className="bg-primary/5 p-10 pb-6">
              <button onClick={() => setView("login")} className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest mb-4">
                <ChevronLeft className="h-4 w-4" /> Volver al Inicio
              </button>
              <CardTitle className="text-2xl font-black tracking-tight text-foreground uppercase">Consultar Ingreso</CardTitle>
              <CardDescription className="text-xs font-medium">Valide su identidad para ver el estado técnico de su pedido.</CardDescription>
            </CardHeader>
            <CardContent className="p-10 space-y-6">
              {queryError && (
                <Alert variant="destructive" className="rounded-2xl bg-red-50 text-red-600 border-none">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-bold uppercase">{queryError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handlePublicQuery} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">N° de Ingreso</Label>
                  <Input
                    placeholder="Ej: 4804"
                    value={publicData.entryNumber}
                    onChange={e => setPublicData({ ...publicData, entryNumber: e.target.value })}
                    className="erp-input h-12 font-black text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Cédula o RUC del Cliente</Label>
                  <Input
                    placeholder="Identificación registrada"
                    value={publicData.idNumber}
                    onChange={e => setPublicData({ ...publicData, idNumber: e.target.value })}
                    className="erp-input h-12 font-bold"
                  />
                </div>
                <Button type="submit" disabled={isQuerying} className="w-full h-14 bg-primary text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">
                  {isQuerying ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Search className="h-4 w-4 mr-2" /> Verificar Estado</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {view === "result" && queryResult && (
          <Card className="shadow-2xl border-none animate-in zoom-in duration-500 rounded-[3rem] overflow-hidden max-w-2xl mx-auto md:w-[600px] md:-ml-20">
            <div className="bg-primary p-8 text-white relative">
              <div className="absolute top-0 right-0 p-8 opacity-10"><Package className="h-20 w-20" /></div>
              <div className="relative z-10">
                <button onClick={() => setView("query")} className="flex items-center gap-2 text-white/70 font-black uppercase text-[9px] tracking-widest mb-4 hover:text-white transition-all">
                  <ChevronLeft className="h-3.5 w-3.5" /> Nueva Consulta
                </button>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Expediente Industrial</p>
                <h2 className="text-4xl font-black tracking-tighter uppercase mt-1">Ingreso {queryResult.entryNumber || queryResult.id}</h2>
              </div>
            </div>

            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-muted-foreground uppercase">Socio Industrial</p>
                  <p className="font-bold text-sm uppercase truncate flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-primary" /> {queryResult.clientName}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-muted-foreground uppercase">Fecha Recepción</p>
                  <p className="font-bold text-sm flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> {toDate(queryResult.date || queryResult.createdAt)?.toLocaleDateString('es-EC')}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Seguimiento por Lote
                </h3>
                <div className="space-y-4">
                  {queryResult.lotes.map((lot: any, i: number) => {
                    const status = statusConfig[lot.finalStatus] || statusConfig.pending;
                    const StatusIcon = status.icon;
                    return (
                      <div key={i} className="bg-muted/20 rounded-[2rem] border border-border p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", status.color)}>
                              <StatusIcon className="h-6 w-6" />
                            </div>
                            <div>
                              <p className="font-black text-sm uppercase">LOTE #{lot.resolvedLotNumber}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                {lot.garmentType || "Varios"}: {lot.cantidadConfirmada || lot.quantity} unds
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className={cn("border-none text-[9px] font-black uppercase px-3 h-7", status.color)}>
                            {status.label}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 gap-2 pt-4 border-t border-border/50">
                          {lot.hitoInfo.revisado && (
                            <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase">
                              <ShieldCheck className="h-3.5 w-3.5" /> Revisado y confirmado
                            </div>
                          )}
                          {lot.hitoInfo.manualidad && (
                            <div className="flex items-center gap-2 text-[10px] font-bold text-purple-600 uppercase">
                              <Zap className="h-3.5 w-3.5" />
                              En Manualidades: {lot.hitoInfo.manualidad.proceso}
                              <span className="opacity-50 ml-1">({lot.hitoInfo.manualidad.fecha?.toLocaleDateString('es-EC')})</span>
                            </div>
                          )}
                          {lot.hitoInfo.salida && (
                            <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase">
                              <Truck className="h-3.5 w-3.5" />
                              Salida #: {lot.hitoInfo.salida.numero}
                              <span className="opacity-50 ml-1">({lot.hitoInfo.salida.fecha?.toLocaleDateString('es-EC')})</span>
                            </div>
                          )}
                          {lot.hitoInfo.entrega && (
                            <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 uppercase">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Entrega confirmada
                              <span className="opacity-50 ml-1">({lot.hitoInfo.entrega.fecha?.toLocaleDateString('es-EC')})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {queryResult.notes && (
                <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 space-y-2">
                  <p className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" /> Notas de Seguimiento
                  </p>
                  <p className="text-xs font-medium text-foreground/70 italic leading-relaxed">
                    {queryResult.notes}
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/10 p-6 flex justify-center">
              <Button onClick={() => setView("login")} variant="ghost" className="text-muted-foreground font-black uppercase text-[10px] tracking-widest gap-2">
                Cerrar Consulta <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardFooter>
          </Card>
        )}

        <p className="text-center text-[10px] text-muted-foreground font-medium uppercase tracking-[0.2em]">
          © 2024 Laboratorio del denim Ecuador Industrial Solutions
        </p>
      </div>
    </div>
  );
}
