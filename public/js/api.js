// /public/js/api.js
import { config } from './config.js';

/**
 * Pure JSONP caller. Caller must supply params.email if available.
 */
export function callBackend(params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonpCallback_' + Math.random().toString(36).substring(2);

    // Build the full URL with query params
    const url = new URL(config.backendUrl);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });
    url.searchParams.append('callback', callbackName);

    // Global callback for JSONP
    window[callbackName] = (data) => {
      resolve(data);
      cleanup();
    };

    const timeout = setTimeout(() => {
      reject(new Error('JSONP request timed out'));
      cleanup();
    }, 10000);

    function cleanup() {
      try { delete window[callbackName]; } catch(e){}
      clearTimeout(timeout);
      if (script && script.parentNode) script.parentNode.removeChild(script);
    }

    const script = document.createElement('script');
    script.src = url.toString();
    script.async = true;
    script.onerror = () => {
      reject(new Error('JSONP request failed'));
      cleanup();
    };

    document.body.appendChild(script);
  });
}
