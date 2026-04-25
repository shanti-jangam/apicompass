/**
 * Represents an HTTP method used in REST API routes.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'ALL';

/**
 * Represents a single API route discovered in the codebase.
 *
 * This is the core data model shared across all parsers, the route manager,
 * and the tree view. Every parser produces an array of Route objects.
 */
export interface Route {
  /** HTTP method (GET, POST, PUT, DELETE, etc.) */
  method: HttpMethod;

  /** URL path of the route (e.g. "/api/v1/users/:id") */
  path: string;

  /** Absolute file path where the route is defined */
  filePath: string;

  /** 1-based line number where the route definition starts */
  lineNumber: number;

  /** The framework that defines this route */
  framework: Framework;

  /** Optional: name of the handler function */
  handlerName?: string;
}

/**
 * Supported backend frameworks.
 */
export type Framework = 'express' | 'flask' | 'django' | 'fastapi' | 'go' | 'nestjs';

/**
 * Result returned by a parser after scanning a single file.
 */
export interface ParseResult {
  /** The file that was parsed */
  filePath: string;

  /** Routes discovered in this file */
  routes: Route[];

  /** Any errors encountered during parsing */
  errors: string[];
}

/**
 * Represents a mount prefix extracted from an entry file.
 * e.g. app.use('/api/users', usersRouter) where usersRouter = require('./routes/users')
 */
export interface MountPrefix {
  /** The prefix path from app.use(), e.g. '/api/users' */
  prefix: string;

  /** Resolved absolute path of the mounted router file (for JS/TS require/import resolution) */
  resolvedFilePath?: string;

  /** Variable name used to reference the router/blueprint (for Python variable-name matching) */
  variableName?: string;
}
