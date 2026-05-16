
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Search, Building2, UserPlus, Filter, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Client, ClientInput } from "@/types/client";
import { ClientTable } from "@/components/clientes/client-table";
import { ClientForm } from "@/components/clientes/client-form";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query
} from "firebase/firestore";

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    // MOCK DATA PARA PRUEBAS LOCALES
    const mockClients: any[] = [
      {
        id: "mock1", name: "TEXTILES ANDINOS S.A.", firstName: "", lastName: "",
        idNumber: "1790011223001", city: "Quito", classification: "socio",
        phone: "0991234567", baseDebt: 0, email: "contacto@textilesandinos.com",
        activo: true, createdAt: "2021-05-10T10:00:00Z"
      },
      {
        id: "mock2", name: "CONFECCIONES LA PERLA", firstName: "María", lastName: "Gómez",
        idNumber: "0912345678001", city: "Guayaquil", classification: "nacional",
        phone: "0987654321", baseDebt: 150.50, email: "ventas@laperla.com",
        activo: true, createdAt: "2023-08-21T10:00:00Z"
      },
      {
        id: "mock3", name: "JEANS & MAS CIA. LTDA.", firstName: "", lastName: "",
        idNumber: "0190022334001", city: "Cuenca", classification: "especial",
        phone: "0971122334", baseDebt: 0, email: "info@jeansymas.com",
        activo: true, createdAt: "2022-11-05T10:00:00Z"
      },
      {
        id: "mock4", name: "DISTRIBUIDORA EL VALLE", firstName: "Carlos", lastName: "Ruiz",
        idNumber: "1801234567001", city: "Ambato", classification: "moroso",
        phone: "0963344556", baseDebt: 1200.00, email: "carlos.ruiz@elvalle.ec",
        activo: false, createdAt: "2020-02-15T10:00:00Z"
      },
      {
        id: "mock5", name: "MODA URBANA S.A.", firstName: "", lastName: "",
        idNumber: "1790033445001", city: "Quito", classification: "socio",
        phone: "0998877665", baseDebt: 0, email: "gerencia@modaurbana.com",
        activo: true, createdAt: "2024-01-10T10:00:00Z"
      }
    ];
    setClients(mockClients as Client[]);
    setLoading(false);

    /*
    if (!db) return;

    const q = query(collection(db, "clients"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => {
        const data = doc.data();
        
        const rawClass = (data.classification || data.clasificacion || "nacional").toString().toLowerCase().trim();
        let normalizedClass: "nacional" | "socio" | "especial" | "moroso" = "nacional";

        if (rawClass.includes("moroso")) normalizedClass = "moroso";
        else if (rawClass.includes("socio")) normalizedClass = "socio";
        else if (rawClass.includes("especial")) normalizedClass = "especial";
        else if (rawClass.includes("nacional")) normalizedClass = "nacional";

        const fName = (data.firstName || data.nombre || "").toString().trim();
        const lName = (data.lastName || data.apellido || "").toString().trim();

        return {
          id: doc.id,
          ...data,
          firstName: fName,
          lastName: lName,
          idNumber: data.idNumber || data.identificacion || data.ruc || data.cedula || "",
          baseDebt: Number(data.baseDebt !== undefined ? data.baseDebt : (data.saldoInicial !== undefined ? data.saldoInicial : 0)),
          classification: normalizedClass
        } as Client;
      });
      
      const sorted = clientsData.sort((a, b) => {
        const nameA = (a.name || a.nombre || `${a.lastName} ${a.firstName}`).trim().toUpperCase();
        const nameB = (b.name || b.nombre || `${b.lastName} ${b.firstName}`).trim().toUpperCase();
        return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
      });

      setClients(sorted);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching clients:", error);
      setLoading(false);
    });

    return () => unsubscribe();
    */
  }, []);

  // Bypass de permisos para modo local
  const canEdit = true;
  /*
  const canEdit = user?.role === "administrador" || user?.role === "facturacion" || user?.role === "cobranzas" || user?.role === "contador";
  */

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.idNumber || "").includes(searchTerm)
    );
  }, [clients, searchTerm]);

  const handleOpenNew = () => {
    if (!canEdit) {
      toast({ variant: "destructive", title: "Acceso Denegado" });
      return;
    }
    setEditingClient(undefined);
    setIsSheetOpen(true);
  };

  const handleEdit = (client: Client) => {
    if (!canEdit) {
      toast({ variant: "destructive", title: "Acceso Denegado" });
      return;
    }
    setEditingClient(client);
    setIsSheetOpen(true);
  };

  const handleView = (client: Client) => {
    setEditingClient(client);
    setIsSheetOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) {
      toast({ variant: "destructive", title: "Acceso Denegado" });
      return;
    }
    
    // MOCK: Eliminar localmente
    setClients(prev => prev.filter(c => c.id !== id));
    toast({ title: "Socio eliminado (Mock)", description: "El registro ha sido retirado de la memoria." });
    /*
    try {
      await deleteDoc(doc(db, "clients", id));
      toast({ title: "Socio eliminado", description: "El registro ha sido retirado de la base de datos." });
    } catch (error) {
      console.error("Error deleting client:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." });
    }
    */
  };

  const handleFormSubmit = async (data: ClientInput) => {
    if (!canEdit) {
      toast({ variant: "destructive", title: "Modo Solo Lectura", description: "No tienes permisos para guardar cambios." });
      setIsSheetOpen(false);
      return;
    }

    // MOCK: Guardar localmente
    const payload = {
      ...data,
      name: `${data.lastName || ''} ${data.firstName || ''}`.trim() || data.name,
      updatedAt: new Date().toISOString()
    };

    if (editingClient) {
      setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, ...payload } as Client : c));
      toast({ title: "Cliente Actualizado (Mock)" });
    } else {
      setClients(prev => [...prev, { id: `mock-${Date.now()}`, classification: "nacional", ...payload } as Client]);
      toast({ title: "Cliente Registrado (Mock)" });
    }
    setIsSheetOpen(false);

    /*
    try {
      const payload: any = {
        ...data,
        name: `${data.lastName} ${data.firstName}`.trim(),
        updatedAt: new Date().toISOString()
      };

      const cleanPayload = Object.keys(payload).reduce((acc: any, key) => {
        if (payload[key] !== undefined) {
          acc[key] = payload[key];
        }
        return acc;
      }, {});

      if (editingClient) {
        await updateDoc(doc(db, "clients", editingClient.id), cleanPayload);
        toast({ title: "Cliente Actualizado" });
      } else {
        await addDoc(collection(db, "clients"), {
          ...cleanPayload,
          createdAt: new Date().toISOString(),
          createdBy: user?.displayName || "system"
        });
        toast({ title: "Cliente Registrado" });
      }
      setIsSheetOpen(false);
    } catch (error) {
      console.error("Error saving client:", error);
      toast({ 
        variant: "destructive", 
        title: "Error al guardar", 
        description: "Verifique su conexión o permisos de escritura." 
      });
    }
    */
  };

  return (
    <div className="space-y-8 max-w-[1600px] auto mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase">Clientes</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="bg-card border-border text-muted-foreground font-bold h-10 gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          {canEdit && (
            <Button onClick={handleOpenNew} className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 gap-2 rounded-lg shadow-premium">
              <UserPlus className="h-4 w-4" /> Nuevo Cliente
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card p-4 rounded-xl border border-border flex flex-col lg:flex-row items-center gap-4">
        <div className="relative w-full lg:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cédula o RUC..." className="pl-10 erp-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex-1" />
        <div className="h-11 flex items-center px-4 bg-muted/30 border border-border rounded-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin mr-2" />
          ) : (
            <span className="text-primary mr-1.5">{filteredClients.length}</span>
          )}
          Registros
        </div>
      </div>

      <div className="min-h-[400px]">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sincronizando con Firestore...</p>
          </div>
        ) : filteredClients.length > 0 ? (
          <ClientTable clients={filteredClients} onEdit={handleEdit} onView={handleView} onPrint={() => window.print()} onDelete={handleDelete} />
        ) : (
          <div className="h-64 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
            <Building2 className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-bold text-sm">No se encontraron clientes en la base de datos.</p>
          </div>
        )}
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-[420px] bg-card border-l-border p-0 overflow-hidden shadow-2xl">
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-border bg-muted/20">
              <SheetHeader>
                <SheetTitle className="text-2xl font-black text-foreground">
                  {canEdit ? (editingClient ? "Editar Cliente" : "Nuevo Cliente") : "Información de Cliente"}
                </SheetTitle>
                <SheetDescription className="text-muted-foreground text-xs font-medium">Información para el directorio de socios industriales.</SheetDescription>
              </SheetHeader>
            </div>
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
              <ClientForm 
                key={editingClient?.id || 'new'} 
                initialData={editingClient} 
                onSubmit={handleFormSubmit} 
                onCancel={() => setIsSheetOpen(false)} 
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
