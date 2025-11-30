/**
 * Diagnostic Report Generator
 *
 * Generates a diagnostic report for troubleshooting issues.
 * Collects system info and logs without sensitive data.
 */

import { app, dialog, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './logger';

const SUPPORT_EMAIL = 'vhiroki@gmail.com';
const MAX_LOG_LINES = 500;

interface DiagnosticInfo {
  appVersion: string;
  electronVersion: string;
  nodeVersion: string;
  platform: string;
  osVersion: string;
  arch: string;
  totalMemory: string;
  freeMemory: string;
  uptime: string;
  connectionCount?: number;
  queryCount?: number;
}

/**
 * Get the last N lines from a file
 */
function getLastLines(filePath: string, lineCount: number): string {
  try {
    if (!fs.existsSync(filePath)) {
      return `[File not found: ${filePath}]`;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const lastLines = lines.slice(-lineCount);
    return lastLines.join('\n');
  } catch (error) {
    return `[Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}]`;
  }
}

/**
 * Get database statistics (counts only, no sensitive data)
 */
async function getDatabaseStats(): Promise<{ connectionCount: number; queryCount: number }> {
  try {
    const response = await fetch('http://localhost:8080/api/queries/');
    const queries = await response.json();

    const connResponse = await fetch('http://localhost:8080/api/connections/');
    const connections = await connResponse.json();

    return {
      connectionCount: Array.isArray(connections) ? connections.length : 0,
      queryCount: Array.isArray(queries) ? queries.length : 0,
    };
  } catch {
    return { connectionCount: -1, queryCount: -1 };
  }
}

/**
 * Collect diagnostic information
 */
async function collectDiagnostics(): Promise<DiagnosticInfo> {
  const dbStats = await getDatabaseStats();

  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    platform: process.platform,
    osVersion: os.release(),
    arch: process.arch,
    totalMemory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`,
    freeMemory: `${Math.round(os.freemem() / (1024 * 1024 * 1024))} GB`,
    uptime: `${Math.round(os.uptime() / 3600)} hours`,
    connectionCount: dbStats.connectionCount,
    queryCount: dbStats.queryCount,
  };
}

/**
 * Generate the diagnostic report as markdown
 */
async function generateReport(): Promise<string> {
  const info = await collectDiagnostics();
  const logDir = logger.getLogDir();

  const electronLogPath = path.join(logDir, 'electron.log');
  const backendLogPath = path.join(logDir, 'qbox.log');

  const electronLogs = getLastLines(electronLogPath, MAX_LOG_LINES);
  const backendLogs = getLastLines(backendLogPath, MAX_LOG_LINES);

  const timestamp = new Date().toISOString();

  return `# QBox Diagnostic Report

Generated: ${timestamp}

## System Information

| Property | Value |
|----------|-------|
| App Version | ${info.appVersion} |
| Electron | ${info.electronVersion} |
| Node.js | ${info.nodeVersion} |
| Platform | ${info.platform} |
| OS Version | ${info.osVersion} |
| Architecture | ${info.arch} |
| Total Memory | ${info.totalMemory} |
| Free Memory | ${info.freeMemory} |
| System Uptime | ${info.uptime} |

## Application Statistics

| Property | Value |
|----------|-------|
| Saved Connections | ${info.connectionCount === -1 ? 'N/A (backend not responding)' : info.connectionCount} |
| Saved Queries | ${info.queryCount === -1 ? 'N/A (backend not responding)' : info.queryCount} |

## Electron Logs (last ${MAX_LOG_LINES} lines)

\`\`\`
${electronLogs}
\`\`\`

## Backend Logs (last ${MAX_LOG_LINES} lines)

\`\`\`
${backendLogs}
\`\`\`

---
*This report was generated automatically by QBox.*
*Please review before sending to ensure no sensitive information is included.*
`;
}

/**
 * Generate report and open email client
 */
export async function reportIssue(): Promise<void> {
  try {
    logger.info('Generating diagnostic report...');

    // Generate report content
    const reportContent = await generateReport();

    // Show save dialog
    const defaultPath = path.join(
      app.getPath('desktop'),
      `qbox-diagnostic-${new Date().toISOString().slice(0, 10)}.md`
    );

    const result = await dialog.showSaveDialog({
      title: 'Save Diagnostic Report',
      defaultPath,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Text', extensions: ['txt'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      logger.info('Report generation cancelled by user');
      return;
    }

    // Save the report
    fs.writeFileSync(result.filePath, reportContent, 'utf-8');
    logger.info(`Diagnostic report saved to: ${result.filePath}`);

    // Open email client with pre-filled template
    const subject = encodeURIComponent(`QBox Issue Report - v${app.getVersion()}`);
    const body = encodeURIComponent(`Hi,

I'm experiencing an issue with QBox. Please find the diagnostic report attached.

**Issue Description:**
[Please describe the issue you're experiencing]

**Steps to Reproduce:**
1. [First step]
2. [Second step]
3. [etc.]

**Expected Behavior:**
[What did you expect to happen?]

**Actual Behavior:**
[What actually happened?]

---
Diagnostic report saved to: ${result.filePath}
Please attach this file to the email.

Thank you!
`);

    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    await shell.openExternal(mailtoUrl);

    logger.info('Email client opened');
  } catch (error) {
    logger.error('Failed to generate diagnostic report', error as Error);
    dialog.showErrorBox(
      'Error',
      `Failed to generate diagnostic report: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
