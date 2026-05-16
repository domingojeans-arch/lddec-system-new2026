"use client";

import React from "react";
import { Collection } from "@/types/collection";
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
import { Wallet, Calendar, Eye, Edit3, CreditCard } from "lucide-react";

interface CollectionTableProps {
  collections: Collection[];
  onView: (collection: Collection) => void;
  onEdit: (collection: Collection) => void;
}

const statusMap = {
  draft: { label: "Borrador", color: "bg-zinc-500/10 text-zinc-600" },
  applied: { label: "Aplicada", color: "bg-blue-500/10 text-blue-600" },
  partial: { label: "Parcial", color: "bg-amber-500/10 text-amber-600" },
  completed: { label: "Completada", color: "bg-emerald-500/10 text-emerald-600" },
};

export function CollectionTable({ collections, onView, onEdit }: CollectionTableProps) {
  return (
    <div className="rounded-2xl border-none bg-card shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-b-muted/20">
            <TableHead className="py-5 pl-8 text-xs font-bold uppercase tracking-widest">Cobro / Socio</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-right">Recibido</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest text-right">Aplicado</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest">Método</TableHead>
            <TableHead className="text-xs font-bold uppercase tracking-widest">Estado</TableHead>
            <TableHead className="text-right pr-8 text-xs font-bold uppercase tracking-widest">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {collections.map((collection) => (
            <TableRow key={collection.id} className="group hover:bg-muted/5 transition-all duration-200 border-b-muted/10">
              <TableCell className="py-5 pl-8">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-amber-500/5 flex items-center justify-center shrink-0 border border-amber-500/5">
                    <Wallet className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="font-bold text-base text-foreground group-hover:text-amber-600 transition-colors">
                      {collection.collectionNumber}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium mt-0.5">
                      {collection.clientName}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="font-bold text-foreground">
                  ${collection.totalReceived.toFixed(2)}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="font-black text-emerald-600">
                  ${collection.totalApplied.toFixed(2)}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <CreditCard className="h-3 w-3" />
                  {collection.paymentMethod}
                </div>
              </TableCell>
              <TableCell>
                <Badge 
                  variant="outline"
                  className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-[0.1em] border-none ${statusMap[collection.status].color}`}
                >
                  {statusMap[collection.status].label}
                </Badge>
              </TableCell>
              <TableCell className="text-right pr-8">
                <div className="flex items-center justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-amber-600 hover:bg-amber-500/5"
                    onClick={() => onView(collection)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-amber-600 hover:bg-amber-500/5"
                    onClick={() => onEdit(collection)}
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
