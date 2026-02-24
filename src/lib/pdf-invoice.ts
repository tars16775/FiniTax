// ============================================
// DTE Invoice PDF Generator (HTML-based)
// ============================================
// Generates a print-ready HTML document for invoices.
// No external PDF library needed — uses browser print/save-as-PDF.
// For server-side, returns the HTML string directly.

import type { DTEInvoice, DTEItem, Organization } from "@/lib/types/database";
import { DTE_TYPE_META, DTE_STATUS_META, PAYMENT_STATUS_META } from "@/lib/invoice-labels";

interface InvoicePDFData {
  invoice: DTEInvoice;
  items: DTEItem[];
  organization: Organization;
}

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("es-SV", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const TAX_LABELS: Record<string, string> = {
  GRAVADA: "Gravada",
  EXENTA: "Exenta",
  NO_SUJETA: "No Sujeta",
};

export function generateInvoiceHTML({ invoice, items, organization }: InvoicePDFData): string {
  const dteMeta = DTE_TYPE_META[invoice.dte_type];
  const statusMeta = DTE_STATUS_META[invoice.status];
  const paymentMeta = PAYMENT_STATUS_META[invoice.payment_status];

  const itemRows = items
    .map(
      (item, i) => `
    <tr>
      <td style="text-align:center; padding:8px; border-bottom:1px solid #e2e8f0;">${i + 1}</td>
      <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${escapeHtml(item.description)}</td>
      <td style="text-align:center; padding:8px; border-bottom:1px solid #e2e8f0;">${item.quantity}</td>
      <td style="text-align:right; padding:8px; border-bottom:1px solid #e2e8f0;">$${fmtMoney(item.unit_price)}</td>
      <td style="text-align:right; padding:8px; border-bottom:1px solid #e2e8f0;">${item.discount > 0 ? `$${fmtMoney(item.discount)}` : "—"}</td>
      <td style="text-align:center; padding:8px; border-bottom:1px solid #e2e8f0;">${TAX_LABELS[item.tax_type] || item.tax_type}</td>
      <td style="text-align:right; padding:8px; border-bottom:1px solid #e2e8f0; font-weight:600;">$${fmtMoney(item.total)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${dteMeta.shortLabel} — ${invoice.generation_code || "Borrador"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: letter; margin: 1cm; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1a202c;
      font-size: 13px;
      line-height: 1.5;
      background: #fff;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; border-bottom: 3px solid #1E3A5F; padding-bottom: 16px; }
    .company-info h1 { font-size: 22px; color: #1E3A5F; margin-bottom: 4px; }
    .company-info p { font-size: 12px; color: #64748b; }
    .dte-badge { background: #1E3A5F; color: #fff; padding: 8px 16px; border-radius: 6px; text-align: center; }
    .dte-badge .type { font-size: 18px; font-weight: 700; }
    .dte-badge .label { font-size: 11px; opacity: 0.85; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .meta-card h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .meta-row .label { color: #64748b; font-size: 12px; }
    .meta-row .value { font-weight: 600; font-size: 12px; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .items-table thead { background: #1E3A5F; color: #fff; }
    .items-table th { padding: 10px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .items-table tbody tr:nth-child(even) { background: #f8fafc; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
    .totals-box { width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .total-row.grand { font-size: 16px; font-weight: 700; color: #1E3A5F; border-bottom: 2px solid #1E3A5F; border-top: 2px solid #1E3A5F; padding: 10px 0; }
    .footer { text-align: center; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    .print-bar { background: #f1f5f9; padding: 12px; text-align: center; margin-bottom: 16px; border-radius: 8px; }
    .print-bar button { background: #1E3A5F; color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 600; }
    .print-bar button:hover { background: #2d4f7a; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Print button (hidden when printing) -->
    <div class="print-bar no-print">
      <button onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
    </div>

    <!-- Header -->
    <div class="header">
      <div class="company-info">
        <h1>${escapeHtml(organization.name)}</h1>
        <p>NIT: ${escapeHtml(organization.nit_number)}</p>
        ${organization.nrc_number ? `<p>NRC: ${escapeHtml(organization.nrc_number)}</p>` : ""}
      </div>
      <div class="dte-badge">
        <div class="type">${dteMeta.shortLabel}</div>
        <div class="label">${dteMeta.label}</div>
      </div>
    </div>

    <!-- Meta info -->
    <div class="meta-grid">
      <div class="meta-card">
        <h3>Datos del Documento</h3>
        <div class="meta-row">
          <span class="label">Código de Generación</span>
          <span class="value" style="font-size:10px;">${invoice.generation_code || "—"}</span>
        </div>
        ${invoice.control_number ? `<div class="meta-row"><span class="label">Número de Control</span><span class="value">${escapeHtml(invoice.control_number)}</span></div>` : ""}
        ${invoice.reception_stamp ? `<div class="meta-row"><span class="label">Sello de Recepción</span><span class="value" style="font-size:10px;">${escapeHtml(invoice.reception_stamp)}</span></div>` : ""}
        <div class="meta-row">
          <span class="label">Fecha de Emisión</span>
          <span class="value">${fmtDate(invoice.issue_date)}</span>
        </div>
        <div class="meta-row">
          <span class="label">Estado</span>
          <span class="value">${statusMeta.label}</span>
        </div>
        <div class="meta-row">
          <span class="label">Pago</span>
          <span class="value">${paymentMeta.label}</span>
        </div>
      </div>

      <div class="meta-card">
        <h3>Datos del Cliente</h3>
        <div class="meta-row">
          <span class="label">Nombre</span>
          <span class="value">${escapeHtml(invoice.client_name || "—")}</span>
        </div>
        ${invoice.client_nit ? `<div class="meta-row"><span class="label">NIT</span><span class="value">${escapeHtml(invoice.client_nit)}</span></div>` : ""}
        ${invoice.client_dui ? `<div class="meta-row"><span class="label">DUI</span><span class="value">${escapeHtml(invoice.client_dui)}</span></div>` : ""}
        ${invoice.client_email ? `<div class="meta-row"><span class="label">Email</span><span class="value">${escapeHtml(invoice.client_email)}</span></div>` : ""}
      </div>
    </div>

    <!-- Items table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="text-align:center; width:40px;">#</th>
          <th style="text-align:left;">Descripción</th>
          <th style="text-align:center; width:70px;">Cant.</th>
          <th style="text-align:right; width:90px;">P. Unit.</th>
          <th style="text-align:right; width:80px;">Desc.</th>
          <th style="text-align:center; width:80px;">Tipo</th>
          <th style="text-align:right; width:100px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <div class="totals-box">
        <div class="total-row">
          <span>Subtotal Gravado</span>
          <span>$${fmtMoney(invoice.total_gravada)}</span>
        </div>
        ${invoice.total_exenta > 0 ? `<div class="total-row"><span>Subtotal Exento</span><span>$${fmtMoney(invoice.total_exenta)}</span></div>` : ""}
        ${invoice.total_no_sujeta > 0 ? `<div class="total-row"><span>Subtotal No Sujeto</span><span>$${fmtMoney(invoice.total_no_sujeta)}</span></div>` : ""}
        <div class="total-row">
          <span>IVA 13%</span>
          <span>$${fmtMoney(invoice.total_iva)}</span>
        </div>
        ${invoice.iva_retained > 0 ? `<div class="total-row"><span>IVA Retenido</span><span>-$${fmtMoney(invoice.iva_retained)}</span></div>` : ""}
        <div class="total-row grand">
          <span>TOTAL</span>
          <span>$${fmtMoney(invoice.total_amount)}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>Documento Tributario Electrónico — Generado por FiniTax</p>
      <p>Ministerio de Hacienda — El Salvador</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
