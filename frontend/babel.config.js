module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Zod v4 ships `export * as` — Metro needs this transform.
    '@babel/plugin-transform-export-namespace-from',
    'react-native-worklets/plugin',
  ],
};
