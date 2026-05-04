/**
 * Authentication Fixtures & Helpers
 * Provides login functionality and session management for tests
 */

/**
 * Login to the application
 * @param {Page} page - Playwright page object
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<string>} - JWT token if available
 */
export async function login(page, email, password) {
  await page.goto('/auth');
  await page.fill('input[placeholder="you@example.com"]', email);
  await page.fill('input[placeholder="••••••••"]', password);
  await page.click('button:has-text("Sign In")');
  
  // Wait for navigation to complete (redirects to dashboard or admin page)
  await page.waitForURL(/\/(admin|dashboard|permits|properties)/);
  
  return getStoredToken(page);
}

/**
 * Get JWT token from localStorage
 * @param {Page} page - Playwright page object
 * @returns {string} - JWT token
 */
export function getStoredToken(page) {
  return page.evaluate(() => {
    const auth = localStorage.getItem('sb-auth');
    if (!auth) return null;
    try {
      const parsed = JSON.parse(auth);
      return parsed.access_token || null;
    } catch {
      return null;
    }
  });
}

/**
 * Logout from the application
 * @param {Page} page - Playwright page object
 */
export async function logout(page) {
  // Try to click logout button if visible
  const logoutBtn = await page.$('[data-testid="logout-btn"], button:has-text("Logout"), button:has-text("Sign Out")');
  if (logoutBtn) {
    await logoutBtn.click();
  } else {
    // Fallback: clear localStorage and navigate to auth
    await page.evaluate(() => localStorage.clear());
    await page.goto('/auth');
  }
  
  // Verify redirected to auth page
  await page.waitForURL(/\/auth/);
}

/**
 * Create a custom context with authenticated session
 * @param {Browser} browser - Playwright browser
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{context: BrowserContext, page: Page, token: string}>}
 */
export async function createAuthenticatedContext(browser, email, password) {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const token = await login(page, email, password);
  
  return { context, page, token };
}

/**
 * Check if user is authenticated
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated(page) {
  const token = await getStoredToken(page);
  return !!token;
}

/**
 * Get current user info from the page (if available)
 * @param {Page} page - Playwright page object
 * @returns {Promise<{email: string, role: string} | null>}
 */
export async function getCurrentUser(page) {
  return page.evaluate(() => {
    // Try to extract from various possible locations
    const userEl = document.querySelector('[data-testid="user-email"], [data-user-email]');
    if (userEl) {
      return {
        email: userEl.textContent,
        role: document.querySelector('[data-user-role]')?.textContent || 'unknown'
      };
    }
    return null;
  });
}

/**
 * Get authorization header for API requests
 * @param {Page} page - Playwright page object
 * @returns {Promise<{Authorization: string} | {}>}
 */
export async function getAuthHeaders(page) {
  const token = await getStoredToken(page);
  if (!token) return {};
  
  return {
    Authorization: `Bearer ${token}`
  };
}

/**
 * Wait for authentication to complete (JWT token stored)
 * @param {Page} page - Playwright page object
 * @param {number} timeout - Timeout in ms
 */
export async function waitForAuth(page, timeout = 10000) {
  await page.waitForFunction(
    () => {
      const auth = localStorage.getItem('sb-auth');
      return auth && JSON.parse(auth).access_token;
    },
    { timeout }
  );
}
