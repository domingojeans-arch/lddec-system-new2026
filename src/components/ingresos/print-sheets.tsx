"use client";

import React, { useState } from "react";
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
              margin: 0 !important;
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
  const cellStyle = {
    border: "1.2px solid #002060",
    padding: "3px 5px",
    fontSize: "9px",
    fontWeight: "bold",
    color: "#002060",
    fontFamily: "Arial, Helvetica, sans-serif",
    verticalAlign: "middle" as const,
  };

  const valStyle = {
    fontSize: "9px",
    fontWeight: "bold",
    color: "black",
    fontFamily: "Arial, Helvetica, sans-serif",
  };

  return (
    <div style={{ width: "100%", height: "100%", boxSizing: "border-box", padding: "1px" }}>
      {/* Contenedor wrapper con bordes redondeados y borde general garantizado en horizontal */}
      <div style={{ width: "100%", height: "100%", border: "1.2px solid #002060", borderRadius: "5px", overflow: "hidden", boxSizing: "border-box" }}>
        <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", border: "none" }}>
          <tbody>
            {/* Fila 1: Cabecera */}
            <tr style={{ height: "30px" }}>
              <td colSpan={7} style={{ ...cellStyle, textAlign: "center", borderTop: "none", borderLeft: "none" }}>
                <div style={{ fontSize: "12px", fontWeight: "bold", letterSpacing: "0.5px" }}>LABORATORIO DEL DENIM ECUADOR</div>
                <div style={{ fontSize: "11px", fontWeight: "bold", letterSpacing: "1.5px", marginTop: "2px" }}>FICHA DE PROCESOS</div>
              </td>
              <td colSpan={2} style={{ ...cellStyle, textAlign: "center", width: "10%", borderTop: "none" }}>
                <img src="/logo-lddec.png" alt="Logo" style={{ height: "26px", margin: "0 auto", objectFit: "contain" }} />
              </td>
              <td colSpan={3} style={{ ...cellStyle, padding: "0", verticalAlign: "top", width: "30%", borderTop: "none", borderRight: "none" }}>
                <div style={{ borderBottom: "1.2px solid #002060", background: "#002060", color: "white", textAlign: "center", fontSize: "8px", fontWeight: "bold", padding: "1.5px 0" }}>
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
                  <span style={{ color: "black", fontSize: "10px" }}>{nIngreso}</span>
                </div>
              </td>
            </tr>

            {/* Fila 3: LOTE, MUESTRA EXTERNA y N° PRENDAS 1 */}
            <tr style={{ height: "30px" }}>
              <td colSpan={1} style={{ ...cellStyle, width: "10%", borderLeft: "none" }}>LOTE N°</td>
              <td colSpan={5} style={{ ...cellStyle, fontSize: "16px", fontWeight: "bold", textAlign: "center", color: "black" }}>
                {lote || ""}
              </td>
              <td colSpan={3} rowSpan={2} style={{ ...cellStyle, verticalAlign: "top", padding: "3px 5px" }}>
                <div style={{ fontSize: "8px", color: "#002060", fontWeight: "bold" }}>MUESTRA EXTERNA</div>
              </td>
              <td colSpan={3} style={{ ...cellStyle, width: "30%", padding: "4px 6px", borderRight: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span>N° PRENDAS 1:</span>
                  <span style={{ color: "black", fontSize: "10px" }}>{nPrendas1}</span>
                </div>
              </td>
            </tr>

            {/* Fila 4: TIPO DE PRENDA y N° PRENDAS 2 */}
            <tr style={{ height: "26px" }}>
              <td colSpan={2} style={{ ...cellStyle, width: "15%", borderLeft: "none" }}>TIPO DE PRENDA:</td>
              <td colSpan={4} style={{ ...cellStyle, fontSize: "9px", fontWeight: "bold", color: "black", textTransform: "uppercase" }}>{tipoPrenda}</td>
              <td colSpan={3} style={{ ...cellStyle, width: "30%", padding: "4px 6px", borderRight: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span>N° PRENDAS 2:</span>
                  <span style={{ color: "black", fontSize: "10px" }}>{nPrendas2}</span>
                </div>
              </td>
            </tr>

            {/* Fila 5: NOMBRE DE TELA, CÓDIGO y PESO (kg) (rowspan 2) */}
            <tr style={{ height: "26px" }}>
              <td colSpan={2} style={{ ...cellStyle, borderLeft: "none" }}>NOMBRE DE TELA:</td>
              <td colSpan={4} style={{ ...cellStyle, fontSize: "9px", fontWeight: "bold", color: "black", textTransform: "uppercase" }}>{nombreTela}</td>
              <td colSpan={3} rowSpan={2} style={{ ...cellStyle, verticalAlign: "top", padding: "3px 5px" }}>
                <div style={{ fontSize: "8px", color: "#002060", fontWeight: "bold" }}>CODIGO</div>
                <div style={{ color: "black", fontSize: "10px", fontWeight: "bold", textAlign: "center", marginTop: "4px" }}>
                  {codigo || ""}
                </div>
              </td>
              <td colSpan={3} rowSpan={2} style={{ ...cellStyle, width: "30%", padding: "6px 6px", borderRight: "none" }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", minHeight: "44px" }}>
                  <span style={{ fontSize: "9px" }}>PESO (kg):</span>
                  <span style={{ color: "black", fontSize: "14px", fontWeight: "bold", textAlign: "right", paddingRight: "4px" }}>{peso}</span>
                </div>
              </td>
            </tr>

            {/* Fila 6: FECHA DE INGRESO */}
            <tr style={{ height: "26px" }}>
              <td colSpan={2} style={{ ...cellStyle, borderLeft: "none" }}>FECHA DE INGRESO:</td>
              <td colSpan={4} style={{ ...cellStyle, fontSize: "9px", fontWeight: "bold", color: "black" }}>{fechaIngreso}</td>
            </tr>

            {/* Fila 7: PROCESO */}
            <tr style={{ height: "46px" }}>
              <td colSpan={2} style={{ ...cellStyle, borderLeft: "none" }}>PROCESO:</td>
              <td colSpan={10} style={{ ...cellStyle, fontSize: "9px", fontWeight: "bold", color: "black", textTransform: "uppercase", borderRight: "none" }}>{proceso}</td>
            </tr>

            {/* Fila 8: Encabezados de Tabla de Manualidades */}
            <tr style={{ height: "18px", background: "#002060" }}>
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
                      <td colSpan={3} style={{ ...cellStyle, textAlign: "center", fontSize: "7px", padding: "1px", background: "#002060/5", borderLeft: "none" }}>PROCESO</td>
                      <td colSpan={3} style={{ ...cellStyle, padding: "0" }}></td>
                      <td colSpan={1} style={{ ...cellStyle, padding: "0" }}></td>
                      <td colSpan={2} style={{ ...cellStyle, padding: "0" }}></td>
                    </>
                  ) : idx === 9 ? (
                    <>
                      <td colSpan={3} style={{ ...cellStyle, textAlign: "center", fontSize: "7px", padding: "1px", background: "#002060/5", borderLeft: "none" }}>SECADO</td>
                      <td colSpan={3} style={{ ...cellStyle, padding: "0" }}></td>
                      <td colSpan={1} style={{ ...cellStyle, padding: "0" }}></td>
                      <td colSpan={2} style={{ ...cellStyle, padding: "0" }}></td>
                    </>
                  ) : (
                    <>
                      <td colSpan={3} style={{ ...cellStyle, textAlign: "center", fontSize: "7px", padding: "1px", background: "#002060/5", borderLeft: "none", borderBottom: "none" }}>DESPACHO</td>
                      <td colSpan={3} style={{ ...cellStyle, padding: "0", borderBottom: "none" }}></td>
                      <td colSpan={1} style={{ ...cellStyle, padding: "0", borderBottom: "none" }}></td>
                      <td colSpan={2} style={{ ...cellStyle, padding: "0", borderBottom: "none" }}></td>
                    </>
                  )}

                  {/* Columna Observaciones con division en Faltantes y Total Enviado */}
                  {idx === 0 && (
                    <td colSpan={3} rowSpan={5} style={{ ...cellStyle, verticalAlign: "top", padding: "3px 5px", height: "80px", borderRight: "none" }}>
                      <div style={{ fontSize: "10px", color: "#002060", fontWeight: "bold" }}>FALTANTES</div>
                    </td>
                  )}
                  {idx === 5 && (
                    <td colSpan={3} rowSpan={6} style={{ ...cellStyle, verticalAlign: "top", padding: "3px 5px", height: "96px", borderRight: "none", borderBottom: "none" }}>
                      <div style={{ fontSize: "10px", color: "#002060", fontWeight: "bold" }}>TOTAL ENVIADO</div>
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
