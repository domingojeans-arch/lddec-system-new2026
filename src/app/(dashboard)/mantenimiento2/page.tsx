"use client";

import React from "react";
import { Settings, Calendar, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Mantenimiento2Page() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="space-y-1">
        <h1 className="text-4xl font-black uppercase tracking-tighter text-foreground">MANTENIMIENTO GLOBAL</h1>
        <p className="text-muted-foreground text-sm font-medium">Panel de control de parámetros, catálogos y perfiles.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[38%_62%] gap-8 items-start">
        {/* COLUMNA IZQUIERDA */}
        <div className="space-y-8">
          {/* TARJETA 1: PRODUCCIÓN */}
          <Card className="rounded-[24px] border border-border shadow-premium overflow-hidden bg-card">
            <CardHeader className="bg-muted/30 border-b border-border py-4 px-6">
              <CardTitle className="text-sm font-black uppercase flex items-center gap-3">
                <Settings className="h-5 w-5 text-primary" />
                1. PRODUCCIÓN
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">PROMEDIO DÍAS ENTREGA</Label>
                <Input type="number" defaultValue="9" className="erp-input h-12 text-sm font-bold rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">LÍMITE DÍAS ALERTA</Label>
                <Input type="number" defaultValue="9" className="erp-input h-12 text-sm font-bold rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">CUPO SEMANAL (PRENDAS)</Label>
                <Input type="number" defaultValue="6500" className="erp-input h-12 text-sm font-bold rounded-xl" />
              </div>
              <Button className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-black uppercase tracking-widest h-12 rounded-xl mt-4 shadow-lg shadow-blue-500/20">
                ACTUALIZAR PRODUCCIÓN
              </Button>
            </CardContent>
          </Card>

          {/* TARJETA 2: AÑO FISCAL */}
          <Card className="rounded-[24px] border border-border shadow-premium overflow-hidden bg-card">
            <CardHeader className="bg-[#fffbeb] border-b border-[#fef3c7] py-4 px-6">
              <CardTitle className="text-sm font-black uppercase flex items-center gap-3 text-amber-900">
                <Calendar className="h-5 w-5 text-amber-600" />
                2. AÑO FISCAL
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">EJERCICIO ACTIVO</Label>
                <div className="flex gap-4 items-center">
                  <div className="flex-1 bg-muted/20 border border-border h-14 rounded-xl flex items-center px-6 text-2xl font-black text-foreground">
                    2026
                  </div>
                  <Button className="bg-[#f97316] hover:bg-[#ea580c] text-white font-black uppercase tracking-widest h-14 px-10 rounded-xl shadow-lg shadow-orange-500/20">
                    ESTABLECER
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="h-full">
          {/* TARJETA 3: TARIFARIO DE MANUALIDADES */}
          <Card className="rounded-[24px] border border-border shadow-premium overflow-hidden bg-card h-full min-h-[600px]">
            <CardHeader className="bg-muted/30 border-b border-border py-4 px-6">
              <CardTitle className="text-sm font-black uppercase flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                TARIFARIO DE MANUALIDADES
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              {/* FORMULARIO SUPERIOR */}
              <div className="border-2 border-dashed border-blue-100 bg-blue-50/5 p-8 rounded-2xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">PROCESO MANUAL</Label>
                    <Select>
                      <SelectTrigger className="erp-input h-11 bg-background">
                        <SelectValue placeholder="Seleccione..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="arruga">ARRUGA T.</SelectItem>
                        <SelectItem value="bigote">BIGOTE</SelectItem>
                        <SelectItem value="diseno">BIGOTE DISEÑO</SelectItem>
                        <SelectItem value="quimico">BIGOTE QUIMICO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">P. ADULTO ($)</Label>
                    <Input type="number" step="0.001" placeholder="0.000" className="erp-input h-11 bg-background font-bold text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">P. NIÑO ($)</Label>
                    <Input type="number" step="0.001" placeholder="0.000" className="erp-input h-11 bg-background font-bold text-emerald-600" />
                  </div>
                </div>
                <div className="flex justify-start">
                  <Button className="bg-[#60a5fa] hover:bg-[#3b82f6] text-white font-black uppercase text-[10px] tracking-widest h-10 px-8 rounded-lg transition-all active:scale-95">
                    ACTUALIZAR
                  </Button>
                </div>
              </div>

              {/* TABLA DE TARIFAS */}
              <div className="space-y-4">
                <div className="rounded-xl border border-border overflow-hidden bg-background shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-b border-border">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4 pl-6">MANUALIDAD</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">P. ADULTO</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">P. NIÑO</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { name: "ARRUGA T.", adulto: "$0.120", nino: "$0.100" },
                        { name: "BIGOTE", adulto: "$0.080", nino: "$0.020" },
                        { name: "BIGOTE DISEÑO", adulto: "$0.120", nino: "$0.100" },
                        { name: "BIGOTE QUIMICO", adulto: "$0.080", nino: "$0.070" },
                      ].map((row, i) => (
                        <TableRow key={i} className="border-b border-border last:border-0 hover:bg-muted/5 transition-colors">
                          <TableCell className="py-4 pl-6 font-bold text-xs uppercase text-foreground">{row.name}</TableCell>
                          <TableCell className="text-center font-black text-sm text-[#3b82f6]">{row.adulto}</TableCell>
                          <TableCell className="text-center font-black text-sm text-[#10b981]">{row.nino}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
