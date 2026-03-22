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
  dateRangeLabel: string;
  formatPrice: (amount: number) => string;
}

export function exportReportToPDF({
  metrics,
  profitMetrics,
  wasteMetrics,
  staffPerformance,
  dateRangeLabel,
  formatPrice,
}: ExportParams) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Sales Report', pageWidth / 2, 20, { align: 'center' });

  // Date range
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${dateRangeLabel}`, pageWidth / 2, 28, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 34, { align: 'center' });

  // Key Metrics Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Metrics', 14, 48);

  const metricsData = [
    ['Total Revenue', `$${metrics.totalRevenue.toFixed(2)}`],
    ['Total Orders', metrics.totalOrders.toString()],
    ['Completed Orders', metrics.completedOrders.toString()],
    ['Cancelled Orders', metrics.cancelledOrders.toString()],
    ['Average Order Value', `$${metrics.averageOrderValue.toFixed(2)}`],
    [
      'Completion Rate',
      `${metrics.totalOrders > 0 ? Math.round((metrics.completedOrders / metrics.totalOrders) * 100) : 0}%`,
    ],
    ['Dine-in Orders', metrics.dineInOrders.toString()],
    ['Takeout Orders', metrics.takeoutOrders.toString()],
    ['Delivery Orders', metrics.deliveryOrders.toString()],
    ['Total Items Sold', metrics.totalItems.toString()],
  ];

  autoTable(doc, {
    startY: 52,
    head: [['Metric', 'Value']],
    body: metricsData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 10 },
  });

  // Profit & Loss Section
  const plStartY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Profit & Loss', 14, plStartY);

  const plData = [
    ['Revenue', formatPrice(metrics.totalRevenue)],
    ['Total Expenses', formatPrice(profitMetrics.totalExpenses)],
    [
      'Net Profit',
      `${profitMetrics.netProfit < 0 ? '-' : ''}${formatPrice(Math.abs(profitMetrics.netProfit))}`,
    ],
    [
      'Profit Margin',
      `${metrics.totalRevenue > 0 ? profitMetrics.profitMargin.toFixed(1) : '0.0'}%`,
    ],
  ];

  autoTable(doc, {
    startY: plStartY + 4,
    head: [['Metric', 'Value']],
    body: plData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 10 },
  });

  if (profitMetrics.byCategory.length > 0) {
    const catStartY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Expense Breakdown by Category', 14, catStartY);

    const catData = profitMetrics.byCategory.map((cat) => [
      cat.name,
      cat.count.toString(),
      formatPrice(cat.total),
      `${profitMetrics.totalExpenses > 0 ? ((cat.total / profitMetrics.totalExpenses) * 100).toFixed(1) : '0.0'}%`,
    ]);

    autoTable(doc, {
      startY: catStartY + 4,
      head: [['Category', 'Count', 'Amount', '% of Total']],
      body: catData,
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38] },
      styles: { fontSize: 10 },
    });
  }

  // Waste Summary Section
  if (wasteMetrics.totalItems > 0) {
    const wasteStartY = doc.lastAutoTable.finalY + 15;
    if (wasteStartY > 240) doc.addPage();
    const wasteY = wasteStartY > 240 ? 20 : wasteStartY;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Waste Summary', 14, wasteY);

    const wasteData = [
      ['Total Waste Cost', formatPrice(wasteMetrics.totalCost)],
      ['Waste Entries', wasteMetrics.totalItems.toString()],
      ['Avg Cost/Entry', formatPrice(wasteMetrics.totalCost / wasteMetrics.totalItems)],
    ];

    autoTable(doc, {
      startY: wasteY + 4,
      head: [['Metric', 'Value']],
      body: wasteData,
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68] },
      styles: { fontSize: 10 },
    });

    if (wasteMetrics.byReason.length > 0) {
      const reasonStartY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Waste by Reason', 14, reasonStartY);

      const reasonData = wasteMetrics.byReason.map((item) => [
        item.reason.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        item.count.toString(),
        formatPrice(item.cost),
        `${wasteMetrics.totalCost > 0 ? ((item.cost / wasteMetrics.totalCost) * 100).toFixed(1) : '0.0'}%`,
      ]);

      autoTable(doc, {
        startY: reasonStartY + 4,
        head: [['Reason', 'Count', 'Cost', '% of Total']],
        body: reasonData,
        theme: 'striped',
        headStyles: { fillColor: [239, 68, 68] },
        styles: { fontSize: 10 },
      });
    }

    if (wasteMetrics.topItems.length > 0) {
      const topWasteStartY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Top Wasted Items', 14, topWasteStartY);

      const topWasteData = wasteMetrics.topItems.map((item, index) => [
        `#${index + 1}`,
        item.name,
        `${item.quantity} ${item.unit}`,
        formatPrice(item.cost),
      ]);

      autoTable(doc, {
        startY: topWasteStartY + 4,
        head: [['Rank', 'Item', 'Quantity', 'Cost']],
        body: topWasteData,
        theme: 'striped',
        headStyles: { fillColor: [239, 68, 68] },
        styles: { fontSize: 10 },
      });
    }
  }

  // Top Items Section
  const topItemsStartY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Sold Items', 14, topItemsStartY);

  if (metrics.soldItems.length > 0) {
    const topItemsData = metrics.soldItems.map((item, index) => [
      `#${index + 1}`,
      item.name,
      item.count.toString(),
      `$${item.revenue.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: topItemsStartY + 4,
      head: [['Rank', 'Item Name', 'Qty Sold', 'Revenue']],
      body: topItemsData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 10 },
    });
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('No items sold in this period', 14, topItemsStartY + 8);
  }

  // Staff Performance Section
  if (staffPerformance.length > 0) {
    const staffStartY = doc.lastAutoTable?.finalY + 15 || topItemsStartY + 20;

    const staffTableStartY = staffStartY > 240 ? 24 : staffStartY + 4;
    if (staffStartY > 240) doc.addPage();

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Staff Performance', 14, staffStartY > 240 ? 20 : staffStartY);

    const staffData = staffPerformance.map((member, index) => [
      `#${index + 1}`,
      member.name,
      member.role.charAt(0).toUpperCase() + member.role.slice(1),
      member.ordersHandled.toString(),
      member.itemsSold.toString(),
      `$${member.revenue.toFixed(2)}`,
      `$${member.ordersHandled > 0 ? (member.revenue / member.ordersHandled).toFixed(2) : '0.00'}`,
      `${member.ordersHandled > 0 ? Math.round((member.completedOrders / member.ordersHandled) * 100) : 0}%`,
    ]);

    autoTable(doc, {
      startY: staffTableStartY,
      head: [['Rank', 'Name', 'Role', 'Orders', 'Items', 'Revenue', 'Avg/Order', 'Completion']],
      body: staffData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
      },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Cafe Idare - Sales Report | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' },
    );
  }

  // Generate filename with date
  const dateStr = dateRangeLabel.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Sales_Report_${dateStr}.pdf`);
}

export type { SalesMetrics, ProfitMetrics, WasteMetrics, StaffMember };
