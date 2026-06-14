import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

interface SalesMetrics {
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  dineInOrders: number;
  takeoutOrders: number;
  deliveryOrders: number;
  totalItems: number;
  totalDiscounts: number;
  soldItems: Array<{ name: string; count: number; revenue: number }>;
}

interface ProfitMetrics {
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  byCategory: Array<{ name: string; count: number; total: number }>;
}

interface WasteMetrics {
  totalCost: number;
  totalItems: number;
  byReason: Array<{ reason: string; count: number; cost: number }>;
  topItems: Array<{ name: string; quantity: number; unit: string; cost: number }>;
}

interface ZReportData {
  cashTotal: number;
  cardTotal: number;
  digitalTotal: number;
  tipsCollected: number;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  ordersHandled: number;
  revenue: number;
  itemsSold: number;
  completedOrders: number;
  cancelledOrders: number;
}

interface ExportParams {
  metrics: SalesMetrics;
  profitMetrics: ProfitMetrics;
  wasteMetrics: WasteMetrics;
  staffPerformance: StaffMember[];
  zReport: ZReportData;
  dateRangeLabel: string;
  formatPrice: (amount: number) => string;
  locale: string;
  /** i18n `t` (staff namespace); pass `{ ns: 'common' }` for common keys. */
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const BLUE: [number, number, number] = [59, 130, 246];
const RED: [number, number, number] = [239, 68, 68];

// Embedded Unicode font so non-Latin scripts and currency symbols (₼, ₸, €,
// Cyrillic, Azerbaijani ə/ş/ğ, …) render — jsPDF's built-in helvetica is
// Latin-1 only. Noto Sans covers Latin/Latin-ext/Cyrillic/Greek + currency.
// (CJK, Arabic, Thai and Georgian aren't in this font and will fall back to
// boxes — they'd each need their own multi-MB font.) Fetched from /public on
// first export and cached, so the ~1.1 MB stays out of the JS bundle.
let fontCache: { regular: string; bold: string } | null = null;

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function loadFonts(): Promise<{ regular: string; bold: string }> {
  if (fontCache) return fontCache;
  const [reg, bold] = await Promise.all([
    fetch('/fonts/NotoSans-Regular.ttf').then((r) => r.arrayBuffer()),
    fetch('/fonts/NotoSans-Bold.ttf').then((r) => r.arrayBuffer()),
  ]);
  fontCache = { regular: bufferToBase64(reg), bold: bufferToBase64(bold) };
  return fontCache;
}

export async function exportReportToPDF({
  metrics,
  profitMetrics,
  wasteMetrics,
  staffPerformance,
  zReport,
  dateRangeLabel,
  formatPrice,
  locale,
  t,
}: ExportParams) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Register + activate the embedded Unicode font (also used by the tables).
  const fonts = await loadFonts();
  doc.addFileToVFS('NotoSans-Regular.ttf', fonts.regular);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFileToVFS('NotoSans-Bold.ttf', fonts.bold);
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
  doc.setFont('NotoSans', 'normal');

  // Y where the next section heading should start; breaks the page when the
  // heading (plus a little of its table) wouldn't fit. One consistent rule for
  // every section — previously only Waste/Staff guarded, so long tables (e.g.
  // the now-uncapped Sold Items list) could orphan the next heading.
  const sectionTop = (prevFinalY: number): number => {
    let y = prevFinalY + 15;
    if (y + 24 > pageHeight - 15) {
      doc.addPage();
      y = 20;
    }
    return y;
  };

  const table = (
    startY: number,
    body: Array<Array<string>>,
    head: Array<Array<string>> | undefined,
    fill: [number, number, number],
  ) => {
    autoTable(doc, {
      startY,
      head,
      body,
      theme: 'striped',
      styles: { font: 'NotoSans', fontSize: 10 },
      headStyles: { font: 'NotoSans', fontStyle: 'bold', fillColor: fill },
    });
  };

  const heading = (text: string, y: number, size = 14) => {
    doc.setFontSize(size);
    doc.setFont('NotoSans', 'bold');
    doc.text(text, 14, y);
  };

  // ── Title ──────────────────────────────────────────────────────────
  doc.setFontSize(20);
  doc.setFont('NotoSans', 'bold');
  doc.text(t('reports.salesReport'), pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('NotoSans', 'normal');
  doc.text(`${t('reports.period')}: ${dateRangeLabel}`, pageWidth / 2, 28, { align: 'center' });
  doc.text(`${t('reports.generated')}: ${new Date().toLocaleString(locale)}`, pageWidth / 2, 34, {
    align: 'center',
  });

  // ── Key Metrics ────────────────────────────────────────────────────
  // "Total Orders" now counts only paid (closed) orders, so completion is
  // measured against finalized orders (paid vs voided), and we drop the
  // redundant "Completed Orders" row (== Total Orders).
  const finalized = metrics.completedOrders + metrics.cancelledOrders;
  const completionPct = finalized > 0 ? Math.round((metrics.completedOrders / finalized) * 100) : 0;

  heading(t('reports.keyMetrics'), 48);
  table(
    52,
    [
      [t('reports.totalRevenue'), formatPrice(metrics.totalRevenue)],
      [t('reports.totalOrders'), metrics.totalOrders.toString()],
      [t('reports.cancelledOrders'), metrics.cancelledOrders.toString()],
      [t('reports.averageOrderValue'), formatPrice(metrics.averageOrderValue)],
      [t('reports.completionRate'), `${completionPct}%`],
      [t('reports.dineInOrders'), metrics.dineInOrders.toString()],
      [t('reports.takeoutOrders'), metrics.takeoutOrders.toString()],
      [t('reports.deliveryOrders'), metrics.deliveryOrders.toString()],
      [t('reports.itemsSold'), metrics.totalItems.toString()],
    ],
    undefined,
    BLUE,
  );

  // ── Profit & Loss ──────────────────────────────────────────────────
  let y = sectionTop(doc.lastAutoTable.finalY);
  heading(t('reports.profitLoss'), y);
  table(
    y + 4,
    [
      [t('reports.revenue'), formatPrice(metrics.totalRevenue)],
      [t('reports.totalDiscounts'), formatPrice(metrics.totalDiscounts)],
      [t('reports.totalExpenses'), formatPrice(profitMetrics.totalExpenses)],
      [
        t('reports.netProfit'),
        `${profitMetrics.netProfit < 0 ? '-' : ''}${formatPrice(Math.abs(profitMetrics.netProfit))}`,
      ],
      [
        t('reports.profitMargin'),
        `${metrics.totalRevenue > 0 ? profitMetrics.profitMargin.toFixed(1) : '0.0'}%`,
      ],
    ],
    undefined,
    BLUE,
  );

  if (profitMetrics.byCategory.length > 0) {
    y = sectionTop(doc.lastAutoTable.finalY);
    heading(t('reports.expenseBreakdown'), y, 12);
    table(
      y + 4,
      profitMetrics.byCategory.map((cat) => [
        cat.name,
        cat.count.toString(),
        formatPrice(cat.total),
        `${profitMetrics.totalExpenses > 0 ? ((cat.total / profitMetrics.totalExpenses) * 100).toFixed(1) : '0.0'}%`,
      ]),
      [
        [
          t('category', { ns: 'common' }),
          t('reports.count'),
          t('amount', { ns: 'common' }),
          t('reports.percentOfTotal'),
        ],
      ],
      RED,
    );
  }

  // ── Z-Report (payments by method + tips) ───────────────────────────
  y = sectionTop(doc.lastAutoTable.finalY);
  heading(t('reports.zReport'), y);
  table(
    y + 4,
    [
      [t('reports.cashPayments'), formatPrice(zReport.cashTotal)],
      [t('reports.cardPayments'), formatPrice(zReport.cardTotal)],
      [t('reports.digitalPayments'), formatPrice(zReport.digitalTotal)],
      [t('reports.tipsCollected'), formatPrice(zReport.tipsCollected)],
    ],
    undefined,
    BLUE,
  );

  // ── Waste ──────────────────────────────────────────────────────────
  if (wasteMetrics.totalItems > 0) {
    y = sectionTop(doc.lastAutoTable.finalY);
    heading(t('reports.wasteSummary'), y);
    table(
      y + 4,
      [
        [t('reports.totalWasteCost'), formatPrice(wasteMetrics.totalCost)],
        [t('reports.wasteEntries'), wasteMetrics.totalItems.toString()],
        [t('reports.avgCostEntry'), formatPrice(wasteMetrics.totalCost / wasteMetrics.totalItems)],
      ],
      undefined,
      RED,
    );

    if (wasteMetrics.byReason.length > 0) {
      y = sectionTop(doc.lastAutoTable.finalY);
      heading(t('reports.wasteByReason'), y, 12);
      table(
        y + 4,
        wasteMetrics.byReason.map((item) => [
          t(`reports.wasteReason.${item.reason}`, { defaultValue: item.reason }),
          item.count.toString(),
          formatPrice(item.cost),
          `${wasteMetrics.totalCost > 0 ? ((item.cost / wasteMetrics.totalCost) * 100).toFixed(1) : '0.0'}%`,
        ]),
        [[t('reports.reason'), t('reports.count'), t('reports.cost'), t('reports.percentOfTotal')]],
        RED,
      );
    }

    if (wasteMetrics.topItems.length > 0) {
      y = sectionTop(doc.lastAutoTable.finalY);
      heading(t('reports.topWastedItems'), y, 12);
      table(
        y + 4,
        wasteMetrics.topItems.map((item, index) => [
          `#${index + 1}`,
          item.name,
          `${item.quantity} ${item.unit}`,
          formatPrice(item.cost),
        ]),
        [
          [
            t('reports.rank'),
            t('reports.item'),
            t('quantity', { ns: 'common' }),
            t('reports.cost'),
          ],
        ],
        RED,
      );
    }
  }

  // ── Sold Items ─────────────────────────────────────────────────────
  y = sectionTop(doc.lastAutoTable.finalY);
  heading(t('reports.soldItems'), y);
  if (metrics.soldItems.length > 0) {
    table(
      y + 4,
      metrics.soldItems.map((item, index) => [
        `#${index + 1}`,
        item.name,
        item.count.toString(),
        formatPrice(item.revenue),
      ]),
      [[t('reports.rank'), t('reports.item'), t('reports.qtySold'), t('reports.revenue')]],
      BLUE,
    );
  } else {
    doc.setFontSize(10);
    doc.setFont('NotoSans', 'normal');
    doc.text(t('reports.noItemsSold'), 14, y + 8);
  }

  // ── Staff Performance ──────────────────────────────────────────────
  // Per-staff "completion" dropped: ordersHandled now == completed (paid), so
  // it was always 100%.
  if (staffPerformance.length > 0) {
    y = sectionTop(doc.lastAutoTable.finalY);
    heading(t('reports.staffPerformance'), y);
    table(
      y + 4,
      staffPerformance.map((member, index) => [
        `#${index + 1}`,
        member.name,
        t(`staffMgmt.role.${member.role}`, { defaultValue: member.role }),
        member.ordersHandled.toString(),
        member.itemsSold.toString(),
        formatPrice(member.revenue),
        formatPrice(member.ordersHandled > 0 ? member.revenue / member.ordersHandled : 0),
      ]),
      [
        [
          t('reports.rank'),
          t('name', { ns: 'common' }),
          t('settings.role'),
          t('reports.ordersHandled'),
          t('reports.itemsSoldCol'),
          t('reports.revenue'),
          t('reports.avgOrder'),
        ],
      ],
      BLUE,
    );
  }

  // ── Footer ─────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('NotoSans', 'normal');
    doc.text(
      `gustri — ${t('reports.salesReport')} · ${i}/${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' },
    );
  }

  // ASCII-safe filename (collapse the label's punctuation/spaces; fall back if
  // it reduces to nothing, e.g. a non-Latin label).
  const safe = dateRangeLabel.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  doc.save(`Sales_Report_${safe || 'report'}.pdf`);
}

export type { ProfitMetrics, SalesMetrics, StaffMember, WasteMetrics, ZReportData };
