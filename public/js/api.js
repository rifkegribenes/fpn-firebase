// /public/js/api.js
import { config } from './config.js';

/**
 * callBackend — unified wrapper for calling Apps Script web app endpoints
 * Automatically includes the signed-in user's email (if provided)
 * Supports arbitrary actions (e.g., delete, save) and disables caching for them.
 */
export async function callBackend(params = {}) {
  const { team = '', email = '', action = '', id = '', cache = true } = params;

  // Build query parameters dynamically
  const query = new URLSearchParams({
    ...(team ? { team } : {}),
    ...(email ? { email } : {}),
    ...(action ? { action } : {}),
    ...(id ? { id } : {})
  });

  const url = `${config.backendUrl}?${query.toString()}`;
  console.log(`callBackend(): ${url}`);

  // Determine if cache should be bypassed
  const shouldBypassCache =
    !cache ||
    (action && action !== 'get') ||
    url.includes('action=delete');

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: shouldBypassCache ? { 'Cache-Control': 'no-cache' } : {}
    }).then(data => console.log('Server debug info:', data.debug));

    const text = await res.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error('Backend did not return valid JSON:', text);
      throw err;
    }

    if (!res.ok) {
      throw new Error(`Backend error: ${res.status} ${res.statusText}`);
    }

    console.log('Backend data received:', data);
    return data;
  } catch (err) {
    console.error('callBackend() failed:', err);
    return { success: false, error: err.message };
  }
}
