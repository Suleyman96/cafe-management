# Deployment Guide - Café İdarə

Complete deployment guide for production environment.

## Prerequisites

- Node.js 18+
- Git
- Supabase account
- Vercel account (for customer web app)
- Expo EAS account (for mobile app)

## 1. Supabase Backend Setup

### Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose your organization
4. Set project details:
   - Name: `cafe-idare`
   - Database Password: (strong password)
   - Region: (closest to your location)

### Run Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Navigate to project directory
cd /path/to/cafe-idare

# Link to your project
supabase link --project-ref your-project-ref

# Push database migrations
supabase db push

# Seed sample data (optional for production)
supabase db reset --seed-only
```

### Configure Authentication

1. Go to Authentication > Settings in Supabase Dashboard
2. Disable "Enable email signup" (only admins create accounts)
3. Set Site URL to your customer web app URL
4. Add redirect URLs for mobile app

### Configure Storage

1. Go to Storage in Supabase Dashboard
2. Create bucket: `menu-images`
   - Public: Yes
   - File size limit: 5MB
   - Allowed MIME types: `image/jpeg, image/png, image/webp`
3. Create bucket: `qr-codes`
   - Public: Yes
   - File size limit: 1MB
   - Allowed MIME types: `image/png`

### Create Admin User

```sql
-- In Supabase SQL Editor, run:
-- Create auth user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@yourCafe.com',
  crypt('your-secure-password', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) RETURNING id;

-- Then create staff record (replace UUID with returned id from above)
INSERT INTO staff (email, full_name, role, auth_user_id)
VALUES ('admin@yourcafe.com', 'Admin User', 'admin', 'uuid-from-above');
```

### Note Connection Details

From Supabase Dashboard > Settings > API:
- Project URL: `https://xxxxx.supabase.co`
- Anon/Public Key: `eyJhbGc...`

## 2. Customer Web App Deployment (Vercel)

### Prepare Environment

```bash
cd customer-web

# Install dependencies
npm install

# Create production .env
cat > .env.production << EOF
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_NAME="Café İdarə"
NEXT_PUBLIC_DEFAULT_LANGUAGE=en
EOF
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

Or use Vercel GitHub integration:

1. Push code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Set environment variables in Vercel dashboard
5. Deploy

### Configure Domain

1. In Vercel Dashboard, go to your project
2. Settings > Domains
3. Add your custom domain (e.g., `order.yourcafe.com`)
4. Follow DNS configuration instructions

## 3. Mobile App Deployment (Expo EAS)

### Setup EAS

```bash
cd mobile-app

# Install dependencies
npm install

# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS
eas build:configure
```

### Configure Environment

```bash
# Create .env
cat > .env << EOF
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_APP_NAME="Café İdarə"
EOF
```

### Update app.json

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id"
      },
      "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key"
    }
  }
}
```

### Build for iOS

```bash
# Create iOS build
eas build --platform ios

# Submit to App Store
eas submit --platform ios
```

Before submitting:
1. Have Apple Developer account ($99/year)
2. Create App ID in App Store Connect
3. Prepare app metadata, screenshots, and icons

### Build for Android

```bash
# Create Android build
eas build --platform android

# Submit to Google Play
eas submit --platform android
```

Before submitting:
1. Have Google Play Developer account ($25 one-time)
2. Create app in Google Play Console
3. Prepare app metadata, screenshots, and icons

## 4. Generate QR Codes for Tables

### Option 1: Manual Generation

Use any QR code generator to create QR codes pointing to:
```
https://order.yourcafe.com/table/TABLE_ID?token=QR_TOKEN
```

Where:
- `TABLE_ID`: UUID from tables table
- `QR_TOKEN`: Value from `qr_code` column

### Option 2: Automated Script

```javascript
// generate-qr-codes.js
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service role key
);

async function generateQRCodes() {
  const { data: tables } = await supabase
    .from('tables')
    .select('*')
    .eq('is_active', true);

  for (const table of tables) {
    const url = `https://order.yourcafe.com/table/${table.id}?token=${table.qr_code}`;
    
    await QRCode.toFile(
      `./qr-codes/${table.table_number}.png`,
      url,
      { width: 500 }
    );
    
    console.log(`Generated QR code for ${table.table_number}`);
  }
}

generateQRCodes();
```

## 5. Post-Deployment Checklist

### Backend (Supabase)
- [ ] Migrations applied successfully
- [ ] RLS policies enabled and tested
- [ ] Storage buckets created and configured
- [ ] Admin user created
- [ ] Backup schedule configured
- [ ] Monitoring alerts set up

### Customer Web App
- [ ] Deployed and accessible
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Environment variables set correctly
- [ ] PWA installable on mobile
- [ ] Test QR code scanning

### Mobile App
- [ ] iOS app submitted and approved
- [ ] Android app submitted and approved
- [ ] Push notifications working
- [ ] Sound alerts functioning
- [ ] Real-time updates working
- [ ] Staff can login successfully

### Testing
- [ ] Place test order from customer web
- [ ] Verify order appears in mobile app
- [ ] Test kitchen display
- [ ] Test waiter calls
- [ ] Test order status updates
- [ ] Verify real-time synchronization

## 6. Monitoring & Maintenance

### Supabase Dashboard

Monitor:
- Database performance
- API usage
- Error rates
- Active connections
- Storage usage

### Vercel Dashboard

Monitor:
- Deployment status
- Page views
- Response times
- Error logs

### Expo Dashboard

Monitor:
- Crash reports
- Update statistics
- User engagement

### Set Up Alerts

1. **Supabase**: Set up email alerts for:
   - High error rates
   - Database connection issues
   - Storage quota warnings

2. **Vercel**: Configure alerts for:
   - Deployment failures
   - High response times
   - Error spikes

3. **Sentry** (Optional):
   - Install Sentry for comprehensive error tracking
   - Set up for both web and mobile apps

## 7. Backup Strategy

### Database Backups

Supabase provides automatic daily backups. For additional safety:

```bash
# Manual backup
supabase db dump -f backups/backup-$(date +%Y%m%d).sql

# Schedule with cron (Linux/Mac)
crontab -e
# Add: 0 2 * * * cd /path/to/project && supabase db dump -f backups/backup-$(date +%Y%m%d).sql
```

### Storage Backups

Periodically download uploaded images:

```bash
# Download all menu images
supabase storage download menu-images --destination ./backups/images/
```

## 8. Scaling Considerations

### As you grow:

1. **Database**: Upgrade Supabase plan for more connections
2. **Storage**: Monitor storage usage, implement image optimization
3. **API**: Use CDN for static assets (Vercel handles this)
4. **Mobile**: Monitor app performance, optimize real-time subscriptions

### Performance Optimization

- Enable Vercel Edge caching
- Optimize images (use WebP format)
- Implement lazy loading
- Cache menu data aggressively
- Use database indexes effectively

## 9. Security Best Practices

- [ ] Change all default passwords
- [ ] Use strong, unique passwords for all services
- [ ] Enable 2FA on all accounts
- [ ] Regularly update dependencies
- [ ] Review RLS policies periodically
- [ ] Monitor for unusual activity
- [ ] Keep service role keys secure (never expose to client)

## 10. Support & Troubleshooting

### Common Issues

**QR codes not working:**
- Verify QR token matches database
- Check URL format is correct
- Ensure customer web app is accessible

**Push notifications not working:**
- Verify permissions are granted
- Check Expo push token is valid
- Test with physical device (not simulator)

**Real-time updates delayed:**
- Check Supabase connection
- Verify subscriptions are active
- Monitor network connectivity

### Getting Help

- **Supabase**: [support.supabase.com](https://support.supabase.com)
- **Vercel**: [vercel.com/support](https://vercel.com/support)
- **Expo**: [expo.dev/support](https://expo.dev/support)

## Conclusion

Your Café İdarə system is now live! 🎉

For ongoing maintenance:
1. Monitor usage and performance
2. Gather user feedback
3. Plan feature updates
4. Keep dependencies updated
5. Review analytics regularly

Congratulations on your successful deployment!


