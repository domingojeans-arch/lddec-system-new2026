import { Collection } from "@/types/collection";

export const mockCollections: Collection[] = [
  {
    id: "col1",
    collectionNumber: "REC-2024-001",
    collectionDate: "2024-03-28",
    clientId: "1",
    clientName: "Textil del Pacífico S.A.",
    responsible: "Elena Méndez",
    driver: "Propio",
    paymentMethod: "Transferencia BCP",
    notes: "Cobro de factura inicial con descuento por pronto pago",
    status: "completed",
    totalReceived: 1500.00,
    totalDiscount: 0,
    totalPromptPaymentDiscount: 57.60,
    totalRetention: 0,
    totalDamagedDiscount: 0,
    totalApplied: 1557.60,
    totalRemaining: 0,
    createdAt: "2024-03-28T10:00:00Z",
    updatedAt: "2024-03-28T10:00:00Z",
    items: [
      {
        id: "ci1",
        invoiceId: "inv1",
        invoiceNumber: "FACT-2024-001",
        invoiceDate: "2024-03-26",
        dueDate: "2024-04-26",
        invoiceTotal: 1557.60,
        previousBalance: 1557.60,
        amountReceived: 1500.00,
        discount: 0,
        promptPaymentDiscount: 57.60,
        retention: 0,
        damagedDiscount: 0,
        totalApplied: 1557.60,
        remainingBalance: 0,
        status: "settled"
      }
    ]
  },
  {
    id: "col2",
    collectionNumber: "REC-2024-002",
    collectionDate: "2024-03-29",
    clientId: "2",
    clientName: "Denim World Export",
    responsible: "Elena Méndez",
    driver: "Mensajería",
    paymentMethod: "Efectivo",
    notes: "Pago parcial de factura",
    status: "partial",
    totalReceived: 100.00,
    totalDiscount: 0,
    totalPromptPaymentDiscount: 0,
    totalRetention: 0,
    totalDamagedDiscount: 0,
    totalApplied: 100.00,
    totalRemaining: 254.00,
    createdAt: "2024-03-29T11:00:00Z",
    updatedAt: "2024-03-29T11:00:00Z",
    items: [
      {
        id: "ci2",
        invoiceId: "inv2",
        invoiceNumber: "FACT-2024-002",
        invoiceDate: "2024-03-27",
        dueDate: "2024-04-10",
        invoiceTotal: 354.00,
        previousBalance: 354.00,
        amountReceived: 100.00,
        discount: 0,
        promptPaymentDiscount: 0,
        retention: 0,
        damagedDiscount: 0,
        totalApplied: 100.00,
        remainingBalance: 254.00,
        status: "partial"
      }
    ]
  }
];
