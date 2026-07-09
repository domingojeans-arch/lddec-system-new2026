"use client";

import React, { useState } from "react";
import { Printer, ShieldCheck, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function PrintSheetsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchLot, setSearchLot] = useState("");

  // Campos de la Ficha
  const [loteInicial, setLoteInicial] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [cliente, setCliente] = useState("");
  const [tipoPrenda, setTipoPrenda] = useState("");
  const [nombreTela, setNombreTela] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState("");
  const [codigo, setCodigo] = useState("");
  const [proceso, setProceso] = useState("");
  const [nIngreso, setNIngreso] = useState("");
  const [nPrendas1, setNPrendas1] = useState("");
  const [nPrendas2, setNPrendas2] = useState("");
  const [peso, setPeso] = useState("");

  const handleSearchLot = async () => {
    const term = searchLot.trim().toUpperCase();
    if (!term) return;
    setLoading(true);
    try {
      const q = query(collection(db, "entries"), where("loteIdList", "array-contains", term), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast({ variant: "destructive", title: "Lote no encontrado", description: "No se halló el lote en los ingresos del sistema." });
        return;
      }
      const entryDoc = snap.docs[0];
      const entryData = entryDoc.data();
      const lot = (entryData.lotes || []).find((l: any) => {
        const candidates = [l.lotNumber, l.numeroLote, l.loteId, l.lote, l.id];
        return candidates.some(c => String(c ?? "").trim().toUpperCase() === term);
      });

      if (lot) {
        setLoteInicial(term);
        setCliente(entryData.clientName || entryData.clienteNombre || "");
        setTipoPrenda(lot.garmentType || lot.tipo || (lot.garments && lot.garments[0]?.garmentType) || "");
        setNombreTela(lot.fabricName || lot.tela || "");
        setFechaIngreso(entryData.entryDate || "");
        setCodigo(lot.code || lot.codigo || "");
        setProceso(lot.process || lot.proceso || "");
        setNIngreso(entryData.entryNumber || entryDoc.id || "");
        setNPrendas1(String(lot.cantidad || lot.quantity || 0));
        setNPrendas2("");
        setPeso(lot.weight || lot.peso || "");
        toast({ title: "Datos cargados", description: `Campos completados desde el Lote ${term}.` });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error en la búsqueda" });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const startNum = parseInt(loteInicial);
    const qty = parseInt(cantidad);

    if (isNaN(startNum) || startNum <= 0) {
      toast({ variant: "destructive", title: "Lote Inicial Inválido", description: "El número de lote debe ser un número entero mayor a cero." });
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      toast({ variant: "destructive", title: "Cantidad Inválida", description: "La cantidad de fichas debe ser mayor a cero." });
      return;
    }

    // Ejecutar impresión nativa
    window.print();
  };

  // Generar las fichas para la vista previa e impresión
  const startNum = parseInt(loteInicial) || 0;
  const qty = parseInt(cantidad) || 0;
  const listFichas = Array.from({ length: qty }).map((_, idx) => {
    return startNum - idx;
  });

  return (
    <div className="space-y-8">
      {/* SECCIÓN FORMULARIO (No se imprime) */}
      <div className="bg-card border border-border rounded-[2rem] p-8 shadow-premium no-print space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Configuración de Fichas de Procesos</h3>
            <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider mt-1">
              Impresión automática en lote en formato media hoja A4
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar Lote..."
              value={searchLot}
              onChange={(e) => setSearchLot(e.target.value)}
              className="h-10 w-44 rounded-xl text-xs font-bold"
              onKeyDown={(e) => e.key === "Enter" && handleSearchLot()}
            />
            <Button
              onClick={handleSearchLot}
              disabled={loading}
              variant="outline"
              className="h-10 rounded-xl px-4 gap-1.5"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              <span className="text-[10px] font-black uppercase">Buscar</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Lote Inicial</Label>
            <Input
              type="number"
              placeholder="Ej: 23617"
              value={loteInicial}
              onChange={(e) => setLoteInicial(e.target.value)}
              className="erp-input h-11 text-center font-black text-lg border-primary/20 text-primary"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cantidad de Fichas</Label>
            <Input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="erp-input h-11 text-center font-black text-lg border-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cliente</Label>
            <Input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="erp-input h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tipo de Prenda</Label>
            <Input
              value={tipoPrenda}
              onChange={(e) => setTipoPrenda(e.target.value)}
              className="erp-input h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nombre de Tela</Label>
            <Input
              value={nombreTela}
              onChange={(e) => setNombreTela(e.target.value)}
              className="erp-input h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fecha de Ingreso</Label>
            <Input
              placeholder="Ej: 07-07-2026"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
              className="erp-input h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Código</Label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="erp-input h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Proceso</Label>
            <Input
              value={proceso}
              onChange={(e) => setProceso(e.target.value)}
              className="erp-input h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">N° Ingreso</Label>
            <Input
              value={nIngreso}
              onChange={(e) => setNIngreso(e.target.value)}
              className="erp-input h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">N° Prendas 1</Label>
            <Input
              value={nPrendas1}
              onChange={(e) => setNPrendas1(e.target.value)}
              className="erp-input h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">N° Prendas 2</Label>
            <Input
              value={nPrendas2}
              onChange={(e) => setNPrendas2(e.target.value)}
              className="erp-input h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Peso (kg)</Label>
            <Input
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              className="erp-input h-11"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            onClick={handlePrint}
            size="lg"
            className="bg-primary hover:bg-primary/95 text-white font-black uppercase px-8 h-12 rounded-xl shadow-xl shadow-primary/20 gap-2"
          >
            <Printer className="h-5 w-5" />
            Imprimir Lote de Fichas
          </Button>
        </div>
      </div>

      {/* SECCIÓN VISTA PREVIA (no-print en la app, visible solo en la app como previsualización) */}
      <div className="no-print">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 mb-4">
          Vista Previa de la Primera Ficha
        </h4>
        {qty > 0 && startNum > 0 ? (
          <Card className="rounded-[2rem] border border-border shadow-lg max-w-[210mm] overflow-hidden bg-white mx-auto">
            <CardContent className="p-8">
              <SingleSheetView
                lote={startNum}
                cliente={cliente}
                tipoPrenda={tipoPrenda}
                nombreTela={nombreTela}
                fechaIngreso={fechaIngreso}
                codigo={codigo}
                proceso={proceso}
                nIngreso={nIngreso}
                nPrendas1={nPrendas1}
                nPrendas2={nPrendas2}
                peso={peso}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="h-32 rounded-2xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-xs font-bold uppercase tracking-wider">
            Ingrese un Lote Inicial y Cantidad para previsualizar
          </div>
        )}
      </div>

      {/* ÁREA DE IMPRESIÓN REAL (Oculto en pantalla, visible solo en @media print) */}
      <div className="hidden print:block absolute left-0 top-0 w-full" id="print-area">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body, html {
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
            }
            @page {
              size: A5 landscape;
              margin: 4mm 6mm;
            }
            .ficha-print-container {
              page-break-after: always !important;
              box-sizing: border-box;
              width: 198mm;
              height: 140mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              padding: 2px;
            }
            .ficha-print-container:last-child {
              page-break-after: avoid !important;
            }
          }
        `}} />
        {listFichas.map((lNum, i) => (
          <div key={i} className="ficha-print-container">
            <SingleSheetView
              lote={lNum}
              cliente={cliente}
              tipoPrenda={tipoPrenda}
              nombreTela={nombreTela}
              fechaIngreso={fechaIngreso}
              codigo={codigo}
              proceso={proceso}
              nIngreso={nIngreso}
              nPrendas1={nPrendas1}
              nPrendas2={nPrendas2}
              peso={peso}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Sub-componente para renderizar la Ficha Exacta
interface SingleSheetViewProps {
  lote: number;
  cliente: string;
  tipoPrenda: string;
  nombreTela: string;
  fechaIngreso: string;
  codigo: string;
  proceso: string;
  nIngreso: string;
  nPrendas1: string;
  nPrendas2: string;
  peso: string;
}

function SingleSheetView({
  lote,
  cliente,
  tipoPrenda,
  nombreTela,
  fechaIngreso,
  codigo,
  proceso,
  nIngreso,
  nPrendas1,
  nPrendas2,
  peso,
}: SingleSheetViewProps) {
  return (
    <div className="w-full text-[#0F1E36] font-sans text-xs select-none" style={{ boxSizing: "border-box" }}>
      {/* Borde contenedor principal */}
      <div className="border-[1.5px] border-[#0F1E36] p-3 rounded-lg bg-white relative w-full h-[135mm] flex flex-col justify-between">
        
        {/* Cabecera Principal */}
        <div>
          <div className="grid grid-cols-12 border-b border-[#0F1E36] pb-2">
            {/* Título de la Ficha */}
            <div className="col-span-8 flex flex-col justify-center">
              <h1 className="text-[13px] font-black uppercase tracking-wide leading-tight text-[#0F1E36]">
                LABORATORIO DEL DENIM ECUADOR
              </h1>
              <h2 className="text-xs font-black uppercase tracking-widest text-[#0F1E36] mt-0.5">
                FICHA DE PROCESOS
              </h2>
            </div>
            {/* Logo de la Empresa */}
            <div className="col-span-1 flex items-center justify-center">
              <img src="/logo-lddec.png" alt="Logo" className="h-9 w-9 object-contain" />
            </div>
            {/* Cuadro Lateral CONFIRMADO */}
            <div className="col-span-3 border border-[#0F1E36] rounded text-[8px] font-black uppercase overflow-hidden">
              <div className="bg-[#0F1E36] text-white py-0.5 px-2 text-center text-[7px] font-black">
                CONFIRMADO
              </div>
              <div className="grid grid-cols-2 border-t border-[#0F1E36] py-0.5 px-1.5 gap-x-1">
                <span className="text-[7px]">N° INGRESO:</span>
                <span className="text-black font-black text-[8px] text-right">{nIngreso}</span>
              </div>
              <div className="grid grid-cols-2 border-t border-[#0F1E36] py-0.5 px-1.5 gap-x-1">
                <span className="text-[7px]">N° PRENDAS 1:</span>
                <span className="text-black font-black text-[8px] text-right">{nPrendas1}</span>
              </div>
              <div className="grid grid-cols-2 border-t border-[#0F1E36] py-0.5 px-1.5 gap-x-1">
                <span className="text-[7px]">N° PRENDAS 2:</span>
                <span className="text-black font-black text-[8px] text-right">{nPrendas2}</span>
              </div>
              <div className="grid grid-cols-2 border-t border-[#0F1E36] py-0.5 px-1.5 gap-x-1">
                <span className="text-[7px]">PESO (kg):</span>
                <span className="text-black font-black text-[8px] text-right">{peso}</span>
              </div>
            </div>
          </div>

          {/* Bloque de Información del Lote */}
          <div className="grid grid-cols-12 border-b border-[#0F1E36]">
            {/* Caja del Lote */}
            <div className="col-span-3 border-r border-[#0F1E36] py-2 flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase text-[#0F1E36]">LOTE N°</span>
              <span className="text-black font-black text-base tracking-tighter leading-none px-1.5">
                {lote}
              </span>
            </div>
            {/* Campo Cliente */}
            <div className="col-span-9 py-2 pl-3 flex items-center gap-2">
              <span className="text-[9px] font-black uppercase text-[#0F1E36]">CLIENTE:</span>
              <span className="text-black font-black text-xs uppercase">{cliente}</span>
            </div>
          </div>

          {/* Bloque Físico Técnico */}
          <div className="grid grid-cols-12 border-b border-[#0F1E36]">
            <div className="col-span-7 border-r border-[#0F1E36] py-1 flex items-center gap-1.5">
              <span className="text-[8px] font-bold uppercase text-[#0F1E36] pl-1">TIPO DE PRENDA:</span>
              <span className="text-black font-black text-xs uppercase">{tipoPrenda}</span>
            </div>
            <div className="col-span-5 py-1 pl-3 flex items-center gap-2">
              <span className="text-[8px] font-bold uppercase text-[#0F1E36]">MUESTRA EXTERNA</span>
            </div>
          </div>

          {/* Bloque Tela */}
          <div className="grid grid-cols-12 border-b border-[#0F1E36] py-1">
            <div className="col-span-12 flex items-center gap-1.5">
              <span className="text-[8px] font-bold uppercase text-[#0F1E36] pl-1">NOMBRE DE TELA:</span>
              <span className="text-black font-black text-xs uppercase">{nombreTela}</span>
            </div>
          </div>

          {/* Bloque Fecha e Ingreso */}
          <div className="grid grid-cols-12 border-b border-[#0F1E36]">
            <div className="col-span-7 border-r border-[#0F1E36] py-1 flex items-center gap-1.5">
              <span className="text-[8px] font-bold uppercase text-[#0F1E36] pl-1">FECHA DE INGRESO:</span>
              <span className="text-black font-black text-xs uppercase">{fechaIngreso}</span>
            </div>
            <div className="col-span-5 py-1 pl-3 flex items-center gap-2">
              <span className="text-[8px] font-bold uppercase text-[#0F1E36]">CODIGO:</span>
              <span className="text-black font-black text-xs uppercase">{codigo}</span>
            </div>
          </div>

          {/* Bloque Proceso */}
          <div className="grid grid-cols-12 border-b border-[#0F1E36] py-2">
            <div className="col-span-12 flex items-center gap-2">
              <span className="text-[9px] font-black uppercase text-[#0F1E36] pl-1">PROCESO:</span>
              <span className="text-black font-black text-xs uppercase">{proceso}</span>
            </div>
          </div>
        </div>

        {/* Tabla de Manualidades y Seguimiento */}
        <div className="flex-1 mt-2">
          <table className="w-full border-collapse border border-[#0F1E36]">
            <thead>
              <tr className="bg-[#0F1E36] text-white">
                <th className="border border-[#0F1E36] text-[8px] font-black uppercase py-1 text-center w-[20%]">MANUALIDADES</th>
                <th className="border border-[#0F1E36] text-[8px] font-black uppercase py-1 text-center w-[25%]">NOMBRE</th>
                <th className="border border-[#0F1E36] text-[8px] font-black uppercase py-1 text-center w-[10%]">CANT</th>
                <th className="border border-[#0F1E36] text-[8px] font-black uppercase py-1 text-center w-[15%]">FIRMA</th>
                <th className="border border-[#0F1E36] text-[8px] font-black uppercase py-1 text-center w-[30%]">OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>
              {/* Filas del cuerpo */}
              {Array.from({ length: 7 }).map((_, idx) => (
                <tr key={idx} className="h-5">
                  <td className="border border-[#0F1E36] px-1 text-center"></td>
                  <td className="border border-[#0F1E36] px-1"></td>
                  <td className="border border-[#0F1E36] px-1"></td>
                  <td className="border border-[#0F1E36] px-1"></td>
                  {/* Celda de Observaciones con rowspans para Faltantes y Total */}
                  {idx === 0 && (
                    <td className="border border-[#0F1E36] relative align-top p-1" rowSpan={4}>
                      <div className="text-[6px] text-muted-foreground uppercase font-bold">Faltantes:</div>
                    </td>
                  )}
                  {idx === 4 && (
                    <td className="border border-[#0F1E36] text-center font-black text-[8px] uppercase align-middle bg-[#0f1e36]/5" rowSpan={2}>
                      FALTANTES
                    </td>
                  )}
                  {idx === 6 && (
                    <td className="border border-[#0F1E36] text-center font-black text-[8px] uppercase align-middle bg-[#0f1e36]/5">
                      TOTAL ENVIADO
                    </td>
                  )}
                </tr>
              ))}

              {/* Fila de PROCESO */}
              <tr className="h-5 bg-[#0f1e36]/5">
                <td className="border border-[#0F1E36] text-center text-[7px] font-black uppercase">PROCESO</td>
                <td className="border border-[#0F1E36]"></td>
                <td className="border border-[#0F1E36]"></td>
                <td className="border border-[#0F1E36]"></td>
                <td className="border border-[#0F1E36]" rowSpan={3}></td>
              </tr>
              {/* Fila de SECADO */}
              <tr className="h-5 bg-[#0f1e36]/5">
                <td className="border border-[#0F1E36] text-center text-[7px] font-black uppercase">SECADO</td>
                <td className="border border-[#0F1E36]"></td>
                <td className="border border-[#0F1E36]"></td>
                <td className="border border-[#0F1E36]"></td>
              </tr>
              {/* Fila de DESPACHO */}
              <tr className="h-5 bg-[#0f1e36]/5">
                <td className="border border-[#0F1E36] text-center text-[7px] font-black uppercase">DESPACHO</td>
                <td className="border border-[#0F1E36]"></td>
                <td className="border border-[#0F1E36]"></td>
                <td className="border border-[#0F1E36]"></td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
