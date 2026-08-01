/**
 * Simple token-bucket rate limiter for Fabric API calls.
 * Max 120 requests per 60-second window. No external dependencies.
 */

const MAX_REQUESTS = 120;
const WINDOW_MS = 60 * 1000;
const RETRY_DELAYS = [1000, 2000, 4000];

let timestamps = [];

function cleanup() {
  const cutoff = Date.now() - WINDOW_MS;
  timestamps = timestamps.filter((t) => t > cutoff);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForSlot() {
  while (true) {
    cleanup();
    if (timestamps.length < MAX_REQUESTS) {
      timestamps.push(Date.now());
      return;
    }
    // Wait until the oldest timestamp falls out of the window
    const oldest = timestamps[0];
    const waitMs = oldest + WINDOW_MS - Date.now() + 10;
    await sleep(Math.max(waitMs, 50));
  }
}

/**
 * Execute a Fabric call through the rate limiter with 429 retry logic.
 * @param {Function} fn - async function that makes the actual Fabric call
 * @returns {Promise<any>} - result of fn()
 */
async function rateLimitedCall(fn) {
  await waitForSlot();

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.code === 'FABRIC_THROTTLE' || err.status === 429) {
        if (attempt < RETRY_DELAYS.length) {
          const delay = RETRY_DELAYS[attempt];
          console.log(`[limiter] Fabric 429 at ${new Date().toISOString()}, retry in ${delay}ms (${attempt + 1}/${RETRY_DELAYS.length})`);
          await sleep(delay);
          await waitForSlot();
          continue;
        }
        throw Object.assign(
          new Error('FABRIC_THROTTLE: All retries exhausted'),
          { code: 'FABRIC_THROTTLE' }
        );
      }
      throw err;
    }
  }
}

function getLimiterInfo() {
  cleanup();
  return {
    waiting: 0,
    active: timestamps.length,
  };
}

function resetLimiter() {
  timestamps = [];
}

module.exports = { rateLimitedCall, getLimiterInfo, resetLimiter };
