-- ============================================
-- Migration 008: Recurring Transactions
-- FiniTax — Scheduled invoice & expense templates
-- ============================================

-- ---- Frequency Types ----
-- WEEKLY      — every week
-- BIWEEKLY    — every 2 weeks
-- MONTHLY     — every month (same day)
-- QUARTERLY   — every 3 months
-- SEMIANNUAL  — every 6 months
-- ANNUAL      — every 12 months

-- ---- Source Types ----
-- INVOICE     — generates a DTE invoice
-- EXPENSE     — generates an expense record

CREATE TABLE IF NOT EXISTS recurring_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Template classification
  source_type     TEXT NOT NULL DEFAULT 'INVOICE',  -- INVOICE, EXPENSE
  template_name   TEXT NOT NULL,                     -- friendly name e.g. "Renta mensual oficina"

  -- Schedule
  frequency       TEXT NOT NULL DEFAULT 'MONTHLY',   -- WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL
  start_date      DATE NOT NULL,
  end_date        DATE,                              -- NULL = no end / indefinite
  next_occurrence DATE NOT NULL,                     -- next date to generate
  last_generated  DATE,                              -- last time a document was generated

  -- Generation tracking
  total_generated INTEGER NOT NULL DEFAULT 0,        -- how many documents generated so far
  max_occurrences INTEGER,                           -- NULL = unlimited

  -- Invoice template fields (used when source_type = 'INVOICE')
  dte_type        TEXT DEFAULT '01',                 -- DTE type code
  client_name     TEXT,
  client_nit      TEXT,
  client_dui      TEXT,
  client_email    TEXT,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Expense template fields (used when source_type = 'EXPENSE')
  expense_category TEXT,
  vendor_name      TEXT,
  vendor_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Shared financial fields
  description     TEXT,
  amount          NUMERIC(14,2),                     -- total template amount
  currency        TEXT NOT NULL DEFAULT 'USD',

  -- Line items stored as JSONB (for invoices with multiple items)
  line_items      JSONB DEFAULT '[]'::jsonb,

  -- State
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Indexes ----
CREATE INDEX idx_recurring_org ON recurring_templates(organization_id);
CREATE INDEX idx_recurring_org_type ON recurring_templates(organization_id, source_type);
CREATE INDEX idx_recurring_next ON recurring_templates(organization_id, next_occurrence) WHERE is_active = true;
CREATE INDEX idx_recurring_active ON recurring_templates(organization_id, is_active);

-- ---- Generation log: track each document generated from a template ----
CREATE TABLE IF NOT EXISTS recurring_generation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES recurring_templates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- What was generated
  generated_type  TEXT NOT NULL,                     -- INVOICE, EXPENSE
  generated_id    UUID NOT NULL,                     -- FK to dte_invoices.id or expenses.id
  generated_date  DATE NOT NULL,                     -- the occurrence date
  amount          NUMERIC(14,2),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gen_log_template ON recurring_generation_log(template_id);
CREATE INDEX idx_gen_log_org ON recurring_generation_log(organization_id);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE recurring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_generation_log ENABLE ROW LEVEL SECURITY;

-- recurring_templates policies
CREATE POLICY "recurring_templates_select" ON recurring_templates
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "recurring_templates_insert" ON recurring_templates
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "recurring_templates_update" ON recurring_templates
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "recurring_templates_delete" ON recurring_templates
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- recurring_generation_log policies
CREATE POLICY "gen_log_select" ON recurring_generation_log
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "gen_log_insert" ON recurring_generation_log
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
