/**
 * Test logger that respects VERBOSE_TESTS environment variable
 * 
 * By default, tests run silently. Set VERBOSE_TESTS=true to see all logs.
 */

import type { Logger } from '../types.js';

const isVerbose = process.env.VERBOSE_TESTS === 'true';

export const testLogger: Logger = {
  debug: isVerbose ? console.debug : () => {},
  info: isVerbose ? console.info : () => {},
  warn: isVerbose ? console.warn : () => {},
  error: isVerbose ? console.error : () => {},
};