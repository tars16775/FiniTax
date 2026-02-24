-- =============================================
-- Migration 010: Bank Reconciliation
-- =============================================
-- Bank accounts, imported transactions, and
-- reconciliation matching with internal records.

-- 1. Bank Accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  account_name  TEXT NOT NULL,                -- user-friendly label
  bank_name     TEXT NOT NULL,                -- financial institution
  account_number TEXT,                        -- last 4 digits or masked
  account_type  TEXT NOT NULL DEFAULT 'CHECKING', -- CHECKING | SAVINGS | CREDIT_CARD | OTHER
  currency_code TEXT NOT NULL DEFAULT 'USD',
  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  as_of_date    DATE,                         -- balance statement date
  is_active     BOOLEAN NOT NULL DEFAULT true,
  notes         TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Bank Transactions table (imported statement lines)
CREATE TABLE IF NOT EXISTS bank_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,

  transaction_date DATE NOT NULL,
  description      TEXT NOT NULL,
  reference        TEXT,                       -- cheque #, transfer ref, etc.
  amount           NUMERIC(18,2) NOT NULL,     -- positive = deposit, negative = withdrawal
  running_balance  NUMERIC(18,2),              -- balance after this txn (from bank)

  category         TEXT NOT NULL DEFAULT 'OTHER', -- DEPOSIT | WITHDRAWAL | TRANSFER | FEE | INTEREST | OTHER
  payee            TEXT,

  -- Reconciliation fields
  is_reconciled    BOOLEAN NOT NULL DEFAULT false,
  reconciled_at    TIMESTAMPTZ,
  reconciled_by    UUID REFERENCES auth.users(id),

  -- Matched internal record (only ONE should be set)
  matched_invoice_id  UUID REFERENCES dte_invoices(id) ON DELETE SET NULL,
  matched_expense_id  UUID REFERENCES expenses(id) ON DELETE SET NULL,
  matched_journal_id  UUID REFERENCES journal_entries(id) ON DELETE SET NULL,

  -- Import metadata
  import_batch     TEXT,                       -- groups rows from same import
  import_source    TEXT,                       -- e.g. "CSV", "OFX", "Manual"
  external_id      TEXT,                       -- dedup key from bank file

  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Reconciliation sessions (optional summary per session)
CREATE TABLE IF NOT EXISTS reconciliation_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,

  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  statement_start DATE NOT NULL,
  statement_end   DATE NOT NULL,
  statement_balance NUMERIC(18,2) NOT NULL,

  book_balance    NUMERIC(18,2),
  difference      NUMERIC(18,2),
  status          TEXT NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS | COMPLETED | CANCELLED
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES auth.users(id),
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes
CREATE INDEX idx_bank_accounts_org        ON bank_accounts(organization_id);
CREATE INDEX idx_bank_txn_org             ON bank_transactions(organization_id);
CREATE INDEX idx_bank_txn_account         ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_txn_date            ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_txn_reconciled      ON bank_transactions(is_reconciled);
CREATE INDEX idx_bank_txn_external        ON bank_transactions(organization_id, external_id);
CREATE INDEX idx_recon_sessions_account   ON reconciliation_sessions(bank_account_id);

-- 5. RLS policies
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_sessions ENABLE ROW LEVEL SECURITY;

-- bank_accounts
CREATE POLICY "bank_accounts_select" ON bank_accounts FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "bank_accounts_insert" ON bank_accounts FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "bank_accounts_update" ON bank_accounts FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "bank_accounts_delete" ON bank_accounts FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);

-- bank_transactions
CREATE POLICY "bank_txn_select" ON bank_transactions FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "bank_txn_insert" ON bank_transactions FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "bank_txn_update" ON bank_transactions FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "bank_txn_delete" ON bank_transactions FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);

-- reconciliation_sessions
CREATE POLICY "recon_session_select" ON reconciliation_sessions FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "recon_session_insert" ON reconciliation_sessions FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "recon_session_update" ON reconciliation_sessions FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
CREATE POLICY "recon_session_delete" ON reconciliation_sessions FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
