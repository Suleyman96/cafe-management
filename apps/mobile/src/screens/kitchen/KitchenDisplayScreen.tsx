import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@gustri/i18n';
import { ErrorScreen, Skeleton } from '@gustri/ui-mobile';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  PaperProvider,
  Portal,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KitchenFilterBar } from '@/components/kitchen/KitchenFilterBar';
import { KitchenFilterSheet } from '@/components/kitchen/KitchenFilterSheet';
import { KitchenOrderCard } from '@/components/kitchen/KitchenOrderCard';
import { BRAND_PRIMARY, COLORS, kitchenDarkTheme, TYPOGRAPHY } from '@/theme';
import { useKitchenDisplay } from './use-kitchen-display';

export default function KitchenDisplayScreen() {
  const { t } = useTranslation('staff');
  const insets = useSafeAreaInsets();

  const {
    kitchenOrders,
    pendingApprovalOrders,
    counts,
    activeFilter,
    staffId,
    categories,
    isLoading,
    filtersLoading,
    categoriesLoading,
    error,
    isRefetching,
    refetch,
    processingOrderId,
    filterSheetVisible,
    setFilterSheetVisible,
    rejectingOrder,
    setRejectingOrder,
    rejectReason,
    setRejectReason,
    approvingOrderId,
    cancelOrder,
    handleStartPreparing,
    handleMarkItemReady,
    handleMarkAllReady,
    handleMarkAllServed,
    handleApproveOrder,
    handleRejectOrder,
  } = useKitchenDisplay();

  const renderKitchenOrder = useCallback<ListRenderItem<(typeof kitchenOrders)[number]>>(
    ({ item }) => (
      <KitchenOrderCard
        // The card renders `order.order_items` — pass the per-station
        // visibleItems so a filtered station only sees what it owns.
        // hiddenCount/hiddenByCategory drive the coordination strip.
        order={{ ...item, order_items: item.visibleItems }}
        hiddenCount={item.hiddenCount}
        hiddenByCategory={item.hiddenByCategory}
        onStartPreparing={handleStartPreparing}
        onMarkItemReady={handleMarkItemReady}
        onMarkAllReady={handleMarkAllReady}
        onMarkAllServed={handleMarkAllServed}
        isProcessing={processingOrderId === item.id}
      />
    ),
    [
      handleStartPreparing,
      handleMarkItemReady,
      handleMarkAllReady,
      handleMarkAllServed,
      processingOrderId,
    ],
  );

  // Gate the loading screen on all three queries — without this, the first
  // paint shows orders un-filtered before the filter rows arrive a beat later.
  if (isLoading || filtersLoading || categoriesLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <KitchenListSkeleton />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ErrorScreen error={error} onRetry={refetch} />
      </View>
    );
  }

  const isFiltered = activeFilter.mode === 'filtered';

  return (
    // The kitchen route runs under a darker Paper theme so any Paper
    // surfaces (Dialog, TextInput, ActivityIndicator) match the kitchen's
    // dark canvas instead of inheriting the app-wide light theme.
    <PaperProvider theme={kitchenDarkTheme}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Status summary tiles — icon + count + label, mirroring the web
            kitchen header's New / Cooking / Ready stack. */}
        <View style={styles.summary}>
          <View style={[styles.summaryTile, { backgroundColor: BRAND_PRIMARY }]}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#fff" />
            <Text style={styles.summaryCount}>{counts.new}</Text>
            <Text style={styles.summaryLabel}>{t('kitchen.newOrders')}</Text>
          </View>
          <View style={[styles.summaryTile, { backgroundColor: COLORS.warning }]}>
            <MaterialCommunityIcons name="chef-hat" size={20} color="#000" />
            <Text style={[styles.summaryCount, { color: '#000' }]}>{counts.preparing}</Text>
            <Text style={[styles.summaryLabel, { color: '#1f2937' }]}>{t('kitchen.cooking')}</Text>
          </View>
          <View style={[styles.summaryTile, { backgroundColor: COLORS.success }]}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
            <Text style={styles.summaryCount}>{counts.ready}</Text>
            <Text style={styles.summaryLabel}>{t('kitchen.readyLabel')}</Text>
          </View>
        </View>

        {/* Pending QR Orders rail — only renders when there's something to
            approve. Horizontal scroll keeps the rail out of the main grid's
            vertical scroll. */}
        {pendingApprovalOrders.length > 0 && (
          <View style={styles.pendingRailWrap}>
            <View style={styles.pendingRailHeader}>
              <MaterialCommunityIcons name="cellphone" size={18} color="#fbbf24" />
              <Text style={styles.pendingRailTitle}>
                {t('kitchen.pendingQrOrders')} ({pendingApprovalOrders.length})
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pendingRailContent}
            >
              {pendingApprovalOrders.map((order) => {
                const itemCount =
                  order.order_items?.filter((i) => i.status !== 'cancelled').length || 0;
                const approving = approvingOrderId === order.id;
                return (
                  <View key={order.id} style={styles.pendingCard}>
                    <View style={styles.pendingCardHeader}>
                      <Text style={styles.pendingOrderNumber}>#{order.order_number || '—'}</Text>
                      <View style={styles.qrBadge}>
                        <MaterialCommunityIcons name="qrcode" size={12} color="#000" />
                        <Text style={styles.qrBadgeText}>QR</Text>
                      </View>
                    </View>
                    <Text style={styles.pendingTableLabel}>
                      {order.table?.table_number
                        ? t('kitchen.tableNumber', { number: order.table.table_number })
                        : t('orders.qrOrder')}
                    </Text>
                    <Text style={styles.pendingMeta}>
                      {t('kitchen.itemCount', { count: itemCount })}
                    </Text>
                    <View style={styles.pendingActions}>
                      <Button
                        mode="contained"
                        compact
                        onPress={() => handleApproveOrder(order.id)}
                        disabled={approving}
                        buttonColor={COLORS.success}
                        textColor="#fff"
                        style={styles.pendingActionBtn}
                      >
                        {approving ? (
                          <ActivityIndicator size={14} color="#fff" />
                        ) : (
                          t('approve', { ns: 'common' })
                        )}
                      </Button>
                      <Button
                        mode="contained"
                        compact
                        onPress={() =>
                          setRejectingOrder({ id: order.id, tableId: order.table_id ?? null })
                        }
                        buttonColor={COLORS.danger}
                        textColor="#fff"
                        style={styles.pendingActionBtn}
                      >
                        {t('reject', { ns: 'common' })}
                      </Button>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {staffId && (
          <KitchenFilterBar
            activeFilter={activeFilter}
            onPress={() => setFilterSheetVisible(true)}
          />
        )}

        <FlashList
          data={kitchenOrders}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#fff" />
          }
          renderItem={renderKitchenOrder}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {isFiltered ? t('kitchen.filter.empty') : t('kitchen.noActiveOrders')}
              </Text>
              <Text style={styles.emptySubtext}>
                {isFiltered ? t('kitchen.filter.emptyHint') : t('kitchen.waitingForOrders')}
              </Text>
            </View>
          }
          contentContainerStyle={styles.list}
        />

        {staffId && (
          <KitchenFilterSheet
            visible={filterSheetVisible}
            onDismiss={() => setFilterSheetVisible(false)}
            staffId={staffId}
            categories={categories}
          />
        )}

        {/* Reject reason dialog. Submission requires a non-empty reason. */}
        <Portal>
          <Dialog
            visible={!!rejectingOrder}
            onDismiss={() => {
              setRejectingOrder(null);
              setRejectReason('');
            }}
          >
            <Dialog.Title>
              {t('reject', { ns: 'common' })} #{rejectingOrder?.id.slice(-4).toUpperCase()}
            </Dialog.Title>
            <Dialog.Content>
              <Text style={styles.rejectHint}>{t('kitchen.rejectReason')}</Text>
              <TextInput
                mode="outlined"
                multiline
                numberOfLines={3}
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder={t('kitchen.rejectReasonPlaceholder')}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => {
                  setRejectingOrder(null);
                  setRejectReason('');
                }}
              >
                {t('cancel', { ns: 'common' })}
              </Button>
              <Button
                onPress={handleRejectOrder}
                disabled={!rejectReason.trim() || cancelOrder.isPending}
                loading={cancelOrder.isPending}
                buttonColor={COLORS.danger}
                textColor="#fff"
              >
                {t('reject', { ns: 'common' })}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    </PaperProvider>
  );
}

function KitchenListSkeleton() {
  return (
    <View style={skeletonStyles.wrap}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton cards have no identity
          key={i}
          style={skeletonStyles.card}
        >
          <View style={skeletonStyles.headRow}>
            <Skeleton width={120} height={28} style={skeletonStyles.darkBg} />
            <Skeleton width={56} height={20} radius={9999} style={skeletonStyles.darkBg} />
          </View>
          <Skeleton width="80%" height={14} style={skeletonStyles.darkBg} />
          <Skeleton width="65%" height={14} style={skeletonStyles.darkBg} />
          <Skeleton width="100%" height={40} style={skeletonStyles.darkBg} />
        </View>
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  wrap: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#262626',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#374151',
    padding: 14,
    gap: 10,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // The Skeleton's default light gray reads as a black smear on the dark
  // kitchen surface; brighten the band so the pulse stays visible.
  darkBg: { backgroundColor: '#3f3f46' },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  summaryTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 92,
  },
  summaryCount: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    fontSize: 12,
  },
  pendingRailWrap: {
    paddingTop: 4,
    paddingBottom: 12,
  },
  pendingRailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  pendingRailTitle: {
    color: '#fbbf24',
    fontWeight: '700',
    fontSize: 14,
  },
  pendingRailContent: {
    paddingHorizontal: 12,
    gap: 10,
  },
  pendingCard: {
    width: 200,
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: '#3b2a05',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  pendingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingOrderNumber: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 20,
  },
  qrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  qrBadgeText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 10,
  },
  pendingTableLabel: {
    color: '#fcd34d',
    fontWeight: '700',
    fontSize: 13,
  },
  pendingMeta: {
    color: '#d1d5db',
    fontSize: 12,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  pendingActionBtn: {
    flex: 1,
  },
  rejectHint: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 12,
  },
  list: {
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    ...TYPOGRAPHY.sectionHeader,
    color: COLORS.textMuted,
  },
  emptySubtext: {
    ...TYPOGRAPHY.body,
    color: '#4b5563',
    marginTop: 4,
  },
});
