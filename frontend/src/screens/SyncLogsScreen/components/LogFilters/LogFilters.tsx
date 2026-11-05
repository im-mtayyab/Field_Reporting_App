import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';

import {
  AppText,
  SearchMultiSelect,
  TextVariant,
  type SearchMultiSelectOption,
} from '../../../../components';
import { colors } from '../../../../theme';
import { LOG_LEVEL_OPTIONS } from '../../utils/buildLogFilters';

type SelectedPill = {
  key: string;
  label: string;
  kind: 'level' | 'image';
  value: string;
};

type LogFiltersProps = {
  levels: string[];
  images: string[];
  imageOptions: SearchMultiSelectOption[];
  selectedPills: SelectedPill[];
  onLevelsChange: (next: string[]) => void;
  onImagesChange: (next: string[]) => void;
  onRemovePill: (kind: 'level' | 'image', value: string) => void;
};

export function LogFilters({
  levels,
  images,
  imageOptions,
  selectedPills,
  onLevelsChange,
  onImagesChange,
  onRemovePill,
}: LogFiltersProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.selects}>
        <SearchMultiSelect
          title="Level"
          placeholder="All levels"
          searchPlaceholder="Search levels…"
          options={LOG_LEVEL_OPTIONS}
          value={levels}
          onChange={onLevelsChange}
        />
        <SearchMultiSelect
          title="Images"
          placeholder="All images"
          searchPlaceholder="Search images…"
          options={imageOptions}
          value={images}
          onChange={onImagesChange}
          disabled={imageOptions.length === 0}
        />
      </View>

      {selectedPills.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
        >
          {selectedPills.map((pill) => (
            <Pressable
              key={pill.key}
              onPress={() => onRemovePill(pill.kind, pill.value)}
              style={styles.pill}
            >
              <AppText
                variant={TextVariant.Label}
                color="text"
                style={styles.pillText}
                numberOfLines={1}
              >
                {pill.label}
              </AppText>
              <X size={12} color={colors.textSoft} strokeWidth={2.5} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },
  selects: {
    flexDirection: 'row',
    gap: 8,
  },
  pills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
  },
  pillText: {
    flexShrink: 1,
  },
});
