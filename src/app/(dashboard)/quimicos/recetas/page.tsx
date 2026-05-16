"use client";

import React, { useState, useMemo } from "react";
import { Search, FlaskConical, SlidersHorizontal, ArrowUpDown, Plus, LayoutGrid, List, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChemicalRecipe, ChemicalRecipeInput, ChemicalRecipeItem } from "@/types/chemical-recipe";
import { mockChemicalRecipes } from "@/data/mock-chemical-recipes";
import { RecipeTable } from "@/components/quimicos/recipes/recipe-table";
import { RecipeCard } from "@/components/quimicos/recipes/recipe-card";
import { RecipeForm } from "@/components/quimicos/recipes/recipe-form";
import { RecipeDetail } from "@/components/quimicos/recipes/recipe-detail";
import { useAuth } from "@/hooks/use-auth";

export default function ChemicalRecipesPage() {
  const [recipes, setRecipes] = useState<ChemicalRecipe[]>(mockChemicalRecipes);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [editingRecipe, setEditingRecipe] = useState<ChemicalRecipe | undefined>(undefined);
  const [viewingRecipe, setViewingRecipe] = useState<ChemicalRecipe | undefined>(undefined);
  
  const { toast } = useToast();
  const { user } = useAuth();

  const canEdit = user?.role === "admin" || user?.role === "produccion" || user?.role === "bodeguero_quimicos";

  const filteredRecipes = useMemo(() => {
    return recipes.filter(rec => 
      rec.recipeNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
      rec.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.process.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [recipes, searchTerm]);

  const handleOpenNew = () => {
    if (!canEdit) {
      toast({ variant: "destructive", title: "Acceso Denegado", description: "No tienes permisos para registrar recetas." });
      return;
    }
    setEditingRecipe(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (recipe: ChemicalRecipe) => {
    if (!canEdit) {
      toast({ variant: "destructive", title: "Acceso Denegado", description: "No tienes permisos para editar." });
      return;
    }
    setEditingRecipe(recipe);
    setIsFormOpen(true);
  };

  const handleView = (recipe: ChemicalRecipe) => {
    setViewingRecipe(recipe);
    setIsDetailOpen(true);
  };

  const handleFormSubmit = (data: ChemicalRecipeInput & { items: ChemicalRecipeItem[] }) => {
    const totalChemicalCost = data.items.reduce((acc, item) => acc + item.totalCost, 0);
    
    if (editingRecipe) {
      setRecipes(prev => prev.map(r => 
        r.id === editingRecipe.id 
          ? { 
              ...r, ...data, 
              totalChemicalCost,
              updatedAt: new Date().toISOString() 
            } 
          : r
      ));
      toast({ title: "Receta Actualizada", description: `La receta ${data.recipeNumber} ha sido guardada.` });
    } else {
      const newRecipe: ChemicalRecipe = {
        ...data,
        id: Math.random().toString(36).substr(2, 9),
        totalChemicalCost,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setRecipes(prev => [newRecipe, ...prev]);
      toast({ title: "Receta Creada", description: `Se ha registrado la nueva fórmula técnica ${data.recipeNumber}.` });
    }
    setIsFormOpen(false);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-cyan-600 font-black text-[10px] uppercase tracking-[0.3em] mb-1">
            <FlaskConical className="h-3.5 w-3.5" />
            Chemical Formulas
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-primary">
            Recetas y Consumos
          </h1>
          <p className="text-muted-foreground text-base max-w-xl leading-relaxed font-medium">
            Gestión técnica de fórmulas químicas por lote. Registra consumos precisos para calcular el costo de procesamiento por prenda.
          </p>
        </div>
        
        {canEdit && (
          <Button 
            onClick={handleOpenNew} 
            className="gap-3 h-14 px-8 shadow-2xl shadow-cyan-600/10 hover:shadow-cyan-600/20 transition-all rounded-2xl bg-cyan-600 text-white font-bold group"
          >
            <Plus className="h-5 w-5 group-hover:scale-110 transition-transform" />
            Nueva Receta Técnica
          </Button>
        )}
      </div>

      {/* Toolbar Section */}
      <div className="flex flex-col sm:flex-row gap-5 items-center justify-between bg-card/50 backdrop-blur-sm p-2 rounded-2xl border border-muted/20">
        <div className="relative w-full sm:max-w-lg group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-cyan-600 transition-colors" />
          <Input 
            placeholder="Buscar por Nro, Lote, Cliente o Proceso..." 
            className="pl-12 h-12 bg-transparent border-none shadow-none text-base rounded-xl transition-all focus-visible:ring-cyan-600/20"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3 shrink-0 pr-2">
          <div className="flex items-center bg-muted/20 p-1 rounded-xl mr-2">
            <Button 
              variant={viewMode === "list" ? "secondary" : "ghost"} 
              size="icon" 
              onClick={() => setViewMode("list")}
              className="h-9 w-9 rounded-lg"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === "grid" ? "secondary" : "ghost"} 
              size="icon" 
              onClick={() => setViewMode("grid")}
              className="h-9 w-9 rounded-lg"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl hover:bg-cyan-600/5 hover:text-cyan-600">
            <Filter className="h-4 w-4" />
          </Button>
          <div className="h-8 w-px bg-muted/30 mx-1" />
          <div className="text-[11px] font-black text-muted-foreground px-4 py-2 bg-muted/20 rounded-xl uppercase tracking-widest">
            <span className="text-cyan-600">{filteredRecipes.length}</span> Recetas
          </div>
        </div>
      </div>

      {/* Content Rendering */}
      <div className="min-h-[500px]">
        {viewMode === "list" ? (
          <div className="hidden lg:block">
            {filteredRecipes.length > 0 ? (
              <RecipeTable recipes={filteredRecipes} onView={handleView} onEdit={handleEdit} />
            ) : (
              <div className="h-96 rounded-3xl border-2 border-dashed border-muted/30 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
                <FlaskConical className="h-16 w-16 mb-6 opacity-10" />
                <p className="text-lg font-bold">No hay recetas registradas</p>
                <p className="text-sm">Inicia una nueva receta técnica sobre un lote activo.</p>
              </div>
            )}
          </div>
        ) : null}

        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "lg:hidden grid grid-cols-1 md:grid-cols-2 gap-6"}>
          {filteredRecipes.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} onView={handleView} onEdit={handleEdit} />
          ))}
        </div>
      </div>

      {/* Modals */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[1100px] h-[90vh] p-0 overflow-hidden border-none shadow-[0_30px_60px_rgba(0,0,0,0.15)] rounded-[3rem]">
          <div className="flex flex-col h-full">
            <div className="p-10 pb-4">
              <DialogHeader className="text-left">
                <DialogTitle className="text-3xl font-black tracking-tight">
                  {editingRecipe ? "Modificar Receta Técnica" : "Nueva Preparación Química"}
                </DialogTitle>
                <DialogDescription className="text-base font-medium text-muted-foreground mt-2">
                  Selecciona el lote operativo y define la mezcla de químicos a utilizar.
                </DialogDescription>
              </DialogHeader>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <RecipeForm 
                initialData={editingRecipe}
                onSubmit={handleFormSubmit}
                onCancel={() => setIsFormOpen(false)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[1000px] p-0 overflow-hidden border-none shadow-[0_30px_60px_rgba(0,0,0,0.15)] rounded-[4rem]">
          <div className="max-h-[85vh] overflow-y-auto">
            <div className="p-12">
              <DialogHeader className="mb-10 text-left border-b pb-6">
                <DialogTitle className="text-xs font-black uppercase tracking-[0.4em] text-muted-foreground">Expediente Técnico de Preparación</DialogTitle>
              </DialogHeader>
              {viewingRecipe && <RecipeDetail recipe={viewingRecipe} />}
              <div className="flex justify-end mt-12">
                <Button 
                  className="rounded-2xl px-10 h-12 bg-primary font-bold text-white shadow-xl shadow-primary/20" 
                  onClick={() => setIsDetailOpen(false)}
                >
                  Cerrar Expediente
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
