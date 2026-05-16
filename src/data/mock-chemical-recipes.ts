import { ChemicalRecipe } from "@/types/chemical-recipe";

export const mockChemicalRecipes: ChemicalRecipe[] = [
  {
    id: "rec1",
    recipeNumber: "REC-001",
    orderNumber: "ORD-552",
    entryId: "e1",
    entryNumber: "ING-2024-001",
    lotId: "l1",
    lotNumber: "LOT-001",
    clientId: "1",
    clientName: "Textil del Pacífico S.A.",
    process: "Stone Wash + Focalizado",
    responsible: "Ing. Marco Aurelio",
    recipeDate: "2024-03-28",
    notes: "Aplicar después del primer lavado",
    status: "applied",
    totalChemicalCost: 15.40,
    createdAt: "2024-03-28T08:00:00Z",
    updatedAt: "2024-03-28T10:30:00Z",
    items: [
      {
        id: "ri1",
        chemicalId: "chem1",
        chemicalName: "Permanganato de Potasio",
        quantityGrams: 800,
        quantityKg: 0.8,
        unitCost: 12.50,
        totalCost: 10.00,
        stockBeforeKg: 46.30,
        stockAfterKg: 45.50,
        notes: "Mezcla al 5%"
      },
      {
        id: "ri2",
        chemicalId: "chem3",
        chemicalName: "Suavizante Siliconado",
        quantityGrams: 1285,
        quantityKg: 1.285,
        unitCost: 4.20,
        totalCost: 5.40,
        stockBeforeKg: 93.285,
        stockAfterKg: 92.00,
        notes: "Baño final"
      }
    ]
  },
  {
    id: "rec2",
    recipeNumber: "REC-002",
    orderNumber: "ORD-553",
    entryId: "e2",
    entryNumber: "ING-2024-002",
    lotId: "l3",
    lotNumber: "LOT-003",
    clientId: "2",
    clientName: "Denim World Export",
    process: "Bio-Lavado",
    responsible: "Ing. Marco Aurelio",
    recipeDate: "2024-03-29",
    notes: "Proceso estándar",
    status: "draft",
    totalChemicalCost: 0,
    createdAt: "2024-03-29T09:00:00Z",
    updatedAt: "2024-03-29T09:00:00Z",
    items: []
  }
];
