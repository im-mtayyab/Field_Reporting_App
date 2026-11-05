import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Pause, Play, RotateCcw, X } from 'lucide-react-native';

import {
  cancelAttachmentAction,
  pauseAttachmentAction,
  resumeAttachmentAction,
  retryAttachmentAction,
} from '../../../../actions/uploadActions';
import { AppText, TextVariant } from '../../../../components';
import {
  UploadAttachmentStatus,
  type UploadAttachment,
} from '../../../../uploadQueue';
import { useUploadProgress } from '../../../../store/uploadProgress';
import { colors } from '../../../../theme';
import { getAttachmentProgressView } from '../../utils/attachmentProgress';

type RowAction = 'pause' | 'resume' | 'cancel' | 'retry';
type ControlMode = 'preparing' | 'uploading' | 'paused' | 'retry' | 'none';

type AttachmentRowProps = {
  reportId: string;
  attachment: UploadAttachment;
  onChanged: () => void;
  last?: boolean;
};

function modeFromView(view: {
  preparing: boolean;
  uploading: boolean;
  paused: boolean;
  canRetry: boolean;
}): ControlMode {
  if (view.preparing) {
    return 'preparing';
  }
  if (view.uploading) {
    return 'uploading';
  }
  if (view.paused) {
    return 'paused';
  }
  if (view.canRetry) {
    return 'retry';
  }
  return 'none';
}

function actionSettled(
  action: RowAction,
  status: UploadAttachmentStatus,
): boolean {
  switch (action) {
    case 'pause':
      return status === UploadAttachmentStatus.Paused;
    case 'resume':
    case 'retry':
      return (
        status === UploadAttachmentStatus.Uploading ||
        status === UploadAttachmentStatus.Pending ||
        status === UploadAttachmentStatus.Uploaded
      );
    case 'cancel':
      return status === UploadAttachmentStatus.Cancelled;
    default:
      return false;
  }
}

export function AttachmentRow({
  reportId,
  attachment,
  onChanged,
  last = false,
}: AttachmentRowProps) {
  const live = useUploadProgress((s) => s.byAttachmentId[attachment.id]);
  const [optimisticStatus, setOptimisticStatus] =
    useState<UploadAttachmentStatus | null>(null);
  const [pendingAction, setPendingAction] = useState<RowAction | null>(null);
  /** Keep the same icons on screen until the action actually settles. */
  const [frozenMode, setFrozenMode] = useState<ControlMode | null>(null);
  const actionGen = useRef(0);

  useEffect(() => {
    if (pendingAction == null || optimisticStatus == null) {
      return;
    }
    if (
      attachment.status === UploadAttachmentStatus.Uploaded ||
      actionSettled(pendingAction, attachment.status)
    ) {
      setOptimisticStatus(null);
      setPendingAction(null);
      setFrozenMode(null);
    }
  }, [attachment.status, optimisticStatus, pendingAction]);

  useEffect(() => {
    if (attachment.status === UploadAttachmentStatus.Uploaded) {
      useUploadProgress.getState().clear(attachment.id);
    }
  }, [attachment.id, attachment.status]);

  // Hold optimistic status for the whole in-flight action (no mid-poll flicker).
  const displayAttachment =
    pendingAction != null && optimisticStatus != null
      ? { ...attachment, status: optimisticStatus }
      : attachment;
  const view = getAttachmentProgressView(displayAttachment, live);
  const locked = pendingAction != null;
  const controlMode = frozenMode ?? modeFromView(view);

  const run = (
    action: RowAction,
    nextStatus: UploadAttachmentStatus,
    fn: () => Promise<{ ok: boolean; message?: string }>,
  ) => {
    if (locked) {
      return;
    }
    const gen = ++actionGen.current;
    setFrozenMode(modeFromView(view));
    setPendingAction(action);
    setOptimisticStatus(nextStatus);
    void (async () => {
      const result = await fn();
      if (gen !== actionGen.current) {
        return;
      }
      if (!result.ok) {
        setOptimisticStatus(null);
        setPendingAction(null);
        setFrozenMode(null);
      }
      onChanged();
    })();
  };

  const actionButtons =
    controlMode === 'preparing' ? (
      <IconButton
        label="Cancel"
        disabled={locked}
        onPress={() =>
          run('cancel', UploadAttachmentStatus.Cancelled, () =>
            cancelAttachmentAction(reportId, attachment.id),
          )
        }
      >
        <X size={18} color={colors.textSoft} strokeWidth={2.25} />
      </IconButton>
    ) : controlMode === 'uploading' ? (
      <>
        <IconButton
          label="Pause"
          disabled={locked}
          onPress={() =>
            run('pause', UploadAttachmentStatus.Paused, () =>
              pauseAttachmentAction(reportId, attachment.id),
            )
          }
        >
          <Pause size={18} color={colors.text} strokeWidth={2.25} />
        </IconButton>
        <IconButton
          label="Cancel"
          disabled={locked}
          onPress={() =>
            run('cancel', UploadAttachmentStatus.Cancelled, () =>
              cancelAttachmentAction(reportId, attachment.id),
            )
          }
        >
          <X size={18} color={colors.textSoft} strokeWidth={2.25} />
        </IconButton>
      </>
    ) : controlMode === 'paused' ? (
      <>
        <IconButton
          label="Resume"
          disabled={locked}
          onPress={() =>
            run('resume', UploadAttachmentStatus.Uploading, () =>
              resumeAttachmentAction(reportId, attachment.id),
            )
          }
        >
          <Play size={18} color={colors.text} strokeWidth={2.25} />
        </IconButton>
        <IconButton
          label="Cancel"
          disabled={locked}
          onPress={() =>
            run('cancel', UploadAttachmentStatus.Cancelled, () =>
              cancelAttachmentAction(reportId, attachment.id),
            )
          }
        >
          <X size={18} color={colors.textSoft} strokeWidth={2.25} />
        </IconButton>
      </>
    ) : controlMode === 'retry' ? (
      <IconButton
        label="Retry"
        disabled={locked}
        onPress={() =>
          run('retry', UploadAttachmentStatus.Uploading, () =>
            retryAttachmentAction(reportId, attachment.id),
          )
        }
      >
        <RotateCcw size={18} color={colors.text} strokeWidth={2.25} />
      </IconButton>
    ) : null;

  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Image
        source={{ uri: attachment.localUri }}
        style={styles.thumb}
        resizeMode="cover"
      />
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <AppText
              variant={TextVariant.Label}
              color="text"
              numberOfLines={1}
              style={styles.fileName}
            >
              {attachment.fileName}
            </AppText>
            <AppText
              variant={TextVariant.Caption}
              color={view.statusColor}
              numberOfLines={2}
            >
              {view.statusLine}
            </AppText>
          </View>
          <View style={styles.actions}>{actionButtons}</View>
        </View>

        {view.showBar ? (
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${view.pct}%`,
                  backgroundColor: view.fillColor,
                },
              ]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function IconButton({
  label,
  onPress,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      // Stable press feedback — no ripple remount flash on Android.
      style={({ pressed }) => [
        styles.iconBtn,
        pressed && !disabled && styles.iconBtnPressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  thumb: {
    width: 40,
    height: 40,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  main: {
    flex: 1,
    gap: 10,
    minWidth: 0,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  fileName: {
    minWidth: 0,
  },
  track: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 1.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    flexShrink: 0,
    minWidth: 76,
    minHeight: 36,
    marginTop: -2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    backgroundColor: colors.border,
  },
});
