/**
 * Electron Logger with File Rotation
 *
 * Provides logging to both console and file with automatic rotation.
 * Logs are stored in ~/.qbox/logs/electron.log
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_BACKUP_COUNT = 3;

class Logger {
  private logDir: string;
  private logFile: string;
  private stream: fs.WriteStream | null = null;

  constructor() {
    const homeDir = app.getPath('home');
    this.logDir = path.join(homeDir, '.qbox', 'logs');
    this.logFile = path.join(this.logDir, 'electron.log');
  }

  /**
   * Initialize the logger - must be called after app is ready
   */
  init(): void {
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Check if rotation is needed
    this.rotateIfNeeded();

    // Open write stream in append mode
    this.stream = fs.createWriteStream(this.logFile, { flags: 'a', encoding: 'utf-8' });

    // Log startup
    this.info('='.repeat(60));
    this.info(`QBox Electron starting - ${new Date().toISOString()}`);
    this.info(`Version: ${app.getVersion()}`);
    this.info(`Platform: ${process.platform} ${process.arch}`);
    this.info('='.repeat(60));
  }

  /**
   * Rotate log files if current file exceeds max size
   */
  private rotateIfNeeded(): void {
    try {
      if (!fs.existsSync(this.logFile)) return;

      const stats = fs.statSync(this.logFile);
      if (stats.size < MAX_FILE_SIZE) return;

      // Close current stream if open
      if (this.stream) {
        this.stream.end();
        this.stream = null;
      }

      // Rotate existing backups
      for (let i = MAX_BACKUP_COUNT - 1; i >= 1; i--) {
        const oldPath = `${this.logFile}.${i}`;
        const newPath = `${this.logFile}.${i + 1}`;
        if (fs.existsSync(oldPath)) {
          if (i === MAX_BACKUP_COUNT - 1) {
            fs.unlinkSync(oldPath); // Delete oldest
          } else {
            fs.renameSync(oldPath, newPath);
          }
        }
      }

      // Rename current to .1
      fs.renameSync(this.logFile, `${this.logFile}.1`);
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  /**
   * Format and write a log message
   */
  private write(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `${timestamp} - ${level} - ${message}`;

    // Always log to console
    if (level === 'ERROR') {
      console.error(formattedMessage);
    } else {
      console.log(formattedMessage);
    }

    // Write to file if stream is open
    if (this.stream) {
      this.stream.write(formattedMessage + '\n');

      // Check if rotation is needed after write
      this.rotateIfNeeded();
      if (!this.stream) {
        // Reopen stream if it was closed during rotation
        this.stream = fs.createWriteStream(this.logFile, { flags: 'a', encoding: 'utf-8' });
      }
    }
  }

  info(message: string): void {
    this.write('INFO', message);
  }

  warn(message: string): void {
    this.write('WARN', message);
  }

  error(message: string, error?: Error): void {
    if (error) {
      this.write('ERROR', `${message}: ${error.message}\n${error.stack || ''}`);
    } else {
      this.write('ERROR', message);
    }
  }

  /**
   * Log backend output (stdout/stderr)
   */
  backend(data: string, isError = false): void {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        this.write(isError ? 'BACKEND-ERR' : 'BACKEND', line);
      }
    }
  }

  /**
   * Close the log stream
   */
  close(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }

  /**
   * Get the log directory path
   */
  getLogDir(): string {
    return this.logDir;
  }

  /**
   * Get the main log file path
   */
  getLogFile(): string {
    return this.logFile;
  }
}

// Export singleton instance
export const logger = new Logger();
