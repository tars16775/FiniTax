-- =============================================
-- Migration 011: Budget Management
-- =============================================
-- Budgets by account for a given year/month
-- with actual amounts computed from journal entries.

-- 1. Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id      UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,

  name            TEXT NOT NULL,                -- budget line label
  period_type     TEXT NOT NULL DEFAULT 'MONTHLY', -- MONTHLY | QUARTERLY | ANNUAL
  period_year     INT NOT NULL,
  period_month    INT,                          -- NULL for ANNUAL; 1-12 for MONTHLY; 1,4,7,10 for QUARTERLY
  budgeted_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  actual_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,

  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate budget per account+period
  UNIQUE(organization_id, account_id, period_year, period_month)
);

-- 2. Budget alerts / thresholds table
CREATE TABLE IF NOT EXISTS budget_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  budget_id       UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,

  threshold_pct   INT NOT NULL DEFAULT 80,       -- e.g. 80 means alert at 80%
  is_triggered    BOOLEAN NOT NULL DEFAULT false,
  triggered_at    TIMESTAMPTZ,
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX idx_budgets_org           ON budgets(organization_id);
CREATE INDEX idx_budgets_account       ON budgets(account_id);
CREATE INDEX idx_budgets_period        ON budgets(organization_id, period_year, period_month);
CREATE INDEX idx_budget_alerts_budget  ON budget_alerts(budget_id);
CREATE INDEX idx_budget_alerts_org     ON budget_alerts(organization_id);

-- 4. RLS policies
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets_select" ON budgets FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "budgets_insert" ON budgets FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "budgets_update" ON budgets FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "budgets_delete" ON budgets FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);

CREATE POLICY "budget_alerts_select" ON budget_alerts FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "budget_alerts_insert" ON budget_alerts FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "budget_alerts_update" ON budget_alerts FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "budget_alerts_delete" ON budget_alerts FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
