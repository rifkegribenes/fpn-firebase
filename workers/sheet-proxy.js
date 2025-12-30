const SHEET_ID = '1A5wqQoAZhgk6QLFB4_8stVZUMP7iHdTrQikEa4ur4go';
const SHEET_NAME = 'TeamPageUpdateForm';
const CACHE_TTL = 60; // seconds

const COLUMN_ORDER = [
  'Timestamp',
  'Email Address',
  'Your Team',
  'What do you want to update?',
  'Announcement Title',
  'Announcement Body',
  'Date of meeting',
  'Upload your meeting minutes here (.pdf, .docx or URL to Google Document)',
  "Upload your team's operations plan here (.pdf, .docx or URL to Google Document)",
  'Upload banner photo here',
  'Image alt text (brief image description for screen readers)',
  'BannerPublicURL',
  'Edit URL',
  'Id',
  'Delete URL'
];


export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },
};

async function handleRequest(request, env, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);

  // Preflight CORS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders(),
    });
  }

  const saKey = JSON.parse(env.GOOGLE_SA_KEY);

  try {
    const token = await getAccessToken(saKey);

    if (request.method === 'POST') {
      const body = await request.json();

    // Map JSON to sheet columns
    const rowValues = COLUMN_ORDER.map(key => body[key] || '');

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowValues] }),
      }
    );


      if (!appendRes.ok) {
        const text = await appendRes.text();
        return new Response('Failed to append: ' + text, {
          status: 500,
          headers: corsHeaders(),
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders(),
      });
    } else {
      // GET request
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const text = await res.text();
        return new Response('Failed to fetch sheet: ' + text, {
          status: 500,
          headers: corsHeaders(),
        });
      }

      const data = await res.json();
      const [headerRow, ...rows] = data.values || [];

      const json = rows.map(row => {
        const obj = {};

        // Map each column in COLUMN_ORDER to the corresponding value in the row
        COLUMN_ORDER.forEach((col, i) => {
          const colIndex = headerRow.indexOf(col); // find actual index in sheet
          obj[col] = colIndex !== -1 ? row[colIndex] || '' : ''; // fill with '' if missing
        });

        return obj;
      });


      const response = new Response(JSON.stringify(json), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });

      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }
  } catch (err) {
    return new Response('Error: ' + err.message, {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

// ======================
// CORS headers
// ======================
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*', // or your front-end domain
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// ======================
// JWT + fetch to get access token
// ======================
async function getAccessToken(saKey) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: saKey.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const message = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);

  const privateKey = await importPrivateKey(saKey.private_key);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    message
  );

  const encodedSignature = base64url(signature);
  const jwt = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) throw new Error('Failed to get access token');

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// Import PEM private key for WebCrypto
async function importPrivateKey(pem) {
  const binary = str2ab(pem);
  return crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

// PEM string -> ArrayBuffer
function str2ab(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}

// Base64URL encoding
function base64url(input) {
  if (input instanceof ArrayBuffer) {
    input = String.fromCharCode(...new Uint8Array(input));
  }
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
