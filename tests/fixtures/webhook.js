/**
 * Webhook Fixtures & Helpers
 * Provides utilities for spying on and capturing webhook payloads (Zapier, etc)
 */

const capturedPayloads = [];

/**
 * Start capturing webhook payloads from the test webhook URL
 * This is useful for verifying that Zapier/external services receive the expected data
 * 
 * For testing:
 * 1. Use webhook.site for real HTTP captures
 * 2. Use a local Express server for CI/CD
 * 3. Mock using page.route() for unit tests
 * 
 * @param {Page} page - Playwright page object
 * @param {string} webhookUrl - Webhook URL to spy on (defaults to TEST_WEBHOOK_URL)
 */
export async function startWebhookCapture(page, webhookUrl = null) {
  const url = webhookUrl || process.env.TEST_WEBHOOK_URL;
  
  if (!url) {
    console.warn('TEST_WEBHOOK_URL not set - webhook capture disabled');
    return;
  }
  
  // Listen for network requests to the webhook URL
  page.on('response', async (response) => {
    if (response.url().includes(url)) {
      try {
        const postData = response.request().postDataJSON();
        capturedPayloads.push({
          timestamp: new Date().toISOString(),
          url: response.url(),
          status: response.status(),
          payload: postData
        });
      } catch {
        // Not JSON, ignore
      }
    }
  });
}

/**
 * Get all captured payloads
 * @returns {Array} - Array of captured payloads
 */
export function getCapturedPayloads() {
  return [...capturedPayloads];
}

/**
 * Get captured payloads filtered by action or event type
 * @param {string} action - Action name (revoke, towed, etc) or event type
 * @returns {Array} - Filtered payloads
 */
export function getPayloadsByAction(action) {
  return capturedPayloads.filter(p =>
    p.payload?.action === action ||
    p.payload?.event_type === action ||
    p.payload?.type === action
  );
}

/**
 * Clear captured payloads (for test isolation)
 */
export function clearCapturedPayloads() {
  capturedPayloads.length = 0;
}

/**
 * Wait for a specific payload to be captured
 * @param {string} action - Action to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} - The captured payload
 */
export async function waitForPayload(action, timeout = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const payload = getPayloadsByAction(action)[0];
    if (payload) return payload;
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Timeout waiting for payload with action: ${action}`);
}

/**
 * Assert that a payload was sent for a specific action
 * @param {string} action - Action name
 * @param {Function} assertFn - Assertion function
 */
export function assertPayloadSent(action, assertFn = null) {
  const payloads = getPayloadsByAction(action);
  
  if (payloads.length === 0) {
    throw new Error(`No payload captured for action: ${action}`);
  }
  
  if (assertFn) {
    assertFn(payloads[0]);
  }
  
  return payloads[0];
}

/**
 * Assert that a payload was NOT sent for a specific action
 * @param {string} action - Action name
 */
export function assertPayloadNotSent(action) {
  const payloads = getPayloadsByAction(action);
  
  if (payloads.length > 0) {
    throw new Error(`Expected no payload for action ${action}, but found ${payloads.length}`);
  }
}

/**
 * Count captured payloads
 * @returns {number}
 */
export function getPayloadCount() {
  return capturedPayloads.length;
}

/**
 * Mock a Zapier webhook response (for API testing without external service)
 * This can be used with page.route() to intercept webhook calls
 * 
 * @param {Page} page - Playwright page object
 * @param {string} webhookUrl - Webhook URL pattern to intercept
 * @param {number} statusCode - Response status code (default 200)
 */
export async function mockWebhookResponse(page, webhookUrl = null, statusCode = 200) {
  const url = webhookUrl || (process.env.TEST_WEBHOOK_URL ? new URL(process.env.TEST_WEBHOOK_URL).pathname : '/webhook');
  
  await page.route('**' + url + '**', route => {
    // Capture the payload
    const postData = route.request().postDataJSON();
    capturedPayloads.push({
      timestamp: new Date().toISOString(),
      url: route.request().url(),
      status: statusCode,
      payload: postData
    });
    
    // Return mock response
    route.abort('blockedbyresponse');
    route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Webhook received'
      })
    });
  });
}

/**
 * Get the last captured payload
 * @returns {Object | null}
 */
export function getLastPayload() {
  return capturedPayloads[capturedPayloads.length - 1] || null;
}

/**
 * Get the count of payloads for a specific action
 * @param {string} action - Action name
 * @returns {number}
 */
export function getPayloadCountByAction(action) {
  return getPayloadsByAction(action).length;
}

/**
 * Simulate a webhook timeout (for testing resilience)
 * This can be used with page.route() to slow down webhook responses
 * 
 * @param {Page} page - Playwright page object
 * @param {string} webhookUrl - Webhook URL pattern
 * @param {number} delayMs - Delay in milliseconds
 */
export async function simulateWebhookDelay(page, webhookUrl = null, delayMs = 5000) {
  const url = webhookUrl || (process.env.TEST_WEBHOOK_URL ? new URL(process.env.TEST_WEBHOOK_URL).pathname : '/webhook');
  
  await page.route('**' + url + '**', async route => {
    const postData = route.request().postDataJSON();
    capturedPayloads.push({
      timestamp: new Date().toISOString(),
      url: route.request().url(),
      status: 200,
      payload: postData
    });
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true
      })
    });
  });
}

/**
 * Simulate a webhook failure (for testing error handling)
 * @param {Page} page - Playwright page object
 * @param {string} webhookUrl - Webhook URL pattern
 * @param {number} statusCode - Error status code (default 500)
 */
export async function simulateWebhookFailure(page, webhookUrl = null, statusCode = 500) {
  const url = webhookUrl || (process.env.TEST_WEBHOOK_URL ? new URL(process.env.TEST_WEBHOOK_URL).pathname : '/webhook');
  
  await page.route('**' + url + '**', route => {
    const postData = route.request().postDataJSON();
    capturedPayloads.push({
      timestamp: new Date().toISOString(),
      url: route.request().url(),
      status: statusCode,
      payload: postData,
      error: true
    });
    
    route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Webhook processing failed'
      })
    });
  });
}
