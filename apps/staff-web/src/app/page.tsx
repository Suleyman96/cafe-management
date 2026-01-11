'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Café İdarə - Staff
              </h1>
              <p className="text-sm text-gray-600">
                Staff Dashboard
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/feedback">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-4xl mb-4">📝</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Customer Feedback
              </h2>
              <p className="text-gray-600 text-sm">
                View and manage customer feedback, complaints, and requests
              </p>
            </div>
          </Link>

          {/* Placeholder for future pages */}
          <Link href="/menu">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-4xl mb-4">🍽️</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Menu Management
              </h2>
              <p className="text-gray-600 text-sm">
                Manage menu items, categories, prices, and images
              </p>
            </div>
          </Link>

          <Link href="/orders">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-4xl mb-4">📊</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Orders
              </h2>
              <p className="text-gray-600 text-sm">
                Manage orders, update status, and process payments
              </p>
            </div>
          </Link>

          <Link href="/tables">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-4xl mb-4">🪑</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Tables
              </h2>
              <p className="text-gray-600 text-sm">
                View table status, manage orders, and handle transfers
              </p>
            </div>
          </Link>

          <Link href="/kitchen">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-4xl mb-4">👨‍🍳</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Kitchen Display
              </h2>
              <p className="text-gray-600 text-sm">
                Kitchen view for preparing orders with real-time updates
              </p>
            </div>
          </Link>

          <Link href="/calls">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-4xl mb-4">🔔</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Waiter Calls
              </h2>
              <p className="text-gray-600 text-sm">
                Respond to customer assistance requests and emergencies
              </p>
            </div>
          </Link>

          <Link href="/reports">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-4xl mb-4">📊</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Reports
              </h2>
              <p className="text-gray-600 text-sm">
                View sales analytics, top items, and performance metrics
              </p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}

