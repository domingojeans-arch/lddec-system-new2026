"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

export function PrintSheetsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchLot, setSearchLot] = useState("");
  const [mounted, setMounted] = useState(false);

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

  // Opciones de Impresión (Azul Oscuro profundo es #001133)
  const [printColor, setPrintColor] = useState("#001133");
  const [lastPrintedLot, setLastPrintedLot] = useState("");

  useEffect(() => {
    setMounted(true);
    const lastLot = localStorage.getItem("lastPrintedLot");
    if (lastLot) setLastPrintedLot(lastLot);
    const color = localStorage.getItem("printColor");
    if (color) {
      // Si el color guardado era el azul claro anterior, lo actualizamos al nuevo azul profundo
      setPrintColor(color === "#002060" ? "#001133" : color);
    }
  }, []);

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

    const finalLot = startNum - qty + 1;
    localStorage.setItem("lastPrintedLot", String(finalLot));
    setLastPrintedLot(String(finalLot));
    localStorage.setItem("printColor", printColor);

    window.print();
  };

  const startNum = parseInt(loteInicial) || 0;
  const qty = parseInt(cantidad) || 0;
  const listFichas = Array.from({ length: qty }).map((_, idx) => {
    return startNum - idx;
  });

  return (
    <div className="space-y-8">
      {/* SECCIÓN CONFIGURACIÓN (No se imprime) */}
      <div className="bg-card border border-border rounded-[2rem] p-8 shadow-premium no-print space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Fichas de Procesos (Excel Copy)</h3>
            <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider mt-1">
              Réplica idéntica de la plantilla original de Excel en media hoja A4
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
              placeholder={lastPrintedLot ? `Ref: ${lastPrintedLot}` : "Ej: 23617"}
              value={loteInicial}
              onChange={(e) => setLoteInicial(e.target.value)}
              className="erp-input h-11 text-center font-black text-lg border-primary/20 text-primary animate-pulse-subtle"
            />
            {lastPrintedLot && (
              <span className="text-[10px] text-muted-foreground block mt-1 font-bold text-center">
                Último impreso: <span className="text-primary font-black">{lastPrintedLot}</span>
              </span>
            )}
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
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Color de Impresión</Label>
            <select
              value={printColor}
              onChange={(e) => setPrintColor(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-bold"
            >
              <option value="#001133">Azul Oscuro</option>
              <option value="#000000">Negro</option>
            </select>
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

      {/* SECCIÓN VISTA PREVIA (no-print) */}
      <div className="no-print space-y-4">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
          Vista Previa de la Ficha (Horizontal A5)
        </h4>
        {qty > 0 && startNum > 0 ? (
          <div className="flex justify-center bg-muted/20 p-8 rounded-[2rem] border border-border">
            <div className="bg-white shadow-2xl p-4 border border-black/10 rounded-lg overflow-hidden" style={{ width: "210mm", height: "148mm", boxSizing: "border-box" }}>
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
                printColor={printColor}
              />
            </div>
          </div>
        ) : (
          <div className="h-32 rounded-2xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-xs font-bold uppercase tracking-wider">
            Ingrese un Lote Inicial y Cantidad para previsualizar
          </div>
        )}
      </div>

      {/* ÁREA DE IMPRESIÓN REAL */}
      {mounted && typeof document !== "undefined" && createPortal(
        <div className="hidden print:block absolute left-0 top-0 w-full" id="print-area">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              /* Ocultar absolutamente todo excepto el area de impresion */
              body > *:not(#print-area) {
                display: none !important;
              }
              #print-area {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                height: auto !important;
              }
              /* Forzar la impresion de colores y graficos de fondo */
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              @page {
                size: portrait;
                margin: 0 !important;
              }
              body, html {
                margin: 0 !important;
                padding: 0 !important;
                width: 210mm !important;
                background: #fff !important;
                overflow: visible !important;
              }
              .ficha-print-container {
                page-break-after: always !important;
                page-break-inside: avoid !important;
                box-sizing: border-box;
                width: 210mm;
                height: 148mm;
                padding: 4mm 6mm;
                background: white;
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
                printColor={printColor}
              />
            </div>
          ))}
        </div>,
        document.body
      )}
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
  printColor: string;
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
  printColor,
}: SingleSheetViewProps) {
  const cellStyle = {
    borderTop: `1.2px solid ${printColor}`,
    borderBottom: `1.2px solid ${printColor}`,
    borderLeft: `1.2px solid ${printColor}`,
    borderRight: `1.2px solid ${printColor}`,
    padding: "3px 5px",
    fontSize: "9px",
    fontWeight: "bold",
    color: printColor,
    fontFamily: "Arial, Helvetica, sans-serif",
    verticalAlign: "middle" as const,
  };

  const valStyle = {
    fontSize: "9px",
    fontWeight: "bold",
    color: printColor, // Imprime todo el texto en el color seleccionado (Azul Oscuro o Negro)
    fontFamily: "Arial, Helvetica, sans-serif",
  };

  return (
    <div style={{ width: "100%", height: "100%", boxSizing: "border-box", padding: "1px" }}>
      {/* Contenedor wrapper con bordes redondeados y borde general garantizado en horizontal */}
      <div style={{ width: "100%", height: "100%", borderTop: `1.2px solid ${printColor}`, borderBottom: `1.2px solid ${printColor}`, borderLeft: `1.2px solid ${printColor}`, borderRight: `1.2px solid ${printColor}`, borderRadius: "5px", overflow: "hidden", boxSizing: "border-box" }}>
        <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", border: "none" }}>
          <tbody>
            {/* Fila 1: Cabecera */}
            <tr style={{ height: "30px" }}>
              <td colSpan={7} style={{ ...cellStyle, textAlign: "center", borderTop: "none", borderLeft: "none" }}>
                <div style={{ fontSize: "12px", fontWeight: "900", letterSpacing: "0.5px" }}>LABORATORIO DEL DENIM ECUADOR</div>
                <div style={{ fontSize: "11px", fontWeight: "900", letterSpacing: "1.5px", marginTop: "2px" }}>FICHA DE PROCESOS</div>
              </td>
              <td colSpan={2} style={{ ...cellStyle, textAlign: "center", width: "10%", borderTop: "none", padding: "1px" }}>
                <img 
                  src="/logo-lddec.png" 
                  alt="Logo" 
                  style={{ 
                    height: "28px", 
                    width: "100%", 
                    objectFit: "contain", 
                    margin: "0 auto",
                    // Si se imprime en negro, convierte el logo a negro puro. Si es azul, mantiene su color original
                    filter: printColor === "#000000" ? "brightness(0)" : "none"
                  }} 
                />
              </td>
              <td colSpan={3} style={{ ...cellStyle, padding: "0", verticalAlign: "top", width: "30%", borderTop: "none", borderRight: "none" }}>
                <div style={{ borderBottom: `1.2px solid ${printColor}`, background: printColor, color: "white", textAlign: "center", fontSize: "8px", fontWeight: "bold", padding: "1.5px 0" }}>
                  CONFIRMADO
                </div>
                <div style={{ height: "10px" }}></div>
              </td>
            </tr>

            {/* Fila 2: CLIENTE y N° INGRESO */}
            <tr style={{ height: "30px" }}>
              <td colSpan={2} style={{ ...cellStyle, borderLeft: "none", width: "15%" }}>CLIENTE:</td>
              <td colSpan={7} style={{ ...cellStyle, ...valStyle, textTransform: "uppercase" }}>{cliente}</td>
              <td colSpan={3} style={{ ...cellStyle, width: "30%", padding: "4px 6px", borderRight: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span>N° INGRESO:</span>
                  <span style={{ color: printColor, fontSize: "10px", fontWeight: "bold" }}>{nIngreso}</span>
                </div>
              </td>
            </tr>

            {/* Fila 3: LOTE y N° PRENDAS 1 */}
            <tr style={{ height: "30px" }}>
              <td colSpan={1} style={{ ...cellStyle, width: "10%", borderLeft: "none" }}>LOTE N°</td>
              <td colSpan={5} style={{ ...cellStyle, fontSize: "26px", fontWeight: "900", textAlign: "center", color: printColor }}>
                {lote || ""}
              </td>
              <td colSpan={3} rowSpan={2} style={{ ...cellStyle, verticalAlign: "top", padding: "3px 5px" }}>
                <div style={{ fontSize: "8px", color: printColor, fontWeight: "bold" }}>MUESTRA EXTERNA</div>
              </td>
              <td colSpan={3} style={{ ...cellStyle, width: "30%", padding: "4px 6px", borderRight: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span>N° PRENDAS 1:</span>
                  <span style={{ color: printColor, fontSize: "10px", fontWeight: "bold" }}>{nPrendas1}</span>
                </div>
              </td>
            </tr>

            {/* Fila 4: TIPO DE PRENDA y N° PRENDAS 2 */}
            <tr style={{ height: "30px" }}>
              <td colSpan={2} style={{ ...cellStyle, width: "15%", borderLeft: "none" }}>TIPO DE PRENDA:</td>
              <td colSpan={4} style={{ ...cellStyle, ...valStyle, textTransform: "uppercase" }}>{tipoPrenda}</td>
              <td colSpan={3} style={{ ...cellStyle, width: "30%", padding: "4px 6px", borderRight: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span>N° PRENDAS 2:</span>
                  <span style={{ color: printColor, fontSize: "10px", fontWeight: "bold" }}>{nPrendas2}</span>
                </div>
              </td>
            </tr>

            {/* Fila 5: NOMBRE DE TELA, CÓDIGO y PESO (kg) (rowspan 2) */}
            <tr style={{ height: "26px" }}>
              <td colSpan={2} style={{ ...cellStyle, borderLeft: "none" }}>NOMBRE DE TELA:</td>
              <td colSpan={4} style={{ ...cellStyle, ...valStyle, textTransform: "uppercase" }}>{nombreTela}</td>
              <td colSpan={3} rowSpan={2} style={{ ...cellStyle, verticalAlign: "top", padding: "3px 5px" }}>
                <div style={{ fontSize: "8px", color: printColor, fontWeight: "bold" }}>CODIGO</div>
                <div style={{ color: printColor, fontSize: "10px", fontWeight: "bold", textAlign: "center", marginTop: "4px" }}>
                  {codigo || ""}
                </div>
              </td>
              <td colSpan={3} rowSpan={2} style={{ ...cellStyle, width: "30%", padding: "6px 6px", borderRight: "none" }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", minHeight: "44px" }}>
                  <span style={{ fontSize: "9px" }}>PESO (kg):</span>
                  <span style={{ color: printColor, fontSize: "14px", fontWeight: "bold", textAlign: "right", paddingRight: "4px" }}>{peso}</span>
                </div>
              </td>
            </tr>

            {/* Fila 6: FECHA DE INGRESO */}
            <tr style={{ height: "26px" }}>
              <td colSpan={2} style={{ ...cellStyle, borderLeft: "none" }}>FECHA DE INGRESO:</td>
              <td colSpan={4} style={{ ...cellStyle, ...valStyle }}>{fechaIngreso}</td>
            </tr>

            {/* Fila 7: PROCESO */}
            <tr style={{ height: "46px" }}>
              <td colSpan={2} style={{ ...cellStyle, borderLeft: "none" }}>PROCESO:</td>
              <td colSpan={10} style={{ ...cellStyle, ...valStyle, textTransform: "uppercase", borderRight: "none" }}>{proceso}</td>
            </tr>

            {/* Fila 8: Encabezados de Tabla de Manualidades */}
            <tr style={{ height: "18px", background: printColor }}>
              <td colSpan={3} style={{ ...cellStyle, color: "white", textAlign: "center", fontSize: "8px", padding: "1px", width: "20%", borderLeft: "none" }}>MANUALIDADES</td>
              <td colSpan={3} style={{ ...cellStyle, color: "white", textAlign: "center", fontSize: "8px", padding: "1px", width: "22%" }}>NOMBRE</td>
              <td colSpan={1} style={{ ...cellStyle, color: "white", textAlign: "center", fontSize: "8px", padding: "1px", width: "8%" }}>CANT</td>
              <td colSpan={2} style={{ ...cellStyle, color: "white", textAlign: "center", fontSize: "8px", padding: "1px", width: "12%" }}>FIRMA</td>
              <td colSpan={3} style={{ ...cellStyle, color: "white", textAlign: "center", fontSize: "8px", padding: "1px", width: "38%", borderRight: "none" }}>OBSERVACIONES</td>
            </tr>

            {/* Filas 9-19: Cuerpo de Tabla de Manualidades */}
            {Array.from({ length: 11 }).map((_, idx) => {
              return (
                <tr key={idx} style={{ height: "16px" }}>
                  {/* Columnas manualidades, nombre, cant, firma */}
                  {idx < 8 ? (
                    <>
                      <td colSpan={3} style={{ ...cellStyle, padding: "0", borderLeft: "none" }}></td>
                      <td colSpan={3} style={{ ...cellStyle, padding: "0" }}></td>
                      <td colSpan={1} style={{ ...cellStyle, padding: "0" }}></td>
                      <td colSpan={2} style={{ ...cellStyle, padding: "0" }}></td>
                    </>
                  ) : idx === 8 ? (
                    <>
                      <td colSpan={3} style={{ ...cellStyle, textAlign: "center", fontSize: "7px", padding: "1px", background: `${printColor}1a`, borderLeft: "none" }}>PROCESO</td>
                      <td colSpan={3} style={{ ...cellStyle, padding: "0" }}></td>
                      <td colSpan={1} style={{ ...cellStyle, padding: "0" }}></td>
                      <td colSpan={2} style={{ ...cellStyle, padding: "0" }}></td>
                    </>
                  ) : idx === 9 ? (
                    <>
                      <td colSpan={3} style={{ ...cellStyle, textAlign: "center", fontSize: "7px", padding: "1px", background: `${printColor}1a`, borderLeft: "none" }}>SECADO</td>
                      <td colSpan={3} style={{ ...cellStyle, padding: "0" }}></td>
                      <td colSpan={1} style={{ ...cellStyle, padding: "0" }}></td>
                      <td colSpan={2} style={{ ...cellStyle, padding: "0" }}></td>
                    </>
                  ) : (
                    <>
                      <td colSpan={3} style={{ ...cellStyle, textAlign: "center", fontSize: "7px", padding: "1px", background: `${printColor}1a`, borderLeft: "none", borderBottom: "none" }}>DESPACHO</td>
                      <td colSpan={3} style={{ ...cellStyle, padding: "0", borderBottom: "none" }}></td>
                      <td colSpan={1} style={{ ...cellStyle, padding: "0", borderBottom: "none" }}></td>
                      <td colSpan={2} style={{ ...cellStyle, padding: "0", borderBottom: "none" }}></td>
                    </>
                  )}

                  {/* Columna Observaciones con division en Faltantes y Total Enviado */}
                  {idx === 0 && (
                    <td colSpan={3} rowSpan={5} style={{ ...cellStyle, verticalAlign: "top", padding: "3px 5px", height: "80px", borderRight: "none" }}>
                      <div style={{ fontSize: "10px", color: printColor, fontWeight: "bold" }}>FALTANTES</div>
                    </td>
                  )}
                  {idx === 5 && (
                    <td colSpan={3} rowSpan={6} style={{ ...cellStyle, verticalAlign: "top", padding: "3px 5px", height: "96px", borderRight: "none", borderBottom: "none" }}>
                      <div style={{ fontSize: "10px", color: printColor, fontWeight: "bold" }}>TOTAL ENVIADO</div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
