import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Check, ChevronDown, X } from 'lucide-react-native';

import { colors, typography } from '../../theme';
import { AppText, TextVariant } from '../AppText/AppText';

export type SearchMultiSelectOption = {
  label: string;
  value: string;
};

type SearchMultiSelectProps = {
  value: string[];
  options: SearchMultiSelectOption[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  title?: string;
};

export function SearchMultiSelect({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  disabled,
  title,
}: SearchMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Draft selection inside the modal — avoids refiltering the whole logs list
  // on every tap (that was the lag). Commit on Done.
  const [draft, setDraft] = useState<string[]>(value);
  const draftSetRef = useRef(new Set(value));

  useEffect(() => {
    if (!open) {
      setDraft(value);
      draftSetRef.current = new Set(value);
    }
  }, [value, open]);

  const selected = useMemo(() => {
    const set = new Set(value);
    return options.filter((option) => set.has(option.value));
  }, [options, value]);

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0].label
        : `${selected.length} selected`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return options;
    }
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        option.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const openModal = () => {
    if (disabled) {
      return;
    }
    setDraft(value);
    draftSetRef.current = new Set(value);
    setQuery('');
    setOpen(true);
  };

  const closeWithoutCommit = () => {
    setOpen(false);
    setQuery('');
  };

  const commitAndClose = () => {
    onChange(draft);
    setOpen(false);
    setQuery('');
  };

  const toggle = (next: string) => {
    const set = new Set(draftSetRef.current);
    if (set.has(next)) {
      set.delete(next);
    } else {
      set.add(next);
    }
    draftSetRef.current = set;
    setDraft(Array.from(set));
  };

  const selectAllFiltered = () => {
    const set = new Set(draftSetRef.current);
    for (const option of filtered) {
      set.add(option.value);
    }
    draftSetRef.current = set;
    setDraft(Array.from(set));
  };

  const clearDraft = () => {
    draftSetRef.current = new Set();
    setDraft([]);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={openModal}
        style={({ pressed }) => [
          styles.trigger,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <View style={styles.triggerText}>
          {title ? (
            <AppText variant={TextVariant.Caption} color="textSoft">
              {title}
            </AppText>
          ) : null}
          <AppText
            variant={TextVariant.Label}
            color={selected.length ? 'text' : 'mutedSoft'}
            numberOfLines={1}
          >
            {summary}
          </AppText>
        </View>
        <ChevronDown size={16} color={colors.textSoft} strokeWidth={2.4} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeWithoutCommit}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeWithoutCommit}
            accessibilityLabel="Dismiss"
          />
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <AppText variant={TextVariant.Label} color="white">
                {title || placeholder}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                onPress={closeWithoutCommit}
                style={styles.closeBtn}
              >
                <X size={18} color={colors.white} strokeWidth={2.25} />
              </Pressable>
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.mutedSoft}
              autoCorrect={false}
              style={styles.search}
            />

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              extraData={draft}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={
                <AppText
                  variant={TextVariant.Body}
                  color="textSoft"
                  style={styles.empty}
                >
                  No results{query ? ` for “${query}”` : ''}
                </AppText>
              }
              renderItem={({ item }) => {
                const active = draft.includes(item.value);
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => toggle(item.value)}
                    style={[styles.option, active && styles.optionOn]}
                  >
                    <AppText
                      variant={TextVariant.Body}
                      color="text"
                      style={styles.optionLabel}
                      numberOfLines={1}
                    >
                      {item.label}
                    </AppText>
                    {active ? (
                      <Check
                        size={16}
                        color={colors.primary}
                        strokeWidth={2.5}
                      />
                    ) : (
                      <View style={styles.checkSlot} />
                    )}
                  </Pressable>
                );
              }}
            />

            <View style={styles.footer}>
              <Pressable
                disabled={filtered.length === 0}
                onPress={selectAllFiltered}
                style={styles.footerBtn}
              >
                <AppText variant={TextVariant.Caption} color="primary">
                  Select all
                </AppText>
              </Pressable>
              <Pressable
                disabled={draft.length === 0}
                onPress={clearDraft}
                style={styles.footerBtn}
              >
                <AppText variant={TextVariant.Caption} color="textSoft">
                  Clear
                </AppText>
              </Pressable>
              <Pressable onPress={commitAndClose} style={styles.footerDone}>
                <AppText variant={TextVariant.Caption} color="white">
                  Done
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
  },
  triggerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  pressed: {
    backgroundColor: colors.surfaceAlt,
  },
  disabled: {
    opacity: 0.45,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  panel: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    maxHeight: '75%',
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.footerBar,
    backgroundColor: colors.header,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    ...typography[TextVariant.Body],
    margin: 12,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.white,
  },
  list: {
    maxHeight: 280,
    marginTop: 8,
  },
  empty: {
    padding: 16,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionOn: {
    backgroundColor: colors.surfaceAlt,
  },
  optionLabel: {
    flex: 1,
  },
  checkSlot: {
    width: 16,
    height: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  footerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  footerDone: {
    marginLeft: 'auto',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.primary,
  },
});
