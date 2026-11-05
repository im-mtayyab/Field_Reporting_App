import { TextStyle } from 'react-native';

import { fonts, fontWeights } from './fonts';

type TextVariantStyle = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing'
>;

/**
 * Available text variants for AppText.
 *
 * @example
 * <AppText variant={TextVariant.Headline}>Home</AppText>
 */
export const TextVariant = {
  Display: 'display',
  Headline: 'headline',
  Title: 'title',
  Label: 'label',
  Body: 'body',
  Caption: 'caption',
  /** Uppercase section / chip labels */
  Overline: 'overline',
} as const;

export type TypographyVariant = (typeof TextVariant)[keyof typeof TextVariant];

/** Shared text styles used throughout the application. */
export const typography: Record<TypographyVariant, TextVariantStyle> = {
  /** Large page titles */
  [TextVariant.Display]: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.25,
  },

  /** Section headings */
  [TextVariant.Headline]: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: fontWeights.bold,
    letterSpacing: 0,
  },

  /** Card and list titles */
  [TextVariant.Title]: {
    fontFamily: fonts.medium,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.1,
  },

  /** Button and form labels */
  [TextVariant.Label]: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.1,
  },

  /** Default body text */
  [TextVariant.Body]: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.15,
  },

  /** Secondary and helper text */
  [TextVariant.Caption]: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.2,
  },

  /** Uppercase chips, section labels, badges */
  [TextVariant.Overline]: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.6,
  },
};
