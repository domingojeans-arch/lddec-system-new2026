
// TEMP_BACKUP_LAB
"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileJson, Database, AlertCircle, CheckCircle2 } from "lucide-react";
import { BackupFile, BackupDiagnostic } from "@/types/backup-import";

interface BackupSummaryCardsProps {
  files: BackupFile[];
  diagnostics: BackupDiagnostic[];
}

export function BackupSummaryCards({ files, diagnostics }: BackupSummaryCardsProps) {
  const totalRecords = files.reduce((acc, f) => acc + f.count, 0);
  const validFiles = diagnostics.filter(d => d.isValid).length;
  const criticalIssues = diagnostics.reduce((acc, d) => acc + d.issues.filter(i => i.severity === 'critical').length, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Card className="bg-card border-border shadow-premium rounded-2xl">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <FileJson className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Archivos</p>
            <p className="text-2xl font-black">{files.length} / 9</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-premium rounded-2xl">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Registros Totales</p>
            <p className="text-2xl font-black">{totalRecords.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-premium rounded-2xl">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Estructuras OK</p>
            <p className="text-2xl font-black text-emerald-500">{validFiles}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-premium rounded-2xl">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Alertas Críticas</p>
            <p className="text-2xl font-black text-destructive">{criticalIssues}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
