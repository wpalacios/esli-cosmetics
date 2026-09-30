/**
 * Utility functions for working with cookies
 */

/**
 * Check if a cookie exists in the browser
 */
export function hasCookie(name: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  return document.cookie
    .split(";")
    .some(cookie => cookie.trim().startsWith(`${name}=`));
}

/**
 * Wait for a cookie to be set in the browser
 * Uses polling to check if cookie exists
 */
export async function waitForCookie(
  name: string,
  options: {
    maxWait?: number; // Maximum time to wait in milliseconds (default: 1000ms)
    pollInterval?: number; // How often to check in milliseconds (default: 50ms)
  } = {}
): Promise<boolean> {
  const { maxWait = 1000, pollInterval = 50 } = options;
  const startTime = Date.now();

  return new Promise(resolve => {
    const checkCookie = () => {
      if (hasCookie(name)) {
        resolve(true);
        return;
      }

      if (Date.now() - startTime >= maxWait) {
        resolve(false);
        return;
      }

      setTimeout(checkCookie, pollInterval);
    };

    checkCookie();
  });
}

/**
 * Wait for multiple cookies to be set
 */
export async function waitForCookies(
  names: string[],
  options: {
    maxWait?: number;
    pollInterval?: number;
    waitForAll?: boolean; // If true, wait for all cookies. If false, wait for any cookie (default: true)
  } = {}
): Promise<boolean> {
  const { maxWait = 1000, pollInterval = 50, waitForAll = true } = options;
  const startTime = Date.now();

  return new Promise(resolve => {
    const checkCookies = () => {
      const hasAllCookies = names.every(name => hasCookie(name));
      const hasAnyCookie = names.some(name => hasCookie(name));

      if (waitForAll ? hasAllCookies : hasAnyCookie) {
        resolve(true);
        return;
      }

      if (Date.now() - startTime >= maxWait) {
        resolve(false);
        return;
      }

      setTimeout(checkCookies, pollInterval);
    };

    checkCookies();
  });
}
