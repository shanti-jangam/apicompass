import * as vscode from 'vscode';
import { Framework } from '../models/route';

/**
 * Reads extension configuration from VS Code settings.
 *
 * Design pattern: Singleton
 */
export class Config {
  private static instance: Config;

  private constructor() {}

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private get config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('apicompass');
  }

  get includePaths(): string[] {
    return this.config.get<string[]>('includePaths', []);
  }

  get excludePaths(): string[] {
    return this.config.get<string[]>('excludePaths', [
      '**/node_modules/**',
      '**/.git/**',
      '**/venv/**',
      '**/__pycache__/**',
      '**/dist/**',
      '**/build/**',
    ]);
  }

  get enabledFrameworks(): Framework[] {
    return this.config.get<Framework[]>('enabledFrameworks', [
      'express',
      'flask',
      'django',
      'fastapi',
      'go',
      'nestjs',
    ]);
  }

  get groupBy(): 'file' | 'method' | 'framework' {
    return this.config.get<'file' | 'method' | 'framework'>('groupBy', 'file');
  }
}
