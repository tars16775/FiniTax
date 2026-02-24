import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  toCSV,
  INVOICE_CSV_COLUMNS,
  EXPENSE_CSV_COLUMNS,
  EMPLOYEE_CSV_COLUMNS,
  LEDGER_CSV_COLUMNS,
  TAX_CSV_COLUMNS,
  INVENTORY_CSV_COLUMNS,
  AUDIT_CSV_COLUMNS,
} from "@/lib/export";

type ExportType = "invoices" | "expenses" | "employees" | "ledger" | "taxes" | "inventory" | "audit";

const VALID_TYPES: ExportType[] = ["invoices", "expenses", "employees", "ledger", "taxes", "inventory", "audit"];

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify auth
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const type = req.nextUrl.searchParams.get("type") as ExportType | null;
    const orgId = req.nextUrl.searchParams.get("orgId");

    if (!orgId || !type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    // Verify user belongs to org
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Only ADMIN / ACCOUNTANT
    if (!["ADMIN", "ACCOUNTANT"].includes(member.role)) {
      return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
    }

    const startDate = req.nextUrl.searchParams.get("startDate");
    const endDate = req.nextUrl.searchParams.get("endDate");

    let csv = "";
    let filename = "";

    switch (type) {
      case "invoices": {
        let q = supabase.from("dte_invoices").select("*").eq("organization_id", orgId).order("issue_date", { ascending: false });
        if (startDate) q = q.gte("issue_date", startDate);
        if (endDate) q = q.lte("issue_date", endDate);
        const { data } = await q;
        csv = toCSV(data || [], INVOICE_CSV_COLUMNS);
        filename = `facturas_${orgId.slice(0, 8)}.csv`;
        break;
      }
      case "expenses": {
        let q = supabase.from("expenses").select("*").eq("organization_id", orgId).order("expense_date", { ascending: false });
        if (startDate) q = q.gte("expense_date", startDate);
        if (endDate) q = q.lte("expense_date", endDate);
        const { data } = await q;
        csv = toCSV(data || [], EXPENSE_CSV_COLUMNS);
        filename = `gastos_${orgId.slice(0, 8)}.csv`;
        break;
      }
      case "employees": {
        const { data } = await supabase.from("employees").select("*").eq("organization_id", orgId).order("last_name");
        csv = toCSV(data || [], EMPLOYEE_CSV_COLUMNS);
        filename = `empleados_${orgId.slice(0, 8)}.csv`;
        break;
      }
      case "ledger": {
        let q = supabase.from("journal_entries").select("*, journal_entry_lines(*, chart_of_accounts(account_code, account_name))").eq("organization_id", orgId).order("entry_date", { ascending: false });
        if (startDate) q = q.gte("entry_date", startDate);
        if (endDate) q = q.lte("entry_date", endDate);
        const { data } = await q;
        const rows: Record<string, unknown>[] = [];
        for (const entry of data || []) {
          const e = entry as Record<string, unknown>;
          const lines = e.journal_entry_lines as Record<string, unknown>[] || [];
          for (const line of lines) {
            const acct = line.chart_of_accounts as { account_code: string; account_name: string } | null;
            rows.push({
              entry_date: e.entry_date,
              reference_number: e.reference_number,
              description: e.description,
              account_code: acct?.account_code || "—",
              account_name: acct?.account_name || "—",
              debit: line.debit,
              credit: line.credit,
              is_posted: e.is_posted,
            });
          }
        }
        csv = toCSV(rows, LEDGER_CSV_COLUMNS);
        filename = `libro_mayor_${orgId.slice(0, 8)}.csv`;
        break;
      }
      case "taxes": {
        const { data } = await supabase.from("tax_filings").select("*").eq("organization_id", orgId).order("period_year", { ascending: false });
        csv = toCSV(data || [], TAX_CSV_COLUMNS);
        filename = `declaraciones_${orgId.slice(0, 8)}.csv`;
        break;
      }
      case "inventory": {
        const { data } = await supabase.from("inventory_items").select("*").eq("organization_id", orgId).order("name");
        csv = toCSV(data || [], INVENTORY_CSV_COLUMNS);
        filename = `inventario_${orgId.slice(0, 8)}.csv`;
        break;
      }
      case "audit": {
        // Only ADMIN for audit
        if (member.role !== "ADMIN") {
          return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
        }
        let q = supabase.from("audit_logs").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
        if (startDate) q = q.gte("created_at", startDate);
        if (endDate) q = q.lte("created_at", endDate);
        const { data } = await q;
        csv = toCSV(data || [], AUDIT_CSV_COLUMNS);
        filename = `auditoria_${orgId.slice(0, 8)}.csv`;
        break;
      }
    }

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
