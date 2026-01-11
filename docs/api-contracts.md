# API Contracts

## Overview

API endpoints for Café İdarə system using Supabase auto-generated REST API with custom Edge Functions where needed.

**Base URL**: `https://your-project.supabase.co`

**Authentication**: JWT tokens (staff only) via `Authorization: Bearer <token>` header

## Authentication

### POST /auth/v1/signup
**Scope**: Admin only (create staff accounts)

**Request**:
```json
{
  "email": "waiter@cafe.com",
  "password": "securePassword123",
  "options": {
    "data": {
      "full_name": "John Doe",
      "role": "waiter",
      "phone": "+994501234567"
    }
  }
}
```

**Response** (201):
```json
{
  "user": {
    "id": "uuid",
    "email": "waiter@cafe.com",
    "user_metadata": {
      "full_name": "John Doe",
      "role": "waiter"
    }
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_in": 3600
  }
}
```

### POST /auth/v1/token?grant_type=password
**Scope**: All staff

**Request**:
```json
{
  "email": "waiter@cafe.com",
  "password": "securePassword123"
}
```

**Response** (200):
```json
{
  "access_token": "jwt_token",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_token",
  "user": {
    "id": "uuid",
    "email": "waiter@cafe.com",
    "role": "waiter"
  }
}
```

### POST /auth/v1/token?grant_type=refresh_token
**Scope**: All staff

**Request**:
```json
{
  "refresh_token": "refresh_token"
}
```

**Response** (200):
```json
{
  "access_token": "new_jwt_token",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "new_refresh_token"
}
```

## Tables

### GET /rest/v1/tables
**Scope**: Staff (all), Customers (single table via QR)

**Query Parameters**:
- `status=eq.free` - Filter by status
- `is_active=eq.true` - Only active tables
- `select=*` - Columns to return

**Response** (200):
```json
[
  {
    "id": "uuid",
    "table_number": "T01",
    "capacity": 4,
    "status": "free",
    "location": "Window",
    "qr_code": "encrypted_token",
    "is_active": true,
    "occupied_at": null,
    "current_session_id": null
  }
]
```

### GET /rest/v1/tables?id=eq.{table_id}
**Scope**: Customers (via QR token), Staff

**Response** (200):
```json
{
  "id": "uuid",
  "table_number": "T01",
  "capacity": 4,
  "status": "occupied",
  "location": "Window",
  "occupied_at": "2025-12-15T10:30:00Z",
  "current_session_id": "order_uuid"
}
```

### PATCH /rest/v1/tables?id=eq.{table_id}
**Scope**: Waiter, Admin

**Request**:
```json
{
  "status": "free",
  "current_session_id": null
}
```

**Response** (200):
```json
{
  "id": "uuid",
  "status": "free",
  "updated_at": "2025-12-15T11:00:00Z"
}
```

## Menu

### GET /rest/v1/categories
**Scope**: Public (with RLS - only active)

**Query Parameters**:
- `is_active=eq.true`
- `order=display_order.asc`

**Response** (200):
```json
[
  {
    "id": "uuid",
    "name_en": "Hot Drinks",
    "name_az": "İsti İçkilər",
    "icon": "coffee",
    "display_order": 1,
    "is_active": true
  }
]
```

### GET /rest/v1/menu_items
**Scope**: Public (with RLS - only available items)

**Query Parameters**:
- `category_id=eq.{category_id}`
- `is_available=eq.true`
- `order=display_order.asc`
- `select=*,categories(name_en,name_az)` - Join with categories

**Response** (200):
```json
[
  {
    "id": "uuid",
    "category_id": "uuid",
    "name_en": "Cappuccino",
    "name_az": "Kapuçino",
    "description_en": "Classic Italian coffee with steamed milk",
    "price": 5.50,
    "image_url": "https://storage.supabase.co/...",
    "preparation_time": 5,
    "is_popular": true,
    "is_vegetarian": true,
    "allergens": ["milk"],
    "is_available": true,
    "categories": {
      "name_en": "Hot Drinks",
      "name_az": "İsti İçkilər"
    }
  }
]
```

### POST /rest/v1/menu_items
**Scope**: Admin only

**Request**:
```json
{
  "category_id": "uuid",
  "name_en": "Latte",
  "name_az": "Latte",
  "description_en": "Espresso with steamed milk",
  "price": 6.00,
  "image_url": "https://storage.supabase.co/...",
  "preparation_time": 5,
  "is_vegetarian": true,
  "allergens": ["milk"],
  "is_available": true
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "name_en": "Latte",
  "price": 6.00,
  "created_at": "2025-12-15T12:00:00Z"
}
```

### PATCH /rest/v1/menu_items?id=eq.{item_id}
**Scope**: Admin only

**Request**:
```json
{
  "price": 6.50,
  "is_available": false
}
```

**Response** (200):
```json
{
  "id": "uuid",
  "price": 6.50,
  "is_available": false,
  "updated_at": "2025-12-15T12:30:00Z"
}
```

## Orders

### GET /rest/v1/orders
**Scope**: Staff (all orders), Customers (their table's order)

**Query Parameters**:
- `table_id=eq.{table_id}`
- `status=in.(new,preparing,ready)` - Filter active orders
- `order=created_at.desc`
- `select=*,tables(table_number),order_items(*)` - Include related data

**Response** (200):
```json
[
  {
    "id": "uuid",
    "order_number": "ORD-20251215-001",
    "table_id": "uuid",
    "status": "preparing",
    "subtotal": 15.00,
    "tax": 2.70,
    "total": 17.70,
    "customer_notes": "Extra napkins please",
    "created_at": "2025-12-15T10:30:00Z",
    "preparing_at": "2025-12-15T10:32:00Z",
    "tables": {
      "table_number": "T01"
    },
    "order_items": [
      {
        "id": "uuid",
        "menu_item_id": "uuid",
        "item_name": "Cappuccino",
        "item_price": 5.50,
        "quantity": 2,
        "notes": "Less foam",
        "status": "preparing"
      }
    ]
  }
]
```

### POST /rest/v1/orders
**Scope**: Customers (their table), Waiters

**Request**:
```json
{
  "table_id": "uuid",
  "customer_notes": "No sugar",
  "assigned_waiter_id": "uuid" // Optional, for waiter-created orders
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "order_number": "ORD-20251215-002",
  "table_id": "uuid",
  "status": "new",
  "subtotal": 0,
  "tax": 0,
  "total": 0,
  "created_at": "2025-12-15T11:00:00Z"
}
```

### PATCH /rest/v1/orders?id=eq.{order_id}
**Scope**: Waiter, Admin

**Request**:
```json
{
  "status": "preparing",
  "preparing_at": "2025-12-15T11:02:00Z"
}
```

**Response** (200):
```json
{
  "id": "uuid",
  "status": "preparing",
  "preparing_at": "2025-12-15T11:02:00Z",
  "updated_at": "2025-12-15T11:02:00Z"
}
```

## Order Items

### POST /rest/v1/order_items
**Scope**: Customers (for their orders), Waiters

**Request**:
```json
{
  "order_id": "uuid",
  "menu_item_id": "uuid",
  "item_name": "Cappuccino",
  "item_price": 5.50,
  "quantity": 2,
  "notes": "Extra hot"
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "order_id": "uuid",
  "menu_item_id": "uuid",
  "item_name": "Cappuccino",
  "item_price": 5.50,
  "quantity": 2,
  "notes": "Extra hot",
  "status": "pending",
  "created_at": "2025-12-15T11:05:00Z"
}
```

**Note**: Order total is auto-calculated via database trigger.

### PATCH /rest/v1/order_items?id=eq.{item_id}
**Scope**: Kitchen, Waiter, Admin

**Request**:
```json
{
  "status": "ready"
}
```

**Response** (200):
```json
{
  "id": "uuid",
  "status": "ready",
  "updated_at": "2025-12-15T11:10:00Z"
}
```

### DELETE /rest/v1/order_items?id=eq.{item_id}
**Scope**: Customers (before preparing), Waiter, Admin

**Response** (204): No content

## Waiter Calls

### GET /rest/v1/waiter_calls
**Scope**: Staff (all calls), Customers (their calls)

**Query Parameters**:
- `status=eq.pending`
- `order=created_at.desc`
- `select=*,tables(table_number,location)`

**Response** (200):
```json
[
  {
    "id": "uuid",
    "table_id": "uuid",
    "reason": "assistance",
    "status": "pending",
    "created_at": "2025-12-15T11:20:00Z",
    "tables": {
      "table_number": "T05",
      "location": "Corner"
    }
  }
]
```

### POST /rest/v1/waiter_calls
**Scope**: Customers

**Request**:
```json
{
  "table_id": "uuid",
  "reason": "bill"
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "table_id": "uuid",
  "reason": "bill",
  "status": "pending",
  "created_at": "2025-12-15T11:25:00Z"
}
```

### PATCH /rest/v1/waiter_calls?id=eq.{call_id}
**Scope**: Waiter, Admin

**Request**:
```json
{
  "status": "acknowledged",
  "responded_by": "staff_uuid",
  "acknowledged_at": "2025-12-15T11:26:00Z"
}
```

**Response** (200):
```json
{
  "id": "uuid",
  "status": "acknowledged",
  "responded_by": "staff_uuid",
  "acknowledged_at": "2025-12-15T11:26:00Z"
}
```

## Staff Management

### GET /rest/v1/staff
**Scope**: Staff (read all), Admin (full access)

**Response** (200):
```json
[
  {
    "id": "uuid",
    "email": "waiter@cafe.com",
    "full_name": "John Doe",
    "role": "waiter",
    "phone": "+994501234567",
    "is_active": true,
    "created_at": "2025-12-01T09:00:00Z",
    "last_login_at": "2025-12-15T08:00:00Z"
  }
]
```

### POST /rest/v1/staff
**Scope**: Admin only

**Request**:
```json
{
  "email": "kitchen@cafe.com",
  "full_name": "Jane Smith",
  "role": "kitchen",
  "phone": "+994501234568"
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "email": "kitchen@cafe.com",
  "full_name": "Jane Smith",
  "role": "kitchen",
  "is_active": true,
  "created_at": "2025-12-15T12:00:00Z"
}
```

### PATCH /rest/v1/staff?id=eq.{staff_id}
**Scope**: Admin only

**Request**:
```json
{
  "is_active": false
}
```

**Response** (200):
```json
{
  "id": "uuid",
  "is_active": false,
  "updated_at": "2025-12-15T12:30:00Z"
}
```

## Views & Reports

### GET /rest/v1/active_orders_view
**Scope**: Kitchen, Waiter, Admin

**Response** (200):
```json
[
  {
    "id": "uuid",
    "order_number": "ORD-20251215-001",
    "status": "preparing",
    "table_number": "T01",
    "location": "Window",
    "waiter_name": "John Doe",
    "item_count": 3,
    "total_quantity": 5,
    "total": 27.50,
    "minutes_elapsed": 8,
    "items": [
      {
        "item_name": "Cappuccino",
        "quantity": 2,
        "notes": "Extra hot",
        "status": "preparing"
      }
    ]
  }
]
```

### GET /rest/v1/sales_summary_view
**Scope**: Admin only

**Query Parameters**:
- `date=gte.2025-12-01&date=lte.2025-12-15` - Date range

**Response** (200):
```json
[
  {
    "date": "2025-12-15",
    "order_count": 45,
    "total_revenue": 1250.50,
    "average_order_value": 27.79,
    "tables_served": 28,
    "avg_service_time_minutes": 22.5
  }
]
```

## Custom Edge Functions

### POST /functions/v1/generate-qr-codes
**Scope**: Admin only

**Description**: Generate QR codes for all tables or specific tables.

**Request**:
```json
{
  "table_ids": ["uuid1", "uuid2"], // Optional, if omitted generates for all
  "regenerate": false // If true, regenerates existing codes
}
```

**Response** (200):
```json
{
  "success": true,
  "generated": 15,
  "qr_codes": [
    {
      "table_id": "uuid",
      "table_number": "T01",
      "qr_code": "encrypted_token",
      "qr_url": "https://cafe.example.com/table/uuid?token=encrypted_token",
      "qr_image_url": "https://storage.supabase.co/qr-codes/T01.png"
    }
  ]
}
```

### POST /functions/v1/close-table
**Scope**: Waiter, Admin

**Description**: Close table session, mark order as closed, free up table.

**Request**:
```json
{
  "table_id": "uuid",
  "payment_method": "cash" // Optional: 'cash', 'card'
}
```

**Response** (200):
```json
{
  "success": true,
  "order_id": "uuid",
  "table_number": "T01",
  "total": 27.50,
  "closed_at": "2025-12-15T12:00:00Z"
}
```

### GET /functions/v1/reports/daily-sales
**Scope**: Admin only

**Query Parameters**:
- `date=2025-12-15` - Specific date (default: today)

**Response** (200):
```json
{
  "date": "2025-12-15",
  "summary": {
    "total_orders": 45,
    "total_revenue": 1250.50,
    "average_order_value": 27.79,
    "tables_served": 28
  },
  "hourly_breakdown": [
    {
      "hour": "09:00",
      "orders": 5,
      "revenue": 125.50
    }
  ],
  "popular_items": [
    {
      "item_name": "Cappuccino",
      "quantity_sold": 35,
      "revenue": 192.50
    }
  ],
  "waiter_performance": [
    {
      "waiter_name": "John Doe",
      "orders_handled": 12,
      "total_sales": 350.00
    }
  ]
}
```

## Real-Time Subscriptions

### WebSocket Channel: orders:kitchen
**Scope**: Kitchen, Waiter, Admin

**Events**:
- `INSERT` - New order created
- `UPDATE` - Order status changed

**Payload**:
```json
{
  "schema": "public",
  "table": "orders",
  "commit_timestamp": "2025-12-15T11:00:00Z",
  "eventType": "INSERT",
  "new": {
    "id": "uuid",
    "order_number": "ORD-20251215-001",
    "table_id": "uuid",
    "status": "new"
  },
  "old": {}
}
```

### WebSocket Channel: orders:table_{table_id}
**Scope**: Customers for their table

**Events**:
- `UPDATE` - Order status changed
- `INSERT` on order_items - New item added

### WebSocket Channel: waiter_calls
**Scope**: Waiter, Admin

**Events**:
- `INSERT` - New waiter call
- `UPDATE` - Waiter call status changed

## Error Responses

### 400 Bad Request
```json
{
  "code": "PGRST102",
  "message": "Invalid request",
  "details": "Missing required field: table_id"
}
```

### 401 Unauthorized
```json
{
  "code": "PGRST301",
  "message": "JWT expired"
}
```

### 403 Forbidden
```json
{
  "code": "42501",
  "message": "new row violates row-level security policy",
  "details": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "code": "PGRST116",
  "message": "The result contains 0 rows"
}
```

### 500 Internal Server Error
```json
{
  "code": "PGRST500",
  "message": "Internal server error",
  "details": "Database connection failed"
}
```

## Rate Limiting

- **Public endpoints** (menu, categories): 60 requests/minute per IP
- **Authenticated endpoints**: 120 requests/minute per user
- **WebSocket connections**: Max 5 concurrent per user

## Pagination

Use `Range` header for pagination:

**Request**:
```
GET /rest/v1/orders
Range: 0-9
```

**Response**:
```
Content-Range: 0-9/45
```

Returns items 0-9 out of 45 total.


