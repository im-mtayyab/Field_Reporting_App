declare module 'react-native-config' {
  export type NativeConfig = {
    API_URL?: string;
    API_TIMEOUT?: string;
  };

  export const Config: NativeConfig;
  export default Config;
}
