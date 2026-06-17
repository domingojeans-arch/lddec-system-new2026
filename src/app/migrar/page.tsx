"use client";

import React, { useState } from "react";
import { migrarPagosHistoricos } from "@/lib/payment-service";
import { Button } from "@/components/ui/button";

export default function MigrarPagosPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleMigrate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await migrarPagosHistoricos();
      setResult(res);
    } catch (e: any) {
      setResult({ success: false, error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-10 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Migración de Pagos Históricos</h1>
      <p>
        Haga clic en el botón a continuación para migrar todos los pagos que no
        estén reflejados en la colección global de pagos. Esto corregirá el
        problema de los pagos de mayo que no aparecen en los informes.
      </p>
      <Button onClick={handleMigrate} disabled={loading} className="w-full h-12">
        {loading ? "Migrando..." : "Ejecutar Migración"}
      </Button>

      {result && (
        <div className="p-4 bg-muted rounded-xl">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
