"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: string;
  className?: string;
}

export function MetricCard({ title, value, subtitle, icon: Icon, color, className }: MetricCardProps) {
  return (
    <Card className={cn("border-none shadow-[0_4px_20px_rgba(0,0,0,0.04)] rounded-2xl overflow-hidden bg-card/50 backdrop-blur-sm", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{title}</p>
            <h3 className={cn("text-2xl font-black tracking-tight", color)}>{value}</h3>
            {subtitle && (
              <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">{subtitle}</p>
            )}
          </div>
          <div className={cn("p-2.5 rounded-xl", color ? "bg-muted/10" : "bg-primary/5")}>
            <Icon className={cn("h-5 w-5", color || "text-primary")} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
