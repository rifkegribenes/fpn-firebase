// /public/js/api.js
import { config } from './config.js';

/**
 * callBackend — unified wrapper for calling Apps Script web app endpoints
 * Automatically includes the signed-in user's email (if provided)
 */
export async function callBackend(params = {}) {
  const { page = 'team', team = '', email = '' } = params;

  // Include current user’s email when available
  const query = new URLSearchParams({
    page,
    team,
    ...(email ? { email } : {}) // only include if not empty
  });

  const url = `${config.backendUrl}?${query.toString()}`;
  console.log(`callBackend(): ${url}`);

  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
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

