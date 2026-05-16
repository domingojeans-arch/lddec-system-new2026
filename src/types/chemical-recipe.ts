export type RecipeStatus = 'draft' | 'prepared' | 'applied';

export interface ChemicalRecipeItem {
  id: string;
  chemicalId: string;
  chemicalName: string;
  quantityGrams: number;
  quantityKg: number;
  unitCost: number;
  totalCost: number;
  stockBeforeKg: number;
  stockAfterKg: number;
  notes?: string;
}

export interface ChemicalRecipe {
  id: string;
  recipeNumber: string;
  orderNumber: string;
  entryId: string;
  entryNumber: string;
  lotId: string;
  lotNumber: string;
  clientId: string;
  clientName: string;
  process: string;
  responsible: string;
  recipeDate: string;
  notes?: string;
  status: RecipeStatus;
  totalChemicalCost: number;
  createdAt: string;
  updatedAt: string;
  items: ChemicalRecipeItem[];
}

export type ChemicalRecipeInput = Omit<ChemicalRecipe, 'id' | 'totalChemicalCost' | 'createdAt' | 'updatedAt' | 'items'>;
