const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Resolve modules from both the project and monorepo node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Force single React version — redirect all 'react' imports to mobile's copy
const mobileReact = path.resolve(projectRoot, 'node_modules/react');
const mobileReactNative = path.resolve(projectRoot, 'node_modules/react-native');
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept react and react-native to prevent duplicate copies from pnpm
  if (
    moduleName === 'react' ||
    moduleName === 'react/jsx-runtime' ||
    moduleName === 'react/jsx-dev-runtime'
  ) {
    const subpath = moduleName.replace('react', '');
    return {
      type: 'sourceFile',
      filePath: require.resolve(`${mobileReact}${subpath}`),
    };
  }
  if (moduleName === 'react-native') {
    return {
      type: 'sourceFile',
      filePath: require.resolve(mobileReactNative),
    };
  }

  // Fall back to default resolution
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
