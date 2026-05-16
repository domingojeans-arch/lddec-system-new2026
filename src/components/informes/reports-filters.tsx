"use client";

import React from "react";
import { Search, Filter, Calendar as CalendarIcon, User, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockClients } from "@/data/mock-clients";
import { ReportFilters } from "@/types/reports";

interface ReportsFiltersProps {
  filters: ReportFilters;
  onChange: (filters: Partial<ReportFilters>) => void;
  onClear: () => void;
}

export function ReportsFilters({ filters, onChange, onClear }: ReportsFiltersProps) {
  return (
    <div className="bg-card/50 backdrop-blur-sm p-4 rounded-3xl border border-muted/20 space-y-4 mb-8">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-xl border border-muted/10">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Analítica Avanzada</span>
        </div>

        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <Input 
            type="date" 
            className="w-40 h-9 rounded-xl border-none bg-muted/30 text-xs font-bold" 
            value={filters.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
          />
          <span className="text-muted-foreground font-bold">al</span>
          <Input 
            type="date" 
            className="w-40 h-9 rounded-xl border-none bg-muted/30 text-xs font-bold" 
            value={filters.dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
          />
        </div>

        <div className="h-6 w-px bg-muted/30" />

        <Select 
          value={filters.clientId} 
          onValueChange={(val) => onChange({ clientId: val === "all" ? "" : val })}
        >
          <SelectTrigger className="w-[220px] h-9 rounded-xl border-none bg-muted/30 text-xs font-bold">
            <SelectValue placeholder="Todos los Clientes" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-none shadow-2xl">
            <SelectItem value="all">Todos los Clientes</SelectItem>
            {mockClients.map(client => (
              <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClear}
          className="h-9 px-4 rounded-xl text-muted-foreground hover:text-accent font-bold"
        >
          <X className="h-4 w-4 mr-2" />
          Limpiar
        </Button>
      </div>
    </div>
  );
}
