/**
 * Call Apps Script backend with parameters.
 * route and other params passed via query string.
 */
function callBackend(params = {}) {
  const url = new URL(config.backendUrl);
  Object.keys(params).forEach(key => {
    url.searchParams.append(key, params[key]);
  });

  return fetch(url.toString(), {
    method: 'GET',
    mode: 'cors'
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('API error: ' + response.status);
    }
    return response.json();
  });
}
