# Migration Guide: Web Apps → React Native Web

This guide explains how to convert from separate web apps to a unified React Native Web codebase when you're ready for mobile apps.

## 📊 Current Architecture (Phase 1 - Web Only)

```
cafe-idare/
├── customer-web/        # Next.js for customers
├── staff-web/          # Next.js for staff/kitchen
├── shared/             # ✅ Shared types & utilities
└── supabase/          # Backend

Code Reuse: ~50% (types, utils, API logic)
Cost: $0/year
Deployment: 2 web apps
```

## 🎯 Target Architecture (Phase 2 - Universal)

```
cafe-idare/
├── app/                # ✅ Single React Native app
│   ├── (customer)/    # Customer routes
│   ├── (staff)/       # Staff routes
│   └── (kitchen)/     # Kitchen routes
├── shared/            # ✅ Same shared code!
└── supabase/         # ✅ Same backend!

Code Reuse: ~90% (everything!)
Cost: $25-124 (app stores)
Deployment: 1 app → web + iOS + Android
```

---

## 🔄 Migration Process

### Timeline: **1-2 weeks**

The migration is straightforward because I structured the web apps with RN Web in mind!

###Step 1: Create React Native Web Project (Day 1)

```bash
cd cafe-idare

# Create new app
npx create-expo-app app --template expo-template-blank-typescript

cd app

# Install React Native Web
npm install react-native-web react-dom
npm install --save-dev @expo/webpack-config
```

### Step 2: Copy Shared Code (Day 1)

```bash
# The shared/ folder works as-is!
# No changes needed 🎉

app/
├── shared/ → symlink to ../shared
└── or just import from ../shared/
```

### Step 3: Convert Components (Days 2-5)

The conversion is mostly 1:1! Here's how:

#### Before (Next.js/Web):

```typescript
// customer-web/src/components/OrderCard.tsx
import { formatPrice } from '@shared/lib/utils';

export function OrderCard({ order }) {
  return (
    <div className="bg-card rounded-lg p-4 border">
      <h3 className="font-semibold">{order.order_number}</h3>
      <p className="text-muted-foreground">
        {formatPrice(order.total)}
      </p>
      <button
        onClick={() => updateOrder(order.id)}
        className="bg-primary text-white px-4 py-2 rounded"
      >
        Update
      </button>
    </div>
  );
}
```

#### After (React Native Web):

```typescript
// app/components/OrderCard.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { formatPrice } from '../shared/lib/utils'; // ✅ Same import!

export function OrderCard({ order }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{order.order_number}</Text>
      <Text style={styles.subtitle}>
        {formatPrice(order.total)} {/* ✅ Same function! */}
      </Text>
      <Pressable
        onPress={() => updateOrder(order.id)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Update</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  title: { fontWeight: '600' },
  subtitle: { color: '#6b7280' },
  button: {
    backgroundColor: '#3b82f6',
    padding: 8,
    borderRadius: 4,
  },
  buttonText: { color: '#fff' },
});
```

**Changes needed**: Just UI layer (HTML → React Native components)  
**Business logic**: ✅ No changes needed!

### Step 4: Convert Navigation (Day 6)

#### Before (Next.js App Router):

```
customer-web/app/
├── table/[id]/page.tsx
├── menu/page.tsx
└── cart/page.tsx
```

#### After (Expo Router):

```
app/
├── (customer)/
│   ├── table/[id]/index.tsx
│   ├── menu/index.tsx
│   └── cart/index.tsx
├── (staff)/
│   ├── tables/index.tsx
│   └── orders/index.tsx
└── (kitchen)/
    └── display/index.tsx
```

**Changes needed**: File structure only  
**Logic**: ✅ Copy-paste!

### Step 5: Configure Web Build (Day 7)

```javascript
// app.json
{
  "expo": {
    "platforms": ["ios", "android", "web"],
    "web": {
      "bundler": "metro",
      "output": "static"
    }
  }
}
```

### Step 6: Deploy (Day 7)

```bash
# Web deployment (replaces customer-web + staff-web)
npx expo export:web
vercel --prod

# Mobile builds (when ready)
eas build --platform ios
eas build --platform android
```

---

## 📋 Component Conversion Cheat Sheet

### HTML → React Native Mapping

| Next.js/HTML | React Native | Notes |
|--------------|--------------|-------|
| `<div>` | `<View>` | Container |
| `<span>`, `<p>` | `<Text>` | Text must be in `<Text>` |
| `<input>` | `<TextInput>` | Different props |
| `<button>` | `<Pressable>` | More control |
| `<img>` | `<Image>` | Requires `source` prop |
| `className` | `style` | StyleSheet objects |
| `onClick` | `onPress` | Same behavior |

### CSS → StyleSheet

```typescript
// Before (Tailwind)
<div className="flex items-center justify-between p-4 bg-white rounded-lg">

// After (StyleSheet)
<View style={styles.container}>

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
});
```

### Or use Nativewind (Tailwind for RN):

```typescript
// Install nativewind
npm install nativewind

// Use Tailwind classes in RN!
<View className="flex flex-row items-center justify-between p-4 bg-white rounded-lg">
```

---

## 💾 What Stays the Same

### ✅ No Changes Needed:

1. **Shared folder** - Works as-is!
   - Types
   - Utils
   - Constants

2. **Business Logic**
   - API calls
   - Data fetching
   - State management
   - Calculations

3. **Backend**
   - Supabase setup
   - Database schema
   - RLS policies
   - Functions

4. **React Query hooks** - Minor adjustments only

5. **Zustand stores** - Works perfectly

### ⚠️ Changes Needed:

1. **UI Components** - HTML → React Native primitives
2. **Styling** - CSS → StyleSheet (or use Nativewind)
3. **Navigation** - Next.js Router → Expo Router
4. **Images** - `<img>` → `<Image>`
5. **Forms** - Different component APIs

---

## 📊 Code Reuse Comparison

### Current (Web Only):
```
customer-web/        staff-web/
├── components/      ├── components/      # 20% shared
├── hooks/          ├── hooks/          # 50% shared
├── lib/            ├── lib/            # 50% shared
└── types/          └── types/          # 100% via shared/

Total Reuse: ~50%
```

### After RN Web Migration:
```
app/
├── components/     # 100% works on web + mobile
├── hooks/         # 100% shared
├── lib/           # 100% from shared/
└── types/         # 100% from shared/

Total Reuse: ~90%
```

---

## 💰 Cost Comparison

### Current Web Apps:
```
Backend: FREE
Customer web: FREE
Staff web: FREE
Total: $0/year ✅
```

### After RN Web Migration:
```
Backend: FREE (same)
Web app: FREE (same, now single deployment)
iOS app: $99/year
Android app: $25 one-time
Total: ~$99/year (or $25 if Android-only)
```

---

## 🎯 Migration Checklist

### Pre-Migration (Do Now):
- [x] Create shared/ folder ✅
- [x] Use shared types in both web apps ✅
- [x] Structure components for easy conversion ✅
- [ ] Document component structure
- [ ] Test everything works

### During Migration (Later):
- [ ] Setup React Native project
- [ ] Install dependencies
- [ ] Convert 1 screen as POC
- [ ] Convert remaining screens
- [ ] Test on web
- [ ] Test on mobile
- [ ] Deploy web
- [ ] Build mobile apps

### Post-Migration:
- [ ] Deprecate old web apps
- [ ] Monitor performance
- [ ] Collect feedback
- [ ] Iterate

---

## 🚀 Quick Start Guide (When Ready)

```bash
# 1. Create RN Web app
npx create-expo-app app --template blank-typescript

# 2. Install web support
cd app
npm install react-native-web react-dom

# 3. Configure for web
# Edit app.json to add "web" platform

# 4. Copy a component from customer-web
# Convert HTML → RN primitives
# Test: npx expo start --web

# 5. Copy business logic (hooks, utils)
# Should work with minimal changes!

# 6. Repeat for all components

# 7. Deploy
npx expo export:web
vercel --prod

# Done! ✅
```

---

## 📚 Resources

### Learning React Native Web:
- https://necolas.github.io/react-native-web/
- https://docs.expo.dev/workflow/web/

### Component Libraries (optional):
- React Native Paper: https://reactnativepaper.com/
- NativeBase: https://nativebase.io/
- Tamagui: https://tamagui.dev/

### Styling:
- Nativewind (Tailwind for RN): https://www.nativewind.dev/
- StyleSheet API: https://reactnative.dev/docs/stylesheet

---

## 💡 Pro Tips

1. **Start with kitchen display** - Simplest screen, good for learning
2. **Use Nativewind** - Keeps Tailwind classes, easier migration
3. **Test on web first** - Faster iteration
4. **One route at a time** - Don't convert everything at once
5. **Keep old apps running** - Until new app is production-ready

---

## 🎉 Benefits After Migration

✅ **One codebase** instead of 3  
✅ **90% code reuse** instead of 50%  
✅ **Native mobile apps** with near-zero extra effort  
✅ **Consistent UI** across all platforms  
✅ **Easier maintenance** - fix once, works everywhere  
✅ **Better performance** on mobile  
✅ **Future-proof** architecture  

---

## ❓ Questions?

**Q: Can I do this gradually?**  
A: Yes! Convert one screen at a time. Keep old web apps running.

**Q: Will it break existing web apps?**  
A: No! Old apps keep running until you're ready to switch.

**Q: How long does migration take?**  
A: 1-2 weeks for complete migration (working part-time)

**Q: Do I need React Native experience?**  
A: Helpful but not required. It's mostly React knowledge + new components.

**Q: Can I get help?**  
A: Yes! The structure I built makes it straightforward. Follow this guide!

---

**Ready to migrate?** Start with web apps now, migrate to RN Web when you need mobile! 🚀


