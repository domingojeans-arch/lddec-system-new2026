"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Client, ClientInput, ClientClassification } from "@/types/client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, X, CreditCard, Phone, Mail, Wallet, Calendar as CalendarIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const clientSchema = z.object({
  firstName: z.string().min(1, "Nombres obligatorios"),
  lastName: z.string().min(1, "Apellidos obligatorios"),
  classification: z.enum(["nacional", "socio", "especial", "moroso"]),
  idNumber: z.string().optional(),
  noId: z.boolean().default(false),
  baseDebt: z.coerce.number().min(0),
  openingDate: z.string().min(1, "Fecha obligatoria"),
  phone: z.string().min(1, "Teléfono obligatorio"),
  email: z.string().email("Correo inválido").or(z.literal("")).optional(),
  address: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});

interface ClientFormProps {
  initialData?: Client;
  onSubmit: (data: ClientInput) => void;
  onCancel: () => void;
}

export function ClientForm({ initialData, onSubmit, onCancel }: ClientFormProps) {
  const { user } = useAuth();
  const isContador = user?.role === "contador";

  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: initialData ? {
      firstName: initialData.firstName || "",
      lastName: initialData.lastName || "",
      classification: (initialData.classification as any) || "nacional",
      idNumber: initialData.idNumber || "",
      noId: !!initialData.noId,
      baseDebt: initialData.baseDebt || 0,
      openingDate: initialData.openingDate || new Date().toISOString().split('T')[0],
      phone: initialData.phone || "",
      email: initialData.email || "",
      address: initialData.address || "",
      status: initialData.status || "active",
    } : {
      firstName: "",
      lastName: "",
      classification: "nacional",
      idNumber: "",
      noId: false,
      baseDebt: 0,
      openingDate: new Date().toISOString().split('T')[0],
      phone: "",
      email: "",
      address: "",
      status: "active",
    },
  });

  const noId = form.watch("noId");
  const openingDate = form.watch("openingDate");
  const openingDateObj = openingDate ? parseISO(openingDate) : undefined;

  const handleFormSubmit = (values: z.infer<typeof clientSchema>) => {
    onSubmit({
      ...values,
      classification: values.classification as ClientClassification,
      email: values.email || "",
      address: values.address || "",
      idNumber: values.idNumber || ""
    } as ClientInput);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nombres</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Juan" className="erp-input h-11 text-sm font-bold" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Apellidos</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Pérez" className="erp-input h-11 text-sm font-bold" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="classification"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Clasificación</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="erp-input h-11 text-sm font-bold">
                    <SelectValue placeholder="Seleccione clasificación" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="nacional">Cliente Nacional</SelectItem>
                  <SelectItem value="socio">Socio</SelectItem>
                  <SelectItem value="especial">Cliente Especial</SelectItem>
                  <SelectItem value="moroso">Morosos</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <FormField
            control={form.control}
            name="idNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">N° Identificación (Cédula/RUC)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Identificación fiscal" 
                      className="pl-10 erp-input h-11 text-sm font-bold" 
                      disabled={noId}
                      {...field} 
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="noId"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground cursor-pointer">
                  Sin Cédula (Generar temporal)
                </FormLabel>
              </FormItem>
            )}
          />
        </div>

        <div className="bg-muted/30 p-6 rounded-xl border border-border space-y-6">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">SALDO INICIAL 2026</h4>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="baseDebt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[9px] font-black uppercase text-muted-foreground">Deuda Base original ($)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        type="number" 
                        step="0.01" 
                        className="pl-8 erp-input h-10 text-xs font-black text-emerald-600 disabled:opacity-50" 
                        disabled={isContador}
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  {isContador && <p className="text-[8px] text-amber-600 font-bold uppercase">Solo lectura para Contador</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="openingDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[9px] font-black uppercase text-muted-foreground">Fecha apertura</FormLabel>
                  <FormControl>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-10 erp-input bg-background justify-start text-left font-bold text-xs rounded-xl">
                          <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />
                          {openingDateObj && isValid(openingDateObj) ? format(openingDateObj, "dd/MM/yyyy") : "Fecha..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-none z-[100]" align="start">
                        <Calendar
                          mode="single"
                          selected={openingDateObj}
                          onSelect={(d) => field.onChange(d ? format(d, "yyyy-MM-dd") : "")}
                          locale={es}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Teléfono</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10 erp-input h-11 text-sm font-bold" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10 erp-input h-11 text-sm font-bold" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Estado Maestro</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="erp-input h-11 text-sm font-bold">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="pt-6 border-t border-border flex gap-3">
          <Button type="button" variant="outline" className="flex-1 font-bold h-12" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-12">
            <Save className="h-4 w-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </form>
    </Form>
  );
}