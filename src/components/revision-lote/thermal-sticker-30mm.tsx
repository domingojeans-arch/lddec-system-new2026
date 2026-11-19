"use client";

import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ThermalStickerData {
  fecha: string;
  lote: string;
  ingreso: string;
  cantidad: number;
  cliente: string;
  prenda?: string;
  revisadoPor?: string;
}

interface ThermalStickerProps {
  data: ThermalStickerData;
}

export function ThermalSticker30mm({ data }: ThermalStickerProps) {
  return (
    <>
      {/* ESTILOS GLOBALES DE IMPRESIÓN PARA BOBINA TÉRMICA DE 30 MM */}
      <style jsx global>{`
        @media print {
          @page {
            size: 30mm auto;
            margin: 0mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 30mm !important;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-30mm,
          #thermal-receipt-30mm * {
            visibility: visible !important;
          }
          #thermal-receipt-30mm {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 30mm !important;
            max-width: 30mm !important;
            min-width: 30mm !important;
            margin: 0 !important;
            padding: 1.5mm 1mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace !important;
            z-index: 9999999 !important;
          }
          /* Ocultar elementos de UI no imprimibles */
          .no-print, [data-state="open"]::before {
            display: none !important;
          }
          [data-radix-portal], [role="dialog"], .fixed {
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {/* CONTENEDOR DEL STICKER TÉRMICO (30 MM DE ANCHO) */}
      <div
        id="thermal-receipt-30mm"
        className="w-[30mm] max-w-[30mm] min-w-[30mm] bg-white text-black text-left p-[1.5mm] leading-tight select-none border border-zinc-300 dark:border-zinc-700 rounded-sm shadow-sm font-sans mx-auto"
        style={{
          width: "30mm",
          maxWidth: "30mm",
          minWidth: "30mm",
          boxSizing: "border-box",
          color: "#000000",
          backgroundColor: "#ffffff",
        }}
      >
        {/* ENCABEZADO */}
        <div className="text-center pb-1 border-b border-dashed border-black">
          <div className="font-black text-[10px] tracking-widest leading-none">
            LDDEC
          </div>
          <div className="text-[6.5px] font-bold tracking-tight text-zinc-800 leading-tight mt-0.5">
            CONTROL DE LOTE
          </div>
        </div>

        {/* FECHA E INGRESO */}
        <div className="py-1 border-b border-dashed border-black text-[7.5px] space-y-0.5 leading-tight">
          <div className="flex justify-between items-center">
            <span className="font-bold">FECHA:</span>
            <span className="font-mono text-[7px] font-semibold">{data.fecha}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-bold">INGRESO:</span>
            <span className="font-black font-mono text-[8px]">{data.ingreso}</span>
          </div>
        </div>

        {/* NÚMERO DE LOTE (MÁXIMO CONTRASTE Y TAMAÑO) */}
        <div className="py-1.5 text-center border-b border-dashed border-black bg-zinc-50/50">
          <div className="text-[6.5px] font-bold uppercase tracking-wider text-zinc-700">
            LOTE N°
          </div>
          <div className="text-[14px] font-black tracking-tight leading-none my-0.5 font-mono">
            {data.lote}
          </div>
        </div>

        {/* CANTIDAD CONFIRMADA (GRANDE Y CLARA) */}
        <div className="py-1.5 text-center border-b border-dashed border-black">
          <div className="text-[6.5px] font-bold uppercase tracking-wider text-zinc-700">
            CANT. CONFIRMADA
          </div>
          <div className="text-[15px] font-black leading-none font-mono tracking-tight mt-0.5">
            {data.cantidad} <span className="text-[8px] font-bold">PZS</span>
          </div>
        </div>

        {/* CLIENTE */}
        <div className="py-1 border-b border-dashed border-black text-[7.5px] leading-tight">
          <div className="text-[6.5px] font-bold uppercase text-zinc-700">
            CLIENTE:
          </div>
          <div className="font-black uppercase break-words leading-tight text-[8px] mt-0.5">
            {data.cliente}
          </div>
        </div>

        {/* PRENDA Y OPERARIO (DATOS ADICIONALES) */}
        {(data.prenda || data.revisadoPor) && (
          <div className="pt-1 text-[7px] space-y-0.5 leading-tight">
            {data.prenda && (
              <div className="truncate">
                <span className="font-bold">PRENDA: </span>
                <span className="uppercase text-zinc-800">{data.prenda}</span>
              </div>
            )}
            {data.revisadoPor && (
              <div className="truncate">
                <span className="font-bold">REV: </span>
                <span className="uppercase text-zinc-800">{data.revisadoPor}</span>
              </div>
            )}
          </div>
        )}

        {/* PIE DE STICKER */}
        <div className="text-center pt-1 mt-0.5 border-t border-dotted border-zinc-400 text-[6px] font-mono text-zinc-600 tracking-tighter">
          * CONFIRMADO EN PLANTA *
        </div>
      </div>
    </>
  );
}
