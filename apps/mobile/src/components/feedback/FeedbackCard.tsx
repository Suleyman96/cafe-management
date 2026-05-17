import { useTranslation } from '@gustri/i18n';
import { TimeElapsed } from '@gustri/ui-mobile';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';

const FEEDBACK_TYPE_COLORS: Record<string, string> = {
  complaint: '#ef4444',
  praise: '#10b981',
};

interface FeedbackCardProps {
  feedback: {
    id: string;
    feedback_type?: string | null;
    message?: string | null;
    status: string;
    created_at: string;
    table_id?: string | null;
    table?: { table_number: number } | null;
  };
  onMarkRead: (id: string) => void;
  isProcessing?: boolean;
}

export const FeedbackCard = React.memo(function FeedbackCard({
  feedback,
  onMarkRead,
  isProcessing = false,
}: FeedbackCardProps) {
  const { t } = useTranslation('staff');

  const type = feedback.feedback_type || 'complaint';
  const typeColor = FEEDBACK_TYPE_COLORS[type] || '#6b7280';
  const typeLabel = t(`feedback.type.${type}`, { defaultValue: type });

  return (
    <Card style={[styles.card, { borderLeftColor: typeColor }]}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.info}>
            <Chip
              compact
              style={[styles.typeChip, { backgroundColor: typeColor }]}
              textStyle={{ color: '#fff', fontSize: 11, fontWeight: '600' }}
            >
              {typeLabel}
            </Chip>
            {feedback.table && (
              <Text variant="bodySmall" style={styles.muted}>
                {t('feedback.tableNumber', { number: feedback.table.table_number })}
              </Text>
            )}
          </View>
          <TimeElapsed createdAt={feedback.created_at} />
        </View>

        {feedback.message && (
          <Text variant="bodyMedium" style={styles.message}>
            {feedback.message}
          </Text>
        )}

        {feedback.status === 'pending' && (
          <View style={styles.actions}>
            <Button
              compact
              mode="contained"
              onPress={() => onMarkRead(feedback.id)}
              disabled={isProcessing}
              loading={isProcessing}
            >
              {t('feedback.markRead')}
            </Button>
          </View>
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
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeChip: {
    alignSelf: 'flex-start',
  },
  message: {
    color: '#374151',
  },
  muted: {
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
});
