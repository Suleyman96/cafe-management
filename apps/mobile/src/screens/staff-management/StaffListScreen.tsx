import { useTranslation } from '@gustri/i18n';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Banner, Chip, Searchbar } from 'react-native-paper';
import { StaffCard } from '@/components/staff-management/StaffCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import { useStaff } from '@/hooks/shared';
import type { Staff, StaffManagementStackParamList } from '@/types';

type NavProp = StackNavigationProp<StaffManagementStackParamList, 'StaffList'>;

const ROLES: Staff['role'][] = ['waiter', 'kitchen', 'admin', 'owner'];

export default function StaffListScreen() {
  const { t } = useTranslation('staff');
  const navigation = useNavigation<NavProp>();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Staff['role'] | undefined>();

  const { data: staffList, isLoading, error, refetch } = useStaff(roleFilter);

  const filtered = useMemo(() => {
    if (!staffList) return [];
    if (!search) return staffList;
    return staffList.filter(
      (s) =>
        s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase()),
    );
  }, [staffList, search]);

  if (isLoading) return <LoadingScreen message={t('staffMgmt.loadingStaff')} />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <Banner visible icon="information-outline" style={styles.banner}>
        {t('staffMgmt.webOnlyManagement', {
          defaultValue: 'Use the web app to add, edit, or deactivate staff. Mobile is read-only.',
        })}
      </Banner>
      <Searchbar
        placeholder={t('staffMgmt.searchPlaceholder')}
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      <View style={styles.filterRow}>
        <Chip compact selected={!roleFilter} onPress={() => setRoleFilter(undefined)}>
          {t('staffMgmt.allRoles')}
        </Chip>
        {ROLES.map((r) => (
          <Chip
            key={r}
            compact
            selected={roleFilter === r}
            onPress={() => setRoleFilter(roleFilter === r ? undefined : r)}
          >
            {t(`staffMgmt.role.${r}`)}
          </Chip>
        ))}
      </View>

      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <StaffCard
            staff={item}
            onPress={(id) => navigation.navigate('StaffDetail', { staffId: id })}
          />
        )}
        ListEmptyComponent={<EmptyState icon="account-off" title={t('staffMgmt.noStaff')} />}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  banner: { backgroundColor: '#FEF3C7' },
  search: { marginHorizontal: 16, marginTop: 8 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  list: { paddingTop: 4, paddingBottom: 24 },
});
