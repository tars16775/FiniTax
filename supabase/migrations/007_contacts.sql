-- ============================================
-- Migration 007: Contacts (Clients & Vendors)
-- FiniTax — Reusable contacts database
-- ============================================

-- ---- Contact Types ----
-- CLIENT    — A customer you invoice
-- VENDOR    — A supplier you buy from
-- BOTH      — Acts as both client and vendor

CREATE TABLE IF NOT EXISTS contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Classification
  contact_type    TEXT NOT NULL DEFAULT 'CLIENT',   -- CLIENT, VENDOR, BOTH

  -- Identity
  name            TEXT NOT NULL,
  trade_name      TEXT,                             -- nombre comercial
  nit             TEXT,                             -- NIT for fiscal operations
  dui             TEXT,                             -- DUI (persona natural)
  nrc             TEXT,                             -- NRC (registro de contribuyente)

  -- Contact info
  email           TEXT,
  phone           TEXT,
  website         TEXT,

  -- Address (El Salvador)
  address_line1   TEXT,
  address_line2   TEXT,
  city            TEXT,
  department      TEXT,                             -- departamento (state equivalent)
  country         TEXT NOT NULL DEFAULT 'SV',

  -- Financial
  payment_terms   INTEGER DEFAULT 30,               -- days
  credit_limit    NUMERIC(14,2) DEFAULT 0,
  tax_category    TEXT DEFAULT 'GRAVADA',            -- GRAVADA, EXENTA, NO_SUJETA

  -- Notes
  notes           TEXT,

  -- State
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Indexes ----
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(organization_id, contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(organization_id, name);
CREATE INDEX IF NOT EXISTS idx_contacts_nit ON contacts(organization_id, nit);

-- ---- FK: link invoices to contacts (optional) ----
ALTER TABLE dte_invoices ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON dte_invoices(contact_id);

-- ---- FK: link expenses to contacts (optional) ----
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_contact ON expenses(contact_id);

-- ---- RLS ----
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Members of the org can view contacts
CREATE POLICY "contacts_select" ON contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = contacts.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- Members can insert contacts
CREATE POLICY "contacts_insert" ON contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = contacts.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- Members can update contacts in their org
CREATE POLICY "contacts_update" ON contacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = contacts.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- Only admins can delete (handled at app level via RBAC)
CREATE POLICY "contacts_delete" ON contacts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = contacts.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );
