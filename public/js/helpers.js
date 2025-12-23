

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


export function toSpinalCase(str = '') {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function formatDateFileName(dateInput) {
  const d = new Date(dateInput);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(dateInput) {
  if (!dateInput) return '';

  let date;

  // YYYY-MM-DD (ISO-like, no timezone)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, d] = dateInput.split('-').map(Number);
    date = new Date(y, m - 1, d);

  // MM/DD/YYYY
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateInput)) {
    const [m, d, y] = dateInput.split('/').map(Number);
    date = new Date(y, m - 1, d);

  } else if (dateInput instanceof Date) {
    date = dateInput;

  } else {
    console.warn('Unrecognized date format:', dateInput);
    return '';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}



/**
 * Extracts the Google Drive file ID from a URL.
 * Supports:
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/uc?id=FILE_ID
 * @param {string} url
 * @returns {string|null} file ID, or null if not found
 */
export function getDriveFileId(url) {
  if (!url) return null;

  // Regex matches different common formats
  const match = url.match(
    /(?:\/d\/|id=)([a-zA-Z0-9_-]{10,})/
  );

  return match ? match[1] : null;
}
