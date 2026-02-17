import * as vscode from 'vscode';
import * as path from 'path';
import { Config } from '../utils/config';
import { Logger } from '../utils/logger';

/**
 * Scans the workspace for files that might contain route definitions.
 *
 * Handles recursive directory traversal, file type detection, and
 * respects include/exclude configuration patterns.
 */
export class FileScanner {
  private config: Config;
  private logger: Logger;

  constructor() {
    this.config = Config.getInstance();
    this.logger = Logger.getInstance();
  }

  /**
   * Scans the workspace and returns paths of all candidate files.
   * Candidate files are .js, .ts, or .py files not in excluded directories.
   */
  async scanWorkspace(): Promise<string[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.logger.warn('No workspace folder open.');
      return [];
    }

    const allFiles: string[] = [];

    for (const folder of workspaceFolders) {
      const files = await this.scanFolder(folder.uri);
      allFiles.push(...files);
    }

    this.logger.info(`FileScanner: Found ${allFiles.length} candidate files.`);
    return allFiles;
  }

  /**
   * Scans a single folder for candidate files using VS Code's findFiles API.
   */
  private async scanFolder(folderUri: vscode.Uri): Promise<string[]> {
    const includePattern = '**/*.{js,ts,mjs,cjs,py}';
    const excludePatterns = this.config.excludePaths.join(',');

    // Build a RelativePattern to scope the search to this folder
    const pattern = new vscode.RelativePattern(folderUri, includePattern);
    const excludeGlob = excludePatterns ? `{${excludePatterns}}` : undefined;

    const uris = await vscode.workspace.findFiles(pattern, excludeGlob);

    return uris.map((uri) => uri.fsPath);
  }

  /**
   * Reads the full text content of a file.
   */
  async readFile(filePath: string): Promise<string> {
    const uri = vscode.Uri.file(filePath);
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString('utf-8');
  }
}
