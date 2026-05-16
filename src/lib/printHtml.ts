/**
 * INDUSTRIAL PRINTING ENGINE LDDEC
 * Exact replica of the previous system: creates an isolated iframe,
 * injects raw HTML with hardcoded resets, and triggers printing.
 */
export function printHtml(html: string) {
  // 1. Clean up existing iframes
  const oldIframe = document.getElementById('lddec-print-iframe');
  if (oldIframe) document.body.removeChild(oldIframe);

  // 2. Create invisible iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'lddec-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.zIndex = '-1';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error("Print context inaccessible.");
    return;
  }

  // 3. Inyect pure HTML with hard resets for pre-printed forms
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <title>LDDEC PRINT</title>
        <style>
          @page {
            size: A4;
            margin: 0 !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 21cm;
            height: 29.7cm;
            background: white;
            color: black;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
          }
          * {
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);
  doc.close();

  // 4. Trigger print after short delay
  setTimeout(() => {
    if (iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  }, 500);
}
