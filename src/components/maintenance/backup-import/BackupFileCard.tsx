
// TEMP_BACKUP_LAB
"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCode, Layers, Info, FolderOpen } from "lucide-react";
import { BackupFile } from "@/types/backup-import";
import { cn } from "@/lib/utils";

interface BackupFileCardProps {
  file: BackupFile;
}

export function BackupFileCard({ file }: BackupFileCardProps) {
  const isStandard = file.status === 'valid';

  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-all rounded-2xl overflow-hidden group shadow-sm">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
              isStandard ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-500"
            )}>
              <FileCode className="h-5 w-5" />
            </div>
            <div className="overflow-hidden">
              <h4 className="font-bold text-sm text-foreground truncate max-w-[180px]">{file.name}</h4>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                {isStandard ? "Archivo Estándar" : "Archivo Adicional"}
              </p>
            </div>
          </div>
          <Badge className={cn(
            "border-none text-[9px] font-black px-2",
            isStandard ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
          )}>
            {isStandard ? "COMPATIBLE" : "DETECTADO"}
          </Badge>
        </div>

        <div className="bg-muted/30 p-3 rounded-xl border border-border space-y-1.5 overflow-hidden">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FolderOpen className="h-3 w-3 shrink-0" />
            <p className="text-[9px] font-mono truncate tracking-tighter" title={file.originalPath}>
              {file.originalPath}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/20 p-3 rounded-xl border border-border">
            <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Registros</p>
            <div className="flex items-center gap-2">
              <Layers className="h-3 w-3 text-primary" />
              <span className="text-sm font-black">{file.count}</span>
            </div>
          </div>
          <div className="bg-muted/20 p-3 rounded-xl border border-border">
            <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Tamaño</p>
            <span className="text-sm font-bold">{(file.size / 1024).toFixed(1)} KB</span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-1.5">
            <Info className="h-3 w-3" /> Campos Detectados
          </p>
          <div className="flex flex-wrap gap-1.5">
            {file.fields.slice(0, 6).map(field => (
              <span key={field} className="text-[8px] font-bold bg-muted px-2 py-0.5 rounded text-muted-foreground uppercase tracking-tighter">
                {field}
              </span>
            ))}
            {file.fields.length > 6 && (
              <span className="text-[8px] font-bold text-primary">+{file.fields.length - 6} más</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
