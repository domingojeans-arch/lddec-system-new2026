
// TEMP_BACKUP_LAB
"use client";

import React, { useState } from "react";
import { Upload, X, ShieldCheck, RefreshCcw, Download, Terminal, Search, AlertCircle, PlayCircle, CheckCircle2, ShieldAlert, Database, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BackupFile, BackupDiagnostic, MappingSimulation, GlobalSimulationReport } from "@/types/backup-import";
import { readZipBackup } from "@/lib/backup-import/readZipBackup";
import { diagnoseFile } from "@/lib/backup-import/diagnoseBackupStructure";
import { simulateMapping } from "@/lib/backup-import/backupMappers";
import { downloadAnalysisJson } from "@/lib/backup-import/exportBackupReport";
import { runImportSimulation } from "@/lib/backup-import/simulateImport";
import { BackupSummaryCards } from "./BackupSummaryCards";
import { BackupFileCard } from "./BackupFileCard";
import { BackupDiagnosticsTable } from "./BackupDiagnosticsTable";
import { BackupSimulationPanel } from "./BackupSimulationPanel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const IMPORT_BACKUP_MODE = "MEMORY_ONLY";

export function BackupImportPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [diagnostics, setDiagnostics] = useState<BackupDiagnostic[]>([]);
  const [simulations, setSimulations] = useState<MappingSimulation[]>([]);
  const [simulationReport, setSimulationReport] = useState<GlobalSimulationReport | null>(null);
  const [activeTab, setActiveTab] = useState("archivos");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setSimulationReport(null);
    try {
      const detected = await readZipBackup(file);
      
      if (detected.length === 0) {
        toast({ 
          variant: "destructive", 
          title: "Archivo Inválido", 
          description: "El ZIP no contiene ningún archivo .json legible." 
        });
        setLoading(false);
        return;
      }

      const diags = detected.map(f => diagnoseFile(f));
      // Procesar mapeo con contexto global de archivos para resolución de IDs
      const sims = detected.map(f => simulateMapping(f.name, f.data, detected));

      setFiles(detected);
      setDiagnostics(diags);
      setSimulations(sims);
      toast({ title: "Análisis Completado", description: `${detected.length} archivos procesados en memoria.` });
      
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Ocurrió un error crítico al procesar el respaldo." });
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateImport = () => {
    if (simulations.length === 0) return;
    const report = runImportSimulation(simulations);
    setSimulationReport(report);
    setActiveTab("sim-carga");
    
    if (report.canImport) {
      toast({ title: "Simulación Exitosa", description: "Todos los datos son consistentes para la carga." });
    } else {
      toast({ variant: "destructive", title: "Errores Detectados", description: "Existen inconsistencias críticas en los datos." });
    }
  };

  const handleClear = () => {
    setFiles([]);
    setDiagnostics([]);
    setSimulations([]);
    setSimulationReport(null);
    setActiveTab("archivos");
    toast({ title: "Memoria Liberada", description: "El análisis ha sido eliminado del sistema local." });
  };

  const handleDownloadReport = () => {
    downloadAnalysisJson(files, diagnostics, simulations);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* MODO LABORATORIO BANNER */}
      <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between sticky top-2 z-40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-amber-500" />
          <div className="space-y-0.5">
            <p className="text-xs font-black uppercase text-amber-500 tracking-widest">Laboratorio de Datos: {IMPORT_BACKUP_MODE}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Validación profunda en memoria. No se altera la base de datos de producción.</p>
          </div>
        </div>
        <Badge className="bg-amber-500 text-white border-none font-bold text-[9px] px-3">SANDBOX ACTIVE</Badge>
      </div>

      {files.length === 0 ? (
        <div className="bg-card p-20 rounded-[3rem] border-2 border-dashed border-border flex flex-col items-center justify-center text-center space-y-8 group hover:border-primary/30 transition-all">
          <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Upload className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black uppercase tracking-tight text-foreground">Subir Respaldo Industrial</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
              Selecciona el archivo .ZIP generado por LDDEC. El sistema procesará los archivos JSON internos para validar su estructura y compatibilidad.
            </p>
          </div>
          <div className="relative">
            <input 
              type="file" 
              accept=".zip" 
              onChange={handleFileUpload} 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              disabled={loading}
            />
            <Button className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest px-12 h-14 rounded-2xl shadow-xl shadow-primary/20">
              {loading ? "Procesando..." : "Analizar Respaldo ZIP"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <h2 className="text-3xl font-black uppercase tracking-tight text-foreground">Panel de Auditoría de Respaldo</h2>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleSimulateImport} className="rounded-xl font-bold h-11 border-primary/20 gap-2 bg-primary/5 text-primary hover:bg-primary/10">
                <PlayCircle className="h-4 w-4" /> Simular Carga
              </Button>
              <Button variant="outline" onClick={handleDownloadReport} className="rounded-xl font-bold h-11 border-border gap-2 bg-card text-foreground">
                <Download className="h-4 w-4" /> Exportar Reporte
              </Button>
              <Button variant="ghost" onClick={handleClear} className="rounded-xl font-bold h-11 text-muted-foreground hover:text-destructive hover:bg-destructive/5 gap-2">
                <RefreshCcw className="h-4 w-4" /> Limpiar
              </Button>
            </div>
          </div>

          <BackupSummaryCards files={files} diagnostics={diagnostics} />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-muted/30 p-1.5 h-14 rounded-2xl w-fit gap-2 mb-10 border border-border">
              <TabsTrigger value="archivos" className="px-8 h-full rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-md font-bold text-xs uppercase tracking-widest">Contenido ZIP</TabsTrigger>
              <TabsTrigger value="diagnostico" className="px-8 h-full rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-md font-bold text-xs uppercase tracking-widest">Campos</TabsTrigger>
              <TabsTrigger value="simulacion" className="px-8 h-full rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-md font-bold text-xs uppercase tracking-widest">Transformación</TabsTrigger>
              <TabsTrigger value="sim-carga" className="px-8 h-full rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-md font-bold text-xs uppercase tracking-widest">Simulación de Carga</TabsTrigger>
              <TabsTrigger value="reporte" className="px-8 h-full rounded-xl data-[state=active]:bg-card data-[state=active]:shadow-md font-bold text-xs uppercase tracking-widest">Finalizar</TabsTrigger>
            </TabsList>

            <TabsContent value="archivos" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {files.map(file => (
                  <BackupFileCard key={file.id} file={file} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="diagnostico" className="mt-0">
              <BackupDiagnosticsTable diagnostics={diagnostics} />
            </TabsContent>

            <TabsContent value="simulacion" className="mt-0">
              <BackupSimulationPanel simulations={simulations} />
            </TabsContent>

            <TabsContent value="sim-carga" className="mt-0 space-y-8">
              {!simulationReport ? (
                <div className="h-64 flex flex-col items-center justify-center bg-card border-2 border-dashed border-border rounded-[2.5rem] text-muted-foreground gap-4">
                  <Database className="h-12 w-12 opacity-10" />
                  <p className="font-bold text-sm uppercase tracking-widest">La simulación audita la integridad referencial de los datos transformados</p>
                  <Button onClick={handleSimulateImport} className="bg-primary hover:bg-primary/90 text-white font-bold h-12 px-10 rounded-xl">
                    Ejecutar Simulación de Carga
                  </Button>
                </div>
              ) : (
                <div className="space-y-8 animate-in zoom-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-emerald-500/10 p-6 rounded-2xl border border-emerald-500/20 text-center">
                      <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Registros Aptos</p>
                      <p className="text-4xl font-black text-emerald-600">{simulationReport.totalReady}</p>
                    </div>
                    <div className="bg-amber-500/10 p-6 rounded-2xl border border-amber-500/20 text-center">
                      <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Advertencias</p>
                      <p className="text-4xl font-black text-amber-600">{simulationReport.totalWarnings}</p>
                    </div>
                    <div className="bg-destructive/10 p-6 rounded-2xl border border-destructive/20 text-center">
                      <p className="text-[10px] font-black text-destructive uppercase mb-1">Errores Críticos</p>
                      <p className="text-4xl font-black text-destructive">{simulationReport.totalErrors}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase py-4 pl-8">Colección</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center">Total</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center text-emerald-600">Listos</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center text-amber-600">Aviso</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-center text-destructive">Error</TableHead>
                          <TableHead className="text-[10px] font-black uppercase pr-8">Auditoría Referencial</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {simulationReport.results.map((res, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="pl-8 font-bold uppercase text-xs">{res.collection}</TableCell>
                            <TableCell className="text-center font-black">{res.total}</TableCell>
                            <TableCell className="text-center font-bold text-emerald-600">{res.ready}</TableCell>
                            <TableCell className="text-center font-bold text-amber-600">{res.warnings}</TableCell>
                            <TableCell className="text-center font-bold text-destructive">{res.errors}</TableCell>
                            <TableCell className="pr-8 py-4">
                              <div className="flex flex-col gap-1">
                                {res.details.length > 0 ? (
                                  res.details.map((d, i) => (
                                    <span key={i} className="text-[9px] font-medium text-muted-foreground flex items-center gap-1">
                                      <Info className="h-2.5 w-2.5 shrink-0" /> {d}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[9px] font-black text-emerald-600 uppercase">Integridad referencial validada</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="reporte" className="mt-0 outline-none">
              <div className="bg-card p-12 rounded-[3rem] border border-border text-center space-y-10">
                <div className={cn(
                  "h-20 w-20 rounded-full flex items-center justify-center mx-auto",
                  simulationReport?.canImport ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                )}>
                  {simulationReport?.canImport ? <ShieldCheck className="h-10 w-10" /> : <ShieldAlert className="h-10 w-10" />}
                </div>
                <div className="space-y-4">
                  <h3 className="text-4xl font-black uppercase tracking-tight text-foreground">Estado Final del Laboratorio</h3>
                  <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    {simulationReport?.canImport 
                      ? "La auditoría de simulación es exitosa. Los datos están normalizados y las relaciones entre registros son consistentes."
                      : "Se requiere ejecutar y aprobar la simulación de carga sin errores críticos para habilitar el motor de importación real."}
                  </p>
                </div>
                <div className="pt-6 flex flex-col sm:flex-row justify-center gap-4">
                  <Button onClick={handleDownloadReport} variant="outline" className="h-16 px-10 rounded-2xl font-bold uppercase tracking-widest">
                    Descargar Log de Simulación
                  </Button>
                  <Button 
                    disabled={!simulationReport?.canImport}
                    className="bg-[#3b82f6] hover:bg-[#2563eb] text-white font-black uppercase tracking-widest px-12 h-16 rounded-2xl shadow-xl shadow-blue-500/20 gap-3 disabled:opacity-20"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Iniciar Carga Real a Firebase
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
