"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { 
  LogOut,
  Sun, 
  Moon, 
  Menu,
  Lock,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { navItems } from "@/lib/nav-items";
import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";

export function DashboardSidebar() {
  const { logout, user } = useAuth();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (path: string) => {
    if (!mounted || !pathname) return false;
    return pathname === path || (path !== "/" && pathname.startsWith(path));
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Filtrar navegación por rol de forma segura
  const filteredNav = navItems.filter(item => {
    if (user?.role === "bodega") {
      const allowedTitles = [
        "Clientes",
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

  const halfLimit = Math.ceil(filteredNav.length / 2);
  const row1Items = filteredNav.slice(0, halfLimit);
  const row2Items = filteredNav.slice(halfLimit);
  const gridCols = Math.max(row1Items.length, row2Items.length || 1);

  return (
    <>
      <header className="w-full bg-card border-b border-border sticky top-0 z-50 px-4 md:px-8 flex flex-col shadow-sm transition-colors duration-300 py-4 gap-4">
        <div className="flex items-center justify-between w-full">
          <Link href="/dashboard" className="flex items-center gap-3 group shrink-0">
            <div className="transition-transform group-hover:scale-105">
              <Image src="/logo-lddec.png" alt="Logo" width={36} height={36} />
            </div>
            <span className="font-extrabold text-xl tracking-tighter text-foreground hidden sm:block uppercase">LDDEC</span>
          </Link>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground hover:bg-muted h-10 w-10 rounded-full transition-all"
            >
              {!mounted ? (
                <div className="h-5 w-5" />
              ) : theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            <div className="md:hidden">
              {!mounted ? (
                <div className="h-11 w-11 rounded-full bg-muted/20 animate-pulse" />
              ) : (
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-muted h-11 w-11 rounded-full">
                      <Menu className="h-6 w-6" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="bg-card border-r-border p-0 w-[300px]">
                    <SheetHeader className="p-8 text-left border-b border-border">
                      <div className="flex items-center gap-3 mb-8">
                        <Image src="/logo-lddec.png" alt="Logo" width={32} height={32} />
                        <SheetTitle className="text-foreground text-2xl font-black tracking-tighter uppercase">LDDEC</SheetTitle>
                      </div>
                      <SheetDescription className="sr-only">Menú móvil</SheetDescription>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-220px)] px-6 py-8">
                      <div className="space-y-2">
                        {filteredNav.map((item) => {
                          const active = isActive(item.path);
                          return (
                            <SheetClose asChild key={item.path}>
                              <Link
                                href={item.path}
                                className={cn(
                                  "flex items-center gap-4 px-5 py-4 rounded-full text-base font-bold transition-all",
                                  active ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                <item.icon className="h-5 w-5" />
                                {item.title}
                              </Link>
                            </SheetClose>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
              )}
            </div>

            <div className="hidden sm:flex flex-col items-end mr-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-foreground leading-tight uppercase">
                  {user?.displayName || "Cargando..."}
                </span>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                  {user?.role?.replace('_', ' ') || "SOCIO"}
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground font-bold">{user?.email}</span>
            </div>

            {!mounted ? (
              <div className="h-10 w-10 rounded-full border-2 border-border bg-muted/20 animate-pulse" />
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="h-10 w-10 rounded-full border-2 border-border cursor-pointer transition-transform active:scale-95 shadow-sm overflow-hidden bg-primary/10 flex items-center justify-center">
                    <span className="text-primary text-sm font-black">{user?.displayName?.charAt(0) || "U"}</span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border w-56 shadow-premium-lg mt-4 rounded-3xl p-2">
                  <DropdownMenuItem 
                    className="text-sm font-bold gap-3 hover:bg-muted py-3 rounded-2xl cursor-pointer"
                    onClick={() => setIsPassModalOpen(true)}
                  >
                    <Lock className="h-4 w-4 text-primary" />
                    Cambiar Contraseña
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-sm font-bold gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 py-3 rounded-2xl cursor-pointer" 
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <nav className="hidden md:flex flex-col gap-2 w-full">
          <div 
            className="grid gap-2 w-full"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {row1Items.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex items-center justify-center gap-2 px-2 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap overflow-hidden text-ellipsis w-full text-center",
                    active 
                      ? "bg-primary text-white shadow-lg shadow-primary/20" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-muted-foreground")} />
                  <span className="truncate">{item.title}</span>
                </Link>
              );
            })}
          </div>
          {row2Items.length > 0 && (
            <div 
              className="grid gap-2 w-full"
              style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
            >
              {row2Items.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={cn(
                      "flex items-center justify-center gap-2 px-2 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap overflow-hidden text-ellipsis w-full text-center",
                      active 
                        ? "bg-primary text-white shadow-lg shadow-primary/20" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-muted-foreground")} />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
      </header>

      <ChangePasswordDialog 
        open={isPassModalOpen} 
        onOpenChange={setIsPassModalOpen} 
      />
    </>
  );
}
