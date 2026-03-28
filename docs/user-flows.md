# User Flows & Screen Layouts

## System Overview

**Roles:** waiter, admin, kitchen, owner (4 roles)

**Apps:**
- **customer-web** (Next.js, port 3000) -- customer QR ordering
- **staff-web** (Next.js, port 3001) -- staff/admin web dashboard
- **mobile** (React Native / Expo) -- staff mobile app

---

## Customer Flow (customer-web)

### 1. QR Code Scan -> Table Access

```
Scan QR Code
     |
     v
/table/{id}?token=xxx
     |
     +--- Invalid ---> Error Screen
     |
     +--- Valid
          |
          v
+--------------------------+
| Table Landing            |
| - Table number           |
| - Welcome message        |
| - Language selector      |
| - [Browse Menu]          |
+--------------------------+
```

### 2. Menu Browsing & Ordering

```
+--------------------------+
| Menu Screen              |
|                          |
| [Category Tabs]          |
|                          |
| +----------------------+ |
| | Cappuccino     $5.50 | |
| | Popular              | |
| | [+] Add              | |
| +----------------------+ |
|                          |
| [Cart: 3 items]          |
+-----------+--------------+
            | Tap item
            v
+--------------------------+
| Item Detail Modal        |
|                          |
| Image, Name, Price       |
| Description              |
| Allergens / Dietary tags |
|                          |
| Quantity: [- 1 +]        |
| Special notes: [______]  |
|                          |
| [Add to Order $5.50]     |
+-----------+--------------+
            | Tap cart
            v
+--------------------------+
| Cart Screen              |
|                          |
| 2x Cappuccino    $11.00  |
|    Less foam         [x] |
| 1x Croissant      $3.50  |
|                      [x] |
|                          |
| Subtotal: $14.50         |
| Tax (18%): $2.61         |
| Total:     $17.11        |
|                          |
| Order notes: [________]  |
|                          |
| [Place Order]            |
+-----------+--------------+
            | Confirm
            v
+--------------------------+
| Order Confirmation       |
|                          |
| Order Placed!            |
| Order #ORD-001           |
|                          |
| [Track Order]            |
| [Add More Items]         |
+--------------------------+
```

### 3. Order Status Tracking (real-time)

```
+--------------------------+
| Order Status             |
|                          |
| * Pending Approval       |
| o New                    |
| o Preparing              |
| o Ready                  |
| o Served                 |
|                          |
| Items:                   |
| 2x Cappuccino - Pending  |
| 1x Croissant  - Pending  |
|                          |
| [Call Waiter]            |
| [Add More Items]         |
| [Leave Feedback]         |
+--------------------------+
```

Order status changes arrive via Supabase Realtime.

### 4. Call Waiter Flow

```
[Call Waiter]
     |
     v
+--------------------------+
| Call Staff Modal         |
|                          |
| Why do you need help?    |
|                          |
| [Assistance]             |
| [Bill]                   |
| [Question]               |
| [Complaint]              |
| [Emergency]              |
|                          |
| Notes: [______________]  |
|                          |
| [Cancel]  [Send]         |
+-----------+--------------+
            | Send
            v
+--------------------------+
| Waiter Notified!         |
| A staff member will be   |
| with you shortly.        |
+--------------------------+
```

Reasons: assistance, bill, complaint, question, emergency

### 5. Customer Feedback Flow

```
[Leave Feedback]
     |
     v
+--------------------------+
| Feedback Form            |
|                          |
| Type:                    |
| [Food Quality]           |
| [Service] [Staff]        |
| [Menu Question]          |
| [General Request]        |
| [Praise]                 |
|                          |
| Subject: [____________]  |
| Message: [____________]  |
|                          |
| [Cancel]  [Submit]       |
+-----------+--------------+
            |
            v
   Feedback submitted!
   (appears on staff-web
    and mobile for staff
    to acknowledge/resolve)
```

---

## Mobile App (React Native / Expo)

### Navigation Structure

**Bottom Tabs** (role-filtered):

| Tab      | waiter | admin | owner | kitchen |
|----------|--------|-------|-------|---------|
| Tables   | yes    | yes   | yes   | --      |
| Orders   | yes    | yes   | yes   | yes     |
| Kitchen  | --     | yes   | yes   | yes     |
| Calls    | yes    | yes   | yes   | --      |
| Profile  | yes    | yes   | yes   | yes     |

**Drawer Menu** (role-filtered, additional screens):

| Section    | Screen          | waiter | admin | owner | kitchen |
|------------|-----------------|--------|-------|-------|---------|
| Main       | Delivery        | yes    | yes   | yes   | --      |
| Main       | Tasks           | yes    | yes   | yes   | yes     |
| Management | Feedback        | yes    | yes   | yes   | --      |
| Management | Stock           | --     | yes   | yes   | --      |
| Management | Waste           | yes    | yes   | yes   | yes     |
| Management | Expenses        | --     | yes   | yes   | --      |
| Admin      | Staff           | --     | yes   | yes   | --      |
| Admin      | Menu            | --     | yes   | yes   | --      |
| Admin      | Schedules       | --     | yes   | yes   | --      |
| Admin      | Reports         | --     | --    | yes   | --      |
| Admin      | Cafe Settings   | --     | yes   | yes   | --      |

### Waiter: Tables Tab

```
+--------------------------+
| Tables Tab               |
|                          |
| Filter: [All] [Free]    |
|         [Occupied]       |
|                          |
| +----+ +----+ +----+    |
| |T01 | |T02 | |T03 |    |
| |Free| |Free| |Busy|    |
| +----+ +----+ +----+    |
|                          |
| Pending Calls: 3         |
| New Orders: 2            |
+-----------+--------------+
            | Tap occupied table
            v
+--------------------------+
| Table Detail             |
|                          |
| Table T03                |
| Occupied: 15 min         |
|                          |
| Order #ORD-001           |
| Status: Preparing        |
| Items: 3                 |
| Total: $27.50            |
|                          |
| [Update Status]          |
| [Add Items]              |
| [Transfer Table]         |
| [Close Table]            |
+--------------------------+
```

### Waiter: Orders Tab

```
+--------------------------+
| Orders Tab               |
|                          |
| Filter: [Active] [All]  |
|                          |
| NEW (2)                  |
| +----------------------+ |
| | ORD-003 | T05        | |
| | $15.50 | 5 min       | |
| +----------------------+ |
|                          |
| PREPARING (3)            |
| +----------------------+ |
| | ORD-001 | T03        | |
| | $27.50 | 15 min      | |
| +----------------------+ |
|                          |
| READY (1)                |
| +----------------------+ |
| | ORD-002 | T07        | |
| | $18.00 | 20 min      | |
| +----------------------+ |
+-----------+--------------+
            | Tap order
            v
+--------------------------+
| Order Detail             |
|                          |
| Order #ORD-001           |
| Table T03                |
| Status: Preparing        |
|                          |
| Items:                   |
| 2x Cappuccino    $11.00  |
|    "Less foam"           |
| 1x Croissant      $3.50  |
|                          |
| Subtotal: $14.50         |
| Tax: $2.61               |
| Total: $17.11            |
|                          |
| [Mark Ready]             |
| [Mark Served]            |
| [Add More Items]         |
+--------------------------+
```

### Kitchen: Orders Display (read-only in mobile)

```
+--------------------------+
| Kitchen Display          |
|                          |
| NEW (2)  PREP (4)       |
|                          |
| +--------+ +--------+   |
| |ORD-003 | |ORD-001 |   |
| |T05     | |T03     |   |
| |NEW     | |PREP    |   |
| |2min    | |15min   |   |
| |        | |        |   |
| |2x Capp.| |2x Capp.|   |
| |  Less  | |1x Crois|   |
| |  foam  | |        |   |
| |1x Salad| |        |   |
| |        | |        |   |
| |[Start] | |[Ready] |   |
| +--------+ +--------+   |
|                          |
| Sound: ON  Alerts: ON   |
+--------------------------+
```

Kitchen role sees only Orders tab and Kitchen tab (plus Profile). Order cards show items and notes. Tapping a card shows item-level detail.

---

## Staff Web Dashboard (staff-web)

Next.js app at port 3001 with sidebar navigation. All admin/owner features are accessible via browser.

### Sidebar Navigation

```
+-- MAIN ----------------+
| Tables                  |
| Orders                  |
| Delivery                |
| Kitchen                 |
| Waiter Calls            |
| Tasks                   |
+-- MANAGEMENT -----------+
| Feedback                |
| Stock (admin+)          |
| Waste                   |
| Expenses (admin+)       |
+-- ADMIN (admin+) -------+
| Staff                   |
| Menu                    |
| Schedules               |
| Reports (owner only)    |
| Cafe Settings           |
+-------------------------+
| My Tasks indicator      |
| Today's Shift indicator |
| [User] [Settings]       |
| [Logout]                |
+-------------------------+
```

Visibility rules:
- Waste link hidden if cafe_settings.waste_tracking_enabled is false
- Reports visible to owner only
- Stock, Expenses, and entire Admin section visible to admin + owner

---

## Dine-in Order Status Flow

```
pending_approval --> new --> preparing --> ready --> served --> closed
                                                       |
                                                       +-- (payment) --> closed
```

- Customer QR orders start at `pending_approval` (staff must approve)
- Staff-created orders start at `new`
- `closed` requires full payment
- `cancelled` possible from any active status

## Delivery Order Status Flow

```
new --> preparing --> ready --> out_for_delivery --> delivered --> closed
```

### Create Delivery Order

```
+--------------------------+
| New Delivery Order       |
|                          |
| Customer Name *          |
| Phone Number *           |
| Delivery Address *       |
| Delivery Notes           |
| Delivery Fee             |
|                          |
| (Order created without   |
|  items. Add items after) |
|                          |
| [Cancel]  [Create Order] |
+--------------------------+
```

### Delivery List Screen

```
+--------------------------+
| Delivery Orders          |
|                          |
| 3 active                 |
|                          |
| Search: [______________] |
|                          |
| [all] [new] [preparing]  |
| [ready] [out_for_deliv.] |
| [delivered] [cancelled]  |
|                          |
| +----------------------+ |
| | #abc123 - John Doe   | |
| | 123 Main St          | |
| | Status: Preparing     | |
| | [Mark Ready]          | |
| +----------------------+ |
|                          |
| [+ New Delivery]         |
+--------------------------+
```

Actions per status:
- pending_approval: [Approve]
- new: [Start Preparing]
- preparing: [Mark Ready]
- ready: [Send Out for Delivery]
- out_for_delivery: [Mark Delivered]
- Any active: [Cancel] (requires reason)

---

## Table Transfer Flow

```
+--------------------------+
| Transfer Table T03       |
|                          |
| Transfer to:             |
| [Select Table v]         |
|  T01 - Window (free)     |
|  T04 - Patio (occupied)  |
|  T06 - Main (free)       |
|                          |
| (!) Warning if target    |
|     table is occupied    |
|                          |
| Reason (optional):       |
| [____________________]   |
|                          |
| [Cancel] [Transfer]      |
+--------------------------+
```

Moves the active order from the source table to the target table. Source table becomes free, target becomes occupied.

---

## Payment & Split Payment Flow

```
Order Detail --> [Payment]
     |
     v
+--------------------------+
| Payment Modal            |
|                          |
| Remaining: $17.11        |
|                          |
| Mode:                    |
| (*) Full Payment         |
| ( ) Partial Amount       |
| ( ) Specific Items       |
|                          |
| Method: [Cash|Card|Digital]
| Tip: [______]            |
|                          |
| [Cancel]  [Process]      |
+-----------+--------------+
```

**Payment types (PAYMENT_TYPE):**
- `full` -- pay full remaining balance
- `partial_amount` -- pay a custom amount
- `specific_items` -- select individual items to pay for

**Payment methods:** cash, card, digital

When fully paid, order can be moved to `closed`.

---

## Customer Feedback Flow (Staff Side)

```
+--------------------------+
| Feedback                 |
|                          |
| [All] [Pending*3]        |
| [Acknowledged] [Resolved]|
| [Dismissed]              |
|                          |
| +----------------------+ |
| | Complaint: Food      | |
| | Table T05            | |
| | "Pizza was cold"     | |
| | Status: pending      | |
| |                      | |
| | [Acknowledge]        | |
| | [Respond]  [Dismiss] | |
| +----------------------+ |
+-----------+--------------+
            | Respond
            v
+--------------------------+
| Write response:          |
| [____________________]   |
| [Send Response] [Cancel] |
+--------------------------+
     |
     v
Feedback status -> resolved
```

**Feedback statuses:** pending -> acknowledged -> resolved | dismissed

**Feedback types:** complaint_food, complaint_service, complaint_staff, question_menu, request_general, praise

---

## Task Management Flow

```
+--------------------------+
| Tasks                    |
|                          |
| [Today] [All] [My]      |
| [Templates]              |
|                          |
| Overdue: 2               |
|                          |
| +----------------------+ |
| | Clean tables         | |
| | Priority: high       | |
| | Assigned: John       | |
| | Due: 2:00 PM         | |
| | Status: pending      | |
| |                      | |
| | [Start] [Edit] [Del] | |
| +----------------------+ |
|                          |
| [+ Add Task]             |
+-----------+--------------+
            | + Add Task
            v
+--------------------------+
| Create/Edit Task         |
|                          |
| Title: [______________]  |
| Description: [________]  |
| Priority: [low|normal|   |
|            high|urgent]  |
| Assigned to: [Staff v]   |
| Due date: [__________]   |
|                          |
| Recurring:               |
| [ ] Enable               |
| Pattern: [daily|weekly|  |
|           monthly]       |
|                          |
| [Cancel]  [Save]         |
+--------------------------+
```

**Task statuses:** pending -> in_progress -> completed | cancelled

**Priorities:** low, normal, high, urgent

Recurring tasks use templates that auto-generate daily/weekly/monthly instances.

---

## Staff Scheduling Flow

```
+--------------------------+
| Schedules (Weekly View)  |
|                          |
| [< Prev Week] [Next >]  |
| [Week View] [Month View] |
|                          |
|       Mon   Tue   Wed    |
| John  9-17  --    9-17   |
| Jane  --    9-17  9-17   |
|                          |
| Status colors:           |
| gray=scheduled           |
| blue=in_progress         |
| green=completed          |
| red=missed               |
|                          |
| [+ Add Schedule]         |
+-----------+--------------+
            | + Add Schedule
            v
+--------------------------+
| Create Schedule          |
|                          |
| Staff: [Select v]        |
| Date: [__________]       |
| Start: [__:__]           |
| End:   [__:__]           |
| Notes: [__________]      |
|                          |
| [Cancel]  [Save]         |
+--------------------------+
```

**Schedule statuses:** scheduled -> in_progress -> completed | missed

Sidebar shows "Today's Shift" indicator for logged-in staff.

---

## Inventory / Stock Flow

Admin + Owner only.

```
+--------------------------+
| Stock Items              |
|                          |
| Low stock alerts: 3      |
| Search: [______________] |
| Category: [All v]        |
|                          |
| +----------------------+ |
| | Coffee Beans         | |
| | Qty: 5 kg            | |
| | Min: 10 kg           | |
| | LOW STOCK            | |
| | [Stock In] [Stock Out]| |
| | [Edit] [History]     | |
| +----------------------+ |
|                          |
| [+ Add Item]             |
+-----------+--------------+
            | Stock In/Out
            v
+--------------------------+
| Stock Movement           |
|                          |
| Item: Coffee Beans       |
| Type: [In | Out |        |
|        Adjustment]       |
| Quantity: [____]         |
| Notes: [______________]  |
|                          |
| [Cancel]  [Save]         |
+--------------------------+
```

**Movement types:** in, out, adjustment

**Stock units:** pieces, kg, liters, boxes, bags

Items have min_quantity thresholds; low-stock count shown in header.

---

## Expense Tracking Flow

Admin + Owner only.

```
+--------------------------+
| Expenses                 |
|                          |
| Month: [March 2026 v]    |
| Category: [All v]        |
| Payment: [All v]         |
|                          |
| Monthly Summary:         |
| Total: $1,250            |
| Count: 15                |
|                          |
| +----------------------+ |
| | Milk delivery        | |
| | $120.00 | Cash       | |
| | Category: Supplies   | |
| | [Edit] [Delete]      | |
| +----------------------+ |
|                          |
| [+ Add Expense]          |
| [Manage Categories]      |
+-----------+--------------+
            | + Add Expense
            v
+--------------------------+
| Add/Edit Expense         |
|                          |
| Description: [________]  |
| Amount: [______]         |
| Category: [Select v]     |
| Payment: [cash|card|     |
|   digital|bank_transfer] |
| Date: [__________]       |
| Notes: [______________]  |
|                          |
| [Cancel]  [Save]         |
+--------------------------+
```

**Expense payment methods:** cash, card, digital, bank_transfer

---

## Waste Logging Flow

Visible to all roles (can be disabled in Cafe Settings).

```
+--------------------------+
| Waste Log                |
|                          |
| Month: [March 2026 v]    |
| Reason: [All v]          |
|                          |
| Monthly Summary:         |
| Total waste cost: $85    |
| Entries: 12              |
|                          |
| +----------------------+ |
| | Coffee Beans - 0.5kg | |
| | Reason: Expired      | |
| | Cost: $15.00         | |
| | [Edit] [Delete]      | |
| +----------------------+ |
|                          |
| [+ Log Waste]            |
+-----------+--------------+
            | + Log Waste
            v
+--------------------------+
| Log Waste                |
|                          |
| Item name: [__________]  |
| Quantity: [____]         |
| Unit: [kg|pcs|liters|    |
|        boxes|bags]       |
| Reason: [expired|spoiled||
|   overcooked|dropped|    |
|   returned_by_customer|  |
|   preparation_waste|     |
|   other]                 |
| Cost estimate: [______]  |
| Stock item: [Select v]   |
| Notes: [______________]  |
|                          |
| [Cancel]  [Save]         |
+--------------------------+
```

**Waste reasons:** expired, spoiled, overcooked, dropped, returned_by_customer, preparation_waste, other

---

## Waiter Call Handling (Staff Side)

```
+--------------------------+
| Waiter Calls             |
|                          |
| Pending (3)              |
| +----------------------+ |
| | Table T05            | |
| | Reason: Bill         | |
| | Priority: normal     | |
| | 2 min ago            | |
| |                      | |
| | [Acknowledge]        | |
| +----------------------+ |
+-----------+--------------+
            | Acknowledge
            v
  Status: acknowledged
            |
            | (serve the table)
            v
  Status: resolved
```

**Call statuses:** pending -> acknowledged -> resolved

**Reasons:** assistance, bill, complaint, question, emergency

**Priorities:** low, normal, high, urgent

---

## Menu Management (Admin)

```
+--------------------------+
| Menu                     |
|                          |
| Search: [______________] |
| [+ Add Item]             |
| [+ Add Category]         |
|                          |
| Category: Hot Drinks (12)|
| +----------------------+ |
| | Cappuccino    $5.50  | |
| | Available            | |
| | [Edit] [Toggle] [Del]| |
| +----------------------+ |
+-----------+--------------+
            | Edit
            v
+--------------------------+
| Edit Menu Item           |
|                          |
| Image: [Upload]          |
|                          |
| Name:                    |
| [Cappuccino          ]   |
|                          |
| Description:             |
| [Rich espresso with... ] |
|                          |
| Price: [5.50]            |
| Category: [Hot Drinks v] |
| Prep Time: [5 min v]     |
|                          |
| [x] Available            |
| [x] Popular              |
| [x] Vegetarian           |
| [ ] Vegan                |
| [ ] Gluten Free          |
|                          |
| Allergens: [+ Add]       |
|                          |
| [Save]  [Delete Item]    |
+--------------------------+
```

---

## Staff Management (Admin)

```
+--------------------------+
| Staff Management         |
|                          |
| [+ Add Staff]            |
|                          |
| Active Staff (5)         |
| +----------------------+ |
| | John Doe             | |
| | Role: Waiter         | |
| | Active               | |
| | [Edit]               | |
| +----------------------+ |
+-----------+--------------+
            | + Add Staff
            v
+--------------------------+
| Add Staff Member         |
|                          |
| Full Name: [__________]  |
| Email:     [__________]  |
| Phone:     [__________]  |
|                          |
| Role: [Select v]         |
|  - Waiter                |
|  - Kitchen               |
|  - Admin                 |
|  - Owner (owner only)    |
|                          |
| Password: [__________]   |
|                          |
| [Create Account]         |
+--------------------------+
```

Owner role option only visible when the current user is an owner.

---

## Reports (Owner Only)

```
+--------------------------+
| Reports                  |
|                          |
| Date Range: [Today v]    |
|  Today / This Week /     |
|  This Month / Custom     |
|                          |
| Sales Summary            |
| Total Revenue: $1,250    |
| Orders: 45               |
| Avg Order: $27.79        |
| Tables Served: 28        |
|                          |
| Popular Items            |
| 1. Cappuccino (35)       |
| 2. Croissant (28)        |
|                          |
| Staff Performance        |
| 1. John Doe - $350       |
| 2. Jane Smith - $280     |
|                          |
| [Export]                  |
+--------------------------+
```

---

## Color Coding

### Order Status
- Pending Approval: amber
- New: red (urgent)
- Preparing: yellow (in progress)
- Ready: green (complete)
- Served: gray
- Out for Delivery: purple
- Delivered: green
- Closed: dark gray
- Cancelled: red strikethrough

### Table Status
- Free: green
- Occupied: red/orange
- Reserved: yellow/blue
- Closed: gray

### Priority Indicators
- urgent: red
- high: orange
- normal: blue
- low: gray
