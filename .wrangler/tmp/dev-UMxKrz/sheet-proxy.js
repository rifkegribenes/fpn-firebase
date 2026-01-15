var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// workers/sheet-proxy.js
var SHEET_ID = "1A5wqQoAZhgk6QLFB4_8stVZUMP7iHdTrQikEa4ur4go";
var SHEET_NAME = "TeamPageUpdateForm";
var TEAM_PAGE_COLUMN_ORDER = [
  "Timestamp",
  "Email Address",
  "Your Team",
  "What do you want to update?",
  "Announcement Title",
  "Announcement Body",
  "Date of meeting",
  "Upload your meeting minutes here (.pdf, .docx or URL to Google Document)",
  "Upload your team's operations plan here (.pdf, .docx or URL to Google Document)",
  "Upload banner photo here",
  "Image alt text (brief image description for screen readers)",
  "BannerPublicURL",
  "Edit URL",
  "Id",
  "Delete URL"
];
var TEAM_LOOKUP_COLUMN_ORDER = [
  "Team",
  "Short name",
  "Team Group Email",
  "Team page",
  "District",
  "Team Lead email",
  "Assigned to (name)",
  "Alt email",
  "Team calendar link",
  "Team drive link"
  // intentionally omitting "Password (original)"
];
var SHEET_ID_MAP = {
  TeamPageUpdateForm: 677519141,
  TeamLookup: 1322285583
};
var sheet_proxy_default = {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};
async function handleRequest(request, env, ctx) {
  console.log("REQUEST", {
    method: request.method,
    url: request.url
  });
  const cache = caches.default;
  const urlObj = new URL(request.url);
  const sheetName = urlObj.searchParams.get("sheet") || SHEET_NAME;
  console.log("Using sheet:", sheetName);
  const sheetId = SHEET_ID_MAP[sheetName];
  if (!sheetId) {
    return new Response(
      JSON.stringify({ error: `Unknown sheet: ${sheetName}` }),
      { status: 400, headers: corsHeaders() }
    );
  }
  let columnOrder;
  switch (sheetName) {
    case "TeamLookup":
      columnOrder = TEAM_LOOKUP_COLUMN_ORDER;
      break;
    case "TeamPageUpdateForm":
    default:
      columnOrder = TEAM_PAGE_COLUMN_ORDER;
  }
  const cacheKey = new Request(
    `${urlObj.origin}${urlObj.pathname}?sheet=${sheetName}`,
    request
  );
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders()
    });
  }
  const saKey = JSON.parse(env.GOOGLE_SA_KEY);
  try {
    const token = await getAccessToken(saKey);
    if (request.method === "POST") {
      const body = await request.json();
      console.log("POST body", JSON.stringify(body, null, 2));
      console.log("columnOrder", columnOrder);
      const row = body?.data?.[0] || {};
      const rowValues = columnOrder.map((key) => row[key] || "");
      console.log("rowValues", rowValues);
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetName}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: [rowValues] })
        }
      );
      if (!appendRes.ok) {
        const text = await appendRes.text();
        return new Response("Failed to append: " + text, {
          status: 500,
          headers: corsHeaders()
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
    } else if (request.method === "PATCH") {
      const urlObj2 = new URL(request.url);
      const rowId = urlObj2.searchParams.get("Id");
      if (!rowId) {
        return new Response(
          JSON.stringify({ error: "Missing Id parameter" }),
          { status: 400, headers: corsHeaders() }
        );
      }
      const body = await request.json();
      const updates = body?.data?.[0] || {};
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetName}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      const [headerRow, ...rows] = data.values || [];
      const idColIndex = headerRow.indexOf("Id");
      if (idColIndex === -1) {
        return new Response(
          JSON.stringify({ error: "Id column not found" }),
          { status: 500, headers: corsHeaders() }
        );
      }
      const rowIndex = rows.findIndex((r) => r[idColIndex] === rowId);
      if (rowIndex === -1) {
        return new Response(
          JSON.stringify({ error: "Row not found" }),
          { status: 404, headers: corsHeaders() }
        );
      }
      const sheetRowNumber = rowIndex + 2;
      const requests = [];
      for (const [key, value] of Object.entries(updates)) {
        if (!columnOrder.includes(key)) continue;
        if (key === "Id") continue;
        const colIndex = headerRow.indexOf(key);
        if (colIndex === -1) continue;
        requests.push({
          updateCells: {
            range: {
              sheetId,
              startRowIndex: sheetRowNumber - 1,
              endRowIndex: sheetRowNumber,
              startColumnIndex: colIndex,
              endColumnIndex: colIndex + 1
            },
            rows: [
              {
                values: [
                  {
                    userEnteredValue: { stringValue: String(value) }
                  }
                ]
              }
            ],
            fields: "userEnteredValue"
          }
        });
      }
      if (!requests.length) {
        return new Response(
          JSON.stringify({ error: "No valid fields to update" }),
          { status: 400, headers: corsHeaders() }
        );
      }
      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ requests })
        }
      );
      if (!updateRes.ok) {
        const text = await updateRes.text();
        return new Response(
          JSON.stringify({ error: text }),
          { status: 500, headers: corsHeaders() }
        );
      }
      return new Response(
        JSON.stringify({ success: true, updatedRowId: rowId }),
        {
          headers: {
            ...corsHeaders(),
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
          }
        }
      );
    } else if (request.method === "DELETE") {
      const urlObj2 = new URL(request.url);
      const rowId = urlObj2.searchParams.get("Id");
      if (!rowId) {
        return new Response(
          JSON.stringify({ error: "Missing Id parameter" }),
          { status: 400, headers: corsHeaders() }
        );
      }
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetName}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      const [headerRow, ...rows] = data.values || [];
      const idColIndex = headerRow.indexOf("Id");
      if (idColIndex === -1) {
        return new Response(
          JSON.stringify({ error: "Id column not found" }),
          { status: 500, headers: corsHeaders() }
        );
      }
      const rowIndex = rows.findIndex((r) => r[idColIndex] === rowId);
      if (rowIndex === -1) {
        return new Response(
          JSON.stringify({ error: "Row not found" }),
          { status: 404, headers: corsHeaders() }
        );
      }
      const sheetRowNumber = rowIndex + 2;
      const deleteRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId,
                    dimension: "ROWS",
                    startIndex: sheetRowNumber - 1,
                    endIndex: sheetRowNumber
                  }
                }
              }
            ]
          })
        }
      );
      if (!deleteRes.ok) {
        const text = await deleteRes.text();
        return new Response(
          JSON.stringify({ error: text }),
          { status: 500, headers: corsHeaders() }
        );
      }
      return new Response(
        JSON.stringify({ success: true, deletedRowId: rowId }),
        {
          headers: {
            ...corsHeaders(),
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
          }
        }
      );
    } else {
      console.log("Fetching sheet:", sheetName);
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetName}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const text = await res.text();
        return new Response("Failed to fetch sheet: " + text, {
          status: 500,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
          }
        });
      }
      const data = await res.json();
      const [headerRow, ...rows] = data.values || [];
      const json = rows.map((row) => {
        const obj = {};
        columnOrder.forEach((col, i) => {
          const colIndex = headerRow.indexOf(col);
          obj[col] = colIndex !== -1 ? row[colIndex] || "" : "";
        });
        return obj;
      });
      const response = new Response(JSON.stringify(json), {
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
      return response;
    }
  } catch (err) {
    return new Response("Error: " + err.message, {
      status: 500,
      headers: {
        ...corsHeaders(),
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });
  }
}
__name(handleRequest, "handleRequest");
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    // or your front-end domain
    "Access-Control-Allow-Methods": "GET, POST, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
__name(corsHeaders, "corsHeaders");
async function getAccessToken(saKey) {
  const iat = Math.floor(Date.now() / 1e3);
  const exp = iat + 3600;
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: saKey.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp,
    iat
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const message = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const privateKey = await importPrivateKey(saKey.private_key);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    message
  );
  const encodedSignature = base64url(signature);
  const jwt = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  if (!tokenRes.ok) throw new Error("Failed to get access token");
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}
__name(getAccessToken, "getAccessToken");
async function importPrivateKey(pem) {
  const binary = str2ab(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}
__name(importPrivateKey, "importPrivateKey");
function str2ab(pem) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}
__name(str2ab, "str2ab");
function base64url(input) {
  if (input instanceof ArrayBuffer) {
    input = String.fromCharCode(...new Uint8Array(input));
  }
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64url, "base64url");

// ../../../.nvm/versions/node/v20.18.1/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../.nvm/versions/node/v20.18.1/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-YV0CPP/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = sheet_proxy_default;

// ../../../.nvm/versions/node/v20.18.1/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-YV0CPP/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=sheet-proxy.js.map
