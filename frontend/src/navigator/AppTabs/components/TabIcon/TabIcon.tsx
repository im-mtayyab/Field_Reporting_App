import type { LucideIcon } from 'lucide-react-native';

type TabIconProps = {
  Icon: LucideIcon;
  color: string;
  focused: boolean;
};

export function TabIcon({ Icon, color, focused }: TabIconProps) {
  return <Icon size={24} color={color} strokeWidth={focused ? 2.4 : 2} />;
}
