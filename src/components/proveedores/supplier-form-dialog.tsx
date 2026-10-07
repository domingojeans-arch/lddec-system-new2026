"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Supplier, PURCHASE_CATEGORIES, CREDIT_DAYS_OPTIONS } from "@/types/proveedores";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Store, Building2, Phone, Mail, MapPin, CalendarClock } from "lucide-react";

interface SupplierFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  supplierToEdit?: Supplier | null;
  onSupplierCreated?: (newSupplier: Supplier) => void;
}

export function SupplierFormDialog({
  isOpen,
  onClose,
  supplierToEdit,
  onSupplierCreated,
}: SupplierFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [nombre, setNombre] = useState("");
  const [ruc, setRuc] = useState("");
  const [telefono, setTelefono] = useState("");
  const [contacto, setContacto] = useState("");
  const [correo, setCorreo] = useState("");
  const [direccion, setDireccion] = useState("");
  const [categoriaPrincipal, setCategoriaPrincipal] = useState<string>("QUIMICOS");
  const [diasCreditoHabitual, setDiasCreditoHabitual] = useState<number>(30);
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (supplierToEdit) {
      setNombre(supplierToEdit.nombre || "");
      setRuc(supplierToEdit.ruc || "");
      setTelefono(supplierToEdit.telefono || "");
      setContacto(supplierToEdit.contacto || "");
      setCorreo(supplierToEdit.correo || "");
      setDireccion(supplierToEdit.direccion || "");
      setCategoriaPrincipal(supplierToEdit.categoriaPrincipal || "QUIMICOS");
      setDiasCreditoHabitual(supplierToEdit.diasCreditoHabitual || 30);
      setNotas(supplierToEdit.notas || "");
    } else {
      setNombre("");
      setRuc("");
      setTelefono("");
      setContacto("");
      setCorreo("");
      setDireccion("");
      setCategoriaPrincipal("QUIMICOS");
      setDiasCreditoHabitual(30);
      setNotas("");
    }
  }, [supplierToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast({ variant: "destructive", title: "El nombre o razón social es obligatorio" });
      return;
    }

    setLoading(true);
    try {
      const payload: Partial<Supplier> = {
        nombre: nombre.trim().toUpperCase(),
        ruc: ruc.trim(),
        telefono: telefono.trim(),
        contacto: contacto.trim(),
        correo: correo.trim().toLowerCase(),
        direccion: direccion.trim(),
        categoriaPrincipal,
        diasCreditoHabitual: Number(diasCreditoHabitual) || 30,
        notas: notas.trim(),
        updatedAt: serverTimestamp(),
      };

      if (supplierToEdit) {
        await updateDoc(doc(db, "suppliers", supplierToEdit.id), payload);
        toast({
          title: "Proveedor actualizado ✅",
          description: `Los datos de ${nombre} se actualizaron correctamente.`,
          className: "bg-emerald-600 text-white font-bold",
        });
      } else {
        payload.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, "suppliers"), payload);
        toast({
          title: "Proveedor registrado ✅",
          description: `Se registró ${nombre} exitosamente.`,
          className: "bg-emerald-600 text-white font-bold",
        });
        if (onSupplierCreated) {
          onSupplierCreated({ id: docRef.id, ...payload } as Supplier);
        }
      }

      onClose();
    } catch (err: any) {
      console.error("Error guardando proveedor:", err);
      toast({
        variant: "destructive",
        title: "Error al guardar proveedor",
        description: err.message || "Ocurrió un error inesperado.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            {supplierToEdit ? "Editar Proveedor" : "Nuevo Proveedor"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-black uppercase text-muted-foreground">
                Razón Social / Nombre Comercial *
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 erp-input font-bold"
                  placeholder="Ej: QUÍMICOS DEL PACÍFICO S.A."
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground">RUC o Cédula</Label>
              <Input
                className="erp-input font-bold"
                placeholder="Ej: 1792345678001"
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground">Teléfono / Celular</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 erp-input font-bold"
                  placeholder="Ej: 0991234567"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground">Contacto / Vendedor</Label>
              <Input
                className="erp-input"
                placeholder="Ej: Ing. Carlos Pérez"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  className="pl-9 erp-input"
                  placeholder="contacto@proveedor.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-black uppercase text-muted-foreground">Dirección / Ubicación</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 erp-input"
                  placeholder="Ej: Av. Galo Plaza Lasso y Sabanilla, Quito"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground">Categoría Principal</Label>
              <Select value={categoriaPrincipal} onValueChange={setCategoriaPrincipal}>
                <SelectTrigger className="erp-input font-bold">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {PURCHASE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-primary" /> Plazo Crédito Habitual
              </Label>
              <Select
                value={diasCreditoHabitual.toString()}
                onValueChange={(val) => setDiasCreditoHabitual(Number(val))}
              >
                <SelectTrigger className="erp-input font-bold">
                  <SelectValue placeholder="Días de crédito" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {CREDIT_DAYS_OPTIONS.map((days) => (
                    <SelectItem key={days} value={days.toString()}>
                      {days} días de crédito
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-black uppercase text-muted-foreground">Notas u Observaciones</Label>
              <Textarea
                className="erp-input rounded-2xl min-h-[70px]"
                placeholder="Datos bancarios, número de cuenta para transferencias, etc."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-xs rounded-xl px-6"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {supplierToEdit ? "Guardar Cambios" : "Crear Proveedor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
