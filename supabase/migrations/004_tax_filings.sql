-- ============================================
-- FiniTax Migration 004: Tax Filings
-- Declaraciones fiscales salvadoreñas: F-07 (IVA), F-11 (Pago a Cuenta), F-14 (Renta Anual)
-- ============================================

CREATE TABLE tax_filings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    form_type VARCHAR(10) NOT NULL CHECK (form_type IN ('F-07', 'F-11', 'F-14')),
    period_year INTEGER NOT NULL,
    period_month INTEGER CHECK (period_month BETWEEN 1 AND 12),
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'FILED', 'ACCEPTED', 'REJECTED')),

    -- IVA fields (F-07)
    iva_debito DECIMAL(15,2) DEFAULT 0.00,
    iva_credito DECIMAL(15,2) DEFAULT 0.00,
    iva_retenido DECIMAL(15,2) DEFAULT 0.00,
    iva_percibido DECIMAL(15,2) DEFAULT 0.00,
    iva_a_pagar DECIMAL(15,2) DEFAULT 0.00,
    ventas_gravadas DECIMAL(15,2) DEFAULT 0.00,
    ventas_exentas DECIMAL(15,2) DEFAULT 0.00,
    compras_gravadas DECIMAL(15,2) DEFAULT 0.00,
    compras_exentas DECIMAL(15,2) DEFAULT 0.00,

    -- Pago a Cuenta / ISR fields (F-11)
    ingresos_brutos DECIMAL(15,2) DEFAULT 0.00,
    pago_a_cuenta DECIMAL(15,2) DEFAULT 0.00,
    isr_retenido_empleados DECIMAL(15,2) DEFAULT 0.00,
    isr_retenido_terceros DECIMAL(15,2) DEFAULT 0.00,

    -- Annual Renta fields (F-14)
    ingresos_anuales DECIMAL(15,2) DEFAULT 0.00,
    costos_deducibles DECIMAL(15,2) DEFAULT 0.00,
    renta_imponible DECIMAL(15,2) DEFAULT 0.00,
    isr_anual DECIMAL(15,2) DEFAULT 0.00,
    pagos_a_cuenta_acumulados DECIMAL(15,2) DEFAULT 0.00,
    saldo_a_pagar DECIMAL(15,2) DEFAULT 0.00,

    -- General
    total_a_pagar DECIMAL(15,2) DEFAULT 0.00,
    filed_at TIMESTAMPTZ,
    filing_reference VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one filing per form type per period per org
CREATE UNIQUE INDEX idx_tax_filings_unique_period ON tax_filings(organization_id, form_type, period_year, period_month)
  WHERE period_month IS NOT NULL;
CREATE UNIQUE INDEX idx_tax_filings_unique_annual ON tax_filings(organization_id, form_type, period_year)
  WHERE period_month IS NULL;

-- Performance indexes
CREATE INDEX idx_tax_filings_org ON tax_filings(organization_id);
CREATE INDEX idx_tax_filings_status ON tax_filings(status);
CREATE INDEX idx_tax_filings_period ON tax_filings(period_year, period_month);

-- RLS
ALTER TABLE tax_filings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage tax filings" ON tax_filings
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT get_user_orgs()))
  WITH CHECK (organization_id IN (SELECT get_user_orgs()));

-- Auto-update updated_at
CREATE TRIGGER update_tax_filings_updated_at
  BEFORE UPDATE ON tax_filings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
