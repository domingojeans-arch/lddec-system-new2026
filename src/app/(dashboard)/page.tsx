"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function DashboardRootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      // Lógica central de aterrizaje por rol usando REPLACE para limpiar historial
      const dashboardRoles = ["admin", "socio", "contador", "financiero", "facturacion"];
      
      if (dashboardRoles.includes(user.role)) {
        router.replace("/dashboard");
      } else if (user.role === 'operario_manualidades') {
        router.replace("/manualidades");
      } else if (user.role === 'produccion') {
        router.replace("/produccion");
      } else if (user.role === 'bodega') {
        router.replace("/ingresos");
      } else if (user.role === 'chofer') {
        router.replace("/entregas");
      } else if (user.role === 'banco') {
        router.replace("/bancos");
      } else if (user.role === 'cobranzas') {
        router.replace("/cobranzas");
      } else if (user.role === 'bodeguero_quimicos') {
        router.replace("/quimicos");
      } else {
        router.replace("/ingresos");
      }
    } else if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Estableciendo entorno industrial...</p>
    </div>
  );
}