
"use client";

import React from "react";
import { Chemical, ChemicalRecipe } from "@/types/chemical";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/reports-helpers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, Beaker } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChemicalsReportProps {
  chemicals: Chemical[];
  recipes: any[];
}

export function ChemicalsReport({ chemicals, recipes }: ChemicalsReportProps) {
  const totalStockKg = chemicals.reduce((acc, c) => acc + c.currentStockKg, 0);
  const totalValue = chemicals.reduce((acc, c) => acc + (c.currentStockKg * c.unitCost), 0);
  const totalRecipeCost = recipes.reduce((acc, r) => acc + r.totalChemicalCost, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center print:hidden">
        <h3 className="text-lg font-black uppercase tracking-tight">Análisis de Insumos</h3>
        <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 rounded-xl gap-2 shadow-lg">
          <Printer className="h-4 w-4" /> Imprimir Resumen
        </Button>
      </div>

      <div className="hidden print:block text-center mb-10 space-y-2">
        <img 
          src="/logo-lddec.png" 
          alt="Logo" 
          style={{ width: '2.5cm', height: '2.5cm', objectFit: 'contain', margin: '0 auto 10px auto', display: 'block' }} 
        />
        <h1 className="text-2xl font-black uppercase text-black">LAVANDERÍA DE DECORACIONES (LDDEC)</h1>
        <h2 className="text-lg font-bold uppercase text-black">RESUMEN ANALÍTICO DE QUÍMICOS</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Inversión en Stock</p>
          <p className="text-2xl font-black text-indigo-600">{formatCurrency(totalValue)}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Masa Total Stock</p>
          <p className="text-2xl font-black">{totalStockKg.toFixed(2)} kg</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Costo Consumo Recetas</p>
          <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalRecipeCost)}</p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-muted/20">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Nro. Insumos</p>
          <p className="text-2xl font-black">{chemicals.length}</p>
        </div>
      </div>

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="bg-muted/20 p-1 rounded-xl mb-6 print:hidden">
          <TabsTrigger value="inventory" className="rounded-lg font-bold px-6">Inventario</TabsTrigger>
          <TabsTrigger value="recipes" className="rounded-lg font-bold px-6">Recetas Aplicadas</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <div className="rounded-2xl border border-muted/20 bg-card overflow-hidden print:border-black print:rounded-none">
            <Table>
              <TableHeader className="bg-muted/30 print:bg-gray-100">
                <TableRow className="print:border-black">
                  <TableHead className="py-4 pl-6 text-xs font-bold uppercase tracking-widest print:text-black">Químico</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Proveedor</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-widest text-right print:text-black">Stock Actual</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-widest text-right print:text-black">C. Unitario</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-widest text-right print:text-black">Valorizado</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chemicals.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/5 print:border-black">
                    <TableCell className="font-bold pl-6 text-indigo-600 print:text-black">{c.chemicalName}</TableCell>
                    <TableCell className="text-sm font-medium print:text-black">{c.supplier}</TableCell>
                    <TableCell className="text-right font-black print:text-black">{c.currentStockKg.toFixed(2)} kg</TableCell>
                    <TableCell className="text-right text-muted-foreground print:text-black">{formatCurrency(c.unitCost)}/kg</TableCell>
                    <TableCell className="text-right font-bold print:text-black">{formatCurrency(c.currentStockKg * c.unitCost)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] uppercase font-black print:text-black print:border-black ${c.status === 'low_stock' ? 'text-amber-600' : ''}`}>
                        {c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="recipes">
          <div className="rounded-2xl border border-muted/20 bg-card overflow-hidden print:border-black print:rounded-none">
            <Table>
              <TableHeader className="bg-muted/30 print:bg-gray-100">
                <TableRow className="print:border-black">
                  <TableHead className="py-4 pl-6 text-xs font-bold uppercase tracking-widest print:text-black">Nro. Receta</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Lote</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Proceso</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-widest text-right print:text-black">Insumos</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-widest text-right print:text-black">Costo Mezcla</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-widest print:text-black">Responsable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipes.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/5 print:border-black">
                    <TableCell className="font-bold pl-6 print:text-black">{r.recipeNumber}</TableCell>
                    <TableCell className="text-sm font-medium print:text-black">{r.lotNumber}</TableCell>
                    <TableCell className="text-sm print:text-black">{r.process}</TableCell>
                    <TableCell className="text-right font-medium print:text-black">{r.items.length}</TableCell>
                    <TableCell className="text-right font-black text-emerald-600 print:text-black">{formatCurrency(r.totalChemicalCost)}</TableCell>
                    <TableCell className="text-sm print:text-black">{r.responsible}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
