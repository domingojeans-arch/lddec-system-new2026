import { migrarPagosHistoricos } from "./src/lib/payment-service";

async function main() {
  console.log("Iniciando migración...");
  try {
    const result = await migrarPagosHistoricos();
    console.log("Resultado de la migración:", result);
  } catch (err) {
    console.error("Error durante migración:", err);
  }
  process.exit(0);
}

main();
