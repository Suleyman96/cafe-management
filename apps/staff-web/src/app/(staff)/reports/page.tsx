'use client';

import { useState, useMemo } from 'react';
import { useOrders, useStaff } from '@/hooks';
import { LoadingSpinner, Button } from '@cafe-idare/ui';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DollarSign,
  TrendingUp,
  Package,
  Users,
  Calendar,
  ChefHat,
  ShoppingBag,
  UserCheck,
  Award,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText
} from 'lucide-react';

type DateRangeType = 'today' | 'week' | 'month' | 'year' | 'custom';
type CustomMode = 'day' | 'month' | 'year';

export default function ReportsPage() {
  const { data: orders, isLoading: loading, error } = useOrders();
  const { data: staff, isLoading: staffLoading } = useStaff();
  const [dateRange, setDateRange] = useState<DateRangeType>('today');

  // Custom date selection state
  const [customMode, setCustomMode] = useState<CustomMode>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Get date range filter - returns { start, end } for the selected period
  const getDateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateRange === 'custom') {
      if (customMode === 'day') {
        const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return { start, end };
      } else if (customMode === 'month') {
        const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
        return { start, end };
      } else if (customMode === 'year') {
        const start = new Date(selectedDate.getFullYear(), 0, 1);
        const end = new Date(selectedDate.getFullYear() + 1, 0, 1);
        return { start, end };
      }
    }

    switch (dateRange) {
      case 'today':
        return { start: today, end: tomorrow };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);
        return { start: weekStart, end: tomorrow };
      case 'month':
        const monthStart = new Date(today);
        monthStart.setDate(today.getDate() - 29);
        return { start: monthStart, end: tomorrow };
      case 'year':
        const yearStart = new Date(today);
        yearStart.setFullYear(today.getFullYear() - 1);
        yearStart.setDate(yearStart.getDate() + 1);
        return { start: yearStart, end: tomorrow };
      default:
        return { start: today, end: tomorrow };
    }
  }, [dateRange, customMode, selectedDate]);

  // Check if we can navigate to next (prevent future dates)
  const canNavigateNext = useMemo(() => {
    const now = new Date();
    if (customMode === 'day') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const selected = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      return selected < today;
    } else if (customMode === 'month') {
      return selectedDate.getFullYear() < now.getFullYear() ||
        (selectedDate.getFullYear() === now.getFullYear() && selectedDate.getMonth() < now.getMonth());
    } else {
      return selectedDate.getFullYear() < now.getFullYear();
    }
  }, [customMode, selectedDate]);

  // Navigate custom date selection
  const navigateDate = (direction: 'prev' | 'next') => {
    if (direction === 'next' && !canNavigateNext) return;

    const newDate = new Date(selectedDate);
    if (customMode === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (customMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (customMode === 'year') {
      newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
    }
    setSelectedDate(newDate);
  };

  // Get today's date string for max attribute
  const todayString = new Date().toISOString().split('T')[0];
  const currentMonthString = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  // Format display for custom selection
  const getCustomDateDisplay = (): string => {
    if (customMode === 'day') {
      return selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
    } else if (customMode === 'month') {
      return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      return selectedDate.getFullYear().toString();
    }
  };

  // Get human-readable date range label
  const getDateRangeLabel = (): string => {
    if (dateRange === 'custom') {
      return getCustomDateDisplay();
    }

    const { start, end } = getDateRange;
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: dateRange === 'year' ? 'numeric' : undefined
    });

    switch (dateRange) {
      case 'today':
        return formatDate(new Date());
      case 'week':
      case 'month':
      case 'year':
        const endDisplay = new Date(end);
        endDisplay.setDate(endDisplay.getDate() - 1);
        return `${formatDate(start)} - ${formatDate(endDisplay)}`;
      default:
        return '';
    }
  };

  // Filter orders by date
  const filteredOrders = orders?.filter((order: any) => {
    const orderDate = new Date(order.created_at);
    return orderDate >= getDateRange.start && orderDate < getDateRange.end;
  }) || [];

  // Calculate metrics
  const metrics = {
    totalRevenue: filteredOrders.reduce((sum: number, order: any) => {
      const orderTotal = order.order_items?.reduce((itemSum: number, item: any) =>
        itemSum + (item.quantity * item.item_price), 0
      ) || 0;
      return sum + orderTotal;
    }, 0),

    totalOrders: filteredOrders.length,

    // Use 'closed' status for completed orders (matches ORDER_STATUS.CLOSED)
    completedOrders: filteredOrders.filter((order: any) => order.status === 'closed').length,

    cancelledOrders: filteredOrders.filter((order: any) => order.status === 'cancelled').length,

    averageOrderValue: filteredOrders.length > 0
      ? filteredOrders.reduce((sum: number, order: any) => {
          const orderTotal = order.order_items?.reduce((itemSum: number, item: any) =>
            itemSum + (item.quantity * item.item_price), 0
          ) || 0;
          return sum + orderTotal;
        }, 0) / filteredOrders.length
      : 0,

    // Use table_id to determine order type (more reliable than source)
    dineInOrders: filteredOrders.filter((order: any) => order.table_id).length,

    takeoutOrders: filteredOrders.filter((order: any) => !order.table_id).length,

    // Calculate total quantity of items sold (not just line items count)
    totalItems: filteredOrders.reduce((sum: number, order: any) =>
      sum + (order.order_items?.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0) || 0), 0
    ),

    // All sold items (sorted by quantity sold)
    soldItems: (() => {
      const itemCounts = new Map<string, { name: string; count: number; revenue: number }>();

      filteredOrders.forEach((order: any) => {
        order.order_items?.forEach((item: any) => {
          const key = item.menu_item_id;
          const current = itemCounts.get(key) || {
            name: item.menu_item?.name_en || 'Unknown',
            count: 0,
            revenue: 0
          };
          itemCounts.set(key, {
            name: current.name,
            count: current.count + item.quantity,
            revenue: current.revenue + (item.quantity * item.item_price)
          });
        });
      });

      return Array.from(itemCounts.values())
        .sort((a, b) => b.count - a.count);
    })()
  };

  // Calculate staff performance metrics
  const staffPerformance = (() => {
    const performanceMap = new Map<string, {
      id: string;
      name: string;
      role: string;
      ordersHandled: number;
      revenue: number;
      itemsSold: number;
      completedOrders: number;
      cancelledOrders: number;
    }>();

    // Initialize with all staff members
    staff?.forEach((member: any) => {
      performanceMap.set(member.id, {
        id: member.id,
        name: member.full_name,
        role: member.role || 'staff',
        ordersHandled: 0,
        revenue: 0,
        itemsSold: 0,
        completedOrders: 0,
        cancelledOrders: 0,
      });
    });

    // Calculate metrics from orders
    filteredOrders.forEach((order: any) => {
      const waiterId = order.assigned_waiter_id;
      if (!waiterId) return;

      const current = performanceMap.get(waiterId);
      if (!current) return;

      const orderTotal = order.order_items?.reduce((sum: number, item: any) =>
        sum + (item.quantity * item.item_price), 0
      ) || 0;

      const itemCount = order.order_items?.reduce((sum: number, item: any) =>
        sum + item.quantity, 0
      ) || 0;

      performanceMap.set(waiterId, {
        ...current,
        ordersHandled: current.ordersHandled + 1,
        revenue: current.revenue + orderTotal,
        itemsSold: current.itemsSold + itemCount,
        completedOrders: current.completedOrders + (order.status === 'closed' ? 1 : 0),
        cancelledOrders: current.cancelledOrders + (order.status === 'cancelled' ? 1 : 0),
      });
    });

    return Array.from(performanceMap.values())
      .filter(p => p.ordersHandled > 0) // Only show staff with orders
      .sort((a, b) => b.revenue - a.revenue);
  })();

  // Export to PDF function
  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Sales Report', pageWidth / 2, 20, { align: 'center' });

    // Date range
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${getDateRangeLabel()}`, pageWidth / 2, 28, { align: 'center' });
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
      ['Completion Rate', `${metrics.totalOrders > 0 ? Math.round((metrics.completedOrders / metrics.totalOrders) * 100) : 0}%`],
      ['Dine-in Orders', metrics.dineInOrders.toString()],
      ['Takeout Orders', metrics.takeoutOrders.toString()],
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

    // Top Items Section
    const topItemsStartY = (doc as any).lastAutoTable.finalY + 15;
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

    // Staff Performance Section (new page if needed)
    if (staffPerformance.length > 0) {
      const staffStartY = (doc as any).lastAutoTable?.finalY + 15 || topItemsStartY + 20;

      // Check if we need a new page
      if (staffStartY > 240) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Staff Performance', 14, 20);

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
          startY: 24,
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
      } else {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Staff Performance', 14, staffStartY);

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
          startY: staffStartY + 4,
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
        { align: 'center' }
      );
    }

    // Generate filename with date
    const dateStr = getDateRangeLabel().replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Sales_Report_${dateStr}.pdf`);
  };

  if (loading || staffLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">Error loading reports</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            <Calendar className="h-4 w-4 inline mr-1" />
            {getDateRangeLabel()}
          </p>
        </div>

        {/* Date Range Filter + Export Button */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {(['today', 'week', 'month', 'year', 'custom'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {range === 'custom' ? 'Custom' : range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          <Button
            onClick={exportToPDF}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Custom Date Picker */}
      {dateRange === 'custom' && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Mode Selection */}
            <div className="flex gap-2">
              <span className="text-sm font-medium text-gray-700 self-center mr-2">View by:</span>
              {(['day', 'month', 'year'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCustomMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    customMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            {/* Date Navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>

              <div className="min-w-[200px] text-center">
                {customMode === 'day' && (
                  <input
                    type="date"
                    value={selectedDate.toISOString().split('T')[0]}
                    max={todayString}
                    onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {customMode === 'month' && (
                  <input
                    type="month"
                    value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`}
                    max={currentMonthString}
                    onChange={(e) => {
                      const [year, month] = e.target.value.split('-');
                      setSelectedDate(new Date(parseInt(year), parseInt(month) - 1, 1));
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {customMode === 'year' && (
                  <select
                    value={selectedDate.getFullYear()}
                    onChange={(e) => setSelectedDate(new Date(parseInt(e.target.value), 0, 1))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                )}
              </div>

              <button
                onClick={() => navigateDate('next')}
                disabled={!canNavigateNext}
                className={`p-2 rounded-lg transition-colors ${
                  canNavigateNext
                    ? 'bg-gray-100 hover:bg-gray-200'
                    : 'bg-gray-50 cursor-not-allowed'
                }`}
              >
                <ChevronRight className={`h-5 w-5 ${canNavigateNext ? 'text-gray-600' : 'text-gray-300'}`} />
              </button>
            </div>

            {/* Quick Jump to Today */}
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Jump to Today
            </button>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Revenue</p>
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold">${metrics.totalRevenue.toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Orders</p>
            <ShoppingBag className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold">{metrics.totalOrders}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Average Order Value</p>
            <TrendingUp className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold">${metrics.averageOrderValue.toFixed(2)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Completion Rate</p>
            <ChefHat className="h-5 w-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold">
            {metrics.totalOrders > 0 
              ? Math.round((metrics.completedOrders / metrics.totalOrders) * 100) 
              : 0}%
          </p>
        </div>
      </div>

      {/* Order Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Order Types</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span>Dine In</span>
              </div>
              <span className="font-medium">{metrics.dineInOrders}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-green-600" />
                <span>Takeout</span>
              </div>
              <span className="font-medium">{metrics.takeoutOrders}</span>
            </div>
          </div>
          {metrics.totalOrders > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex gap-2">
                <div className="flex-1 bg-blue-100 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(metrics.dineInOrders / metrics.totalOrders) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-2">
                <span>Dine In: {Math.round((metrics.dineInOrders / metrics.totalOrders) * 100)}%</span>
                <span>Takeout: {Math.round((metrics.takeoutOrders / metrics.totalOrders) * 100)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Sold Items */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Sold Items</h2>
            <span className="text-sm text-gray-500">{metrics.soldItems.length} items</span>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {metrics.soldItems.map((item, index) => (
              <div key={index} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                  <span className="truncate flex-1">{item.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium">{item.count} sold</p>
                  <p className="text-xs text-gray-600">${item.revenue.toFixed(2)}</p>
                </div>
              </div>
            ))}
            {metrics.soldItems.length === 0 && (
              <p className="text-gray-500 text-center py-4">No items sold yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Order Status Summary */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Order Status Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{metrics.completedOrders}</p>
            <p className="text-sm text-gray-600">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-red-600">{metrics.cancelledOrders}</p>
            <p className="text-sm text-gray-600">Cancelled</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{metrics.totalItems}</p>
            <p className="text-sm text-gray-600">Items Sold</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">
              {metrics.totalOrders > 0
                ? (metrics.totalItems / metrics.totalOrders).toFixed(1)
                : '0'}
            </p>
            <p className="text-sm text-gray-600">Items/Order</p>
          </div>
        </div>
      </div>

      {/* Staff Performance */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Staff Performance</h2>
        </div>

        {staffPerformance.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No staff performance data for this period
          </p>
        ) : (
          <div className="space-y-4">
            {/* Top Performer Highlight */}
            {staffPerformance.length > 0 && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <Award className="h-8 w-8 text-yellow-600" />
                  <div>
                    <p className="text-sm text-yellow-700">Top Performer</p>
                    <p className="text-lg font-bold text-yellow-900">
                      {staffPerformance[0].name}
                    </p>
                    <p className="text-sm text-yellow-700">
                      ${staffPerformance[0].revenue.toFixed(2)} revenue from {staffPerformance[0].ordersHandled} orders
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Staff Leaderboard */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-600">
                    <th className="pb-3 font-medium">Rank</th>
                    <th className="pb-3 font-medium">Staff Member</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium text-right">Orders</th>
                    <th className="pb-3 font-medium text-right">Items</th>
                    <th className="pb-3 font-medium text-right">Revenue</th>
                    <th className="pb-3 font-medium text-right">Avg/Order</th>
                    <th className="pb-3 font-medium text-right">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {staffPerformance.map((member, index) => (
                    <tr key={member.id} className="border-b last:border-0">
                      <td className="py-3">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-200 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{member.name}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          member.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                          member.role === 'waiter' ? 'bg-blue-100 text-blue-800' :
                          member.role === 'kitchen' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 text-right">{member.ordersHandled}</td>
                      <td className="py-3 text-right">{member.itemsSold}</td>
                      <td className="py-3 text-right font-medium text-green-600">
                        ${member.revenue.toFixed(2)}
                      </td>
                      <td className="py-3 text-right">
                        ${member.ordersHandled > 0
                          ? (member.revenue / member.ordersHandled).toFixed(2)
                          : '0.00'}
                      </td>
                      <td className="py-3 text-right">
                        <span className={`font-medium ${
                          member.ordersHandled > 0 &&
                          (member.completedOrders / member.ordersHandled) >= 0.9
                            ? 'text-green-600'
                            : 'text-gray-600'
                        }`}>
                          {member.ordersHandled > 0
                            ? Math.round((member.completedOrders / member.ordersHandled) * 100)
                            : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t mt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{staffPerformance.length}</p>
                <p className="text-xs text-gray-600">Active Staff</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  ${staffPerformance.length > 0
                    ? (staffPerformance.reduce((sum, s) => sum + s.revenue, 0) / staffPerformance.length).toFixed(2)
                    : '0.00'}
                </p>
                <p className="text-xs text-gray-600">Avg Revenue/Staff</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {staffPerformance.length > 0
                    ? (staffPerformance.reduce((sum, s) => sum + s.ordersHandled, 0) / staffPerformance.length).toFixed(1)
                    : '0'}
                </p>
                <p className="text-xs text-gray-600">Avg Orders/Staff</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {staffPerformance.length > 0
                    ? (staffPerformance.reduce((sum, s) => sum + s.itemsSold, 0) / staffPerformance.length).toFixed(1)
                    : '0'}
                </p>
                <p className="text-xs text-gray-600">Avg Items/Staff</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}