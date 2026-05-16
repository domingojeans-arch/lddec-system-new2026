"use client";

import React from "react";
import { ChemicalRecipe } from "@/types/chemical-recipe";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlaskConical, Building2, Eye, Edit3, Shirt, Layers } from "lucide-react";

interface RecipeTableProps {
  recipes: ChemicalRecipe[];
  onView: (recipe: ChemicalRecipe) => void;
  onEdit: (recipe: ChemicalRecipe) => void;
}

const statusMap = {
  draft: { label: "Borrador", color: "bg-muted text-muted-foreground" },
  prepared: { label: "Preparada", color: "bg-cyan-500/10 text-cyan-600" },
  applied: { label: "Aplicada", color: "bg-emerald-500/10 text-emerald-600" },
};

export function RecipeTable({ recipes, onView, onEdit }: RecipeTableProps) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-b border-border">
            <TableHead className="py-5 pl-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">Receta / Socio</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Lote Operativo</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Proceso Técnico</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-right text-muted-foreground">Costo Químico</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Estado</TableHead>
            <TableHead className="text-right pr-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipes.map((recipe) => (
            <TableRow key={recipe.id} className="group hover:bg-muted/10 transition-all duration-200 border-b border-border">
              <TableCell className="py-5 pl-8">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-cyan-500/5 flex items-center justify-center shrink-0 border border-cyan-500/5">
                    <FlaskConical className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <div className="font-bold text-base text-foreground group-hover:text-cyan-600 transition-colors">
                      {recipe.recipeNumber}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                        {recipe.clientName}
                      </span>
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-bold text-foreground/80">{recipe.lotNumber}</span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">({recipe.entryNumber})</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                  <Shirt className="h-3.5 w-3.5" />
                  {recipe.process}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="font-black text-emerald-600">
                  ${recipe.totalChemicalCost.toFixed(2)}
                </div>
              </TableCell>
              <TableCell>
                <Badge 
                  variant="outline"
                  className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-[0.1em] border-none ${statusMap[recipe.status].color}`}
                >
                  {statusMap[recipe.status].label}
                </Badge>
              </TableCell>
              <TableCell className="text-right pr-8">
                <div className="flex items-center justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-cyan-600 hover:bg-cyan-500/5"
                    onClick={() => onView(recipe)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-cyan-600 hover:bg-cyan-500/5"
                    onClick={() => onEdit(recipe)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
