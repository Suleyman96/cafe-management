'use client';

import { useState } from 'react';
import { useOrders } from '@/hooks';
import { LoadingSpinner } from '@cafe-idare/ui';
import { 
  DollarSign,
  TrendingUp,
  Package,
  Users,
  Clock,
  Calendar,
  CreditCard,
  ChefHat,
  ShoppingBag
} from 'lucide-react';

export default function ReportsPage() {
  const { data: orders, isLoading: loading, error } = useOrders();
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');

  // Get date range filter
  const getDateFilter = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateRange) {
      case 'today':
        return today;
      case 'week':
        return new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  };

  // Filter orders by date
  const filteredOrders = orders?.filter((order: any) => {
    const orderDate = new Date(order.created_at);
    return orderDate >= getDateFilter();
  }) || [];

  // Calculate metrics
  const metrics = {
    totalRevenue: filteredOrders.reduce((sum: number, order: any) => {
      const orderTotal = order.order_items?.reduce((itemSum: number, item: any) => 
        itemSum + (item.quantity * item.price), 0
      ) || 0;
      return sum + orderTotal;
    }, 0),
    
    totalOrders: filteredOrders.length,
    
    completedOrders: filteredOrders.filter((order: any) => order.status === 'paid').length,
    
    cancelledOrders: filteredOrders.filter((order: any) => order.status === 'cancelled').length,
    
    averageOrderValue: filteredOrders.length > 0 
      ? filteredOrders.reduce((sum: number, order: any) => {
          const orderTotal = order.order_items?.reduce((itemSum: number, item: any) => 
            itemSum + (item.quantity * item.price), 0
          ) || 0;
          return sum + orderTotal;
        }, 0) / filteredOrders.length
      : 0,
    
    dineInOrders: filteredOrders.filter((order: any) => order.source !== 'phone').length,
    
    takeoutOrders: filteredOrders.filter((order: any) => order.source === 'phone').length,
    
    totalItems: filteredOrders.reduce((sum: number, order: any) => 
      sum + (order.order_items?.length || 0), 0
    ),

    topItems: (() => {
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
            revenue: current.revenue + (item.quantity * item.price)
          });
        });
      });

      return Array.from(itemCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    })()
  };

  if (loading) {
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        
        {/* Date Range Filter */}
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                dateRange === range 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

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

        {/* Top Items */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Top Items</h2>
          <div className="space-y-3">
            {metrics.topItems.map((item, index) => (
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
            {metrics.topItems.length === 0 && (
              <p className="text-gray-500 text-center py-4">No items sold yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Order Status Summary */}
      <div className="bg-white rounded-lg shadow p-6">
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
    </div>
  );
}