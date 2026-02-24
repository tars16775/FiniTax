// ============================================
// FiniTax RBAC — Centralized Permission Definitions
// ============================================
// Roles: ADMIN, EMPLOYEE, ACCOUNTANT
// Each permission maps to a set of allowed roles.

import type { UserRole } from "@/lib/types/database";

// ---- Module Permissions ----
// Each key is a module or feature; the value is the list of roles that may access it.

export const PERMISSIONS = {
  // Dashboard — everyone can see the main dashboard
  "dashboard.view": ["ADMIN", "EMPLOYEE", "ACCOUNTANT"],

  // Organization management
  "organization.view": ["ADMIN", "EMPLOYEE", "ACCOUNTANT"],
  "organization.edit": ["ADMIN"],
  "organization.delete": ["ADMIN"],

  // Member management
  "members.view": ["ADMIN"],
  "members.invite": ["ADMIN"],
  "members.remove": ["ADMIN"],
  "members.change_role": ["ADMIN"],

  // Chart of Accounts
  "accounts.view": ["ADMIN", "ACCOUNTANT"],
  "accounts.create": ["ADMIN", "ACCOUNTANT"],
  "accounts.edit": ["ADMIN", "ACCOUNTANT"],
  "accounts.delete": ["ADMIN"],

  // Journal Entries / Ledger
  "ledger.view": ["ADMIN", "ACCOUNTANT"],
  "ledger.create": ["ADMIN", "ACCOUNTANT"],
  "ledger.edit": ["ADMIN", "ACCOUNTANT"],
  "ledger.post": ["ADMIN", "ACCOUNTANT"],
  "ledger.delete": ["ADMIN"],

  // Inventory
  "inventory.view": ["ADMIN", "EMPLOYEE", "ACCOUNTANT"],
  "inventory.create": ["ADMIN", "EMPLOYEE"],
  "inventory.edit": ["ADMIN", "EMPLOYEE"],
  "inventory.adjust": ["ADMIN", "EMPLOYEE"],
  "inventory.delete": ["ADMIN"],

  // DTE Invoicing
  "invoices.view": ["ADMIN", "EMPLOYEE", "ACCOUNTANT"],
  "invoices.create": ["ADMIN", "EMPLOYEE"],
  "invoices.edit": ["ADMIN", "EMPLOYEE"],
  "invoices.void": ["ADMIN"],
  "invoices.transmit": ["ADMIN", "ACCOUNTANT"],

  // Expenses
  "expenses.view": ["ADMIN", "EMPLOYEE", "ACCOUNTANT"],
  "expenses.create": ["ADMIN", "EMPLOYEE", "ACCOUNTANT"],
  "expenses.approve": ["ADMIN", "ACCOUNTANT"],
  "expenses.delete": ["ADMIN"],

  // Tax Filing
  "taxes.view": ["ADMIN", "ACCOUNTANT"],
  "taxes.file": ["ADMIN", "ACCOUNTANT"],
  "taxes.configure": ["ADMIN"],

  // Payroll
  "payroll.view": ["ADMIN"],
  "payroll.run": ["ADMIN"],
  "payroll.approve": ["ADMIN"],
  "payroll.manage_employees": ["ADMIN"],

  // Reports & Analytics
  "reports.view": ["ADMIN", "ACCOUNTANT"],
  "reports.export": ["ADMIN", "ACCOUNTANT"],

  // Audit Trail
  "audit.view": ["ADMIN"],

  // AI Assistant — everyone
  "assistant.view": ["ADMIN", "EMPLOYEE", "ACCOUNTANT"],
  "assistant.use": ["ADMIN", "EMPLOYEE", "ACCOUNTANT"],

  // Contacts — clients & vendors
  "contacts.view": ["ADMIN", "EMPLOYEE", "ACCOUNTANT"],
  "contacts.create": ["ADMIN", "EMPLOYEE"],
  "contacts.edit": ["ADMIN", "EMPLOYEE"],
  "contacts.delete": ["ADMIN"],

  // Recurring Transactions
  "recurring.view": ["ADMIN", "EMPLOYEE", "ACCOUNTANT"],
  "recurring.create": ["ADMIN", "EMPLOYEE"],
  "recurring.edit": ["ADMIN", "EMPLOYEE"],
  "recurring.delete": ["ADMIN"],

  // Multi-Currency
  "currencies.view": ["ADMIN", "ACCOUNTANT"],
  "currencies.manage": ["ADMIN"],

  // Banking & Reconciliation
  "banking.view": ["ADMIN", "ACCOUNTANT"],
  "banking.manage": ["ADMIN"],
  "banking.reconcile": ["ADMIN", "ACCOUNTANT"],

  // Budgets
  "budgets.view": ["ADMIN", "ACCOUNTANT"],
  "budgets.create": ["ADMIN", "ACCOUNTANT"],
  "budgets.edit": ["ADMIN", "ACCOUNTANT"],
  "budgets.delete": ["ADMIN"],

  // Notifications — everyone can see their own
  "notifications.view": ["ADMIN", "EMPLOYEE", "ACCOUNTANT"],

  // Settings
  "settings.profile": ["ADMIN", "EMPLOYEE", "ACCOUNTANT"],
  "settings.organization": ["ADMIN"],
  "settings.members": ["ADMIN"],
  "settings.security": ["ADMIN", "EMPLOYEE", "ACCOUNTANT"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ---- Helper: check a single permission ----
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission];
  return (allowedRoles as readonly string[]).includes(role);
}

// ---- Helper: check any of several permissions ----
export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

// ---- Helper: check ALL permissions ----
export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

// ---- Route → Permission mapping ----
// Maps each dashboard sub-route to the permission required to view it.
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  "/dashboard": "dashboard.view",
  "/dashboard/accounts": "accounts.view",
  "/dashboard/ledger": "ledger.view",
  "/dashboard/inventory": "inventory.view",
  "/dashboard/invoices": "invoices.view",
  "/dashboard/expenses": "expenses.view",
  "/dashboard/taxes": "taxes.view",
  "/dashboard/payroll": "payroll.view",
  "/dashboard/reports": "reports.view",
  "/dashboard/audit": "audit.view",
  "/dashboard/contacts": "contacts.view",
  "/dashboard/recurring": "recurring.view",
  "/dashboard/currencies": "currencies.view",
  "/dashboard/banking": "banking.view",
  "/dashboard/budgets": "budgets.view",
  "/dashboard/notifications": "notifications.view",
  "/dashboard/assistant": "assistant.view",
  "/dashboard/settings": "settings.profile",
};

// ---- Role display metadata ----
export const ROLE_META: Record<
  UserRole,
  { label: string; description: string; color: string }
> = {
  ADMIN: {
    label: "Administrador",
    description: "Acceso completo a todas las funciones del sistema",
    color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950",
  },
  EMPLOYEE: {
    label: "Empleado",
    description: "Facturación, inventario y gastos",
    color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950",
  },
  ACCOUNTANT: {
    label: "Contador",
    description: "Contabilidad, impuestos y reportes financieros",
    color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950",
  },
};
