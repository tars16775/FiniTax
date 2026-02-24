-- FiniTax Phase 4: Seed standard Salvadoran Chart of Accounts
-- Based on the CONACYT/MH standard accounting classification for El Salvador
-- Run against: postgresql://postgres:Finitax1234!@db.gpizxeplpciqpkajcnjl.supabase.co:5432/postgres

-- This function seeds the standard SV chart of accounts for a given organization.
-- Call: SELECT seed_chart_of_accounts('<org_id>');

CREATE OR REPLACE FUNCTION seed_chart_of_accounts(org_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
  existing_count INTEGER;
BEGIN
  -- Check if already seeded
  SELECT COUNT(*) INTO existing_count
  FROM chart_of_accounts
  WHERE organization_id = org_id;
  
  IF existing_count > 0 THEN
    RETURN 0; -- Already seeded
  END IF;

  -- ============================================
  -- 1xxx — ACTIVO (Assets)
  -- ============================================
  INSERT INTO chart_of_accounts (organization_id, account_code, account_name, account_type, is_active) VALUES
  (org_id, '1',      'ACTIVO',                              'ASSET', true),
  (org_id, '11',     'ACTIVO CORRIENTE',                    'ASSET', true),
  (org_id, '1101',   'Efectivo y Equivalentes',             'ASSET', true),
  (org_id, '110101', 'Caja General',                        'ASSET', true),
  (org_id, '110102', 'Caja Chica',                          'ASSET', true),
  (org_id, '110103', 'Bancos',                              'ASSET', true),
  (org_id, '1102',   'Inversiones Temporales',              'ASSET', true),
  (org_id, '110201', 'Depósitos a Plazo',                   'ASSET', true),
  (org_id, '1103',   'Cuentas por Cobrar Comerciales',      'ASSET', true),
  (org_id, '110301', 'Clientes',                            'ASSET', true),
  (org_id, '110302', 'Documentos por Cobrar',               'ASSET', true),
  (org_id, '110303', 'Provisión para Cuentas Incobrables',  'ASSET', true),
  (org_id, '1104',   'Cuentas por Cobrar No Comerciales',   'ASSET', true),
  (org_id, '110401', 'Anticipos a Proveedores',             'ASSET', true),
  (org_id, '110402', 'Préstamos a Empleados',               'ASSET', true),
  (org_id, '110403', 'IVA — Crédito Fiscal',                'ASSET', true),
  (org_id, '110404', 'Pago a Cuenta ISR',                   'ASSET', true),
  (org_id, '110405', 'Retenciones de IVA (por cobrar)',     'ASSET', true),
  (org_id, '1105',   'Inventarios',                         'ASSET', true),
  (org_id, '110501', 'Inventario de Mercaderías',           'ASSET', true),
  (org_id, '110502', 'Inventario de Materias Primas',       'ASSET', true),
  (org_id, '110503', 'Inventario de Productos en Proceso',  'ASSET', true),
  (org_id, '110504', 'Inventario de Productos Terminados',  'ASSET', true),
  (org_id, '1106',   'Gastos Pagados por Anticipado',       'ASSET', true),
  (org_id, '110601', 'Seguros Pagados por Anticipado',      'ASSET', true),
  (org_id, '110602', 'Alquileres Pagados por Anticipado',   'ASSET', true),

  -- Non-current assets
  (org_id, '12',     'ACTIVO NO CORRIENTE',                 'ASSET', true),
  (org_id, '1201',   'Propiedad, Planta y Equipo',          'ASSET', true),
  (org_id, '120101', 'Terrenos',                             'ASSET', true),
  (org_id, '120102', 'Edificios',                            'ASSET', true),
  (org_id, '120103', 'Mobiliario y Equipo de Oficina',       'ASSET', true),
  (org_id, '120104', 'Equipo de Transporte',                 'ASSET', true),
  (org_id, '120105', 'Maquinaria y Equipo Industrial',       'ASSET', true),
  (org_id, '120106', 'Equipo de Computación',                'ASSET', true),
  (org_id, '120107', 'Herramientas',                         'ASSET', true),
  (org_id, '1202',   'Depreciación Acumulada',               'ASSET', true),
  (org_id, '120201', 'Depreciación Acum. de Edificios',     'ASSET', true),
  (org_id, '120202', 'Depreciación Acum. de Mob. y Equipo', 'ASSET', true),
  (org_id, '120203', 'Depreciación Acum. de Eq. Transporte','ASSET', true),
  (org_id, '120204', 'Depreciación Acum. de Maquinaria',    'ASSET', true),
  (org_id, '120205', 'Depreciación Acum. de Eq. Computación','ASSET', true),
  (org_id, '1203',   'Activos Intangibles',                  'ASSET', true),
  (org_id, '120301', 'Marcas y Patentes',                    'ASSET', true),
  (org_id, '120302', 'Licencias de Software',                'ASSET', true),
  (org_id, '120303', 'Amortización Acumulada de Intangibles','ASSET', true);

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  -- ============================================
  -- 2xxx — PASIVO (Liabilities)
  -- ============================================
  INSERT INTO chart_of_accounts (organization_id, account_code, account_name, account_type, is_active) VALUES
  (org_id, '2',      'PASIVO',                               'LIABILITY', true),
  (org_id, '21',     'PASIVO CORRIENTE',                     'LIABILITY', true),
  (org_id, '2101',   'Cuentas por Pagar Comerciales',        'LIABILITY', true),
  (org_id, '210101', 'Proveedores Locales',                  'LIABILITY', true),
  (org_id, '210102', 'Proveedores del Exterior',             'LIABILITY', true),
  (org_id, '210103', 'Documentos por Pagar',                 'LIABILITY', true),
  (org_id, '2102',   'Obligaciones Financieras a Corto Plazo','LIABILITY', true),
  (org_id, '210201', 'Préstamos Bancarios a Corto Plazo',   'LIABILITY', true),
  (org_id, '210202', 'Porción Corriente de Deuda a Largo Plazo','LIABILITY', true),
  (org_id, '2103',   'Impuestos por Pagar',                  'LIABILITY', true),
  (org_id, '210301', 'IVA — Débito Fiscal',                  'LIABILITY', true),
  (org_id, '210302', 'IVA por Pagar',                        'LIABILITY', true),
  (org_id, '210303', 'Impuesto sobre la Renta por Pagar',   'LIABILITY', true),
  (org_id, '210304', 'Retenciones de ISR por Pagar',        'LIABILITY', true),
  (org_id, '210305', 'Impuesto Municipal por Pagar',        'LIABILITY', true),
  (org_id, '2104',   'Obligaciones Laborales',               'LIABILITY', true),
  (org_id, '210401', 'Sueldos por Pagar',                    'LIABILITY', true),
  (org_id, '210402', 'ISSS Patronal por Pagar',              'LIABILITY', true),
  (org_id, '210403', 'AFP Patronal por Pagar',               'LIABILITY', true),
  (org_id, '210404', 'ISSS Laboral (retenido)',              'LIABILITY', true),
  (org_id, '210405', 'AFP Laboral (retenido)',               'LIABILITY', true),
  (org_id, '210406', 'ISR Retenido a Empleados',            'LIABILITY', true),
  (org_id, '210407', 'Aguinaldo por Pagar',                  'LIABILITY', true),
  (org_id, '210408', 'Vacaciones por Pagar',                 'LIABILITY', true),
  (org_id, '210409', 'Indemnización por Pagar',              'LIABILITY', true),
  (org_id, '210410', 'INSAFORP por Pagar',                   'LIABILITY', true),
  (org_id, '2105',   'Otras Cuentas por Pagar',              'LIABILITY', true),
  (org_id, '210501', 'Retenciones por Pagar Diversas',       'LIABILITY', true),
  (org_id, '210502', 'Anticipos de Clientes',                'LIABILITY', true),

  -- Non-current liabilities
  (org_id, '22',     'PASIVO NO CORRIENTE',                  'LIABILITY', true),
  (org_id, '2201',   'Préstamos Bancarios a Largo Plazo',   'LIABILITY', true),
  (org_id, '2202',   'Hipotecas por Pagar',                  'LIABILITY', true),
  (org_id, '2203',   'Provisiones a Largo Plazo',            'LIABILITY', true);

  -- ============================================
  -- 3xxx — PATRIMONIO (Equity)
  -- ============================================
  INSERT INTO chart_of_accounts (organization_id, account_code, account_name, account_type, is_active) VALUES
  (org_id, '3',      'PATRIMONIO',                           'EQUITY', true),
  (org_id, '31',     'CAPITAL SOCIAL',                       'EQUITY', true),
  (org_id, '3101',   'Capital Social Mínimo',                'EQUITY', true),
  (org_id, '3102',   'Capital Social Variable',              'EQUITY', true),
  (org_id, '32',     'RESERVAS',                             'EQUITY', true),
  (org_id, '3201',   'Reserva Legal',                        'EQUITY', true),
  (org_id, '3202',   'Reservas Voluntarias',                 'EQUITY', true),
  (org_id, '33',     'RESULTADOS',                           'EQUITY', true),
  (org_id, '3301',   'Utilidades de Ejercicios Anteriores',  'EQUITY', true),
  (org_id, '3302',   'Utilidad del Ejercicio',               'EQUITY', true),
  (org_id, '3303',   'Pérdidas de Ejercicios Anteriores',   'EQUITY', true),
  (org_id, '3304',   'Pérdida del Ejercicio',               'EQUITY', true),
  (org_id, '34',     'SUPERÁVIT POR REVALUACIÓN',           'EQUITY', true);

  -- ============================================
  -- 4xxx — INGRESOS (Revenue)
  -- ============================================
  INSERT INTO chart_of_accounts (organization_id, account_code, account_name, account_type, is_active) VALUES
  (org_id, '4',      'INGRESOS',                             'REVENUE', true),
  (org_id, '41',     'INGRESOS DE OPERACIÓN',               'REVENUE', true),
  (org_id, '4101',   'Ventas',                               'REVENUE', true),
  (org_id, '410101', 'Ventas Gravadas',                      'REVENUE', true),
  (org_id, '410102', 'Ventas Exentas',                       'REVENUE', true),
  (org_id, '410103', 'Ventas No Sujetas',                    'REVENUE', true),
  (org_id, '4102',   'Devoluciones y Rebajas sobre Ventas', 'REVENUE', true),
  (org_id, '4103',   'Descuentos sobre Ventas',              'REVENUE', true),
  (org_id, '42',     'INGRESOS NO OPERACIONALES',           'REVENUE', true),
  (org_id, '4201',   'Intereses Ganados',                    'REVENUE', true),
  (org_id, '4202',   'Ganancia en Venta de Activos',         'REVENUE', true),
  (org_id, '4203',   'Otros Ingresos',                       'REVENUE', true);

  -- ============================================
  -- 5xxx — COSTOS Y GASTOS (Expenses)
  -- ============================================
  INSERT INTO chart_of_accounts (organization_id, account_code, account_name, account_type, is_active) VALUES
  (org_id, '5',      'COSTOS Y GASTOS',                      'EXPENSE', true),
  (org_id, '51',     'COSTO DE VENTAS',                      'EXPENSE', true),
  (org_id, '5101',   'Costo de Mercadería Vendida',          'EXPENSE', true),
  (org_id, '5102',   'Costo de Producción',                  'EXPENSE', true),
  (org_id, '52',     'GASTOS DE OPERACIÓN',                  'EXPENSE', true),
  (org_id, '5201',   'Gastos de Administración',             'EXPENSE', true),
  (org_id, '520101', 'Sueldos y Salarios — Administración', 'EXPENSE', true),
  (org_id, '520102', 'ISSS Patronal — Administración',      'EXPENSE', true),
  (org_id, '520103', 'AFP Patronal — Administración',       'EXPENSE', true),
  (org_id, '520104', 'INSAFORP — Administración',           'EXPENSE', true),
  (org_id, '520105', 'Aguinaldo — Administración',          'EXPENSE', true),
  (org_id, '520106', 'Vacaciones — Administración',         'EXPENSE', true),
  (org_id, '520107', 'Indemnización — Administración',      'EXPENSE', true),
  (org_id, '520108', 'Alquiler — Administración',           'EXPENSE', true),
  (org_id, '520109', 'Servicios Básicos — Administración',  'EXPENSE', true),
  (org_id, '520110', 'Papelería y Útiles',                   'EXPENSE', true),
  (org_id, '520111', 'Depreciación — Administración',       'EXPENSE', true),
  (org_id, '520112', 'Honorarios Profesionales',             'EXPENSE', true),
  (org_id, '520113', 'Seguros — Administración',            'EXPENSE', true),
  (org_id, '520114', 'Mantenimiento y Reparaciones',         'EXPENSE', true),
  (org_id, '520115', 'Viáticos y Transporte',               'EXPENSE', true),
  (org_id, '520116', 'Amortización de Intangibles',         'EXPENSE', true),
  (org_id, '520117', 'Gastos Varios de Administración',     'EXPENSE', true),
  (org_id, '5202',   'Gastos de Venta',                      'EXPENSE', true),
  (org_id, '520201', 'Sueldos y Salarios — Ventas',         'EXPENSE', true),
  (org_id, '520202', 'Comisiones sobre Ventas',              'EXPENSE', true),
  (org_id, '520203', 'Publicidad y Propaganda',              'EXPENSE', true),
  (org_id, '520204', 'Envíos y Fletes',                     'EXPENSE', true),
  (org_id, '520205', 'ISSS Patronal — Ventas',              'EXPENSE', true),
  (org_id, '520206', 'AFP Patronal — Ventas',               'EXPENSE', true),
  (org_id, '520207', 'Aguinaldo — Ventas',                  'EXPENSE', true),
  (org_id, '520208', 'Depreciación — Ventas',               'EXPENSE', true),
  (org_id, '520209', 'Gastos Varios de Ventas',              'EXPENSE', true),
  (org_id, '53',     'GASTOS NO OPERACIONALES',             'EXPENSE', true),
  (org_id, '5301',   'Gastos Financieros',                   'EXPENSE', true),
  (org_id, '530101', 'Intereses Bancarios',                  'EXPENSE', true),
  (org_id, '530102', 'Comisiones Bancarias',                 'EXPENSE', true),
  (org_id, '530103', 'Diferencial Cambiario',                'EXPENSE', true),
  (org_id, '5302',   'Pérdida en Venta de Activos',         'EXPENSE', true),
  (org_id, '5303',   'Cuentas Incobrables',                  'EXPENSE', true),
  (org_id, '5304',   'Otros Gastos No Operacionales',       'EXPENSE', true),
  (org_id, '54',     'GASTOS DE IMPUESTOS',                  'EXPENSE', true),
  (org_id, '5401',   'Impuesto sobre la Renta Corriente',   'EXPENSE', true),
  (org_id, '5402',   'Impuesto sobre la Renta Diferido',    'EXPENSE', true),
  (org_id, '5403',   'Impuesto Municipal',                   'EXPENSE', true);

  -- ============================================
  -- Now set parent_account_id relationships
  -- ============================================
  -- Level 2 parents (e.g. '11' -> '1')
  UPDATE chart_of_accounts c SET parent_account_id = p.id
  FROM chart_of_accounts p
  WHERE c.organization_id = org_id
    AND p.organization_id = org_id
    AND LENGTH(c.account_code) = 2
    AND LENGTH(p.account_code) = 1
    AND c.account_code LIKE p.account_code || '%'
    AND c.parent_account_id IS NULL;

  -- Level 4 parents (e.g. '1101' -> '11')
  UPDATE chart_of_accounts c SET parent_account_id = p.id
  FROM chart_of_accounts p
  WHERE c.organization_id = org_id
    AND p.organization_id = org_id
    AND LENGTH(c.account_code) = 4
    AND LENGTH(p.account_code) = 2
    AND c.account_code LIKE p.account_code || '%'
    AND c.parent_account_id IS NULL;

  -- Level 6 parents (e.g. '110101' -> '1101')
  UPDATE chart_of_accounts c SET parent_account_id = p.id
  FROM chart_of_accounts p
  WHERE c.organization_id = org_id
    AND p.organization_id = org_id
    AND LENGTH(c.account_code) = 6
    AND LENGTH(p.account_code) = 4
    AND c.account_code LIKE p.account_code || '%'
    AND c.parent_account_id IS NULL;

  SELECT COUNT(*) INTO inserted_count FROM chart_of_accounts WHERE organization_id = org_id;
  
  RETURN inserted_count;
END;
$$;
