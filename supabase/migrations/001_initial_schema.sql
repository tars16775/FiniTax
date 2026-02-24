-- FiniTax Database Schema
-- Migration: 001_initial_schema
-- Target: Supabase (PostgreSQL)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: Organizations (Multi-tenant boundary)
-- ============================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    nit_number VARCHAR(14) UNIQUE NOT NULL,
    nrc_number VARCHAR(10),
    industry_code VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: User Profiles (Extends Supabase Auth)
-- ============================================
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    dui_number VARCHAR(9),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: Organization Memberships (RBAC)
-- ============================================
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'EMPLOYEE', 'ACCOUNTANT')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- ============================================
-- Table: Chart of Accounts
-- ============================================
CREATE TABLE chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    account_code VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    parent_account_id UUID REFERENCES chart_of_accounts(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: Journal Entries
-- ============================================
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    description TEXT,
    reference_number VARCHAR(100),
    is_posted BOOLEAN DEFAULT false,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: Journal Entry Lines
-- ============================================
CREATE TABLE journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID REFERENCES chart_of_accounts(id),
    debit DECIMAL(15,2) DEFAULT 0.00,
    credit DECIMAL(15,2) DEFAULT 0.00,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: DTE Invoices (Electronic Invoicing)
-- ============================================
CREATE TABLE dte_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    dte_type VARCHAR(2) NOT NULL,
    generation_code TEXT UNIQUE,
    control_number TEXT,
    reception_stamp TEXT,
    issue_date DATE NOT NULL,
    client_nit VARCHAR(14),
    client_dui VARCHAR(9),
    client_name VARCHAR(255),
    client_email VARCHAR(255),
    total_gravada DECIMAL(15,2) DEFAULT 0.00,
    total_exenta DECIMAL(15,2) DEFAULT 0.00,
    total_no_sujeta DECIMAL(15,2) DEFAULT 0.00,
    total_iva DECIMAL(15,2) DEFAULT 0.00,
    iva_retained DECIMAL(15,2) DEFAULT 0.00,
    total_amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SIGNED', 'TRANSMITTED', 'APPROVED', 'REJECTED', 'VOIDED')),
    payment_status VARCHAR(50) DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PARTIAL', 'PAID')),
    wompi_payment_id VARCHAR(255),
    json_payload JSONB,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: DTE Line Items
-- ============================================
CREATE TABLE dte_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES dte_invoices(id) ON DELETE CASCADE,
    item_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    discount DECIMAL(15,2) DEFAULT 0.00,
    tax_type VARCHAR(20) CHECK (tax_type IN ('GRAVADA', 'EXENTA', 'NO_SUJETA')),
    total DECIMAL(15,2) NOT NULL
);

-- ============================================
-- Table: Inventory Items
-- ============================================
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    sku VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cost_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    sales_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    tax_category VARCHAR(20) DEFAULT 'GRAVADA' CHECK (tax_category IN ('GRAVADA', 'EXENTA', 'NO_SUJETA')),
    current_stock DECIMAL(10,2) DEFAULT 0,
    reorder_point DECIMAL(10,2) DEFAULT 0,
    unit_of_measure VARCHAR(50) DEFAULT 'UNIDAD',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: Inventory Adjustments
-- ============================================
CREATE TABLE inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    adjustment_type VARCHAR(20) CHECK (adjustment_type IN ('IN', 'OUT', 'ADJUSTMENT')),
    quantity DECIMAL(10,2) NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: Employees (For Payroll)
-- ============================================
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    dui_number VARCHAR(9) UNIQUE NOT NULL,
    nit_number VARCHAR(14),
    afp_number VARCHAR(50),
    isss_number VARCHAR(50),
    base_salary DECIMAL(10,2) NOT NULL,
    hire_date DATE NOT NULL,
    termination_date DATE,
    department VARCHAR(100),
    position VARCHAR(100),
    bank_account VARCHAR(50),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'TERMINATED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: Payroll Runs
-- ============================================
CREATE TABLE payroll_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'PAID')),
    total_gross DECIMAL(15,2) DEFAULT 0.00,
    total_deductions DECIMAL(15,2) DEFAULT 0.00,
    total_net DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: Payroll Details
-- ============================================
CREATE TABLE payroll_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id),
    gross_salary DECIMAL(10,2) NOT NULL,
    isss_employee DECIMAL(10,2) DEFAULT 0.00,
    isss_employer DECIMAL(10,2) DEFAULT 0.00,
    afp_employee DECIMAL(10,2) DEFAULT 0.00,
    afp_employer DECIMAL(10,2) DEFAULT 0.00,
    income_tax DECIMAL(10,2) DEFAULT 0.00,
    other_deductions DECIMAL(10,2) DEFAULT 0.00,
    net_salary DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: Expenses
-- ============================================
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    account_id UUID REFERENCES chart_of_accounts(id),
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    expense_date DATE NOT NULL,
    vendor_name VARCHAR(255),
    vendor_nit VARCHAR(14),
    receipt_url TEXT,
    dte_generation_code TEXT,
    dte_reception_stamp TEXT,
    ocr_extracted BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'REJECTED')),
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: Consent Logs (LPD Compliance)
-- ============================================
CREATE TABLE consent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    consent_type VARCHAR(100) NOT NULL,
    granted BOOLEAN NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_dte_invoices_org ON dte_invoices(organization_id);
CREATE INDEX idx_dte_invoices_status ON dte_invoices(status);
CREATE INDEX idx_dte_invoices_date ON dte_invoices(issue_date);
CREATE INDEX idx_dte_items_invoice ON dte_items(invoice_id);
CREATE INDEX idx_employees_org ON employees(organization_id);
CREATE INDEX idx_chart_of_accounts_org ON chart_of_accounts(organization_id);
CREATE INDEX idx_expenses_org ON expenses(organization_id);
CREATE INDEX idx_journal_entries_org ON journal_entries(organization_id);
CREATE INDEX idx_payroll_runs_org ON payroll_runs(organization_id);
CREATE INDEX idx_inventory_items_org ON inventory_items(organization_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE dte_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE dte_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's organization IDs
CREATE OR REPLACE FUNCTION get_user_orgs()
RETURNS SETOF UUID AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- User Profiles: users can view/edit their own profile
CREATE POLICY "Users manage own profile" ON user_profiles
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Organizations: users can view orgs they belong to
CREATE POLICY "View own organizations" ON organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT get_user_orgs()));

-- Organizations: only admins can update
CREATE POLICY "Admins update organizations" ON organizations
  FOR UPDATE TO authenticated
  USING (id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = 'ADMIN'
  ));

-- Organizations: any authenticated user can create
CREATE POLICY "Create organizations" ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Organization Members: view members of your orgs
CREATE POLICY "View org members" ON organization_members
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_orgs()));

-- Organization Members: admins can manage members
CREATE POLICY "Admins manage members" ON organization_members
  FOR ALL TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = 'ADMIN'
  ));

-- Generic org-scoped policy for main data tables
CREATE POLICY "Manage chart of accounts" ON chart_of_accounts
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT get_user_orgs()))
  WITH CHECK (organization_id IN (SELECT get_user_orgs()));

CREATE POLICY "Manage journal entries" ON journal_entries
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT get_user_orgs()))
  WITH CHECK (organization_id IN (SELECT get_user_orgs()));

CREATE POLICY "Manage journal entry lines" ON journal_entry_lines
  FOR ALL TO authenticated
  USING (journal_entry_id IN (
    SELECT id FROM journal_entries WHERE organization_id IN (SELECT get_user_orgs())
  ));

CREATE POLICY "Manage DTEs" ON dte_invoices
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT get_user_orgs()))
  WITH CHECK (organization_id IN (SELECT get_user_orgs()));

CREATE POLICY "Manage DTE items" ON dte_items
  FOR ALL TO authenticated
  USING (invoice_id IN (
    SELECT id FROM dte_invoices WHERE organization_id IN (SELECT get_user_orgs())
  ));

CREATE POLICY "Manage inventory" ON inventory_items
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT get_user_orgs()))
  WITH CHECK (organization_id IN (SELECT get_user_orgs()));

CREATE POLICY "Manage inventory adjustments" ON inventory_adjustments
  FOR ALL TO authenticated
  USING (item_id IN (
    SELECT id FROM inventory_items WHERE organization_id IN (SELECT get_user_orgs())
  ));

CREATE POLICY "Manage employees" ON employees
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT get_user_orgs()))
  WITH CHECK (organization_id IN (SELECT get_user_orgs()));

CREATE POLICY "Manage payroll runs" ON payroll_runs
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT get_user_orgs()))
  WITH CHECK (organization_id IN (SELECT get_user_orgs()));

CREATE POLICY "Manage payroll details" ON payroll_details
  FOR ALL TO authenticated
  USING (payroll_run_id IN (
    SELECT id FROM payroll_runs WHERE organization_id IN (SELECT get_user_orgs())
  ));

CREATE POLICY "Manage expenses" ON expenses
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT get_user_orgs()))
  WITH CHECK (organization_id IN (SELECT get_user_orgs()));

CREATE POLICY "Users manage own consent" ON consent_logs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- Trigger: Auto-create user profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Trigger: Auto-update updated_at timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_dte_invoices_updated_at
  BEFORE UPDATE ON dte_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
