import { Entry } from "@/types/entry";

export const mockEntries: Entry[] = [
  {
    id: "e1",
    entryNumber: "ING-2024-001",
    clientId: "1",
    clientName: "Textil del Pacífico S.A.",
    entryDate: "2024-03-20",
    responsible: "Ricardo Alva",
    status: "completed",
    totalGarments: 450,
    notes: "Lote urgente para exportación",
    createdAt: "2024-03-20T08:30:00Z",
    updatedAt: "2024-03-20T10:00:00Z",
    lots: [
      {
        id: "l1",
        lotNumber: "LOT-001",
        responsible: "Juan Mecánico",
        process: "Stone Wash",
        washType: "Bio-Lavado",
        isSample: false,
        status: "ready",
        garments: [
          { id: "g1", garmentType: "Jeans Slim Fit", quantity: 200 }
        ]
      },
      {
        id: "l2",
        lotNumber: "LOT-002",
        responsible: "Pedro Operario",
        process: "Bleach",
        washType: "Químico",
        isSample: true,
        status: "ready",
        garments: [
          { id: "g2", garmentType: "Camisa Denim", quantity: 250 }
        ]
      }
    ]
  },
  {
    id: "e2",
    entryNumber: "ING-2024-002",
    clientId: "2",
    clientName: "Denim World Export",
    entryDate: "2024-03-21",
    responsible: "Sofía Huamán",
    status: "active",
    totalGarments: 120,
    notes: "Pruebas de color iniciales",
    createdAt: "2024-03-21T09:15:00Z",
    updatedAt: "2024-03-21T09:15:00Z",
    lots: [
      {
        id: "l3",
        lotNumber: "LOT-003",
        responsible: "Maria Tintorera",
        process: "Enzyme Wash",
        washType: "Ecológico",
        isSample: false,
        status: "in_process",
        garments: [
          { id: "g3", garmentType: "Chaqueta Denim", quantity: 120 }
        ]
      }
    ]
  }
];
