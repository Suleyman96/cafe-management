# Quick Start Guide - Café İdarə

Get your café system running in **under 30 minutes**!

## 🎯 What You're Building

```
✅ Backend (Supabase) - Database + Real-time + Auth
✅ Customer Web App - QR code ordering  
✅ Staff Web App - Orders + Kitchen display
```

**Total Cost: $0/year** 🎉

---

## 📋 Prerequisites

- [x] Node.js 18+ installed
- [x] npm or yarn installed
- [x] Git installed
- [x] Supabase account (free)
- [x] Vercel account (free) - optional for deployment

---

## 🚀 Step 1: Deploy Backend (5 minutes)

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name**: `cafe-idare`
   - **Database Password**: (save this!)
   - **Region**: Closest to you
4. Click "Create project" (takes 2 minutes)

### 1.2 Run Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Navigate to project
cd /Users/kamilhajilov/Documents/cafe-idare

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push

# Load sample data (optional)
supabase db reset --seed-only
```

### 1.3 Save Your Credentials

From Supabase Dashboard → Settings → API:
- **Project URL**: `https://xxxxx.supabase.co`
- **Anon Key**: `eyJhbGc...`

Save these! You'll need them next.

---

## 🌐 Step 2: Deploy Customer Web App (5 minutes)

```bash
cd customer-web

# Install dependencies
npm install

# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_NAME="Café İdarə"
EOF

# Run locally
npm run dev

# Open http://localhost:3000
```

**✅ Test it**: Navigate to `http://localhost:3000/table/demo`

---

## 💼 Step 3: Deploy Staff Web App (5 minutes)

```bash
cd ../staff-web

# Install dependencies
npm install

# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_NAME="Café İdarə - Staff"
EOF

# Run locally
npm run dev

# Open http://localhost:3001
```

**✅ Test it**: Open `http://localhost:3001`

---

## 👤 Step 4: Create Admin User (3 minutes)

Go to Supabase Dashboard → SQL Editor → New Query:

```sql
-- Create admin user
INSERT INTO staff (email, full_name, role, is_active)
VALUES ('admin@yourcafe.com', 'Admin User', 'admin', true);

-- This creates a staff record
-- You'll set the password via Supabase Auth Dashboard
```

Then go to Authentication → Users → Add User:
- Email: `admin@yourcafe.com`
- Password: (your choice)
- Confirm password

---

## 🧪 Step 5: Test Everything (5 minutes)

### Test Customer Flow:
1. Open `http://localhost:3000/table/demo`
2. Browse menu (sample data loaded)
3. Add items to cart
4. Place order
5. See order status

### Test Staff Flow:
1. Open `http://localhost:3001`
2. Login with admin credentials
3. View dashboard
4. See orders appear
5. Update order status

### Test Kitchen Display:
1. Go to `http://localhost:3001/kitchen`
2. See grid of active orders
3. Watch real-time updates

---

## 📱 Step 6: Generate QR Codes (5 minutes)

### Option 1: Online Generator (Quick)

Go to any QR code generator and create codes for:

```
Table 1: http://localhost:3000/table/TABLE_ID_1?token=qr_token_table_01
Table 2: http://localhost:3000/table/TABLE_ID_2?token=qr_token_table_02
...
```

Get Table IDs from Supabase → Table Editor → tables

### Option 2: Automated Script

```javascript
// generate-qr.js
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function generateQRCodes() {
  const { data: tables } = await supabase
    .from('tables')
    .select('*');

  for (const table of tables) {
    await QRCode.toFile(
      `./qr-codes/${table.table_number}.png`,
      `http://localhost:3000/table/${table.id}?token=${table.qr_code}`,
      { width: 500 }
    );
  }
}

generateQRCodes();
```

---

## 🌍 Step 7: Deploy to Production (Optional, 5 minutes)

### Deploy Customer Web:

```bash
cd customer-web

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel Dashboard
```

### Deploy Staff Web:

```bash
cd ../staff-web

# Deploy
vercel --prod
```

**Done!** ✅

Your URLs:
- Customer: `https://your-customer-app.vercel.app`
- Staff: `https://your-staff-app.vercel.app`

---

## 📊 What's Next?

### Immediate (Today):
- [ ] Print QR codes for tables
- [ ] Put QR codes on tables
- [ ] Train staff on tablets
- [ ] Test with real orders

### Soon (This Week):
- [ ] Customize menu items
- [ ] Add your café's branding
- [ ] Set up proper domain names
- [ ] Create more staff accounts

### Later (When Needed):
- [ ] Add mobile apps ($25-124)
- [ ] Expand to multiple locations
- [ ] Upgrade Supabase if needed

---

## 🐛 Troubleshooting

### "Cannot connect to Supabase"
✅ Check .env.local has correct URL and key  
✅ Check internet connection  
✅ Verify Supabase project is running

### "RLS policy error"
✅ Make sure migrations ran: `supabase db push`  
✅ Check RLS policies in Supabase Dashboard

### "Port already in use"
```bash
# Use different ports
npm run dev -- --port 3002
```

### "Module not found: @shared"
```bash
# The shared folder might not be linked
# Just copy shared types to each app for now
```

---

## 💡 Pro Tips

1. **Test locally first** - Don't deploy until everything works
2. **Use sample data** - The seed.sql has good test data
3. **Start simple** - Use just web apps, add mobile later
4. **Monitor costs** - Supabase free tier is generous
5. **Backup regularly** - Download database backups weekly

---

## 📞 Need Help?

**Check these files:**
- `README.md` - Overview
- `docs/architecture.md` - System design
- `DEPLOYMENT.md` - Production deployment
- `MIGRATION_TO_RN_WEB.md` - Mobile app guide

**Common issues:**
- Database schema: `docs/database-schema.md`
- API docs: `docs/api-contracts.md`
- User flows: `docs/user-flows.md`

---

## ✅ Success Checklist

- [ ] Supabase project created
- [ ] Database migrations applied
- [ ] Sample data loaded
- [ ] Customer web app running
- [ ] Staff web app running
- [ ] Admin user created
- [ ] Can place test order
- [ ] Order appears in staff dashboard
- [ ] Kitchen display shows orders
- [ ] Real-time updates working

**All checked?** Congratulations! 🎉 Your café system is ready!

---

## 🎯 Next Steps

1. **Customize**: Add your real menu items
2. **Brand**: Update logos and colors
3. **Deploy**: Push to production when ready
4. **Train**: Teach staff how to use system
5. **Launch**: Start taking real orders!

**Total time**: ~30 minutes  
**Total cost**: $0  
**Value**: Priceless! 🚀

Enjoy your new café management system! ☕️


