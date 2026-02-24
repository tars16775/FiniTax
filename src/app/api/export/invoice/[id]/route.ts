import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { generateInvoiceHTML } from "@/lib/pdf-invoice";
import type { DTEInvoice, DTEItem, Organization } from "@/lib/types/database";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // Verify auth
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: invoiceId } = await params;
    const orgId = req.nextUrl.searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ error: "orgId requerido" }, { status: 400 });
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

    // Get organization
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
    }

    // Get invoice
    const { data: invoice } = await supabase
      .from("dte_invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("organization_id", orgId)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    // Get items
    const { data: items } = await supabase
      .from("dte_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("item_number", { ascending: true });

    // Normalize
    const normalizedInvoice: DTEInvoice = {
      ...invoice,
      total_gravada: Number(invoice.total_gravada),
      total_exenta: Number(invoice.total_exenta),
      total_no_sujeta: Number(invoice.total_no_sujeta),
      total_iva: Number(invoice.total_iva),
      iva_retained: Number(invoice.iva_retained),
      total_amount: Number(invoice.total_amount),
    } as DTEInvoice;

    const normalizedItems: DTEItem[] = (items || []).map((item: Record<string, unknown>) => ({
      ...item,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      discount: Number(item.discount),
      total: Number(item.total),
    })) as DTEItem[];

    const html = generateInvoiceHTML({
      invoice: normalizedInvoice,
      items: normalizedItems,
      organization: org as Organization,
    });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="DTE-${invoice.generation_code || invoiceId}.html"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
