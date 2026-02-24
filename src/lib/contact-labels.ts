// ============================================
// Contact Labels — Client-safe constants
// ============================================

import type { ContactType } from "@/lib/types/database";

export const CONTACT_TYPE_META: Record<
  ContactType,
  { label: string; pluralLabel: string; color: string }
> = {
  CLIENT: {
    label: "Cliente",
    pluralLabel: "Clientes",
    color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950",
  },
  VENDOR: {
    label: "Proveedor",
    pluralLabel: "Proveedores",
    color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950",
  },
  BOTH: {
    label: "Cliente / Proveedor",
    pluralLabel: "Clientes / Proveedores",
    color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950",
  },
};

export const SV_DEPARTMENTS = [
  "Ahuachapán",
  "Cabañas",
  "Chalatenango",
  "Cuscatlán",
  "La Libertad",
  "La Paz",
  "La Unión",
  "Morazán",
  "San Miguel",
  "San Salvador",
  "San Vicente",
  "Santa Ana",
  "Sonsonate",
  "Usulután",
] as const;
