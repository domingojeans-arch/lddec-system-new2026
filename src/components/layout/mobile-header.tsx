"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, LogOut, User, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";

export function MobileHeader() {
  const { logout, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <>
      <header className="w-full bg-card border-b border-border h-16 px-4 flex items-center justify-between sticky top-0 z-50 shadow-sm transition-colors duration-300">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo-lddec.png" alt="Logo" width={24} height={24} />
          <span className="font-black text-lg tracking-tighter text-foreground uppercase">LDDEC</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-black uppercase text-foreground">{user?.displayName}</span>
            <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black px-2 h-4 uppercase tracking-widest">
              {user?.role?.substring(0, 4)}
            </Badge>
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme}
            className="text-muted-foreground h-9 w-9 rounded-full"
          >
            {mounted && (theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />)}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="h-9 w-9 rounded-full border border-border bg-primary/5 flex items-center justify-center cursor-pointer">
                <User className="h-4.5 w-4.5 text-primary" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl mt-2 w-48 p-2">
              <div className="px-3 py-2 border-b mb-2">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">{user?.role}</p>
                <p className="text-xs font-bold truncate">{user?.displayName}</p>
              </div>
              <DropdownMenuItem 
                className="text-sm font-bold gap-3 hover:bg-muted py-2.5 rounded-xl cursor-pointer"
                onClick={() => setIsPassModalOpen(true)}
              >
                <Lock className="h-4 w-4 text-primary" />
                Nueva Clave
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive font-bold gap-2 focus:bg-destructive/5 rounded-xl py-2.5"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <ChangePasswordDialog 
        open={isPassModalOpen} 
        onOpenChange={setIsPassModalOpen} 
      />
    </>
  );
}
