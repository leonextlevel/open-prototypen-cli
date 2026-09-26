import { afterEach } from 'vitest';

// OpenPencil runs synchronously, so a test file can block the worker's event loop for longer
// than Vitest's RPC timeout. Yield a macrotask after each test so pending RPC replies arrive.
afterEach(() => new Promise((resolve) => setTimeout(resolve, 0)));
