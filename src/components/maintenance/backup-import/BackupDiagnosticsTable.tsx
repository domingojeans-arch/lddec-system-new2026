
// TEMP_BACKUP_LAB
"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import { BackupDiagnostic } from "@/types/backup-import";
import { cn } from "@/lib/utils";

interface BackupDiagnosticsTableProps {
  diagnostics: BackupDiagnostic[];
}

export function BackupDiagnosticsTable({ diagnostics }: BackupDiagnosticsTableProps) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xl">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-[10px] font-black uppercase text-muted-foreground py-4 pl-8">Archivo</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Estado</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Cobertura</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Problemas Detectados</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-muted-foreground pr-8">Observación</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {diagnostics.map((diag, idx) => (
            <TableRow key={idx} className="border-border hover:bg-muted/20">
              <TableCell className="py-5 pl-8 font-bold text-sm">{diag.fileName}</TableCell>
              <TableCell>
                {diag.isValid ? (
                  diag.isTransformed ? (
                    <Badge className="bg-blue-500/10 text-blue-500 border-none gap-1.5 whitespace-nowrap">
                      <Sparkles className="h-3 w-3" /> COMPATIBLE (CON MAPEO)
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-none gap-1.5">
                      <CheckCircle2 className="h-3 w-3" /> COMPATIBLE
                    </Badge>
                  )
                ) : (
                  <Badge className="bg-destructive/10 text-destructive border-none gap-1.5">
                    <ShieldAlert className="h-3 w-3" /> REVISAR
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all", diag.coverage > 80 ? "bg-emerald-500" : "bg-amber-500")}
                      style={{ width: `${diag.coverage}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black">{diag.coverage}%</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {diag.issues.length > 0 ? (
                    diag.issues.map((issue, i) => (
                      <span key={i} className="text-[9px] font-bold text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {issue.issue.toUpperCase()}: {issue.field}
                      </span>
                    ))
                  ) : (
                    <span className="text-[9px] font-bold text-muted-foreground">SIN PROBLEMAS</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="pr-8 text-xs text-muted-foreground italic">{diag.observations}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
