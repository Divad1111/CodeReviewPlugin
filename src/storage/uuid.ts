/**
 * Simple UUID v4 generator — avoids adding a dependency for this single function.
 */

import * as crypto from 'crypto';

export function v4(): string {
  return crypto.randomUUID();
}
