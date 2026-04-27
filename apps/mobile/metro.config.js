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

// Force single copies — redirect shared dependencies to mobile's copy
// to prevent duplicate React contexts from pnpm's isolated node_modules
const mobileReact = path.resolve(projectRoot, 'node_modules/react');
const mobileReactNative = path.resolve(projectRoot, 'node_modules/react-native');
const mobileReactQuery = path.resolve(projectRoot, 'node_modules/@tanstack/react-query');
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
  // Force single @tanstack/react-query — prevents "No QueryClient set" error
  // when @gustri/queries resolves a different copy than the mobile app
  if (moduleName === '@tanstack/react-query') {
    return {
      type: 'sourceFile',
      filePath: require.resolve(mobileReactQuery),
    };
  }

  // Fall back to default resolution
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
