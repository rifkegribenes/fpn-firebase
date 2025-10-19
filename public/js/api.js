import { config } from './config.js';

/**
 * Call Apps Script backend with parameters (JSONP version).
 */
export function callBackend(params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonpCallback_' + Math.random().toString(36).substring(2);

    // Build the full URL with query params
    const url = new URL(config.backendUrl);
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });
    // Add JSONP callback param (Apps Script expects this)
    url.searchParams.append('callback', callbackName);

    // Define the global callback the server will call
    window[callbackName] = (data) => {
      resolve(data);
      cleanup();
    };

    // Handle network errors or timeouts
    const timeout = setTimeout(() => {
      reject(new Error('JSONP request timed out'));
      cleanup();
    }, 10000); // 10s timeout

    function cleanup() {
      delete window[callbackName];
      clearTimeout(timeout);
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    // Create and inject the <script> tag
    const script = document.createElement('script');
    script.src = url.toString();
    script.onerror = () => {
      reject(new Error('JSONP request failed'));
      cleanup();
    };

    document.body.appendChild(script);
  });
}

