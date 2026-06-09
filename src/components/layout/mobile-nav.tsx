
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { navItems } from "@/lib/nav-items";

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isActive = (path: string) => pathname === path || (path !== "/" && pathname.startsWith(path));

  // Filtrar por rol de forma segura
  const allowedItems = navItems.filter(item => {
    // 1. Exclusividad estricta de Mantenimiento solo para EDGAR ADMIN
    if (item.title === "Mantenimiento") {
      return user?.role === "admin" || user?.displayName === "EDGAR ADMIN" || user?.email === "ugeofly@hotmail.com";
    }

    if (user?.role === "bodega") {
      const allowedTitles = [
        "Ingresos",
        "Revisión Lote",
        "Salidas",
        "Entregas",
        "INFORMES",
        "Faltantes",
        "Muestras Antiguas"
      ];
      return allowedTitles.includes(item.title);
    }
    if (user?.role === "bodega_quimicos" || user?.role === "bodeguero_quimicos") {
      return item.title === "Bodega Químicos";
    }
    return user?.role === "admin" || (item.allowedRoles as string[]).includes(user?.role || "");
  });

  const mainItemsLimit = 4;
  const mainItems = allowedItems.slice(0, mainItemsLimit);
  const otherModules = allowedItems.slice(mainItemsLimit);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border h-16 flex items-center justify-around px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] pb-safe">
      {mainItems.map((item) => (
        <Link 
          key={item.path} 
          href={item.path}
          className={cn(
            "flex flex-col items-center justify-center gap-1 w-full h-full transition-all",
            isActive(item.path) ? "text-primary" : "text-muted-foreground"
          )}
        >
          <item.icon className={cn("h-5 w-5", isActive(item.path) && "fill-primary/10")} />
          <span className="text-[10px] font-bold uppercase tracking-tight">{item.title}</span>
        </Link>
      ))}

      {otherModules.length > 0 && (
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-1 w-full h-full text-muted-foreground">
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Más</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-[32px] p-0 border-t-0 shadow-2xl">
            <div className="p-8 space-y-8 h-full flex flex-col">
              <SheetHeader className="border-b border-border pb-6 pt-2">
                <SheetTitle className="text-2xl font-black uppercase tracking-tight text-foreground">Panel de Navegación</SheetTitle>
              </SheetHeader>

              <ScrollArea className="flex-1 pr-4">
                <div className="grid grid-cols-3 gap-y-8 gap-x-4 pb-10">
                  {otherModules.map((item) => (
                    <SheetClose asChild key={item.path}>
                      <Link 
                        href={item.path}
                        className={cn(
                          "flex flex-col items-center text-center gap-3 p-2 rounded-2xl transition-all active:scale-95",
                          isActive(item.path) ? "bg-primary/5 text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className={cn(
                          "h-14 w-14 rounded-2xl flex items-center justify-center border transition-colors shadow-sm",
                          isActive(item.path) ? "bg-primary border-primary text-white" : "bg-card border-border"
                        )}>
                          <item.icon className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest leading-tight">
                          {item.title}
                        </span>
                      </Link>
                    </SheetClose>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </nav>
  );
}
