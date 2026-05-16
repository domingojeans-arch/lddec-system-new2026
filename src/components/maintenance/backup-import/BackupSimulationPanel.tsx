
// TEMP_BACKUP_LAB
"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Code, Database, Layers, CheckCircle2 } from "lucide-react";
import { MappingSimulation } from "@/types/backup-import";

interface BackupSimulationPanelProps {
  simulations: MappingSimulation[];
}

export function BackupSimulationPanel({ simulations }: BackupSimulationPanelProps) {
  return (
    <div className="space-y-8">
      <div className="bg-primary/5 p-6 rounded-[2rem] border border-primary/10 mb-10">
        <h3 className="text-xl font-black uppercase tracking-tight text-primary flex items-center gap-3 mb-2">
          <Database className="h-6 w-6" />
          Simulación de Mapeo 1.1
        </h3>
        <p className="text-xs text-muted-foreground font-medium">
          Previsualización técnica de cómo los datos antiguos se transformarían a la estructura actual de DENIMLAB.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {simulations.map((sim, idx) => (
          <div key={idx} className="bg-card border border-border rounded-[2.5rem] p-8 shadow-premium">
            <div className="flex items-center justify-between border-b border-border pb-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-primary">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-black text-lg text-foreground">{sim.fileName}</h4>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-2">
                    Destino: <span className="text-primary">{sim.targetCollection}</span>
                  </p>
                </div>
              </div>
              <Badge className="bg-primary/10 text-primary border-none font-black px-4 py-1">
                {sim.compatibleCount} / {sim.totalCount} REGISTROS MAPEADOS
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  <Code className="h-3 w-3" /> Estructura Original (Respaldo)
                </div>
                <div className="bg-muted/30 p-6 rounded-2xl border border-border">
                  <pre className="text-[10px] font-mono text-muted-foreground overflow-x-auto">
                    {JSON.stringify(sim.sampleOriginal, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="space-y-4 relative">
                <div className="absolute left-[-25px] top-1/2 -translate-y-1/2 hidden lg:flex">
                  <ArrowRight className="h-6 w-6 text-primary/20" />
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary tracking-widest">
                  <CheckCircle2 className="h-3 w-3" /> TransformaciónDENIMLAB 1.1
                </div>
                <div className="bg-primary/5 p-6 rounded-2xl border border-primary/20">
                  <pre className="text-[10px] font-mono text-primary overflow-x-auto">
                    {JSON.stringify(sim.sampleMapped, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
