import { useEffect, useRef } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Camera, ImagePlus, X } from 'lucide-react-native';

import { AppText, Button, TextVariant } from '../../../../components';
import { colors } from '../../../../theme';
import {
  MAX_IMAGES,
  type FormImage,
} from '../../createReportForm.schema';
import {
  openAppPermissionSettings,
  pickReportImages,
} from '../../utils/pickReportImages';

const GAP = 10;
const COLS = 3;

type ImagePickerFieldProps = {
  value: FormImage[];
  onChange: (next: FormImage[]) => void;
  onBlur?: () => void;
  errorMessage?: string;
};

export function ImagePickerField({
  value,
  onChange,
  onBlur,
  errorMessage,
}: ImagePickerFieldProps) {
  const { width } = useWindowDimensions();
  const horizontalPad = 48;
  const cell = (width - horizontalPad - GAP * (COLS - 1)) / COLS;
  const remaining = MAX_IMAGES - value.length;
  const canAdd = remaining > 0;

  const pickingRef = useRef(false);
  const valueRef = useRef(value);
  const pickSessionRef = useRef(0);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const handlePick = async (source: 'camera' | 'library') => {
    if (pickingRef.current || !canAdd) {
      return;
    }
    pickingRef.current = true;
    onBlur?.();

    const session = ++pickSessionRef.current;

    try {
      const result = await pickReportImages(source, valueRef.current.length);
      if (session !== pickSessionRef.current) {
        return;
      }
      if (!result.ok) {
        if (result.reason === 'cancelled') {
          return;
        }
        if (result.reason === 'permission') {
          if (result.canOpenSettings) {
            Alert.alert(
              'Permission required',
              result.message ??
                'Enable access in Settings to continue. If the system closes the app after a permission change, reopen it and try again.',
              [
                { text: 'Not now', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: openAppPermissionSettings,
                },
              ],
            );
          }
          return;
        }
        Alert.alert(
          'Unable to add photos',
          result.message ?? 'The photos could not be added. Please try again.',
        );
        return;
      }

      if (result.skipped > 0) {
        const detail =
          result.skipReason === 'too_large'
            ? 'One or more photos exceed the size limit for this device.'
            : result.skipReason === 'unsupported_type'
              ? 'Please use JPEG, PNG, WebP, or HEIC images.'
              : 'One or more photos could not be added. Please try again.';
        Alert.alert(
          'Some photos were skipped',
          `${result.skipped} photo(s) were not added. ${detail}`,
        );
      }

      if (result.images.length > 0) {
        onChange(
          [...valueRef.current, ...result.images].slice(0, MAX_IMAGES),
        );
      }
    } finally {
      if (session === pickSessionRef.current) {
        pickingRef.current = false;
      }
    }
  };

  const removeAt = (index: number) => {
    onChange(valueRef.current.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.actions}>
        <Button
          variant="secondary"
          disabled={!canAdd}
          onPress={() => void handlePick('camera')}
          style={styles.actionBtn}
        >
          <View style={styles.actionInner}>
            <Camera size={18} color={colors.text} strokeWidth={2} />
            <AppText variant={TextVariant.Label} color="text">
              Camera
            </AppText>
          </View>
        </Button>
        <Button
          variant="ghost"
          disabled={!canAdd}
          onPress={() => void handlePick('library')}
          style={styles.actionBtn}
        >
          <View style={styles.actionInner}>
            <ImagePlus size={18} color={colors.primary} strokeWidth={2} />
            <AppText variant={TextVariant.Label} color="primary">
              Gallery
            </AppText>
          </View>
        </Button>
      </View>

      <AppText variant={TextVariant.Caption} color="textSoft">
        {value.length} of {MAX_IMAGES} photos
        {canAdd ? ' · 1–5 required' : ' · limit reached'}
      </AppText>

      {value.length > 0 ? (
        <View style={styles.grid}>
          {value.map((image, index) => (
            <View
              key={`${image.uri}-${index}`}
              style={[styles.cell, { width: cell }]}
            >
              <Image
                source={{ uri: image.uri }}
                style={[styles.thumb, { height: cell }]}
                resizeMode="cover"
                fadeDuration={0}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                hitSlop={6}
                onPress={() => removeAt(index)}
                style={styles.remove}
              >
                <X size={16} color={colors.white} strokeWidth={2.5} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <ImagePlus size={28} color={colors.mutedSoft} strokeWidth={1.75} />
          <AppText variant={TextVariant.Body} color="textSoft">
            Add 1–5 photos from camera or gallery
          </AppText>
        </View>
      )}

      {errorMessage ? (
        <AppText variant={TextVariant.Caption} color="statusFailedText">
          {errorMessage}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
  },
  actionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
  },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.header,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 36,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
  },
});
