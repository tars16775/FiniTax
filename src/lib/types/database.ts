// FiniTax Database Types — auto-generated from schema
// These types mirror the Supabase PostgreSQL schema

export type UserRole = "ADMIN" | "EMPLOYEE" | "ACCOUNTANT";

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export type DTEType = "01" | "03" | "04" | "05" | "06" | "11" | "14";

export type DTEStatus = "DRAFT" | "SIGNED" | "TRANSMITTED" | "APPROVED" | "REJECTED" | "VOIDED";

export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export type TaxType = "GRAVADA" | "EXENTA" | "NO_SUJETA";

export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "TERMINATED";

export type ExpenseStatus = "DRAFT" | "APPROVED" | "REJECTED";

export type PayrollStatus = "DRAFT" | "APPROVED" | "PAID";

export type AdjustmentType = "IN" | "OUT" | "ADJUSTMENT";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";

export type TaxFormType = "F-07" | "F-11" | "F-14";

export type TaxFilingStatus = "DRAFT" | "CALCULATED" | "FILED" | "ACCEPTED" | "REJECTED";

export type NotificationType =
  | "INVOICE_APPROVED"
  | "INVOICE_REJECTED"
  | "EXPENSE_APPROVED"
  | "EXPENSE_REJECTED"
  | "PAYROLL_GENERATED"
  | "PAYROLL_APPROVED"
  | "PAYROLL_PAID"
  | "TAX_CALCULATED"
  | "TAX_FILED"
  | "TAX_DEADLINE"
  | "MEMBER_INVITED"
  | "MEMBER_JOINED"
  | "LOW_STOCK"
  | "SYSTEM";

export type ContactType = "CLIENT" | "VENDOR" | "BOTH";

export type RecurringSourceType = "INVOICE" | "EXPENSE";

export type RecurringFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";

export type BankAccountType = "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "OTHER";

export type BankTxnCategory = "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "FEE" | "INTEREST" | "OTHER";

export type ReconciliationStatus = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type BudgetPeriodType = "MONTHLY" | "QUARTERLY" | "ANNUAL";

export interface Organization {
  id: string;
  name: string;
  nit_number: string;
  nrc_number: string | null;
  industry_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  dui_number: string | null;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface ChartOfAccount {
  id: string;
  organization_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  parent_account_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  organization_id: string;
  entry_date: string;
  description: string | null;
  reference_number: string | null;
  is_posted: boolean;
  created_by: string | null;
  created_at: string;
}

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string | null;
  debit: number;
  credit: number;
  description: string | null;
  created_at: string;
}

export interface DTEInvoice {
  id: string;
  organization_id: string;
  dte_type: DTEType;
  generation_code: string | null;
  control_number: string | null;
  reception_stamp: string | null;
  issue_date: string;
  client_nit: string | null;
  client_dui: string | null;
  client_name: string | null;
  client_email: string | null;
  total_gravada: number;
  total_exenta: number;
  total_no_sujeta: number;
  total_iva: number;
  iva_retained: number;
  total_amount: number;
  status: DTEStatus;
  payment_status: PaymentStatus;
  wompi_payment_id: string | null;
  json_payload: Record<string, unknown> | null;
  pdf_url: string | null;
  contact_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DTEItem {
  id: string;
  invoice_id: string;
  item_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_type: TaxType;
  total: number;
}

export interface InventoryItem {
  id: string;
  organization_id: string;
  sku: string | null;
  name: string;
  description: string | null;
  cost_price: number;
  sales_price: number;
  tax_category: TaxType;
  current_stock: number;
  reorder_point: number;
  unit_of_measure: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryAdjustment {
  id: string;
  item_id: string;
  adjustment_type: AdjustmentType;
  quantity: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  dui_number: string;
  nit_number: string | null;
  afp_number: string | null;
  isss_number: string | null;
  base_salary: number;
  hire_date: string;
  termination_date: string | null;
  department: string | null;
  position: string | null;
  bank_account: string | null;
  status: EmployeeStatus;
  created_at: string;
}

export interface PayrollRun {
  id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  status: PayrollStatus;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  created_at: string;
}

export interface PayrollDetail {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  gross_salary: number;
  isss_employee: number;
  isss_employer: number;
  afp_employee: number;
  afp_employer: number;
  income_tax: number;
  other_deductions: number;
  net_salary: number;
  created_at: string;
}

export interface Expense {
  id: string;
  organization_id: string;
  account_id: string | null;
  description: string;
  amount: number;
  expense_date: string;
  vendor_name: string | null;
  vendor_nit: string | null;
  receipt_url: string | null;
  dte_generation_code: string | null;
  dte_reception_stamp: string | null;
  ocr_extracted: boolean;
  status: ExpenseStatus;
  contact_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ConsentLog {
  id: string;
  user_id: string;
  consent_type: string;
  granted: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  organization_id: string;
  invited_email: string;
  role: UserRole;
  invited_by: string;
  status: InvitationStatus;
  token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface TaxFiling {
  id: string;
  organization_id: string;
  form_type: TaxFormType;
  period_year: number;
  period_month: number | null;
  status: TaxFilingStatus;
  // IVA (F-07)
  iva_debito: number;
  iva_credito: number;
  iva_retenido: number;
  iva_percibido: number;
  iva_a_pagar: number;
  ventas_gravadas: number;
  ventas_exentas: number;
  compras_gravadas: number;
  compras_exentas: number;
  // Pago a Cuenta / ISR (F-11)
  ingresos_brutos: number;
  pago_a_cuenta: number;
  isr_retenido_empleados: number;
  isr_retenido_terceros: number;
  // Renta Anual (F-14)
  ingresos_anuales: number;
  costos_deducibles: number;
  renta_imponible: number;
  isr_anual: number;
  pagos_a_cuenta_acumulados: number;
  saldo_a_pagar: number;
  // General
  total_a_pagar: number;
  filed_at: string | null;
  filing_reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Contact {
  id: string;
  organization_id: string;
  contact_type: ContactType;
  name: string;
  trade_name: string | null;
  nit: string | null;
  dui: string | null;
  nrc: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  department: string | null;
  country: string;
  payment_terms: number;
  credit_limit: number;
  tax_category: string;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  organization_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RecurringTemplate {
  id: string;
  organization_id: string;
  source_type: RecurringSourceType;
  template_name: string;
  frequency: RecurringFrequency;
  start_date: string;
  end_date: string | null;
  next_occurrence: string;
  last_generated: string | null;
  total_generated: number;
  max_occurrences: number | null;
  dte_type: string | null;
  client_name: string | null;
  client_nit: string | null;
  client_dui: string | null;
  client_email: string | null;
  contact_id: string | null;
  expense_category: string | null;
  vendor_name: string | null;
  vendor_contact_id: string | null;
  description: string | null;
  amount: number | null;
  currency: string;
  line_items: unknown[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringGenerationLog {
  id: string;
  template_id: string;
  organization_id: string;
  generated_type: RecurringSourceType;
  generated_id: string;
  generated_date: string;
  amount: number | null;
  created_at: string;
}

export interface Currency {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  exchange_rate: number;
  rate_date: string | null;
  is_base: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExchangeRateHistory {
  id: string;
  organization_id: string;
  currency_code: string;
  rate: number;
  rate_date: string;
  source: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BankAccount {
  id: string;
  organization_id: string;
  account_name: string;
  bank_name: string;
  account_number: string | null;
  account_type: BankAccountType;
  currency_code: string;
  opening_balance: number;
  current_balance: number;
  as_of_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankTransaction {
  id: string;
  organization_id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  reference: string | null;
  amount: number;
  running_balance: number | null;
  category: BankTxnCategory;
  payee: string | null;
  is_reconciled: boolean;
  reconciled_at: string | null;
  reconciled_by: string | null;
  matched_invoice_id: string | null;
  matched_expense_id: string | null;
  matched_journal_id: string | null;
  import_batch: string | null;
  import_source: string | null;
  external_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationSession {
  id: string;
  organization_id: string;
  bank_account_id: string;
  session_date: string;
  statement_start: string;
  statement_end: string;
  statement_balance: number;
  book_balance: number | null;
  difference: number | null;
  status: ReconciliationStatus;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  organization_id: string;
  account_id: string | null;
  name: string;
  period_type: BudgetPeriodType;
  period_year: number;
  period_month: number | null;
  budgeted_amount: number;
  actual_amount: number;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetAlert {
  id: string;
  organization_id: string;
  budget_id: string;
  threshold_pct: number;
  is_triggered: boolean;
  triggered_at: string | null;
  notes: string | null;
  created_at: string;
}

// Supabase Database type helper
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Organization, "id">>;
      };
      user_profiles: {
        Row: UserProfile;
        Insert: Omit<UserProfile, "created_at">;
        Update: Partial<Omit<UserProfile, "id">>;
      };
      organization_members: {
        Row: OrganizationMember;
        Insert: Omit<OrganizationMember, "id" | "created_at">;
        Update: Partial<Omit<OrganizationMember, "id">>;
      };
      chart_of_accounts: {
        Row: ChartOfAccount;
        Insert: Omit<ChartOfAccount, "id" | "created_at">;
        Update: Partial<Omit<ChartOfAccount, "id">>;
      };
      journal_entries: {
        Row: JournalEntry;
        Insert: Omit<JournalEntry, "id" | "created_at">;
        Update: Partial<Omit<JournalEntry, "id">>;
      };
      journal_entry_lines: {
        Row: JournalEntryLine;
        Insert: Omit<JournalEntryLine, "id" | "created_at">;
        Update: Partial<Omit<JournalEntryLine, "id">>;
      };
      dte_invoices: {
        Row: DTEInvoice;
        Insert: Omit<DTEInvoice, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<DTEInvoice, "id">>;
      };
      dte_items: {
        Row: DTEItem;
        Insert: Omit<DTEItem, "id">;
        Update: Partial<Omit<DTEItem, "id">>;
      };
      inventory_items: {
        Row: InventoryItem;
        Insert: Omit<InventoryItem, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<InventoryItem, "id">>;
      };
      inventory_adjustments: {
        Row: InventoryAdjustment;
        Insert: Omit<InventoryAdjustment, "id" | "created_at">;
        Update: Partial<Omit<InventoryAdjustment, "id">>;
      };
      employees: {
        Row: Employee;
        Insert: Omit<Employee, "id" | "created_at">;
        Update: Partial<Omit<Employee, "id">>;
      };
      payroll_runs: {
        Row: PayrollRun;
        Insert: Omit<PayrollRun, "id" | "created_at">;
        Update: Partial<Omit<PayrollRun, "id">>;
      };
      payroll_details: {
        Row: PayrollDetail;
        Insert: Omit<PayrollDetail, "id" | "created_at">;
        Update: Partial<Omit<PayrollDetail, "id">>;
      };
      expenses: {
        Row: Expense;
        Insert: Omit<Expense, "id" | "created_at">;
        Update: Partial<Omit<Expense, "id">>;
      };
      consent_logs: {
        Row: ConsentLog;
        Insert: Omit<ConsentLog, "id" | "created_at">;
        Update: Partial<Omit<ConsentLog, "id">>;
      };
      tax_filings: {
        Row: TaxFiling;
        Insert: Omit<TaxFiling, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<TaxFiling, "id">>;
      };
      invitations: {
        Row: Invitation;
        Insert: Omit<Invitation, "id" | "created_at" | "updated_at" | "token">;
        Update: Partial<Omit<Invitation, "id">>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, "id" | "created_at">;
        Update: Partial<Omit<AuditLog, "id">>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at">;
        Update: Partial<Omit<Notification, "id">>;
      };
      contacts: {
        Row: Contact;
        Insert: Omit<Contact, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Contact, "id">>;
      };
      recurring_templates: {
        Row: RecurringTemplate;
        Insert: Omit<RecurringTemplate, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<RecurringTemplate, "id">>;
      };
      recurring_generation_log: {
        Row: RecurringGenerationLog;
        Insert: Omit<RecurringGenerationLog, "id" | "created_at">;
        Update: Partial<Omit<RecurringGenerationLog, "id">>;
      };
      currencies: {
        Row: Currency;
        Insert: Omit<Currency, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Currency, "id">>;
      };
      exchange_rate_history: {
        Row: ExchangeRateHistory;
        Insert: Omit<ExchangeRateHistory, "id" | "created_at">;
        Update: Partial<Omit<ExchangeRateHistory, "id">>;
      };
      bank_accounts: {
        Row: BankAccount;
        Insert: Omit<BankAccount, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<BankAccount, "id">>;
      };
      bank_transactions: {
        Row: BankTransaction;
        Insert: Omit<BankTransaction, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<BankTransaction, "id">>;
      };
      reconciliation_sessions: {
        Row: ReconciliationSession;
        Insert: Omit<ReconciliationSession, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ReconciliationSession, "id">>;
      };
      budgets: {
        Row: Budget;
        Insert: Omit<Budget, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Budget, "id">>;
      };
      budget_alerts: {
        Row: BudgetAlert;
        Insert: Omit<BudgetAlert, "id" | "created_at">;
        Update: Partial<Omit<BudgetAlert, "id">>;
      };
    };
  };
}
