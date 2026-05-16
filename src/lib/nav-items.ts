
import { 
  LayoutDashboard, Users, CircleArrowDown, ClipboardCheck, 
  Cog, Zap, Beaker, CircleArrowUp, Truck, Receipt, 
  Wallet, Building, History, FileText, 
  AlertTriangle, PackageSearch, Wrench 
} from "lucide-react";
import { SystemRole } from "@/types/lddec";

export interface NavItem {
  title: string;
  path: string;
  icon: any;
  allowedRoles: SystemRole[];
}

export const navItems: NavItem[] = [
  { 
    title: "Dashboard", 
    path: "/dashboard", 
    icon: LayoutDashboard, 
    allowedRoles: ["admin", "socio", "contador", "financiero", "facturacion"] 
  },
  { 
    title: "Clientes", 
    path: "/clientes", 
    icon: Users, 
    allowedRoles: ["admin", "facturacion", "cobranzas", "contador", "socio"] 
  },
  { 
    title: "Ingresos", 
    path: "/ingresos", 
    icon: CircleArrowDown, 
    allowedRoles: ["admin", "bodega", "socio", "bodeguero_quimicos"] 
  },
  { 
    title: "Revisión Lote", 
    path: "/revision-lote", 
    icon: ClipboardCheck, 
    allowedRoles: ["admin", "bodega", "socio", "bodeguero_quimicos"] 
  },
  { 
    title: "Producción", 
    path: "/produccion", 
    icon: Cog, 
    allowedRoles: ["admin", "produccion", "socio"] 
  },
  { 
    title: "Manualidades", 
    path: "/manualidades", 
    icon: Zap, 
    allowedRoles: ["admin", "operario_manualidades", "socio"] 
  },
  { 
    title: "Bodega Químicos", 
    path: "/quimicos", 
    icon: Beaker, 
    allowedRoles: ["admin", "bodega", "produccion", "socio", "bodeguero_quimicos"] 
  },
  { 
    title: "Salidas", 
    path: "/salidas", 
    icon: CircleArrowUp, 
    allowedRoles: ["admin", "bodega", "chofer", "socio", "bodeguero_quimicos"] 
  },
  { 
    title: "Entregas", 
    path: "/entregas", 
    icon: Truck, 
    allowedRoles: ["admin", "chofer", "bodega", "socio"] 
  },
  { 
    title: "Facturación", 
    path: "/facturacion", 
    icon: Receipt, 
    allowedRoles: ["admin", "facturacion", "socio"] 
  },
  { 
    title: "Cobranzas", 
    path: "/cobranzas", 
    icon: Wallet, 
    allowedRoles: ["admin", "cobranzas", "financiero", "contador", "socio"] 
  },
  { 
    title: "Bancos", 
    path: "/bancos", 
    icon: Building, 
    allowedRoles: ["admin", "banco", "financiero", "contador", "socio"] 
  },
  { 
    title: "Historial", 
    path: "/historial", 
    icon: History, 
    allowedRoles: ["admin", "socio", "contador", "financiero"] 
  },
  { 
    title: "INFORMES", 
    path: "/informes", 
    icon: FileText, 
    allowedRoles: ["admin", "socio", "contador", "financiero", "facturacion", "bodega", "banco", "produccion", "bodeguero_quimicos"] 
  },
  { 
    title: "Faltantes", 
    path: "/faltantes", 
    icon: AlertTriangle, 
    allowedRoles: ["admin", "bodega", "socio"] 
  },
  { 
    title: "Muestras Antiguas", 
    path: "/muestras", 
    icon: PackageSearch, 
    allowedRoles: ["admin", "facturacion", "socio"] 
  },
  { 
    title: "Mantenimiento", 
    path: "/mantenimiento", 
    icon: Wrench, 
    allowedRoles: ["admin"] 
  },
];
