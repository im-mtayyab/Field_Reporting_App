import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';

/** No Android ripple / iOS highlight flash on tab press. */
export function TabBarButton(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      pressColor="transparent"
      pressOpacity={1}
      android_ripple={{ color: 'transparent' }}
    />
  );
}
