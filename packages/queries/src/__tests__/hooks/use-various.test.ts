import { describe, expect, it } from 'vitest';
import { useExpense, useExpenseCategories, useExpenses } from '../../hooks/use-expenses';
import { useFeedback, usePendingFeedbackCount } from '../../hooks/use-feedback';
import {
  useMySchedule,
  useMyScheduleToday,
  useSchedulesByDate,
  useSchedulesByDateRange,
} from '../../hooks/use-schedules';
import {
  useLowStockCount,
  useStockItem,
  useStockItems,
  useStockMovements,
} from '../../hooks/use-stock';
import {
  useMyTasks,
  useRecurringTemplates,
  useTask,
  useTasks,
  useTodaysTasks,
} from '../../hooks/use-tasks';
import { usePendingWaiterCallsCount, useWaiterCalls } from '../../hooks/use-waiter-calls';
import {
  useTopWastedItems,
  useWasteDailySummary,
  useWasteLog,
  useWasteLogs,
  useWasteMonthlySummary,
} from '../../hooks/use-waste';
import { renderHookWithProviders } from '../helpers/test-utils';

// ─── Expenses ───────────────────────────────────────────────────────────────

describe('expense hooks', () => {
  it('useExpenses calls findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useExpenses({ year: 2026 }));
    expect(mockDb.expenses.findAll).toHaveBeenCalledWith({ year: 2026 });
  });

  it('useExpense disabled with empty id', () => {
    const { mockDb } = renderHookWithProviders(() => useExpense(''));
    expect(mockDb.expenses.findById).not.toHaveBeenCalled();
  });

  it('useExpense calls findById with id', () => {
    const { mockDb } = renderHookWithProviders(() => useExpense('e1'));
    expect(mockDb.expenses.findById).toHaveBeenCalledWith('e1');
  });

  it('useExpenseCategories calls findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useExpenseCategories());
    expect(mockDb.expenseCategories.findAll).toHaveBeenCalled();
  });
});

// ─── Stock ──────────────────────────────────────────────────────────────────

describe('stock hooks', () => {
  it('useStockItems forwards filter options', () => {
    const { mockDb } = renderHookWithProviders(() => useStockItems({ lowStockOnly: true }));
    expect(mockDb.stockItems.findAll).toHaveBeenCalledWith({ lowStockOnly: true });
  });

  it('useStockItem disabled with empty id', () => {
    const { mockDb } = renderHookWithProviders(() => useStockItem(''));
    expect(mockDb.stockItems.findById).not.toHaveBeenCalled();
  });

  it('useStockMovements forwards stockItemId', () => {
    const { mockDb } = renderHookWithProviders(() => useStockMovements('s1'));
    expect(mockDb.stockItems.getMovements).toHaveBeenCalledWith('s1');
  });

  it('useStockMovements disabled when id missing', () => {
    const { mockDb } = renderHookWithProviders(() => useStockMovements(''));
    expect(mockDb.stockItems.getMovements).not.toHaveBeenCalled();
  });

  it('useLowStockCount calls getLowStockCount', () => {
    const { mockDb } = renderHookWithProviders(() => useLowStockCount());
    expect(mockDb.stockItems.getLowStockCount).toHaveBeenCalled();
  });
});

// ─── Tasks ──────────────────────────────────────────────────────────────────

describe('task hooks', () => {
  it('useTasks forwards options', () => {
    const { mockDb } = renderHookWithProviders(() => useTasks({ status: 'pending' }));
    expect(mockDb.tasks.findAll).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('useTask disabled with empty id', () => {
    const { mockDb } = renderHookWithProviders(() => useTask(''));
    expect(mockDb.tasks.findById).not.toHaveBeenCalled();
  });

  it('useMyTasks forwards staffId', () => {
    const { mockDb } = renderHookWithProviders(() => useMyTasks('s1'));
    expect(mockDb.tasks.findMyTasks).toHaveBeenCalledWith('s1');
  });

  it('useMyTasks disabled with empty staffId', () => {
    const { mockDb } = renderHookWithProviders(() => useMyTasks(''));
    expect(mockDb.tasks.findMyTasks).not.toHaveBeenCalled();
  });

  it('useTodaysTasks calls getTodaysTasks', () => {
    const { mockDb } = renderHookWithProviders(() => useTodaysTasks());
    expect(mockDb.tasks.getTodaysTasks).toHaveBeenCalled();
  });

  it('useRecurringTemplates calls getRecurringTemplates', () => {
    const { mockDb } = renderHookWithProviders(() => useRecurringTemplates());
    expect(mockDb.tasks.getRecurringTemplates).toHaveBeenCalled();
  });
});

// ─── Schedules ──────────────────────────────────────────────────────────────

describe('schedule hooks', () => {
  it('useSchedulesByDate forwards date', () => {
    const { mockDb } = renderHookWithProviders(() => useSchedulesByDate('2026-04-26'));
    expect(mockDb.schedules.findByDate).toHaveBeenCalledWith('2026-04-26');
  });

  it('useSchedulesByDate disabled when date empty', () => {
    const { mockDb } = renderHookWithProviders(() => useSchedulesByDate(''));
    expect(mockDb.schedules.findByDate).not.toHaveBeenCalled();
  });

  it('useSchedulesByDateRange forwards date range', () => {
    const { mockDb } = renderHookWithProviders(() =>
      useSchedulesByDateRange('2026-04-01', '2026-04-30'),
    );
    expect(mockDb.schedules.findByDateRange).toHaveBeenCalledWith('2026-04-01', '2026-04-30');
  });

  it('useSchedulesByDateRange disabled when missing endDate', () => {
    const { mockDb } = renderHookWithProviders(() => useSchedulesByDateRange('2026-04-01', ''));
    expect(mockDb.schedules.findByDateRange).not.toHaveBeenCalled();
  });

  it('useMySchedule disabled when staffId missing', () => {
    const { mockDb } = renderHookWithProviders(() => useMySchedule('', '2026-04-01', '2026-04-30'));
    expect(mockDb.schedules.findByStaffRange).not.toHaveBeenCalled();
  });

  it('useMyScheduleToday forwards today date', () => {
    const { mockDb } = renderHookWithProviders(() => useMyScheduleToday('s1'));
    expect(mockDb.schedules.findByStaffAndDate).toHaveBeenCalledWith('s1', expect.any(String));
  });
});

// ─── Waste ──────────────────────────────────────────────────────────────────

describe('waste hooks', () => {
  it('useWasteLogs forwards options', () => {
    const { mockDb } = renderHookWithProviders(() => useWasteLogs({ reason: 'expired' }));
    expect(mockDb.waste.findAll).toHaveBeenCalledWith({ reason: 'expired' });
  });

  it('useWasteLog disabled when id missing', () => {
    const { mockDb } = renderHookWithProviders(() => useWasteLog(''));
    expect(mockDb.waste.findById).not.toHaveBeenCalled();
  });

  it('useWasteMonthlySummary forwards year/month', () => {
    const { mockDb } = renderHookWithProviders(() => useWasteMonthlySummary(2026, 4));
    expect(mockDb.waste.getMonthlySummary).toHaveBeenCalledWith(2026, 4);
  });

  it('useWasteDailySummary forwards date', () => {
    const { mockDb } = renderHookWithProviders(() => useWasteDailySummary('2026-04-26'));
    expect(mockDb.waste.getDailySummary).toHaveBeenCalledWith('2026-04-26');
  });

  it('useTopWastedItems forwards limit', () => {
    const { mockDb } = renderHookWithProviders(() => useTopWastedItems(5));
    expect(mockDb.waste.getTopWastedItems).toHaveBeenCalledWith(5);
  });
});

// ─── Feedback ───────────────────────────────────────────────────────────────

describe('feedback hooks', () => {
  it('useFeedback forwards status filter', () => {
    const { mockDb } = renderHookWithProviders(() => useFeedback('pending'));
    expect(mockDb.feedback.findAll).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('useFeedback omits filter when no status', () => {
    const { mockDb } = renderHookWithProviders(() => useFeedback());
    expect(mockDb.feedback.findAll).toHaveBeenCalledWith(undefined);
  });

  it('usePendingFeedbackCount calls getPendingCount', () => {
    const { mockDb } = renderHookWithProviders(() => usePendingFeedbackCount());
    expect(mockDb.feedback.getPendingCount).toHaveBeenCalled();
  });
});

// ─── Waiter Calls ───────────────────────────────────────────────────────────

describe('waiter call hooks', () => {
  it('useWaiterCalls forwards status filter', () => {
    const { mockDb } = renderHookWithProviders(() => useWaiterCalls('pending'));
    expect(mockDb.waiterCalls.findAll).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('useWaiterCalls omits filter when no status', () => {
    const { mockDb } = renderHookWithProviders(() => useWaiterCalls());
    expect(mockDb.waiterCalls.findAll).toHaveBeenCalledWith(undefined);
  });

  it('usePendingWaiterCallsCount calls getPendingCount', () => {
    const { mockDb } = renderHookWithProviders(() => usePendingWaiterCallsCount());
    expect(mockDb.waiterCalls.getPendingCount).toHaveBeenCalled();
  });
});
