"use client";

import React, { useState } from "react";
import { updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, ShieldCheck, AlertCircle } from "lucide-react";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Contraseña corta",
        description: "La contraseña debe tener al menos 6 caracteres."
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Las contraseñas no coinciden."
      });
      return;
    }

    setLoading(true);
    try {
      if (auth && auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        toast({
          title: "Contraseña actualizada",
          description: "Tu contraseña ha sido cambiada exitosamente."
        });
        setNewPassword("");
        setConfirmPassword("");
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error updating password:", error);
      let message = "No se pudo cambiar la contraseña.";
      
      if (error.code === 'auth/requires-recent-login') {
        message = "Por seguridad, debes cerrar sesión y volver a entrar para realizar esta acción.";
      }
      
      toast({
        variant: "destructive",
        title: "Error",
        description: message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-card max-w-md">
        <div className="p-8 border-b border-border bg-primary/5">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
            <Lock className="h-6 w-6 text-primary" />
            Cambiar Contraseña
          </DialogTitle>
          <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Actualiza tus credenciales de acceso
          </DialogDescription>
        </div>
        
        <form onSubmit={handleUpdate} className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Nueva Contraseña</Label>
              <Input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="erp-input h-12 font-bold"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Confirmar Contraseña</Label>
              <Input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="erp-input h-12 font-bold"
                required
              />
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
            <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
              Si ha pasado mucho tiempo desde que iniciaste sesión, el sistema podría pedirte que vuelvas a entrar para confirmar tu identidad.
            </p>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => onOpenChange(false)}
              className="flex-1 font-bold uppercase text-[10px] h-12 rounded-xl"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest h-12 rounded-xl shadow-xl shadow-primary/20"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Actualizar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
