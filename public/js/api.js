// /public/js/api.js
import { config } from './config.js';

/**
 * callBackend — unified wrapper for calling Apps Script web app endpoints
 * Automatically includes the signed-in user's email (if provided)
 * Supports arbitrary actions (e.g., delete, save) and disables caching for them.
 */
export async function callBackend(params = {}) {
  const { team = '', email = '', action = '', id = '', cache = true } = params;

  const query = new URLSearchParams({
    ...(team ? { team } : {}),
    ...(email ? { email } : {}),
    ...(action ? { action } : {}),
    ...(id ? { id } : {})
  });

  const url = `${config.backendUrl}?${query.toString()}`;
  console.log(`callBackend(): ${url}`);

  const shouldBypassCache =
    !cache ||
    (action && action !== 'get') ||
    url.includes('action=delete');

  try {
    // Fetch response
    const res = await fetch(url);

    // Debug log for raw Response object
    console.log('Server raw Response:', res);

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
