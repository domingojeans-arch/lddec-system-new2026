import { ManualWorkType } from "@/types/manual-work";

export const manualWorkTypes: ManualWorkType[] = [
  { id: 'whiskers', label: 'Bigotes (Whiskers)', icon: 'Zap' },
  { id: 'sanding', label: 'Lijado (Sanding)', icon: 'Scissors' },
  { id: 'ripping', label: 'Rotos (Ripping)', icon: 'Trash2' },
  { id: 'repair', label: 'Resanado (Repair)', icon: 'Heart' },
  { id: 'patching', label: 'Parches (Patching)', icon: 'Layers' },
  { id: 'ironing', label: 'Planchado (Ironing)', icon: 'Wind' },
  { id: 'embroidery', label: 'Bordado (Embroidery)', icon: 'Palette' },
  { id: 'labeling', label: 'Etiquetado (Labeling)', icon: 'Tag' },
  { id: 'special_finish', label: 'Acabado Especial', icon: 'Sparkles' },
];
