# User Flows & Screen Layouts

## Customer Flow (Web App)

### 1. QR Code Scan → Table Access

```
┌────────────────┐
│  Scan QR Code  │
└────────┬───────┘
         │
         v
┌────────────────────────┐
│ Redirect to Web App    │
│ /table/{id}?token=xxx  │
└────────┬───────────────┘
         │
         v
┌────────────────────────┐
│ Validate Table Token   │
│ Check table status     │
└────────┬───────────────┘
         │
         ├─── Invalid ──────> Error Screen
         │
         └─── Valid
              │
              v
┌────────────────────────┐
│ Table Landing Screen   │
│ - Table number         │
│ - Welcome message      │
│ - Language selector    │
│ - [Browse Menu] button │
└────────┬───────────────┘
         │
         v
    Menu Screen
```

### 2. Menu Browsing & Ordering

```
┌─────────────────────────┐
│    Menu Screen          │
│                         │
│  [Categories Tabs]      │
│  ┌─ Hot Drinks ─┐       │
│  │ Cold Drinks  │       │
│  │ Food         │       │
│  └──────────────┘       │
│                         │
│  ┌──────────────────┐   │
│  │ 📷 Cappuccino    │   │
│  │ €5.50            │   │
│  │ ⭐ Popular       │   │
│  │ [+] Add          │   │
│  └──────────────────┘   │
│                         │
│  [🛒 Cart: 3 items]     │
└────────┬────────────────┘
         │
         │ Tap item
         v
┌─────────────────────────┐
│  Item Detail Modal      │
│                         │
│  📷 Large Image         │
│  Cappuccino             │
│  €5.50                  │
│                         │
│  Description...         │
│                         │
│  🥛 Contains: Milk      │
│  🌱 Vegetarian          │
│                         │
│  Quantity: [- 1 +]      │
│                         │
│  📝 Special notes:      │
│  ┌──────────────────┐   │
│  │ Less foam...     │   │
│  └──────────────────┘   │
│                         │
│  [Add to Order €5.50]   │
└────────┬────────────────┘
         │
         │ Add to cart
         v
┌─────────────────────────┐
│  Cart Badge Updated     │
│  [🛒 Cart: 4 items]     │
└────────┬────────────────┘
         │
         │ Tap cart
         v
┌─────────────────────────┐
│    Cart Screen          │
│                         │
│  Your Order             │
│  ┌──────────────────┐   │
│  │ 2x Cappuccino    │   │
│  │ Less foam        │   │
│  │ €11.00       [×] │   │
│  └──────────────────┘   │
│  ┌──────────────────┐   │
│  │ 1x Croissant     │   │
│  │ €3.50        [×] │   │
│  └──────────────────┘   │
│                         │
│  Subtotal: €14.50       │
│  Tax (18%): €2.61       │
│  ─────────────────       │
│  Total: €17.11          │
│                         │
│  📝 Order notes:        │
│  ┌──────────────────┐   │
│  │ Extra napkins    │   │
│  └──────────────────┘   │
│                         │
│  [Place Order]          │
└────────┬────────────────┘
         │
         │ Confirm order
         v
┌─────────────────────────┐
│  Order Confirmation     │
│                         │
│  ✅ Order Placed!       │
│  Order #ORD-001         │
│                         │
│  Your order is being    │
│  prepared.              │
│                         │
│  [Track Order]          │
│  [Add More Items]       │
└────────┬────────────────┘
         │
         v
    Order Status Screen
```

### 3. Order Status Tracking

```
┌─────────────────────────┐
│  Order Status Screen    │
│                         │
│  Table T01              │
│  Order #ORD-001         │
│                         │
│  ● New                  │
│  ○ Preparing            │
│  ○ Ready                │
│  ○ Served               │
│                         │
│  Estimated: 15 min      │
│                         │
│  ┌──────────────────┐   │
│  │ 2x Cappuccino    │   │
│  │ ● Preparing      │   │
│  └──────────────────┘   │
│  ┌──────────────────┐   │
│  │ 1x Croissant     │   │
│  │ ○ Pending        │   │
│  └──────────────────┘   │
│                         │
│  [🔔 Call Waiter]       │
│  [Add More Items]       │
└─────────────────────────┘

-- Real-time updates --

Status changes to "Preparing":

┌─────────────────────────┐
│  Order Status Screen    │
│                         │
│  ✓ New                  │
│  ● Preparing  🔥        │
│  ○ Ready                │
│  ○ Served               │
│                         │
│  Your order is being    │
│  prepared in kitchen.   │
└─────────────────────────┘

Status changes to "Ready":

┌─────────────────────────┐
│  Order Status Screen    │
│                         │
│  ✓ New                  │
│  ✓ Preparing            │
│  ● Ready  ✨            │
│  ○ Served               │
│                         │
│  🎉 Your order is ready!│
│  Waiter will serve soon.│
└─────────────────────────┘
```

### 4. Call Waiter Flow

```
┌─────────────────────────┐
│  [🔔 Call Waiter]       │
└────────┬────────────────┘
         │
         │ Tap button
         v
┌─────────────────────────┐
│  Call Waiter Modal      │
│                         │
│  Why do you need help?  │
│                         │
│  [💬 General Help]      │
│  [🧾 Request Bill]      │
│  [🍽️ Bring Cutlery]    │
│  [⚠️ Complaint]         │
│                         │
│  [Cancel]               │
└────────┬────────────────┘
         │
         │ Select reason
         v
┌─────────────────────────┐
│  ✅ Waiter Notified     │
│                         │
│  A waiter will be with  │
│  you shortly.           │
│                         │
│  [OK]                   │
└─────────────────────────┘
```

---

## Waiter Flow (Mobile App)

### 1. Login & Home

```
┌─────────────────────────┐
│    Login Screen         │
│                         │
│  📱 Café İdarə          │
│                         │
│  ┌──────────────────┐   │
│  │ Email            │   │
│  └──────────────────┘   │
│  ┌──────────────────┐   │
│  │ Password         │   │
│  └──────────────────┘   │
│                         │
│  [Sign In]              │
└────────┬────────────────┘
         │
         │ Authenticate
         v
┌─────────────────────────┐
│  Waiter Home (Tabs)     │
│                         │
│  ┌─ Tables ─┬─ Orders ─┬─ Profile ─┐
│  │          │          │           │
│  └──────────┴──────────┴───────────┘
│                         │
│  Tables Overview        │
│                         │
│  🟢 T01  🟢 T02  🔴 T03│
│  Free     Free    Busy  │
│                         │
│  🔴 T04  🔴 T05  🟢 T06│
│  Busy     Busy    Free  │
│                         │
│  🟡 3 Pending Calls     │
│  🔔 2 New Orders        │
│                         │
│  Quick Actions:         │
│  [Create Manual Order]  │
│  [View All Orders]      │
└─────────────────────────┘
```

### 2. Tables Tab

```
┌─────────────────────────┐
│    Tables Tab           │
│                         │
│  Filter: [All] [Free]   │
│          [Occupied]     │
│                         │
│  ┌──────────────────┐   │
│  │ 🟢 Table T01     │   │
│  │ Status: Free     │   │
│  │ Capacity: 4      │   │
│  │ Location: Window │   │
│  └──────────────────┘   │
│                         │
│  ┌──────────────────┐   │
│  │ 🔴 Table T03     │   │
│  │ Status: Occupied │   │
│  │ Order: ORD-001   │   │
│  │ Total: €27.50    │   │
│  │ Time: 15 min     │   │
│  └──────────────────┘   │
│                         │
└────────┬────────────────┘
         │
         │ Tap occupied table
         v
┌─────────────────────────┐
│  Table Detail Screen    │
│                         │
│  Table T03 - Corner     │
│  ⏱️ Occupied: 15 min    │
│                         │
│  Order #ORD-001         │
│  Status: Preparing      │
│                         │
│  Items (3):             │
│  • 2x Cappuccino        │
│  • 1x Croissant         │
│                         │
│  Total: €27.50          │
│                         │
│  [Update Status ▼]      │
│  [Add Items]            │
│  [Close Table]          │
│  [Transfer Table]       │
└─────────────────────────┘
```

### 3. Orders Tab

```
┌─────────────────────────┐
│    Orders Tab           │
│                         │
│  Filter: [Active]       │
│          [All]          │
│                         │
│  🔴 NEW (2)             │
│  ┌──────────────────┐   │
│  │ ORD-003 | T05    │   │
│  │ €15.50 | 5 min   │   │
│  │ 3 items          │   │
│  └──────────────────┘   │
│                         │
│  🟡 PREPARING (3)       │
│  ┌──────────────────┐   │
│  │ ORD-001 | T03    │   │
│  │ €27.50 | 15 min  │   │
│  │ 3 items          │   │
│  └──────────────────┘   │
│                         │
│  🟢 READY (1)           │
│  ┌──────────────────┐   │
│  │ ORD-002 | T07    │   │
│  │ €18.00 | 20 min  │   │
│  │ 2 items          │   │
│  └──────────────────┘   │
│                         │
└────────┬────────────────┘
         │
         │ Tap order
         v
┌─────────────────────────┐
│  Order Detail Screen    │
│                         │
│  Order #ORD-001         │
│  Table T03 - Corner     │
│  Status: Preparing 🟡   │
│  Time: 15 minutes       │
│                         │
│  Items:                 │
│  ┌──────────────────┐   │
│  │ 2x Cappuccino    │   │
│  │ €11.00           │   │
│  │ 📝 Less foam     │   │
│  │ Status: Ready ✓  │   │
│  └──────────────────┘   │
│  ┌──────────────────┐   │
│  │ 1x Croissant     │   │
│  │ €3.50            │   │
│  │ Status: Ready ✓  │   │
│  └──────────────────┘   │
│                         │
│  Subtotal: €14.50       │
│  Tax: €2.61             │
│  Total: €17.11          │
│                         │
│  Customer Notes:        │
│  "Extra napkins"        │
│                         │
│  [Mark as Ready]        │
│  [Mark as Served]       │
│  [Add More Items]       │
└─────────────────────────┘
```

### 4. Waiter Call Notification

```
┌─────────────────────────┐
│  🔔 Notification        │
│                         │
│  Waiter Call - Table T05│
│  Reason: Request Bill   │
│  2 minutes ago          │
│                         │
│  [View] [Dismiss]       │
└────────┬────────────────┘
         │
         │ Tap View
         v
┌─────────────────────────┐
│  Waiter Call Detail     │
│                         │
│  Table T05 - Patio      │
│  Reason: Request Bill   │
│  Time: 2 min ago        │
│                         │
│  Current Order:         │
│  #ORD-005               │
│  Total: €42.50          │
│  Status: Served         │
│                         │
│  [Acknowledge]          │
│  [Close Table]          │
│  [Navigate to Table]    │
└─────────────────────────┘
```

---

## Kitchen Flow (Mobile App - Tablet View)

### 1. Kitchen Display System (KDS)

```
┌──────────────────────────────────────────┐
│  Kitchen Display - Grid View             │
│                                          │
│  🔴 NEW (2)  🟡 PREPARING (4)  🟢 READY (1)
│                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ ORD-003 │ │ ORD-001 │ │ ORD-004 │   │
│  │ T05     │ │ T03     │ │ T08     │   │
│  │ 🔴 NEW  │ │ 🟡 PREP │ │ 🟡 PREP │   │
│  │ ⏱️ 2min │ │ ⏱️ 15min│ │ ⏱️ 8min │   │
│  │         │ │         │ │         │   │
│  │ 2x      │ │ 2x ☕   │ │ 1x 🥐   │   │
│  │ Cappuc..│ │ Cappuc..│ │ Croissa.│   │
│  │ ⚠️ Less │ │ Less foa│ │         │   │
│  │ foam    │ │         │ │         │   │
│  │         │ │ 1x 🥐   │ │ 1x 🥗   │   │
│  │ 1x 🥗   │ │ Croissa.│ │ Salad   │   │
│  │ Salad   │ │         │ │         │   │
│  │         │ │         │ │         │   │
│  │[Start]  │ │ [Ready] │ │ [Ready] │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ ORD-006 │ │ ORD-002 │ │ ORD-007 │   │
│  │ T12     │ │ T07     │ │ T15     │   │
│  │ 🔴 NEW  │ │ 🟡 PREP │ │ 🟢 READY│   │
│  │ ⏱️ 1min │ │ ⏱️ 20min│ │ ⏱️ 25min│   │
│  │         │ │         │ │         │   │
│  │ 3x ☕   │ │ 2x 🍔   │ │ 1x ☕   │   │
│  │ Espresso│ │ Burger  │ │ Latte   │   │
│  │         │ │ ⚠️ No   │ │         │   │
│  │ 2x 🍰   │ │ pickles │ │ [Serve] │   │
│  │ Cake    │ │         │ │         │   │
│  │         │ │         │ │         │   │
│  │[Start]  │ │ [Ready] │ │         │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│                                          │
│  🔊 Sound: ON   🔔 Alerts: ON           │
└──────────────────────────────────────────┘
```

### 2. Order Card Tap → Detail View

```
┌─────────────────────────┐
│  Order Detail (Kitchen) │
│                         │
│  ORD-001                │
│  Table T03 - Corner     │
│  Status: Preparing 🟡   │
│  ⏱️ 15 minutes ago      │
│                         │
│  Items to Prepare:      │
│                         │
│  ┌──────────────────┐   │
│  │ ☕☕ Cappuccino  │   │
│  │ Quantity: 2      │   │
│  │                  │   │
│  │ 📝 NOTES:        │   │
│  │ "Less foam"      │   │
│  │ "Extra hot"      │   │
│  │                  │   │
│  │ [✓] Mark Ready   │   │
│  └──────────────────┘   │
│                         │
│  ┌──────────────────┐   │
│  │ 🥐 Croissant     │   │
│  │ Quantity: 1      │   │
│  │                  │   │
│  │ [✓] Mark Ready   │   │
│  └──────────────────┘   │
│                         │
│  All items ready?       │
│  [Mark Order Ready]     │
│                         │
│  [< Back to Grid]       │
└─────────────────────────┘
```

### 3. New Order Alert

```
┌─────────────────────────┐
│  🔔 NEW ORDER ALERT     │
│                         │
│  ♪ *DING DONG* 📳      │
│                         │
│  Order #ORD-008         │
│  Table T10              │
│  4 items                │
│                         │
│  [View Order]           │
│  [Dismiss]              │
└─────────────────────────┘
```

---

## Admin Flow (Mobile App)

### 1. Admin Dashboard

```
┌─────────────────────────┐
│  Admin Dashboard        │
│                         │
│  ┌─ Tables ─┬─ Orders ─┬─ Menu ─┬─ Staff ─┬─ Reports ─┐
│                         │
│  Today's Performance    │
│  ┌──────────────────┐   │
│  │ 💰 Revenue       │   │
│  │ €1,250.50        │   │
│  │ +15% vs yesterday│   │
│  └──────────────────┘   │
│                         │
│  ┌──────────────────┐   │
│  │ 📊 Orders        │   │
│  │ 45 orders        │   │
│  │ Avg: €27.79      │   │
│  └──────────────────┘   │
│                         │
│  ┌──────────────────┐   │
│  │ ⏱️ Service Time  │   │
│  │ 22 minutes       │   │
│  │ -3 min vs avg    │   │
│  └──────────────────┘   │
│                         │
│  Quick Actions:         │
│  [Manage Menu]          │
│  [View Reports]         │
│  [Staff Management]     │
└─────────────────────────┘
```

### 2. Menu Management Tab

```
┌─────────────────────────┐
│    Menu Tab (Admin)     │
│                         │
│  [+ Add Item]           │
│                         │
│  🔍 Search menu...      │
│                         │
│  Hot Drinks (12 items)  │
│  ┌──────────────────┐   │
│  │ ☕ Cappuccino    │   │
│  │ €5.50            │   │
│  │ ✅ Available     │   │
│  │ [Edit] [⋮]       │   │
│  └──────────────────┘   │
│                         │
│  ┌──────────────────┐   │
│  │ ☕ Latte         │   │
│  │ €6.00            │   │
│  │ ❌ Unavailable   │   │
│  │ [Edit] [⋮]       │   │
│  └──────────────────┘   │
│                         │
│  Cold Drinks (8 items)  │
│  ...                    │
└────────┬────────────────┘
         │
         │ Tap Edit
         v
┌─────────────────────────┐
│  Edit Menu Item         │
│                         │
│  📷 [Upload Image]      │
│                         │
│  Name (English):        │
│  ┌──────────────────┐   │
│  │ Cappuccino       │   │
│  └──────────────────┘   │
│                         │
│  Name (Azerbaijani):    │
│  ┌──────────────────┐   │
│  │ Kapuçino         │   │
│  └──────────────────┘   │
│                         │
│  Price:                 │
│  ┌──────────────────┐   │
│  │ 5.50             │   │
│  └──────────────────┘   │
│                         │
│  Category:              │
│  [Hot Drinks ▼]         │
│                         │
│  Preparation Time:      │
│  [5 minutes ▼]          │
│                         │
│  ☑️ Available           │
│  ☑️ Popular Item        │
│  ☑️ Vegetarian          │
│  ☐ Vegan                │
│  ☐ Gluten Free          │
│                         │
│  Allergens:             │
│  [+ Add] [Milk ×]       │
│                         │
│  [Save Changes]         │
│  [Delete Item]          │
└─────────────────────────┘
```

### 3. Staff Management Tab

```
┌─────────────────────────┐
│  Staff Management       │
│                         │
│  [+ Add Staff Member]   │
│                         │
│  Active Staff (5)       │
│  ┌──────────────────┐   │
│  │ 👤 John Doe      │   │
│  │ Role: Waiter     │   │
│  │ 🟢 Active        │   │
│  │ Last login: 1h   │   │
│  │ [Edit] [⋮]       │   │
│  └──────────────────┘   │
│                         │
│  ┌──────────────────┐   │
│  │ 👤 Jane Smith    │   │
│  │ Role: Kitchen    │   │
│  │ 🟢 Active        │   │
│  │ Last login: 30m  │   │
│  │ [Edit] [⋮]       │   │
│  └──────────────────┘   │
│                         │
│  Inactive (1)           │
│  ...                    │
└────────┬────────────────┘
         │
         │ Tap Add Staff
         v
┌─────────────────────────┐
│  Add Staff Member       │
│                         │
│  Full Name:             │
│  ┌──────────────────┐   │
│  │                  │   │
│  └──────────────────┘   │
│                         │
│  Email:                 │
│  ┌──────────────────┐   │
│  │                  │   │
│  └──────────────────┘   │
│                         │
│  Phone:                 │
│  ┌──────────────────┐   │
│  │                  │   │
│  └──────────────────┘   │
│                         │
│  Role:                  │
│  [Select Role ▼]        │
│  • Waiter               │
│  • Kitchen              │
│  • Admin                │
│                         │
│  Password:              │
│  ┌──────────────────┐   │
│  │                  │   │
│  └──────────────────┘   │
│                         │
│  [Create Account]       │
└─────────────────────────┘
```

### 4. Reports Tab

```
┌─────────────────────────┐
│    Reports Tab          │
│                         │
│  Date Range:            │
│  [Today ▼]              │
│  • Today                │
│  • This Week            │
│  • This Month           │
│  • Custom Range         │
│                         │
│  Sales Summary          │
│  ┌──────────────────┐   │
│  │ Total Revenue    │   │
│  │ €1,250.50        │   │
│  └──────────────────┘   │
│  ┌──────────────────┐   │
│  │ Orders Count     │   │
│  │ 45 orders        │   │
│  └──────────────────┘   │
│  ┌──────────────────┐   │
│  │ Avg Order Value  │   │
│  │ €27.79           │   │
│  └──────────────────┘   │
│  ┌──────────────────┐   │
│  │ Tables Served    │   │
│  │ 28 tables        │   │
│  └──────────────────┘   │
│                         │
│  Popular Items          │
│  1. Cappuccino (35)     │
│  2. Croissant (28)      │
│  3. Espresso (22)       │
│                         │
│  Waiter Performance     │
│  1. John Doe - €350     │
│  2. Jane Smith - €280   │
│                         │
│  [📊 Detailed Report]   │
│  [📧 Export to Email]   │
└─────────────────────────┘
```

## Color Coding System

### Order Status Colors
- 🔴 **New**: Red (urgent, needs attention)
- 🟡 **Preparing**: Yellow/Orange (in progress)
- 🟢 **Ready**: Green (complete, ready to serve)
- ⚪ **Served**: Gray (delivered to customer)
- ⚫ **Closed**: Dark Gray (completed)

### Table Status Colors
- 🟢 **Free**: Green
- 🔴 **Occupied**: Red
- 🟡 **Reserved**: Yellow
- ⚪ **Closed**: Gray

### Priority Indicators
- ⚠️ High Priority (>20 minutes elapsed)
- 📝 Has Special Notes
- 🔔 Waiter Called
- ⭐ Popular Item


