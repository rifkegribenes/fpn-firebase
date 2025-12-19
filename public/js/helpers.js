

export function getNormalizedTeamParam() {
  const urlParams = new URLSearchParams(window.location.search);
  // default fallback empty string if no team specified
  return (urlParams.get('team') || '').toLowerCase();
}

export function cacheKeyFor(team) {
  console.log('cacheKeyFor called with:', team);
  return `teamData_${team.toLowerCase()}`;
}

export function normalizeAnnouncement(row) {
  const announcement = {
    id: row.id || row.Id,
    title: row.title || row['Announcement Title'],
    body: row.body || row['Announcement Body'],
    timestamp: row.timestamp || row.Timestamp || new Date().toISOString(),
    editURL: '',
    deleteURL: ''
  };

  if (!announcement.id) {
    console.error('normalizeAnnouncement: missing id', row);
    return null;
  }

  return announcement;
}

export function getQueryParams() {
    return Object.fromEntries(new URLSearchParams(window.location.search));
  }

  /**
 * Check if localStorage is available and writable.
 */
export function isLocalStorageAvailable() {
  try {
    const testKey = '__test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.warn('LocalStorage not available:', e);
    return false;
  }
}

// Global helper
export function setLoading(loading, message = "Loading...") {
  const spinner = document.getElementById('loadingSpinner');
  if (!spinner) return;

  const messageEl = spinner.querySelector('p');
  if (messageEl) messageEl.textContent = message;

  if (loading) {
    spinner.style.display = 'flex';
    requestAnimationFrame(() => spinner.style.opacity = '1');
  } else {
    spinner.style.opacity = '0';
    setTimeout(() => spinner.style.display = 'none', 300);
  }
}

export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    function check() {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      if (performance.now() - start > timeout)
        return reject(new Error(`Element ${selector} not found`));
      requestAnimationFrame(check);
    }
    check();
  });
}


export function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',  // "Jan", "Feb", ...
    day: 'numeric',  // 1–31
    year: 'numeric'  // 2025
  }).format(date);
}