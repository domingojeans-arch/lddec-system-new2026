"use client";

import React, { useState, useMemo } from "react";
import { Client } from "@/types/client";
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
import { 
  Edit3, 
  Eye, 
  Trash2, 
  Printer, 
  AlertTriangle, 
  ArrowUp, 
  ArrowDown, 
  ChevronsUpDown, 
  Users, 
  Crown,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { ResetCobranzasModal } from "@/components/cobranzas/ResetCobranzasModal";

interface ClientTableProps {
  clients: Client[];
  allClients?: Client[];
  onEdit: (client: Client) => void;
  onView: (client: Client) => void;
  onPrint: (client: Client) => void;
  onDelete: (id: string) => void;
  hideFinancials?: boolean;
  canDelete?: boolean;
}

const classificationMap = {
  nacional: { label: "Nacional", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  socio: { label: "Socio", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  especial: { label: "Especial", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  moroso: { label: "Moroso", color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  temporal: { label: "Temporal / Muestra", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
};

export function ClientTable({ clients, allClients, onEdit, onView, onPrint, onDelete, hideFinancials = false, canDelete = true }: ClientTableProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [resetModalClient, setResetModalClient] = useState<Client | null>(null);

  // Conteo de cuentas familiares vinculadas a cada titular
  const linkedCountMap = useMemo(() => {
    const map = new Map<string, number>();
    (allClients || clients).forEach(c => {
      if (c.parentClientId) {
        map.set(c.parentClientId, (map.get(c.parentClientId) || 0) + 1);
      }
    });
    return map;
  }, [allClients, clients]);

  // ORDENAR POR APELLIDO POR DEFECTO
  const [sortKey, setSortKey] = useState<string>("lastName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      let valA: any = a[sortKey as keyof Client] || "";
      let valB: any = b[sortKey as keyof Client] || "";

      if (sortKey === "name") {
        // Ordenar por Apellido Nombre
        valA = (a.lastName + " " + a.firstName).toLowerCase();
        valB = (b.lastName + " " + b.firstName).toLowerCase();
      }

      if (typeof valA === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB, 'es') : valB.localeCompare(valA, 'es');
      }
      return sortDir === "asc" ? valA - valB : valB - valA;
    });
  }, [clients, sortKey, sortDir]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xl">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-b border-border hover:bg-transparent">
            <TableHead onClick={() => handleSort("idNumber")} className="cursor-pointer text-[11px] font-black uppercase tracking-widest text-muted-foreground py-5 pl-8">
              <div className="flex items-center">Identificación <SortIcon colKey="idNumber" /></div>
            </TableHead>
            <TableHead onClick={() => handleSort("lastName")} className="cursor-pointer text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center">Socio / Razón Social <SortIcon colKey="lastName" /></div>
            </TableHead>
            {!hideFinancials && <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Clasificación</TableHead>}
            <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Contacto</TableHead>
            {hideFinancials && <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Dirección</TableHead>}
            {!hideFinancials && (
              <TableHead onClick={() => handleSort("baseDebt")} className="cursor-pointer text-right text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                <div className="flex items-center justify-end">Saldo Base <SortIcon colKey="baseDebt" /></div>
              </TableHead>
            )}
            <TableHead className="text-right pr-8 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedClients.map((client) => {
            const classification = (client.classification || "nacional") as keyof typeof classificationMap;
            const badgeConfig = classificationMap[classification] || classificationMap.nacional;

            return (
              <TableRow key={client.id} className="border-b border-border hover:bg-muted/10 group transition-colors">
                <TableCell className="py-5 pl-8">
                  <span className="font-mono text-xs font-bold text-primary">
                    {client.noId ? "TEMP-ID" : client.idNumber}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="font-bold text-sm text-foreground uppercase">{client.lastName} {client.firstName}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 uppercase">Apertura: {client.openingDate}</div>
                  {client.parentClientId && (
                    <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-bold tracking-tight mt-1 bg-blue-500/10 px-2 py-0.5 rounded-md w-fit">
                      <Users className="h-3 w-3 inline text-blue-500 shrink-0" />
                      <span>Familiar de: {client.parentClientName || "Cuenta Titular"}</span>
                    </div>
                  )}
                  {Number(linkedCountMap.get(client.id) || 0) > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold tracking-tight mt-1 bg-emerald-500/10 px-2 py-0.5 rounded-md w-fit">
                      <Crown className="h-3 w-3 inline text-emerald-500 shrink-0" />
                      <span>Titular Familiar ({linkedCountMap.get(client.id)} {linkedCountMap.get(client.id) === 1 ? 'vinculado' : 'vinculados'})</span>
                    </div>
                  )}
                </TableCell>
                {!hideFinancials && (
                  <TableCell>
                    <Badge className={cn("text-[9px] font-black uppercase border-none", badgeConfig.color)}>
                      {badgeConfig.label}
                    </Badge>
                  </TableCell>
                )}
                <TableCell>
                  <div className="text-xs font-semibold text-foreground">{client.phone}</div>
                  <div className="text-[10px] text-muted-foreground">{client.email}</div>
                </TableCell>
                {hideFinancials && (
                  <TableCell>
                    <span className="text-xs font-medium text-foreground uppercase">{client.address || "SIN DIRECCIÓN"}</span>
                  </TableCell>
                )}
                {!hideFinancials && (
                  <TableCell className="text-right">
                    <span className="text-sm font-black text-emerald-600">${client.baseDebt?.toFixed(2) || "0.00"}</span>
                  </TableCell>
                )}
                <TableCell className="text-right pr-8">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => onView(client)} title="Ver detalles">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-600/10" onClick={() => onPrint(client)} title="Imprimir ficha">
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-400/10" onClick={() => onEdit(client)} title="Editar socio">
                      <Edit3 className="h-4 w-4" />
                    </Button>

                    {isAdmin && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10" 
                        onClick={() => setResetModalClient(client)}
                        title="Reiniciar Cobros por Mes (Solo Administrador)"
                      >
                        <RotateCcw className="h-4 w-4 text-amber-600" />
                      </Button>
                    )}
                    
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                            title="Eliminar socio"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border rounded-[2rem]">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                              Confirmar eliminación
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Estás seguro de que deseas eliminar al socio industrial <strong>{client.lastName} {client.firstName}</strong>? Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => onDelete(client.id)}
                              className="bg-destructive text-white hover:bg-destructive/90 rounded-xl font-bold"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Modal para reiniciar cobranzas de cliente por mes */}
      {resetModalClient && (
        <ResetCobranzasModal
          isOpen={Boolean(resetModalClient)}
          onClose={() => setResetModalClient(null)}
          client={resetModalClient}
          allClients={allClients || clients}
          onSuccess={() => setResetModalClient(null)}
        />
      )}
    </div>
  );
}
