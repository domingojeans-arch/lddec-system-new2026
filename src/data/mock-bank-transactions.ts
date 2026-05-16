import { BankTransaction } from "@/types/bank";

export const mockBankTransactions: BankTransaction[] = [
  {
    id: "bt1",
    accountId: "1", // BCP
    date: "2023-12-31",
    concept: "SALDO INICIAL",
    type: "deposito",
    amount: 5000,
    resultingBalance: 5000,
    createdAt: "2023-12-31T10:00:00Z"
  },
  {
    id: "bt2",
    accountId: "1",
    date: "2024-01-05",
    concept: "PAGO FACTURA 001",
    type: "deposito",
    amount: 1500,
    resultingBalance: 6500,
    createdAt: "2024-01-05T10:00:00Z"
  },
  {
    id: "bt3",
    accountId: "1",
    date: "2024-01-15",
    concept: "PAGO PROVEEDOR QUIMICOS",
    type: "retiro",
    amount: 800,
    resultingBalance: 5700,
    createdAt: "2024-01-15T10:00:00Z"
  },
  {
    id: "bt4",
    accountId: "2", // CAJA CHICA
    date: "2024-01-01",
    concept: "APERTURA CAJA",
    type: "deposito",
    amount: 200,
    resultingBalance: 200,
    createdAt: "2024-01-01T08:00:00Z"
  }
];
