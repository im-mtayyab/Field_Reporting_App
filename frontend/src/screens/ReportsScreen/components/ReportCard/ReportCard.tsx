import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import FastImage from 'react-native-fast-image';
import { Image as ImageIcon } from 'lucide-react-native';

import { Card } from '../../../../components/Card/Card';
import { Pill } from '../../../../components/Pill/Pill';
import { StatusPill } from '../../../../components/StatusPill/StatusPill';
import { AppText, TextVariant } from '../../../../components/AppText/AppText';
import { colors, reportStatusTone } from '../../../../theme';
import type { Report } from '../../../../types/report';
import { formatReportDate } from '../../utils/formatReportDate';

const THUMB = 72;

type ReportCardProps = {
  report: Report;
  onPress?: (report: Report) => void;
};

function ReportCardComponent({ report, onPress }: ReportCardProps) {
  const count = report.attachments.length;
  const cover = report.attachments.find((a) => Boolean(a.downloadUrl));
  const when = formatReportDate(report.updatedAt || report.createdAt);
  const description = report.description.trim() || 'Untitled report';
  const moreCount = Math.max(0, count - 1);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress?.(report)}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card accentLeft contentStyle={styles.content}>
        <View style={styles.row}>
          <View style={styles.thumbWrap}>
            {cover?.downloadUrl ? (
              <FastImage
                style={styles.thumb}
                objectFit="cover"
                objectPosition="top"
                source={{
                  uri: cover.downloadUrl,
                  priority: FastImage.priority.normal,
                  cache: FastImage.cacheControl.immutable,
                  cacheKey: cover.objectPath || cover.id,
                }}
              />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <ImageIcon
                  size={24}
                  color={count === 0 ? colors.mutedSoft : colors.primary}
                  strokeWidth={1.75}
                />
              </View>
            )}

            {moreCount > 0 ? (
              <Pill tone="accent" style={styles.morePill}>
                {`+${moreCount} more`}
              </Pill>
            ) : null}
          </View>

          <View style={styles.body}>
            <AppText
              variant={TextVariant.Body}
              color="text"
              numberOfLines={3}
              style={styles.description}
            >
              {description}
            </AppText>
            <AppText
              variant={TextVariant.Caption}
              color="textSoft"
              style={styles.meta}
            >
              {count === 0
                ? 'No photos'
                : count === 1
                  ? '1 photo'
                  : `${count} photos`}
              {'  ·  '}
              {when}
            </AppText>
            <StatusPill
              tone={reportStatusTone(report.status)}
              style={styles.statusPill}
            />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export const ReportCard = memo(ReportCardComponent);

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.92,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
    marginTop: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 0,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  morePill: {
    position: 'absolute',
    top: 4,
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  description: {
    fontWeight: '400',
  },
  meta: {
    marginTop: 6,
  },
  statusPill: {
    marginTop: 10,
  },
});

