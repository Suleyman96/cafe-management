/**
 * Profit & Loss calculation utilities
 */

export interface ExpenseEntry {
  amount: number;
  category?: { id: string; name: string } | null;
}

export interface CategoryBreakdown {
  /**
   * Category name, or `null` when the expense has no category. Headless code
   * can't translate, so it emits `null` rather than an English `'Uncategorized'`
   * literal — UI consumers render the localized label (`expenses.uncategorized`)
   * for `null`.
   */
  name: string | null;
  total: number;
  count: number;
}

export interface ProfitMetrics {
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  byCategory: CategoryBreakdown[];
}

/**
 * Calculate total expenses from a list of expense entries
 */
export function calculateTotalExpenses(expenses: ExpenseEntry[]): number {
  return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

/**
 * Calculate net profit (revenue - expenses)
 */
export function calculateNetProfit(revenue: number, totalExpenses: number): number {
  return revenue - totalExpenses;
}

/**
 * Calculate profit margin as a percentage
 * Returns 0 if revenue is 0
 */
export function calculateProfitMargin(revenue: number, netProfit: number): number {
  if (revenue <= 0) return 0;
  return (netProfit / revenue) * 100;
}

/**
 * Group expenses by category and return sorted breakdown
 */
export function groupExpensesByCategory(expenses: ExpenseEntry[]): CategoryBreakdown[] {
  const categoryMap = new Map<string, CategoryBreakdown>();

  for (const e of expenses) {
    const catName = e.category?.name ?? null;
    const catId = e.category?.id || 'uncategorized';
    const current = categoryMap.get(catId) || { name: catName, total: 0, count: 0 };
    categoryMap.set(catId, {
      name: current.name,
      total: current.total + (Number(e.amount) || 0),
      count: current.count + 1,
    });
  }

  return Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);
}

/**
 * Calculate all profit metrics from revenue and expenses
 */
export function calculateProfitMetrics(revenue: number, expenses: ExpenseEntry[]): ProfitMetrics {
  const totalExpenses = calculateTotalExpenses(expenses);
  const netProfit = calculateNetProfit(revenue, totalExpenses);
  const profitMargin = calculateProfitMargin(revenue, netProfit);
  const byCategory = groupExpensesByCategory(expenses);

  return { totalExpenses, netProfit, profitMargin, byCategory };
}
