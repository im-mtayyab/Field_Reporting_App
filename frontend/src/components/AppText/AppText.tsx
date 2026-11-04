import { Text, type TextProps, type TextStyle } from 'react-native';

import {
  colors,
  type ColorName,
  TextVariant,
  typography,
  type TypographyVariant,
} from '../../theme';

type AppTextProps = TextProps & {
  /**
   * Text style variant.
   * Values: TextVariant.Display | Headline | Title | Label | Body | Caption
   */
  variant?: TypographyVariant;
  /** Color token name from theme */
  color?: ColorName;
  /** Optional extra text styles */
  style?: TextStyle | TextStyle[];
};

/**
 * Text component that applies theme typography and color tokens.
 *
 * @example
 * <AppText variant={TextVariant.Title} color="primary">Reports</AppText>
 *
 * @example
 * <AppText variant={TextVariant.Caption} color="textSoft">Last synced 2m ago</AppText>
 */
export function AppText({
  variant = TextVariant.Body,
  color = 'text',
  style,
  children,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[typography[variant], { color: colors[color] }, style]}
    >
      {children}
    </Text>
  );
}

export { TextVariant };
