"use client";

import React from "react";
import { Client } from "@/types/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Phone, User, Calendar, MapPin, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
}

export function ClientCard({ client, onEdit }: ClientCardProps) {
  return (
    <Card className="border-none shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 bg-card rounded-2xl overflow-hidden group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight group-hover:text-accent transition-colors">
                {client.name}
              </h3>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.15em] mt-1">
                {client.code}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-full bg-muted/50 hover:bg-accent hover:text-white transition-all"
            onClick={() => onEdit(client)}
          >
            <Edit3 className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="h-7 w-7 rounded-full bg-muted/30 flex items-center justify-center shrink-0">
              <User className="h-3.5 w-3.5" />
            </div>
            <span className="font-medium text-foreground/80">{client.contactName}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="h-7 w-7 rounded-full bg-muted/30 flex items-center justify-center shrink-0">
              <Phone className="h-3.5 w-3.5" />
            </div>
            <span className="font-medium">{client.phone}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="h-7 w-7 rounded-full bg-muted/30 flex items-center justify-center shrink-0">
              <MapPin className="h-3.5 w-3.5" />
            </div>
            <span className="truncate font-medium italic">{client.address}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-muted/30">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-full">
            <Calendar className="h-3 w-3" />
            Socio desde {client.sinceYear}
          </div>
          <Badge 
            variant={client.status === "active" ? "default" : "secondary"}
            className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest ${
              client.status === "active" 
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                : "bg-zinc-500/10 text-zinc-600 border-zinc-500/20"
            }`}
          >
            {client.status === "active" ? "Activo" : "Inactivo"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
