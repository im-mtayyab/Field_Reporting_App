import { useNetInfo } from '@react-native-community/netinfo';

/** Online flag for sync/upload. App still works offline. */
export function useNetwork() {
  const { isConnected } = useNetInfo();

  return {
    isOnline: isConnected !== false,
  };
}
