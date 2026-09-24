export const SITE_NAME = 'gustri';
export const SITE_DESCRIPTION =
  'All-in-one restaurant management platform. POS, QR ordering, kitchen display, delivery, inventory, and staff scheduling — simplified.';
export const SITE_URL = 'https://gustri.com';
export const SITE_TAGLINE = 'Your restaurant, one platform.';

export const STAFF_APP_URL = process.env.NEXT_PUBLIC_STAFF_APP_URL || 'http://localhost:3001';

export const FREE_PLAN_REASSURANCE =
  'No credit card. 5-minute setup. Free forever for up to 300 orders/mo.';

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

export type Plan = {
  name: string;
  /** Monthly price in USD. 0 = free. */
  price: number;
  /** Yearly price in USD (paid plans only; omitted for Free). */
  priceYearly?: number;
  description: string;
  features: readonly string[];
  cta: string;
  microcopy: string;
  highlighted: boolean;
};

export const PLANS: readonly Plan[] = [
  {
    name: 'Free',
    price: 0,
    description: 'For very small cafes just getting started',
    features: [
      'Up to 5 tables',
      'Up to 300 orders/month',
      'QR ordering included',
      'Kitchen display',
      'Basic analytics',
      'Community support',
    ],
    cta: 'Start Free',
    microcopy: 'No credit card. Free forever for up to 300 orders/mo.',
    highlighted: false,
  },
  {
    name: 'Standard',
    price: 12,
    priceYearly: 99,
    description: 'For small cafes ready to grow',
    features: [
      'Up to 15 tables',
      'Unlimited orders',
      'QR ordering',
      'Full analytics',
      'Custom branding',
      'Email support',
    ],
    cta: 'Talk to us',
    microcopy: 'We onboard you personally.',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 20,
    priceYearly: 189,
    description: 'For medium cafes that need everything',
    features: [
      'Up to 40 tables',
      'Unlimited orders',
      'All features included',
      'Inventory & waste tracking',
      'Staff scheduling & tasks',
      'Priority support',
    ],
    cta: 'Talk to us',
    microcopy: 'Most popular. We handle onboarding.',
    highlighted: true,
  },
  {
    name: 'Business',
    price: 50,
    priceYearly: 399,
    description: 'For large restaurants — no limits',
    features: [
      'Unlimited tables',
      'Unlimited orders',
      'Everything in Pro',
      'Multi-location support',
      'API access & data export',
      'Dedicated onboarding',
    ],
    cta: 'Contact Sales',
    microcopy: 'Custom onboarding for larger restaurants.',
    highlighted: false,
  },
];

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
      'Yes. The Free plan includes POS, kitchen display, and QR ordering — up to 5 tables and 300 orders per month. No credit card required, no time limit.',
  },
  {
    question: 'Do I need special hardware?',
    answer:
      'No. Gustri works on any device with a web browser — tablets, laptops, phones. For the mobile app, download from the App Store or Google Play.',
  },
  {
    question: 'Can I switch plans anytime?',
    answer:
      'Yes. Start on the Free plan instantly, and message us whenever you want to move up. We set up your paid plan and arrange billing with you directly — no lock-in, change whenever your cafe needs to.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Absolutely. We use PostgreSQL with Row Level Security, encrypted connections, and regular backups. Your data is yours — export it anytime.',
  },
  {
    question: 'Do you support multiple languages?',
    answer:
      'Yes. The staff interface supports 20 languages including Japanese, English, Korean, Spanish, French, German, Arabic, Turkish, Russian, and more.',
  },
  {
    question: 'Can I use Gustri for delivery orders?',
    answer:
      'Yes. Built-in delivery management with customer details, delivery fees, driver assignment, and real-time status tracking.',
  },
] as const;
