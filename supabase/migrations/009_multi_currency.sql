-- ============================================
-- Migration 009: Multi-Currency & Exchange Rates
-- FiniTax — Currency management & conversion
-- ============================================

-- ---- Supported Currencies ----
-- Organization-scoped list of enabled currencies with
-- a reference rate to the base currency (USD for El Salvador).

CREATE TABLE IF NOT EXISTS currencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Currency identity
  code            TEXT NOT NULL,                      -- ISO 4217: USD, EUR, GTQ, HNL, etc.
  name            TEXT NOT NULL,                      -- "Dólar Estadounidense"
  symbol          TEXT NOT NULL DEFAULT '$',           -- $, €, Q, L, etc.
  decimal_places  INTEGER NOT NULL DEFAULT 2,

  -- Current rate to base (USD)
  exchange_rate   NUMERIC(18,8) NOT NULL DEFAULT 1.0, -- 1 unit of this currency = X USD
  rate_date       DATE,                               -- when the rate was last updated

  -- State
  is_base         BOOLEAN NOT NULL DEFAULT false,     -- TRUE for USD (the org base currency)
  is_active       BOOLEAN NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, code)
);

-- ---- Exchange Rate History ----
-- Tracks historical exchange rates for auditing and reporting.

CREATE TABLE IF NOT EXISTS exchange_rate_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  currency_code   TEXT NOT NULL,
  rate            NUMERIC(18,8) NOT NULL,             -- 1 unit = X USD
  rate_date       DATE NOT NULL,
  source          TEXT DEFAULT 'MANUAL',              -- MANUAL, BCR, API
  notes           TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Indexes ----
CREATE INDEX idx_currencies_org ON currencies(organization_id);
CREATE INDEX idx_currencies_org_code ON currencies(organization_id, code);
CREATE INDEX idx_rate_history_org ON exchange_rate_history(organization_id);
CREATE INDEX idx_rate_history_currency ON exchange_rate_history(organization_id, currency_code, rate_date DESC);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rate_history ENABLE ROW LEVEL SECURITY;

-- currencies policies
CREATE POLICY "currencies_select" ON currencies
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "currencies_insert" ON currencies
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "currencies_update" ON currencies
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "currencies_delete" ON currencies
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- exchange_rate_history policies
CREATE POLICY "rate_history_select" ON exchange_rate_history
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "rate_history_insert" ON exchange_rate_history
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
