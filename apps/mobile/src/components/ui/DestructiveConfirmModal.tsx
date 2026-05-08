import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

interface DestructiveConfirmModalProps {
  visible: boolean;
  /** Already-localized title. */
  title: string;
  /** Already-localized body copy. */
  message: string;
  /** Already-localized confirm-button label (e.g. `t('common.delete')`). */
  confirmLabel: string;
  /** Already-localized cancel-button label. */
  cancelLabel: string;
  /** Hold duration before confirm fires. Default 1500 ms. */
  holdDurationMs?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const DEFAULT_HOLD_MS = 1500;
const TICK_MS = 30;

/**
 * Destructive-action confirmation dialog requiring the user to press-and-hold
 * the confirm button for ~1.5 s before the action fires. Replaces
 * `Alert.alert(..., [{ style: 'destructive' }])` for irreversible actions
 * (delete task, etc.) — a single mis-tap on a tap-to-confirm dialog is the
 * exact failure mode the audit's M2 closes.
 *
 * The button itself fills with a progress bar as the user holds; releasing
 * before completion resets. This visual affordance is intentional:
 * tapping does nothing (with no error), so the user discovers the gesture
 * by holding instinctively after the first tap fails. No new copy required —
 * the existing `t('common.delete')` button label plus the progress fill are
 * enough signal.
 */
export const DestructiveConfirmModal = React.memo(function DestructiveConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  holdDurationMs = DEFAULT_HOLD_MS,
  onConfirm,
  onCancel,
}: DestructiveConfirmModalProps) {
  const [progress, setProgress] = useState(0);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    setProgress(0);
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  // Cleanup on unmount so a hold-in-progress when the parent unmounts the
  // modal doesn't fire onConfirm against a stale closure.
  useEffect(() => () => reset(), [reset]);

  const handlePressIn = useCallback(() => {
    if (completionTimerRef.current) return;
    const startedAt = Date.now();
    tickTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const ratio = elapsed / holdDurationMs;
      setProgress(ratio >= 1 ? 1 : ratio);
    }, TICK_MS);
    completionTimerRef.current = setTimeout(() => {
      reset();
      onConfirm();
    }, holdDurationMs);
  }, [holdDurationMs, onConfirm, reset]);

  const handlePressOut = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCancel}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel}>{cancelLabel}</Button>
          <Pressable
            testID="destructive-confirm-button"
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.holdBtn}
          >
            <View
              testID="destructive-confirm-progress"
              style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]}
            />
            <Text style={styles.holdLabel}>{confirmLabel}</Text>
          </Pressable>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
});

const styles = StyleSheet.create({
  holdBtn: {
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 96,
    backgroundColor: 'transparent',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#fee2e2',
  },
  holdLabel: {
    color: '#ef4444',
    fontWeight: '600',
    textAlign: 'center',
  },
});
