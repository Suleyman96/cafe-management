import { useTranslation } from '@gustri/i18n';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text, TextInput } from 'react-native-paper';
import { TimeElapsed } from '@/components/ui';

const FEEDBACK_TYPE_COLORS: Record<string, string> = {
  complaint_food: '#ef4444',
  complaint_service: '#f97316',
  complaint_staff: '#ef4444',
  question_menu: '#3b82f6',
  request_general: '#6b7280',
  praise: '#10b981',
};

interface FeedbackCardProps {
  feedback: {
    id: string;
    feedback_type?: string | null;
    subject?: string | null;
    message?: string | null;
    status: string;
    response?: string | null;
    created_at: string;
    table_id?: string | null;
    table?: { table_number: number } | null;
    responded_by_staff?: { full_name: string } | null;
  };
  onAcknowledge: (id: string) => void;
  onRespond: (id: string, response: string) => void;
  onDismiss: (id: string) => void;
  isProcessing?: boolean;
}

export const FeedbackCard = React.memo(function FeedbackCard({
  feedback,
  onAcknowledge,
  onRespond,
  onDismiss,
  isProcessing = false,
}: FeedbackCardProps) {
  const { t } = useTranslation('staff');
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');

  const type = feedback.feedback_type || 'request_general';
  const typeColor = FEEDBACK_TYPE_COLORS[type] || '#6b7280';
  const typeLabel = t(`feedback.type.${type}`, { defaultValue: type });

  const handleSubmitReply = () => {
    if (replyText.trim()) {
      onRespond(feedback.id, replyText.trim());
      setShowReply(false);
      setReplyText('');
    }
  };

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

        {feedback.subject && (
          <Text variant="titleSmall" style={styles.subject}>
            {feedback.subject}
          </Text>
        )}

        {feedback.message && (
          <Text variant="bodyMedium" style={styles.message}>
            {feedback.message}
          </Text>
        )}

        {feedback.response && (
          <View style={styles.responseBox}>
            <Text variant="bodySmall" style={styles.responseLabel}>
              {t('feedback.responseBy', {
                name: feedback.responded_by_staff?.full_name || 'Staff',
              })}
            </Text>
            <Text variant="bodyMedium">{feedback.response}</Text>
          </View>
        )}

        {showReply && (
          <View style={styles.replySection}>
            <TextInput
              mode="outlined"
              placeholder={t('feedback.writeResponse')}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              numberOfLines={3}
              dense
            />
            <View style={styles.replyActions}>
              <Button compact onPress={() => setShowReply(false)} disabled={isProcessing}>
                {t('feedback.cancel')}
              </Button>
              <Button
                compact
                mode="contained"
                onPress={handleSubmitReply}
                disabled={!replyText.trim() || isProcessing}
                loading={isProcessing}
              >
                {t('feedback.send')}
              </Button>
            </View>
          </View>
        )}

        {feedback.status === 'pending' && !showReply && (
          <View style={styles.actions}>
            <Button
              compact
              mode="outlined"
              onPress={() => onAcknowledge(feedback.id)}
              disabled={isProcessing}
            >
              {t('feedback.acknowledge')}
            </Button>
            <Button
              compact
              mode="contained"
              onPress={() => setShowReply(true)}
              disabled={isProcessing}
            >
              {t('feedback.respond')}
            </Button>
            <Button
              compact
              onPress={() => onDismiss(feedback.id)}
              textColor="#6b7280"
              disabled={isProcessing}
            >
              {t('feedback.dismiss')}
            </Button>
          </View>
        )}

        {feedback.status === 'acknowledged' && !showReply && (
          <View style={styles.actions}>
            <Button
              compact
              mode="contained"
              onPress={() => setShowReply(true)}
              disabled={isProcessing}
            >
              {t('feedback.respond')}
            </Button>
            <Button
              compact
              onPress={() => onDismiss(feedback.id)}
              textColor="#6b7280"
              disabled={isProcessing}
            >
              {t('feedback.dismiss')}
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
  subject: {
    fontWeight: '600',
    color: '#1e293b',
  },
  message: {
    color: '#374151',
  },
  muted: {
    color: '#6b7280',
  },
  responseBox: {
    backgroundColor: '#f0fdf4',
    padding: 8,
    borderRadius: 6,
    gap: 2,
  },
  responseLabel: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 11,
  },
  replySection: {
    gap: 8,
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
});
