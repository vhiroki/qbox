import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import path from 'path';
import { importSigningCertificate } from './scripts/import-signing-cert';

// Import certificate from CSC_LINK if provided (for CI/CD)
const { identity: signingIdentity, keychain: keychainPath } = importSigningCertificate();

const config: ForgeConfig = {
  packagerConfig: {
    name: 'QBox',
    executableName: 'qbox',
    appBundleId: 'com.qbox.app',
    appCategoryType: 'public.app-category.developer-tools',
    icon: path.resolve(__dirname, 'assets', 'icons', 'icon'),
    asar: true,
    extraResource: [
      // Backend executable will be placed here by the build script
      path.resolve(__dirname, '..', 'backend', 'dist'),
    ],
    // Code signing configuration for macOS
    // Uses certificate from CSC_LINK (imported above) or from local Keychain
    ...(signingIdentity ? {
      osxSign: {
        identity: signingIdentity,
        keychain: keychainPath,
        optionsForFile: () => ({
          hardenedRuntime: true,
          entitlements: path.resolve(__dirname, 'entitlements.plist'),
          'entitlements-inherit': path.resolve(__dirname, 'entitlements.plist'),
        }),
      },
      ...(process.env.APPLE_ID ? {
        osxNotarize: {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_PASSWORD || '',
          teamId: process.env.APPLE_TEAM_ID || '',
        },
      } : {}),
    } : {}),
  },
  rebuildConfig: {},
  makers: [
    // Windows installer (disabled - add icons first)
    // new MakerSquirrel({
    //   name: 'qbox',
    //   authors: 'QBox Team',
    //   description: 'AI-powered data query application',
    //   iconUrl: 'https://example.com/icon.ico',
    //   setupIcon: path.resolve(__dirname, 'assets', 'icons', 'icon.ico'),
    //   loadingGif: undefined,
    //   noMsi: true,
    // }),
    // macOS DMG
    new MakerDMG({
      name: 'QBox',
      icon: path.resolve(__dirname, 'assets', 'icons', 'icon.icns'),
      background: undefined,
      format: 'ULFO',
    }),
    // Linux Debian package (disabled - add icons first)
    // new MakerDeb({
    //   options: {
    //     name: 'qbox',
    //     productName: 'QBox',
    //     genericName: 'Data Query Tool',
    //     description: 'AI-powered data query application',
    //     categories: ['Development', 'Database'],
    //     icon: path.resolve(__dirname, 'assets', 'icons', 'icon.png'),
    //     maintainer: 'QBox Team',
    //     homepage: 'https://github.com/yourusername/qbox',
    //   },
    // }),
    // Linux RPM package (disabled - add icons first)
    // new MakerRpm({
    //   options: {
    //     name: 'qbox',
    //     productName: 'QBox',
    //     genericName: 'Data Query Tool',
    //     description: 'AI-powered data query application',
    //     categories: ['Development', 'Database'],
    //     icon: path.resolve(__dirname, 'assets', 'icons', 'icon.png'),
    //     homepage: 'https://github.com/yourusername/qbox',
    //   },
    // }),
  ],
  plugins: [
    new VitePlugin({
      // Vite config for main process
      build: [
        {
          entry: 'electron/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'electron/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      // Vite config for renderer process
      renderer: [
        {
          name: 'main_window',
          config: 'vite.config.ts',
        },
      ],
    }),
  ],
  hooks: {
    postMake: async (forgeConfig, makeResults) => {
      console.log('✅ Make completed successfully!');
      console.log('\nGenerated artifacts:');
      makeResults.forEach((result) => {
        console.log(`\n📦 Platform: ${result.platform}/${result.arch}`);
        result.artifacts.forEach((artifact) => {
          console.log(`   - ${artifact}`);
        });
      });
      return makeResults;
    },
  },
};

export default config;

