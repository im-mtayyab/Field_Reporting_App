import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ClipboardList, RotateCcw } from 'lucide-react-native';

import { retryReportAction } from '../../../../actions/uploadActions';
import {
  AppText,
  Card,
  StatusPill,
  TextVariant,
} from '../../../../components';
import {
  UploadAttachmentStatus,
  UploadReportStatus,
  type UploadReport,
} from '../../../../uploadQueue';
import { colors, uploadReportStatusTone } from '../../../../theme';
import { formatReportUploadSummary } from '../../utils/formatReportUploadSummary';
import { AttachmentRow } from '../AttachmentRow/AttachmentRow';

type ReportAccordionProps = {
  report: UploadReport;
  onChanged: () => void;
  onOpenLogs: () => void;
};

function accentFor(report: UploadReport): 'uploading' | 'failed' | 'done' | 'idle' {
  if (report.status === UploadReportStatus.Delivered) {
    return 'done';
  }
  if (
    report.status === UploadReportStatus.Failed ||
    report.attachments.some(
      (item) =>
        item.status === UploadAttachmentStatus.Failed ||
        item.status === UploadAttachmentStatus.Cancelled,
    )
  ) {
    return 'failed';
  }
  if (
    report.attachments.some(
      (item) =>
        item.status === UploadAttachmentStatus.Preparing ||
        item.status === UploadAttachmentStatus.Uploading ||
        item.status === UploadAttachmentStatus.Pending,
    )
  ) {
    return 'uploading';
  }
  return 'idle';
}

export function ReportAccordion({
  report,
  onChanged,
  onOpenLogs,
}: ReportAccordionProps) {
  const [retrying, setRetrying] = useState(false);
  const summary = formatReportUploadSummary(report);
  const accent = accentFor(report);
  const statusTone = uploadReportStatusTone(report.status);
  const description = report.description.trim() || 'Untitled report';

  const onRetryReport = async () => {
    setRetrying(true);
    await retryReportAction(report.id);
    setRetrying(false);
    onChanged();
  };

  return (
    <Card
      contentStyle={styles.cardContent}
      style={[
        styles.card,
        accent === 'uploading' && styles.cardUploading,
        accent === 'failed' && styles.cardFailed,
        accent === 'done' && styles.cardDone,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant={TextVariant.Title} color="text" numberOfLines={3}>
            {description}
          </AppText>

          <View style={styles.metaRow}>
            <StatusPill tone={statusTone} style={styles.statusPill} />
            <AppText
              variant={TextVariant.Caption}
              color="textSoft"
              numberOfLines={1}
            >
              {summary.line}
            </AppText>
          </View>
        </View>

        <View style={styles.headerActions}>
          {summary.canRetryCreate ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry"
              disabled={retrying}
              onPress={() => void onRetryReport()}
              hitSlop={6}
              style={({ pressed }) => [
                styles.headerIcon,
                pressed && !retrying && styles.iconPressed,
                retrying && styles.disabled,
              ]}
            >
              <RotateCcw size={18} color={colors.text} strokeWidth={2.25} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={onOpenLogs}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open logs"
            style={({ pressed }) => [
              styles.headerIcon,
              pressed && styles.iconPressed,
            ]}
          >
            <ClipboardList size={18} color={colors.primary} strokeWidth={2.25} />
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        {report.attachments.map((attachment, index) => (
          <AttachmentRow
            key={attachment.id}
            reportId={report.id}
            attachment={attachment}
            onChanged={onChanged}
            last={index === report.attachments.length - 1}
          />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.borderStrong,
  },
  cardUploading: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  cardFailed: {
    borderLeftWidth: 3,
    borderLeftColor: colors.statusFailedText,
  },
  cardDone: {
    borderLeftWidth: 3,
    borderLeftColor: colors.statusDeliveredText,
  },
  cardContent: {
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerText: {
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    flexShrink: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: colors.white,
  },
  disabled: {
    opacity: 0.4,
  },
});
