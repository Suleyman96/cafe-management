import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';
import { TimeElapsed } from '@/components/ui';
import { WAITER_CALL_REASON_COLORS } from '@/theme';

interface WaiterCallCardProps {
  call: {
    id: string;
    call_type: string;
    reason: string;
    status: string;
    created_at: string;
    acknowledged_at?: string | null;
    resolved_at?: string | null;
    table_id: string;
    table?: { table_number: string; location?: string | null } | null;
  };
  onAcknowledge: (callId: string) => void;
  onResolve: (callId: string) => void;
}

export const WaiterCallCard = React.memo(function WaiterCallCard({
  call,
  onAcknowledge,
  onResolve,
}: WaiterCallCardProps) {
  const callType = call.call_type || 'assistance';
  const reasonColor = WAITER_CALL_REASON_COLORS[callType] || '#6b7280';

  return (
    <Card style={[styles.card, { borderLeftColor: reasonColor }]}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.tableInfo}>
            <Text variant="titleLarge" style={styles.tableNumber}>
              Table #{call.table?.table_number || '—'}
            </Text>
            {call.table?.location && (
              <Text variant="bodySmall" style={styles.muted}>
                {call.table.location}
              </Text>
            )}
          </View>
          <TimeElapsed createdAt={call.created_at} showColor />
        </View>

        <Chip
          compact
          style={[styles.reasonChip, { backgroundColor: reasonColor }]}
          textStyle={{ color: '#fff', fontSize: 11, fontWeight: '600' }}
        >
          {callType.charAt(0).toUpperCase() + callType.slice(1)}
        </Chip>

        {call.reason ? (
          <Text variant="bodySmall" style={styles.reasonText}>
            {call.reason}
          </Text>
        ) : null}

        {call.status === 'pending' && (
          <Button
            mode="contained"
            onPress={() => onAcknowledge(call.id)}
            style={styles.actionButton}
          >
            Acknowledge
          </Button>
        )}

        {call.status === 'acknowledged' && (
          <Button
            mode="contained"
            onPress={() => onResolve(call.id)}
            style={[styles.actionButton, { backgroundColor: '#10b981' }]}
          >
            Resolve
          </Button>
        )}

        {call.status === 'resolved' && call.resolved_at && (
          <Text variant="bodySmall" style={styles.muted}>
            Resolved at {new Date(call.resolved_at).toLocaleTimeString()}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  content: {
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tableInfo: {
    gap: 2,
  },
  tableNumber: {
    fontWeight: '700',
    color: '#1e293b',
  },
  muted: {
    color: '#6b7280',
  },
  reasonText: {
    color: '#374151',
    fontStyle: 'italic',
  },
  reasonChip: {
    alignSelf: 'flex-start',
  },
  actionButton: {
    alignSelf: 'flex-end',
  },
});
