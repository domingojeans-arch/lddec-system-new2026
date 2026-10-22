"use client";

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";

export interface PdfExportOptions {
  filename?: string;
  landscape?: boolean;
  scale?: number;
  quality?: number;
}

/**
 * Utility to export an HTML report container to a downloadable A4 PDF.
 * Specifically optimized for mobile browsers (iPhone/Safari/Chrome) and desktop.
 */
export async function exportReportToPdf(
  target: string | HTMLElement,
  options: PdfExportOptions = {}
): Promise<void> {
  const {
    filename = "reporte-lddec.pdf",
    landscape = false,
    scale = 2,
    quality = 0.95,
  } = options;

  let element: HTMLElement | null = null;
  if (typeof target === "string") {
    element = document.getElementById(target);
  } else {
    element = target;
  }

  if (!element) {
    console.error(`exportReportToPdf: Element "${target}" not found.`);
    throw new Error(`No se encontró el contenido del reporte para generar el PDF.`);
  }

  // Clone element to prevent interfering with live DOM and ensure desktop-grade layout on mobile
  const clone = element.cloneNode(true) as HTMLElement;

  // Offscreen container with fixed width suitable for A4
  const container = document.createElement("div");
  container.id = "pdf-export-offscreen-sandbox";
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "-99999px";
  container.style.width = landscape ? "1120px" : "820px";
  container.style.minWidth = landscape ? "1120px" : "820px";
  container.style.maxWidth = landscape ? "1120px" : "820px";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#000000";
  container.style.zIndex = "-9999";
  container.style.overflow = "visible";
  container.style.padding = "20px";
  container.style.boxSizing = "border-box";

  // Process cloned elements: unhide print headers, hide buttons and print-hidden elements
  const allElements = clone.querySelectorAll("*");
  allElements.forEach((node) => {
    const el = node as HTMLElement;
    const cls = typeof el.className === "string" ? el.className : "";

    // Unhide elements meant for print (headers, logo, meta)
    if (
      cls.includes("print:block") ||
      cls.includes("header-logo") ||
      cls.includes("header-title") ||
      cls.includes("meta-info")
    ) {
      el.classList.remove("hidden");
      el.style.display = "block";
    } else if (cls.includes("print:flex")) {
      el.classList.remove("hidden");
      el.style.display = "flex";
    }

    // Hide elements marked print-hidden or buttons
    if (
      cls.includes("print-hidden") ||
      cls.includes("print:hidden") ||
      el.tagName === "BUTTON" ||
      el.getAttribute("data-pdf-ignore") === "true"
    ) {
      el.style.display = "none";
    }
  });

  // Inject crisp printing styles directly inside container
  const printStyle = document.createElement("style");
  printStyle.textContent = `
    #pdf-export-offscreen-sandbox,
    #pdf-export-offscreen-sandbox * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #pdf-export-offscreen-sandbox {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      color: #000000 !important;
      background: #ffffff !important;
    }
    #pdf-export-offscreen-sandbox .header-logo {
      position: absolute !important;
      top: 20px !important;
      right: 20px !important;
      width: 75px !important;
      height: 75px !important;
      object-fit: contain !important;
      display: block !important;
    }
    #pdf-export-offscreen-sandbox .header-title {
      font-size: 15pt !important;
      font-weight: 900 !important;
      text-transform: uppercase !important;
      margin-bottom: 2px !important;
      color: #000000 !important;
    }
    #pdf-export-offscreen-sandbox .header-subtitle {
      font-size: 12pt !important;
      font-weight: 700 !important;
      color: #1d4ed8 !important;
      text-transform: uppercase !important;
      margin-bottom: 8px !important;
    }
    #pdf-export-offscreen-sandbox .meta-info {
      font-size: 8.5pt !important;
      font-weight: 600 !important;
      color: #475569 !important;
      text-transform: uppercase !important;
      margin-bottom: 15px !important;
    }
    #pdf-export-offscreen-sandbox table {
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: collapse !important;
      margin-top: 10px !important;
      margin-bottom: 14px !important;
    }
    #pdf-export-offscreen-sandbox th {
      background-color: #f1f5f9 !important;
      border: 1px solid #000000 !important;
      color: #000000 !important;
      font-weight: 900 !important;
      font-size: 8pt !important;
      padding: 5px 6px !important;
      text-align: inherit !important;
    }
    #pdf-export-offscreen-sandbox td {
      border: 1px solid #000000 !important;
      color: #000000 !important;
      font-size: 8pt !important;
      padding: 4px 6px !important;
      line-height: 1.15 !important;
    }
    #pdf-export-offscreen-sandbox .bg-card,
    #pdf-export-offscreen-sandbox .bg-muted,
    #pdf-export-offscreen-sandbox .bg-background {
      background-color: #ffffff !important;
    }
    #pdf-export-offscreen-sandbox .text-muted-foreground,
    #pdf-export-offscreen-sandbox .text-foreground {
      color: #000000 !important;
    }
  `;
  container.appendChild(printStyle);
  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    // Wait for fonts and all images inside clone to be ready
    if (document.fonts) {
      await document.fonts.ready;
    }

    const images = Array.from(container.querySelectorAll("img"));
    if (images.length > 0) {
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((res) => {
            img.onload = res;
            img.onerror = res;
          });
        })
      );
    }

    // Small delay to ensure browser layout settles
    await new Promise((res) => setTimeout(res, 200));

    // Capture offscreen element into canvas
    const canvas = await html2canvas(container, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: landscape ? 1120 : 820,
    });

    // Generate jsPDF
    const orientation = landscape ? "landscape" : "portrait";
    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = landscape ? 297 : 210;
    const pageHeight = landscape ? 210 : 297;
    const margin = 8; // 8mm margin
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;

    const pxPerMm = canvas.width / contentWidth;
    const pageHeightInPx = Math.floor(contentHeight * pxPerMm);

    const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightInPx));

    for (let i = 0; i < totalPages; i++) {
      const sourceY = i * pageHeightInPx;
      const sourceH = Math.min(pageHeightInPx, canvas.height - sourceY);

      if (sourceH <= 0) break;

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceH;
      const pctx = pageCanvas.getContext("2d");
      if (pctx) {
        pctx.fillStyle = "#ffffff";
        pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pctx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sourceH,
          0,
          0,
          canvas.width,
          sourceH
        );
      }

      const pageData = pageCanvas.toDataURL("image/jpeg", quality);
      const destHeightMm = sourceH / pxPerMm;

      if (i > 0) {
        pdf.addPage("a4", orientation);
      }

      pdf.addImage(
        pageData,
        "JPEG",
        margin,
        margin,
        contentWidth,
        destHeightMm,
        undefined,
        "FAST"
      );
    }

    // Deliver PDF as download / save to files on iPhone
    const cleanFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    const blob = pdf.output("blob");
    saveAs(blob, cleanFilename);
  } finally {
    // Clean up temporary DOM container
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
