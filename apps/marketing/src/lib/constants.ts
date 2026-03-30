export const SITE_NAME = 'Gustri';
export const SITE_DESCRIPTION =
  'All-in-one restaurant management platform. POS, QR ordering, kitchen display, delivery, inventory, and staff scheduling — simplified.';
export const SITE_URL = 'https://gustri.com';
export const SITE_TAGLINE = 'Your restaurant, one platform.';

export const NAV_LINKS = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
] as const;

export const SOCIAL_LINKS = {
  twitter: 'https://x.com/gustri',
  instagram: 'https://instagram.com/gustri',
  linkedin: 'https://linkedin.com/company/gustri',
} as const;

export const PLANS = [
  {
    name: 'Free',
    price: 0,
    description: 'Perfect for solo cafes and food trucks',
    features: [
      '1 terminal',
      '50 menu items',
      '5 tables',
      'QR ordering',
      'Kitchen display (mobile)',
      'Basic analytics (today)',
      'Community support',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Standard',
    price: 29,
    description: 'For small cafes with 1-2 staff',
    features: [
      '2 terminals',
      '200 menu items',
      '15 tables',
      'Everything in Free',
      '30-day analytics history',
      'Custom branding',
      'Email support',
    ],
    cta: 'Start Trial',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 59,
    description: 'For medium cafes with full operations',
    features: [
      '5 terminals',
      'Unlimited menu items',
      'Unlimited tables',
      'Everything in Standard',
      'Full analytics history',
      'Loyalty & points program',
      'Priority email support',
    ],
    cta: 'Start Trial',
    highlighted: true,
  },
  {
    name: 'Business',
    price: 99,
    description: 'For multi-location and advanced needs',
    features: [
      'Unlimited terminals',
      'Everything in Pro',
      'Multi-location support',
      'API access',
      'Full data export',
      'Phone + email support',
      'Dedicated onboarding',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
] as const;

export const FEATURES = [
  {
    title: 'Point of Sale',
    description: 'Fast, intuitive POS for dine-in, takeout, and delivery orders.',
    icon: 'Monitor',
    category: 'operations',
  },
  {
    title: 'QR Ordering',
    description: 'Customers scan, browse the menu, and order from their phone.',
    icon: 'QrCode',
    category: 'operations',
  },
  {
    title: 'Kitchen Display',
    description: 'Real-time order queue on any device. No more lost tickets.',
    icon: 'ChefHat',
    category: 'operations',
  },
  {
    title: 'Delivery Management',
    description: 'Built-in delivery orders with driver assignment and tracking.',
    icon: 'Truck',
    category: 'operations',
  },
  {
    title: 'Table Management',
    description: 'Visual floor plan, table status, transfers, and waiter calls.',
    icon: 'LayoutGrid',
    category: 'operations',
  },
  {
    title: 'Split Payments',
    description: 'Split by amount, percentage, or specific items. Cash, card, or digital.',
    icon: 'CreditCard',
    category: 'operations',
  },
  {
    title: 'Inventory Tracking',
    description: 'Track stock levels, movements, and get low-stock alerts.',
    icon: 'Package',
    category: 'finance',
  },
  {
    title: 'Expense Tracking',
    description: 'Log expenses by category and payment method. Monthly summaries.',
    icon: 'Receipt',
    category: 'finance',
  },
  {
    title: 'Waste Logging',
    description: 'Track waste by reason. Identify patterns and reduce costs.',
    icon: 'Trash2',
    category: 'finance',
  },
  {
    title: 'Staff Scheduling',
    description: 'Create shifts, track attendance, and manage work schedules.',
    icon: 'CalendarDays',
    category: 'staff',
  },
  {
    title: 'Task Management',
    description: 'Assign tasks, set priorities, and track completion. Recurring tasks supported.',
    icon: 'ListTodo',
    category: 'staff',
  },
  {
    title: 'Customer Feedback',
    description: 'Collect feedback in real-time. Acknowledge, respond, and resolve.',
    icon: 'MessageSquare',
    category: 'customer',
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: 'Is there really a free plan?',
    answer:
      'Yes. The Free plan includes POS, QR ordering, kitchen display, inventory, and more — with 1 terminal, 50 menu items, and 5 tables. No credit card required, no time limit.',
  },
  {
    question: 'Do I need special hardware?',
    answer:
      'No. Gustri works on any device with a web browser — tablets, laptops, phones. For the mobile app, download from the App Store or Google Play.',
  },
  {
    question: 'Can I switch plans anytime?',
    answer:
      'Yes. Upgrade or downgrade at any time. If you upgrade, you only pay the difference. If you downgrade, the credit applies to your next billing cycle.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Absolutely. We use PostgreSQL with Row Level Security, encrypted connections, and regular backups. Your data is yours — export it anytime.',
  },
  {
    question: 'Do you support multiple languages?',
    answer:
      'Yes. The staff interface supports 20 languages including English, Azerbaijani, Turkish, Russian, Spanish, French, German, Japanese, Korean, Arabic, and more.',
  },
  {
    question: 'Can I use Gustri for delivery orders?',
    answer:
      'Yes. Built-in delivery management with customer details, delivery fees, driver assignment, and real-time status tracking.',
  },
] as const;
