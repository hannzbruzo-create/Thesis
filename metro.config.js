
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer/expo'
);

config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== 'svg'
);

config.resolver.sourceExts.push('svg');

// Always load Three.js's ES module build. Its CommonJS build (three.cjs) calls
// Node's process.emitWarning on load, which crashes React Native. One path also
// keeps a single Three.js instance for the app and @react-three/fiber.
const path = require('path');
const threeModule = path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.js');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: threeModule };
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
