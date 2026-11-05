import { useCallback, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { enqueueReportAction } from '../../actions/uploadActions';
import {
  AppFormScreen,
  AppHeader,
  AppText,
  Button,
  GlobalLoader,
  ScreenIntro,
} from '../../components';
import type { MainTabScreenProps } from '../../navigator/types';
import { colors, TextVariant, typography } from '../../theme';
import { ImagePickerField } from './components/ImagePickerField/ImagePickerField';
import {
  createReportFormSchema,
  MAX_IMAGES,
  MIN_IMAGES,
  type CreateReportFormValues,
} from './createReportForm.schema';
import { requestMediaPermission } from './utils/requestCreateMediaPermissions';

const DEFAULT_VALUES: CreateReportFormValues = {
  description: '',
  images: [],
};

export function CreateScreen() {
  const navigation =
    useNavigation<MainTabScreenProps<'CreateScreen'>['navigation']>();
  const [savePhase, setSavePhase] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateReportFormValues>({
    resolver: zodResolver(createReportFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const description = useWatch({ control, name: 'description' });
  const images = useWatch({ control, name: 'images' });
  const canSave =
    description.trim().length > 0 &&
    images.length >= MIN_IMAGES &&
    images.length <= MAX_IMAGES;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const timer = setTimeout(() => {
        if (!cancelled) {
          void requestMediaPermission('camera');
        }
      }, 400);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, []),
  );

  const onSubmit = async (values: CreateReportFormValues) => {
    const saved = await enqueueReportAction({
      description: values.description,
      images: values.images,
      onPhase: setSavePhase,
    });

    if (!saved.ok) {
      setSavePhase(null);
      Alert.alert(
        'Unable to save report',
        saved.message ||
          'The report was not saved. Your entries remain on this screen so you can try again.',
      );
      return;
    }

    reset(DEFAULT_VALUES);
    setSavePhase(null);
    navigation.navigate('SyncScreen');
  };

  const busy = isSubmitting || savePhase != null;

  return (
    <View style={styles.flex} pointerEvents={busy ? 'none' : 'auto'}>
      <AppHeader />
      <AppFormScreen contentStyle={styles.content}>
        <ScreenIntro
          title="New report"
          description="Add a short description and one to five photos. The report is stored on this device, then registered with the server before uploads continue."
          style={styles.intro}
        />
        <View style={styles.field}>
          <AppText variant={TextVariant.Label} color="text">
            Description{' '}
            <AppText variant={TextVariant.Label} color="statusFailedText">
              *
            </AppText>
          </AppText>
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                editable={!busy}
                placeholder="What did you see on site?"
                placeholderTextColor={colors.mutedSoft}
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
                style={[
                  styles.input,
                  errors.description ? styles.inputError : null,
                ]}
              />
            )}
          />
          {errors.description?.message ? (
            <AppText variant={TextVariant.Caption} color="statusFailedText">
              {errors.description.message}
            </AppText>
          ) : null}
        </View>

        <View style={styles.field}>
          <AppText variant={TextVariant.Label} color="text">
            Photos{' '}
            <AppText variant={TextVariant.Label} color="statusFailedText">
              *
            </AppText>
          </AppText>
          <Controller
            control={control}
            name="images"
            render={({ field: { onChange, onBlur, value } }) => (
              <ImagePickerField
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                errorMessage={errors.images?.message}
              />
            )}
          />
        </View>

        <Button
          loading={busy}
          disabled={!canSave || busy}
          onPress={handleSubmit(onSubmit)}
          style={[styles.submit, !canSave && styles.submitMuted]}
        >
          Save report
        </Button>
      </AppFormScreen>

      <GlobalLoader
        visible={busy}
        message={savePhase || 'Saving report…'}
        detail="The report is registered with the server, then Uploads opens while photos continue preparing."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
  },
  intro: {
    marginBottom: 20,
  },
  field: {
    marginBottom: 20,
    gap: 8,
  },
  input: {
    ...typography[TextVariant.Body],
    minHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.statusFailedText,
  },
  submit: {
    marginTop: 4,
  },
  submitMuted: {
    backgroundColor: colors.mutedSoft,
  },
});
