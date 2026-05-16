"use client";

import React from "react";
import { Output } from "@/types/output";
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
import { ArrowUpCircle, User, Calendar, Eye, Edit3, Shirt, Truck } from "lucide-react";

interface OutputTableProps {
  outputs: Output[];
  onView: (output: Output) => void;
  onEdit: (output: Output) => void;
}

const statusMap = {
  draft: { label: "Borrador", color: "bg-muted text-muted-foreground" },
  active: { label: "En Despacho", color: "bg-amber-500/10 text-amber-600" },
  completed: { label: "Completado", color: "bg-emerald-500/10 text-emerald-600" },
};

export function OutputTable({ outputs, onView, onEdit }: OutputTableProps) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-b border-border">
            <TableHead className="py-5 pl-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">Salida / Cliente</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-center text-muted-foreground">Despacho</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Transporte</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fecha</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Estado</TableHead>
            <TableHead className="text-right pr-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {outputs.map((output) => (
            <TableRow key={output.id} className="group hover:bg-muted/10 transition-all duration-200 border-b border-border">
              <TableCell className="py-5 pl-8">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-accent/5 flex items-center justify-center shrink-0 border border-accent/5">
                    <ArrowUpCircle className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <div className="font-bold text-base text-foreground group-hover:text-accent transition-colors">
                      {output.outputNumber}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium mt-0.5">
                      {output.clientName}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 font-bold text-accent">
                    <Shirt className="h-3.5 w-3.5" />
                    {output.totalDispatched}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                    de {output.totalOriginal} prendas
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 truncate max-w-[150px]">
                  <Truck className="h-3 w-3 text-muted-foreground" />
                  {output.driver}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {output.outputDate}
                </div>
              </TableCell>
              <TableCell>
                <Badge 
                  variant="outline"
                  className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-[0.1em] border-none ${statusMap[output.status].color}`}
                >
                  {statusMap[output.status].label}
                </Badge>
              </TableCell>
              <TableCell className="text-right pr-8">
                <div className="flex items-center justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-accent hover:bg-accent/5"
                    onClick={() => onView(output)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-accent hover:bg-accent/5"
                    onClick={() => onEdit(output)}
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
