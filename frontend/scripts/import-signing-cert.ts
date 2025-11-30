/**
 * macOS Code Signing Certificate Import
 *
 * This module handles importing certificates from CSC_LINK environment variable
 * for CI/CD environments (like GitHub Actions). It mimics electron-builder's
 * behavior since Electron Forge doesn't handle this automatically.
 *
 * Environment variables:
 * - CSC_LINK: Base64-encoded .p12 certificate
 * - CSC_KEY_PASSWORD: Password for the .p12 certificate
 * - APPLE_IDENTITY: (Optional) Fallback identity if not using CSC_LINK
 */

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface SigningConfig {
  identity: string | undefined;
  keychain: string | undefined;
}

const KEYCHAIN_PASSWORD = 'temp-keychain-password';

/**
 * Import a signing certificate from CSC_LINK environment variable.
 * Creates a temporary keychain and imports the certificate into it.
 *
 * @returns SigningConfig with identity and keychain path, or undefined values if no certificate
 */
export function importSigningCertificate(): SigningConfig {
  // Default to APPLE_IDENTITY if set
  let identity: string | undefined = process.env.APPLE_IDENTITY;
  let keychainPath: string | undefined;

  const cscLink = process.env.CSC_LINK;
  const cscPassword = process.env.CSC_KEY_PASSWORD;

  if (!cscLink || !cscPassword) {
    if (identity) {
      console.log(`ℹ️ Using APPLE_IDENTITY from environment: ${identity}`);
    }
    return { identity, keychain: keychainPath };
  }

  try {
    // Decode base64 certificate to temp file
    const certPath = path.join(os.tmpdir(), 'signing-cert.p12');
    const certData = Buffer.from(cscLink, 'base64');
    fs.writeFileSync(certPath, certData);

    // Create a temporary keychain
    keychainPath = path.join(os.tmpdir(), 'signing-keychain.keychain-db');

    // Delete existing temp keychain if it exists
    try {
      execSync(`security delete-keychain "${keychainPath}"`, { stdio: 'ignore' });
    } catch {
      // Keychain doesn't exist, that's fine
    }

    // Create new keychain
    execSync(`security create-keychain -p "${KEYCHAIN_PASSWORD}" "${keychainPath}"`);

    // Set keychain settings (no auto-lock)
    execSync(`security set-keychain-settings -t 3600 -u "${keychainPath}"`);

    // Unlock keychain
    execSync(`security unlock-keychain -p "${KEYCHAIN_PASSWORD}" "${keychainPath}"`);

    // Import certificate
    execSync(
      `security import "${certPath}" -k "${keychainPath}" -P "${cscPassword}" -T /usr/bin/codesign -T /usr/bin/security`
    );

    // Set key partition list (allows codesign to access the key)
    execSync(
      `security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "${KEYCHAIN_PASSWORD}" "${keychainPath}"`
    );

    // Add temp keychain to search list (prepend to make it first)
    const existingKeychains = execSync('security list-keychains -d user').toString().trim();
    execSync(`security list-keychains -d user -s "${keychainPath}" ${existingKeychains}`);

    // Clean up cert file
    fs.unlinkSync(certPath);

    // Get the identity from the keychain
    const identities = execSync(
      `security find-identity -v -p codesigning "${keychainPath}"`
    ).toString();
    const match = identities.match(/"([^"]+Developer ID Application[^"]+)"/);

    if (match) {
      identity = match[1];
      console.log(`✅ Imported certificate: ${identity}`);
    } else {
      console.error('⚠️ Could not find Developer ID Application identity in imported certificate');
      console.log('Available identities:', identities);
    }
  } catch (error) {
    console.error('⚠️ Failed to import certificate from CSC_LINK:', error);
  }

  return { identity, keychain: keychainPath };
}
