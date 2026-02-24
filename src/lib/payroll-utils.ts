import type {
  EmployeeStatus,
  PayrollStatus,
  PayrollRun,
  PayrollDetail,
} from "@/lib/types/database";

// ============================================
// Types
// ============================================

export interface PayrollDetailWithEmployee extends PayrollDetail {
  employee_name: string;
  dui_number: string;
}

export interface PayrollRunWithDetails extends PayrollRun {
  details: PayrollDetailWithEmployee[];
}

// ============================================
// Metadata / Constants
// ============================================

export const EMPLOYEE_STATUS_META: Record<
  EmployeeStatus,
  { label: string; color: string }
> = {
  ACTIVE: {
    label: "Activo",
    color: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  INACTIVE: {
    label: "Inactivo",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  },
  TERMINATED: {
    label: "Cesado",
    color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

export const PAYROLL_STATUS_META: Record<
  PayrollStatus,
  { label: string; color: string }
> = {
  DRAFT: {
    label: "Borrador",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  },
  APPROVED: {
    label: "Aprobada",
    color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  PAID: {
    label: "Pagada",
    color: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
};

// ============================================
// SV Payroll Constants (2024-2026)
// ============================================
// ISSS: Employee 3%, Employer 7.5% — max contributory salary $1,000
// AFP:  Employee 7.25%, Employer 8.75%
// Income tax (ISR) brackets monthly:
//   $0.01 - $472.00      → 0%
//   $472.01 - $895.24    → 10% on excess of $472.00, + $17.67
//   $895.25 - $2,038.10  → 20% on excess of $895.24, + $60.00
//   $2,038.11+           → 30% on excess of $2,038.10, + $288.57

export const ISSS_EMPLOYEE_RATE = 0.03;
export const ISSS_EMPLOYER_RATE = 0.075;
export const ISSS_MAX_SALARY = 1000;
export const AFP_EMPLOYEE_RATE = 0.0725;
export const AFP_EMPLOYER_RATE = 0.0875;

export function calculateISR(taxableIncome: number): number {
  if (taxableIncome <= 472.0) return 0;
  if (taxableIncome <= 895.24) return (taxableIncome - 472.0) * 0.1 + 17.67;
  if (taxableIncome <= 2038.1) return (taxableIncome - 895.24) * 0.2 + 60.0;
  return (taxableIncome - 2038.1) * 0.3 + 288.57;
}

export function calculateDeductions(grossSalary: number) {
  const isssBase = Math.min(grossSalary, ISSS_MAX_SALARY);
  const isss_employee = Math.round(isssBase * ISSS_EMPLOYEE_RATE * 100) / 100;
  const isss_employer = Math.round(isssBase * ISSS_EMPLOYER_RATE * 100) / 100;
  const afp_employee = Math.round(grossSalary * AFP_EMPLOYEE_RATE * 100) / 100;
  const afp_employer = Math.round(grossSalary * AFP_EMPLOYER_RATE * 100) / 100;
  const taxableIncome = grossSalary - isss_employee - afp_employee;
  const income_tax = Math.round(calculateISR(taxableIncome) * 100) / 100;
  const total_deductions = isss_employee + afp_employee + income_tax;
  const net_salary = Math.round((grossSalary - total_deductions) * 100) / 100;

  return {
    isss_employee,
    isss_employer,
    afp_employee,
    afp_employer,
    income_tax,
    net_salary,
    total_deductions: Math.round(total_deductions * 100) / 100,
    employer_cost: Math.round((isss_employer + afp_employer) * 100) / 100,
  };
}
