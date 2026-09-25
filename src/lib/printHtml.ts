/**
 * INDUSTRIAL PRINTING ENGINE LDDEC
 * Creates an isolated iframe, injects print HTML, and triggers printing.
 */
export function printHtml(html: string) {
  // 1. Clean up existing iframes
  const oldIframe = document.getElementById('lddec-print-iframe');
  if (oldIframe && oldIframe.parentNode) {
    oldIframe.parentNode.removeChild(oldIframe);
  }

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

  const isFullHtml = html.trim().toLowerCase().startsWith("<!doctype") || html.trim().toLowerCase().startsWith("<html");

  // 3. Inject HTML
  doc.open();
  if (isFullHtml) {
    doc.write(html);
  } else {
    doc.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <title>LDDEC PRINT</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 10mm !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: white;
              color: black;
              font-family: Arial, Helvetica, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
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
  }
  doc.close();

  // 4. Trigger print after short delay
  setTimeout(() => {
    if (iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  }, 350);
}
