"use client";

import React, { useState, useEffect } from "react";
import { Filter, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { manualWorkTypes } from "@/data/manual-work-types";

interface ManualWorkFiltersProps {
  statusFilter: string;
  typeFilter: string;
  onStatusChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  totalResults: number;
}

export function ManualWorkFilters({ 
  statusFilter, 
  typeFilter, 
  onStatusChange, 
  onTypeChange,
  totalResults
}: ManualWorkFiltersProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch for Radix Select IDs
  if (!mounted) {
    return (
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card/50 backdrop-blur-sm p-3 rounded-2xl border border-muted/20 min-h-[68px]">
        <div className="flex items-center gap-3">
          <div className="w-24 h-8 bg-muted/20 rounded-xl" />
          <div className="w-[140px] h-9 bg-muted/30 rounded-xl" />
          <div className="w-[180px] h-9 bg-muted/30 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card/50 backdrop-blur-sm p-3 rounded-2xl border border-muted/20">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-xl border border-muted/10">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filtros</span>
        </div>

        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[140px] h-9 rounded-xl border-none bg-muted/30 text-xs font-bold focus:ring-accent/20">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-none shadow-2xl">
            <SelectItem value="all">Todos los Estados</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="in_progress">En Proceso</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={onTypeChange}>
          <SelectTrigger className="w-[180px] h-9 rounded-xl border-none bg-muted/30 text-xs font-bold focus:ring-accent/20">
            <SelectValue placeholder="Tipo Manualidad" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-none shadow-2xl">
            <SelectItem value="all">Todas las Manualidades</SelectItem>
            {manualWorkTypes.map(type => (
              <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-accent/5 hover:text-accent">
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
        <div className="h-6 w-px bg-muted/30 mx-1" />
        <div className="text-[10px] font-black text-muted-foreground px-4 py-2 bg-muted/20 rounded-xl uppercase tracking-widest">
          <span className="text-accent">{totalResults}</span> Registros
        </div>
      </div>
    </div>
  );
}
