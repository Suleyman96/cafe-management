# Gustri - Project Summary

## 🎯 Project Overview

**Gustri** is a comprehensive in-store ordering and management system designed for modern cafés. It provides a seamless experience for customers, staff, and kitchen operations with real-time synchronization across all platforms.

## ✨ Key Features

### Customer Features (Web App)
- 📱 QR code-based ordering (no app download required)
- 🌍 Multi-language support (English, Azerbaijani, Russian, Turkish)
- 🍽️ Browse menu with images, descriptions, and allergen information
- 🛒 Add items to cart with custom notes
- 📊 Real-time order status tracking
- 🔔 Call waiter functionality

### Staff Features (Mobile App)
- 📋 View and manage all tables
- 📦 Order management with status updates
- 🔔 Instant notifications for new orders and waiter calls
- 👥 Staff performance tracking (Admin only)
- 💰 Sales reports and analytics (Admin only)

### Kitchen Features (Mobile App)
- 🖥️ Grid view of active orders
- 🎨 Color-coded order statuses (New, Preparing, Ready)
- 📝 Prominent display of special notes
- 🔊 Sound and vibration alerts for new orders
- ⏱️ Elapsed time tracking per order

### Admin Features (Mobile App)
- All waiter features +
- 📚 Menu and price management
- 👨‍💼 Staff management (create, edit, deactivate)
- 📊 Comprehensive reports and analytics
- ⚙️ System configuration

## 🏗️ Technical Architecture

```
Customer Web (Next.js)
         ↓
    Supabase Backend (PostgreSQL + Realtime)
         ↓
Mobile App (React Native) → Waiter | Admin | Kitchen
```

### Technology Stack

| Component | Technology |
|-----------|-----------|
| **Customer Web** | Next.js 14, TypeScript, Tailwind CSS |
| **Mobile App** | React Native (Expo), TypeScript |
| **Backend** | Supabase (PostgreSQL, Realtime, Auth, Storage) |
| **State Management** | Zustand + TanStack React Query |
| **Real-time** | Supabase Realtime (WebSocket) |
| **UI Components** | Custom + React Native Paper |
| **Notifications** | Expo Notifications + Push |
| **Authentication** | Supabase Auth (JWT) |

## 📊 Database Schema

### Core Tables
- `staff` - Staff members with roles (waiter, admin, kitchen)
- `tables` - Physical café tables with QR codes
- `categories` - Menu categories
- `menu_items` - Menu items with multi-language support
- `orders` - Customer orders with status tracking
- `order_items` - Individual items within orders
- `waiter_calls` - Customer requests for assistance

### Key Features
- Row-Level Security (RLS) for data isolation
- Real-time subscriptions for live updates
- Automatic order number generation
- Automatic total calculation with tax
- Multi-language content support

## 📁 Project Structure

```
gustri/
├── docs/                      # Documentation
│   ├── architecture.md        # System architecture
│   ├── database-schema.md     # Database design
│   ├── api-contracts.md       # API documentation
│   └── user-flows.md          # User flows and screens
│
├── customer-web/              # Next.js customer app
│   ├── src/
│   │   ├── app/              # Next.js App Router
│   │   ├── components/       # React components
│   │   ├── hooks/            # React Query hooks
│   │   ├── store/            # Zustand stores
│   │   ├── lib/              # Utilities
│   │   └── types/            # TypeScript types
│   └── package.json
│
├── mobile-app/                # React Native staff app
│   ├── src/
│   │   ├── screens/          # Screen components
│   │   ├── components/       # Reusable components
│   │   ├── navigation/       # Navigation setup
│   │   ├── hooks/            # React Query hooks
│   │   ├── store/            # Zustand stores
│   │   ├── lib/              # Utilities
│   │   └── types/            # TypeScript types
│   └── package.json
│
├── supabase/                  # Backend configuration
│   ├── migrations/           # Database migrations
│   ├── config.toml           # Supabase config
│   └── seed.sql             # Sample data
│
├── README.md                 # Main documentation
├── DEPLOYMENT.md            # Deployment guide
└── PROJECT_SUMMARY.md       # This file
```

## 🚀 Getting Started

### Quick Start (Development)

```bash
# 1. Clone repository
git clone <repository-url>
cd gustri

# 2. Setup Supabase
cd supabase
supabase start
supabase db reset

# 3. Setup Customer Web App
cd ../customer-web
npm install
cp .env.example .env.local
# Update .env.local with Supabase credentials
npm run dev

# 4. Setup Mobile App
cd ../mobile-app
npm install
cp .env.example .env
# Update .env with Supabase credentials
npm start
```

### Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment guide.

## 📱 User Flows

### Customer Journey
1. Customer scans QR code on table
2. Browser opens to table landing page
3. Customer selects language and browses menu
4. Customer adds items to cart with custom notes
5. Customer reviews cart and places order
6. Customer sees real-time order status updates
7. Customer receives notification when order is ready
8. Customer can call waiter if needed

### Waiter Journey
1. Waiter logs in to mobile app
2. Views dashboard with table overview
3. Receives notification for new order
4. Views order details and updates status
5. Receives notification for waiter calls
6. Responds to waiter calls
7. Closes table after payment

### Kitchen Journey
1. Kitchen staff logs in to mobile app
2. Views grid of active orders
3. Receives sound alert for new orders
4. Marks items as preparing/ready
5. Views special notes for each item
6. Sees elapsed time for each order

### Admin Journey
1. Admin logs in with full access
2. Views comprehensive dashboard
3. Manages menu items and prices
4. Creates and manages staff accounts
5. Views sales reports and analytics
6. Monitors system performance

## 🎨 Design Principles

- **Mobile-First**: Optimized for phone and tablet screens
- **Touch-Friendly**: Large buttons (min 44x44px) for easy interaction
- **Color-Coded**: Visual clarity with status colors
- **Minimal Clicks**: Maximum 3 taps to complete any action
- **Fast Loading**: Optimized images and lazy loading
- **Real-Time**: Instant updates across all devices
- **Accessible**: Support for screen readers and keyboard navigation

## 🔒 Security Features

- Row-Level Security (RLS) enforced at database level
- No authentication required for customers (QR token based)
- JWT authentication for staff with role-based access
- Secure session management
- Encrypted passwords
- HTTPS/SSL everywhere
- Protected API endpoints
- Input validation and sanitization

## 📊 Performance Metrics

### Target Performance
- Initial page load: < 2 seconds
- Real-time update latency: < 500ms
- API response time: < 200ms (p95)
- Concurrent users: 100+ per café
- Order processing time: < 5 seconds

### Optimization Strategies
- Server-side rendering (Next.js)
- Optimistic UI updates
- React Query caching
- Image optimization and lazy loading
- Database indexing
- CDN for static assets

## 🌍 Internationalization

Supports 4 languages out of the box:
- 🇬🇧 English (en)
- 🇦🇿 Azerbaijani (az)
- 🇷🇺 Russian (ru)
- 🇹🇷 Turkish (tr)

All menu items, categories, and UI text are translatable.

## 📈 Future Enhancements

### Phase 2 (Optional Features)
- [ ] Multi-café support (single deployment, multiple locations)
- [ ] Customer accounts (optional, for loyalty)
- [ ] Online payments (Stripe integration)
- [ ] Takeaway and delivery orders
- [ ] Inventory management
- [ ] Loyalty program
- [ ] AI-powered recommendations
- [ ] Voice ordering support
- [ ] Table reservations
- [ ] Split bill functionality

### Scalability
- Multi-region deployment
- Read replicas for reporting
- Advanced caching strategies
- Microservices architecture (if needed)

## 🐛 Known Limitations

- Customer web app requires internet connection
- Mobile app requires iOS 13+ or Android 8+
- Push notifications require physical device (not simulator)
- QR codes must be regenerated if table IDs change
- Maximum 1000 menu items (database pagination)

## 🎯 Success Metrics

### Business Metrics
- Average order value
- Orders per day
- Customer satisfaction
- Staff efficiency
- Table turnover rate

### Technical Metrics
- System uptime (target: 99.9%)
- API response times
- Error rates
- Real-time message delivery rate
- App crash rate

## 🤝 Contributing

This is a private project, but if you have suggestions or find bugs:

1. Document the issue clearly
2. Provide steps to reproduce
3. Include screenshots if relevant
4. Suggest a solution if possible

## 📄 License

Proprietary - All rights reserved.

## 📞 Support

For technical support or questions:
- Check documentation in `/docs` folder
- Review troubleshooting guide in DEPLOYMENT.md
- Contact project maintainer

## 🎉 Acknowledgments

Built with modern technologies:
- [Next.js](https://nextjs.org/) - React framework
- [React Native](https://reactnative.dev/) - Mobile framework
- [Supabase](https://supabase.com/) - Backend platform
- [Expo](https://expo.dev/) - React Native tooling
- [TanStack Query](https://tanstack.com/query) - Data fetching
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [React Native Paper](https://reactnativepaper.com/) - UI components

---

**Version**: 1.0.0  
**Last Updated**: December 15, 2025  
**Status**: Production Ready ✅

Enjoy your Gustri system! ☕️


