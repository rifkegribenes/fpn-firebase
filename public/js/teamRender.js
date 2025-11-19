import { callBackend } from './api.js';
import { config } from './config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  GoogleAuthProvider 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Initialize Firebase app
const app = initializeApp(config.firebase);

// Initialize Firebase Auth and attach globally
window.firebaseAuth = getAuth(app);

// Initialize Auth provider
const provider = new GoogleAuthProvider();

function getNormalizedTeamParam() {
  const urlParams = new URLSearchParams(window.location.search);
  // default fallback 'default' if no team specified, lowercase for consistency
  return (urlParams.get('team') || 'default').toLowerCase();
}

/**
 * Check if localStorage is available and writable.
 */
function isLocalStorageAvailable() {
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
function setLoading(loading, message = "Loading...") {
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

/**
 * Render the team page after data is ready.
 */
export async function renderTeamPage(data) {
  console.log('renderTeamPage() data:', data);
  const updateContainer = document.getElementById('teamUpdateContainer');
  if (!updateContainer) console.warn('#teamUpdateContainer not found');

  const [
    title,
    announcementsDiv,
    minutesDiv,
    eventsDiv,
    opsDiv,
    groupDiv,
    driveDiv
  ] = await Promise.all([
    waitForElement('#pageTitle'),
    waitForElement('#announcements'),
    waitForElement('#minutes'),
    waitForElement('#events'),
    waitForElement('#ops'),
    waitForElement('#group'),
    waitForElement('#drive')
  ]);

  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.style.display = data.isTeamPageEditor ? 'inline-block' : 'none';

  const team = data.teamObj || {};
  const teamName = data.teamObj?.teamName || getNormalizedTeamParam();

  title.innerText = team.teamName
  ? `${team.teamName} NET`
  : 'Team Links';

  // Set sidebar header
  // const sidebarHeader = document.getElementById('sidebarHeader');
  // if (sidebarHeader && data.teamObj?.teamName) {
  //   sidebarHeader.textContent = `${data.teamObj.teamName} NET`;
  // }  

  // --- Announcements ---
  announcementsDiv.innerHTML = '';
  if (data.announcements?.length) {
    console.log('rendering announcements');
    data.announcements.forEach(a => {
      const div = document.createElement('div');
      div.className = 'announcement-item';

      let adminBlock = '';
      if (data.isTeamPageEditor) {
        const deleteURLWithParams = `${a.deleteURL}&team=${data.teamObj.shortName}`;
        adminBlock = `
          <div class="announcement-admin links">
            <a href="${a.editURL}" target="_blank" class="edit-link">Edit</a>
            &nbsp;|&nbsp;
            <a href="${deleteURLWithParams}" target="_blank" class="delete-link">Delete</a>
          </div>
        `;
      }

      div.innerHTML = `
        <h4>${a.title}</h4>
        <div class="date">${new Date(a.timestamp).toLocaleString()}</div>
        <div class="body">${a.body}</div>
        ${adminBlock}
      `;
      announcementsDiv.appendChild(div);
    });
  } else {
    announcementsDiv.innerHTML = `<p>No announcements found for ${team.teamName}.</p>`;
  }

  // --- Minutes ---
  minutesDiv.innerHTML = '';
  if (data.minutes?.length) {
    const ul = document.createElement('ul');
    data.minutes.forEach(file => {
      const li = document.createElement('li');
      const createdDateStr = file.createdTime || null;
      let formattedDate = 'Unknown date';
      let mtgDateParsed;

      if (file.description) {
        mtgDateParsed = file.description.split(",")[1] || null;
      }
      if (mtgDateParsed) {
        formattedDate = formatDate(new Date(mtgDateParsed));
      } else if (createdDateStr) {
        const createdDate = new Date(createdDateStr);
        formattedDate = formatDate(createdDate);
      }

      const linkText = `${team.teamName} minutes ${formattedDate}`;
      const url = `https://drive.google.com/file/d/${file.id}/view`;
      li.innerHTML = `<a href="${url}" target="_blank">${linkText}</a>`;
      ul.appendChild(li);
    });
    minutesDiv.appendChild(ul);
  } else {
    minutesDiv.innerHTML = `<p>No minutes found for ${team.teamName}.</p>`;
  }

  // Calendar / Events

  eventsDiv.innerHTML = '';

  if (data.teamObj?.teamCal) {
    // The backend already provides a full embed URL (e.g., https://calendar.google.com/calendar/embed?...).
    const baseUrl = data.teamObj.teamCal;

    // Add mode parameters for different display types
    const monthViewUrl = baseUrl.includes('mode=')
      ? baseUrl.replace(/mode=[^&]*/i, 'mode=MONTH')
      : `${baseUrl}&mode=MONTH`;

    const agendaViewUrl = baseUrl.includes('mode=')
      ? baseUrl.replace(/mode=[^&]*/i, 'mode=AGENDA')
      : `${baseUrl}&mode=AGENDA`;

    eventsDiv.innerHTML = `
      <div class="calendar-container">
        <!-- Desktop (Month Grid) -->
        <iframe 
          class="calendar-view calendar-desktop"
          src="${monthViewUrl}"
          style="border: 0;"
          frameborder="0"
          scrolling="no">
        </iframe>

        <!-- Mobile (Agenda List) -->
        <iframe 
          class="calendar-view calendar-mobile"
          src="${agendaViewUrl}"
          style="border: 0;"
          frameborder="0"
          scrolling="no">
        </iframe>
      </div>
    `;
  } else {
    eventsDiv.innerHTML = `<p>No calendar found for ${data.teamObj?.teamName}.</p>`;
  }



  // Operations Plan
  opsDiv.innerHTML = '';
  if (data.opsPlanLink) {
    const file = data.opsPlanLink;
    // console.log(`opsPlan`, file);
    const createdDateStr = file.createdTime || null;
    let formattedDate = 'Unknown date';
    if (createdDateStr) {
      const createdDate = new Date(createdDateStr);
      formattedDate = formatDate(createdDate);
    }
    const linkText = `${team.teamName} Operations Plan`;
    const url = `https://drive.google.com/file/d/${file.id}/view`;
    // console.log(linkText, url);
    opsDiv.innerHTML = `<ul><li>
      <a href="${url}" target="_blank">
        ${linkText}
      </a></li></ul>`;
  } else {
    opsDiv.innerHTML = `<p>No operations plan found for ${team.teamName}.</p>`;
  }

  groupDiv.innerHTML = team.groupEmail
    ? `<ul><li><a href="https://groups.google.com/a/friendsofportlandnet.org/g/${team.shortName}" target="_blank">${team.teamName} Google Group</a></li></ul>`
    : `<p>No Google group found for ${team.teamName}.</p>`;

  driveDiv.innerHTML = team.teamDrive
    ? `<ul><li><a href=${team.teamDrive}>${team.teamName} Documents</a></li></ul>`
    : `<p>Shared Drive for ${team.teamName} has not been set up yet.</p>`;


  // --- Team Update Link (conditionally rendered) ---
  updateContainer.innerHTML = ''; // clear previous content

  if (data.isTeamPageEditor && data.teamObj?.teamName) {
    const updateLink = document.createElement('a');
    updateLink.id = 'teamUpdateLink';
    updateLink.href = `https://docs.google.com/forms/d/e/1FAIpQLSe9TU8URPswEVELyy9jOImY2_2vJ9OOE7O8L5JlNUuiJzPQYQ/viewform?usp=pp_url&entry.1458714000=${encodeURIComponent(data.teamObj.teamName)}`;
    updateLink.target = '_blank';
    updateLink.className = 'responsiveLink';
    updateLink.textContent = 'Update page';

    updateContainer.appendChild(updateLink);
  }  

  attachDeleteHandlers();

}

function updateAuthUI(user) {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userInfo = document.getElementById("userInfo");
  const refreshBtn = document.getElementById("refreshBtn");
  const teamUpdateContainer = document.getElementById("teamUpdateContainer");

  if (user) {
    // Logged in
    if (userInfo) userInfo.textContent = `Logged in as ${user.email}`;
    if (loginBtn) loginBtn.hidden = true;
    if (logoutBtn) logoutBtn.hidden = false;
    if (refreshBtn) {
      refreshBtn.style.display = 'inline-block';
      attachRefreshListener(); 
    }
    if (teamUpdateContainer) teamUpdateContainer.style.display = 'block';
    // Optionally show edit/delete links (already handled in renderTeamPage)
  } else {
    // Logged out
    if (userInfo) userInfo.textContent = 'Not logged in';
    if (loginBtn) loginBtn.hidden = false;
    if (logoutBtn) logoutBtn.hidden = true;
    if (refreshBtn) refreshBtn.style.display = 'none';
    if (teamUpdateContainer) teamUpdateContainer.style.display = 'none';

    // Hide all edit links
    document.querySelectorAll('.announcement-admin').forEach(el => el.style.display = 'none');
  }
}

let currentUser = null;

// --- Global Firebase Auth Listener ---
const auth = window.firebaseAuth;
let prevUser = null; // track previous state

onAuthStateChanged(auth, async (user) => {
  const email = user?.email || '';
  console.log('onAuthStateChanged →', email || 'anonymous');

  // Always update UI
  updateAuthUI(user);

  // Detect “just logged out”: previously logged in, now null
  const justLoggedOut = prevUser && !user;

  // Load backend if:
  // 1. Initial load (prevUser === null)
  // 2. User is logged in
  if (!justLoggedOut) {
    const team = getNormalizedTeamParam();

    console.log('Loading backend for team:', team);
    await loadBackend(team, email);
  } else {
    console.log('User just logged out — skipping backend load.');
  }

  // Update prevUser for next auth change
  prevUser = user;
});




// --- Immediately fetch backend for anonymous user ---
async function loadBackend(team, email = '') {
  console.log('loadBackend');
  setLoading(true); // always show spinner initially

  // --- TEAM LINKS PAGE (no ?team param) ---
  if (!team) {
    console.log('No team param — rendering team links page');

    const pseudoTeamKey = 'teamLinks';
    const linksContent = document.getElementById('linksContent');
    const teamContent = document.getElementById('teamContent');
    const teamLinksContainer = document.getElementById('teamLinks');

    // Show links, hide team page
    linksContent.style.display = 'block';
    teamContent.style.display = 'none';

    // Try cache first
    const cached = getCachedData(pseudoTeamKey);
    if (cached?.data?.teamLinks?.length) {
      console.log(`Rendering ${cached.data.teamLinks.length} cached team links`);
      renderTeamLinks(cached.data.teamLinks);

      // Background refresh
      (async () => {
        try {
          const fresh = await callBackend();
          if (fresh?.success && Array.isArray(fresh.teamLinks)) {
            cacheData(pseudoTeamKey, fresh);
            renderTeamLinks(fresh.teamLinks);
            console.log('Background refresh of teamLinks complete');
          }
        } catch (err) {
          console.error('Background refresh failed:', err);
        }
      })();

      setLoading(false);
      return;
    }

    // No cache → fetch fresh
    try {
      const fresh = await callBackend();
      if (fresh?.success && Array.isArray(fresh.teamLinks)) {
        cacheData(pseudoTeamKey, fresh);
        renderTeamLinks(fresh.teamLinks);
      } else {
        console.warn('No team links found from backend');
        teamLinksContainer.innerHTML = '<p>No teams found.</p>';
      }
    } catch (err) {
      console.error('Error fetching team links:', err);
      teamLinksContainer.innerHTML = '<p>Error loading team links.</p>';
    } finally {
      setLoading(false);
    }
    return;
  }

  // --- TEAM PAGE (with ?team param) ---
  const teamContent = document.getElementById('teamContent');
  const linksContent = document.getElementById('linksContent');

  linksContent.style.display = 'none';
  teamContent.style.display = 'block';

  // Check cache
  const cacheKey = team || 'teamLinks';
  const cached = getCachedData(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Using cached team page data:', cached.data);
    renderTeamPage(cached.data);
    setLoading(false);
    attachRefreshListener();
    return; // skip backend entirely
  }

  // No cache or stale → call backend
  try {
    const data = await callBackend({ page: 'team', team, email });
    console.log('Fresh backend data:', data);
    if (data?.success) {
      cacheData(team, data);
      renderTeamPage(data);
    }
  } catch (err) {
    console.error('Error fetching team page:', err);
  } finally {
    setLoading(false);
    attachRefreshListener();
  }

}



/**
 * Handle post-login success — clear cache, re-fetch backend, re-render.
 */

async function handleLoginSuccess() {
  const team = getNormalizedTeamParam();
  const currentEmail = currentUser?.email;
  const lastEmail = localStorage.getItem('lastUserEmail');
  const auth = window.firebaseAuth;

  console.log(`handleLoginSuccess() — current=${currentEmail}, last=${lastEmail}, team="${team}"`);

  // Only clear cache if user changed
  if (currentEmail && lastEmail && currentEmail !== lastEmail) {
    console.log(`User changed from ${lastEmail} → ${currentEmail}, clearing cached team data.`);
    localStorage.removeItem(`teamData_${team}`);
  } else {
    console.log(`handleLoginSuccess() — same user (${currentEmail}), keeping cached data.`);
  }

  // Store current user for next time
  if (currentEmail) {
    localStorage.setItem('lastUserEmail', currentEmail);
  }

  // Wait for Firebase to ensure user is ready
  if (!currentUser) {
    console.warn('handleLoginSuccess: currentUser not ready yet.');
    await new Promise(resolve =>
      onAuthStateChanged(auth, user => {
        if (user) {
          currentUser = user;
          resolve();
        }
      })
    );
  }

  // Re-init app with current user
  await init(currentUser);
}




/**
 * Setup login/logout buttons
 */
function setupAuthUI() {
  const auth = window.firebaseAuth;
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginBtn) loginBtn.addEventListener('click', () => signInWithPopup(auth, provider));
  if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));
}


const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function cacheData(team, data) {
  if (!isLocalStorageAvailable()) return; // skip caching if not available
  const key = `teamData_${team}`;
  const payload = {
    timestamp: Date.now(),
    data, // keep wrapped for backward compatibility
  };
  console.log(`cacheData(): writing to ${key} —`, payload);
  try {
    localStorage.setItem(key, JSON.stringify(payload));
    console.log(`Cached data for team "${team}" at ${new Date(payload.timestamp).toLocaleTimeString()}`);
  } catch (err) {
    console.error('cacheData() failed:', err);
  }
}

function getCachedData(team) {
  console.log('Current origin:', window.location.origin);
  if (!isLocalStorageAvailable()) return null; // skip if localStorage not available
  const key = `teamData_${team}`;
  console.log('getCachedData(): checking key', key);
  console.log('Available localStorage keys:', Object.keys(localStorage));
  const raw = localStorage.getItem(key);
  if (!raw) {
    console.log(`getCachedData(): no localStorage entry found for "${key}"`);
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    // Validate structure
    if (!parsed || typeof parsed !== 'object') {
      console.warn(`getCachedData(): malformed cache for "${key}"`);
      return null;
    }

    const { timestamp, data } = parsed;
    if (!timestamp || !data) {
      console.warn(`getCachedData(): missing timestamp or data for "${key}"`);
      return null;
    }

    // Expiry check
    const age = Date.now() - timestamp;
    if (age > CACHE_TTL) {
      console.log(`getCachedData(): cache expired (${Math.round(age / 1000)}s old) for "${key}"`);
      return null;
    }

    console.log(`getCachedData(): cache hit for "${key}" (${Math.round(age / 1000)}s old)`);
    return parsed;

  } catch (e) {
    console.error(`getCachedData(): failed to parse cached data for "${key}"`, e);
    return null;
  }
}

function waitForElement(selector, timeout = 5000) {
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


function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',  // "Jan", "Feb", ...
    day: 'numeric',  // 1–31
    year: 'numeric'  // 2025
  }).format(date);
}


/**
 * Render grid of team link buttons.
 */
function renderTeamLinks(links) {
  const container = document.getElementById('teamLinks');
  container.innerHTML = '';

  links.forEach(link => {
    const a = document.createElement('a');
    a.href = `?team=${link.shortName}`;
    a.textContent = link.name;
    a.className = 'teamLinkBtn';
    container.appendChild(a);
  });
}


/**
 * Main init() — loads team data from backend, uses user email if logged in.
 */
async function init(user = currentUser) {
  const auth = window.firebaseAuth;
  // --- Wait for Firebase auth state if needed ---
  if (!user || !user.email) {
    console.log('init(): user not ready yet — waiting for Firebase auth state...');
    await new Promise(resolve => {
      const unsubscribe = onAuthStateChanged(auth, fbUser => {
        if (fbUser) {
          console.log(`init(): Firebase returned user ${fbUser.email}`);
          currentUser = fbUser;
          unsubscribe(); // stop listening once we have a user
          resolve();
        } else {
          console.log('init(): No logged-in user — continuing as anonymous.');
          unsubscribe();
          resolve(); // resolve even if logged out
        }
      });
    });
    user = currentUser;
  }

  // --- BASIC PARAM SETUP ---
  const team = getNormalizedTeamParam();

  if (!team) {
    console.log('init() skipped — no team param in URL.');
    setLoading(false);
    return;
  }

  const effectiveEmail = user?.email || 'anonymous@public'; // default to anonymous
  console.log(`init() called — team=${team}, user=${effectiveEmail || 'anonymous'}`);

  // fallback cache key
  const cacheKey = team || 'teamLinks';
  const cached = getCachedData(cacheKey);
  console.log('getCachedData() returned:', cached);

  // --- CACHE FRESHNESS GUARD (skip redundant backend call) ---
  const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes validity
  if (cached && cached.timestamp && Date.now() - cached.timestamp < MAX_CACHE_AGE) {
    console.log(`Cache is fresh (age=${Math.round((Date.now() - cached.timestamp) / 1000)}s) — using cache only.`);
    console.log('Backend data:', cached.data);
    console.log(cached);
    renderTeamPage(cached.data || cached); // support both old/new cache formats
    setLoading(false);
    attachRefreshListener();
    return;
  }

  // --- CASE 1: Cached data exists (stale but renderable) ---
  if (cached) {
    console.log(`Using stale cached data for team "${team}" (background refresh will run).`);
    console.log('Backend data:', cached.data);
    console.log(cached);
    const age = Date.now() - cached.timestamp;
    if (age < MAX_CACHE_AGE) {
      renderTeamPage(cached.data);
      setLoading(false);
      attachRefreshListener();
      return; // stop, cache is fresh
    }

    try {
      const effectiveEmail = currentUser?.email || '';
      const fresh = await callBackend({ team, email: effectiveEmail });
      console.log('Background refresh response:', fresh);
      if (fresh?.success) {
        console.log('Background refresh complete — updating cache and UI');
        cacheData(cacheKey, fresh);
        console.log('Backend data:', fresh);
        renderTeamPage(fresh);
      } else {
        console.warn('Background refresh returned unsuccessful response:', fresh);
      }
    } catch (err) {
      console.error('Background refresh failed:', err);
    } finally {
      clearTimeout(hideTimer);
      showRefreshOverlay(false);
    }

    return;
  }

  // --- CASE 2: No cache — fetch fresh data ---
  console.log('No cached data found — fetching fresh data from backend...');
  setLoading(true);
  try {
    const effectiveEmail = currentUser?.email || '';
    const data = await callBackend({ team, email: effectiveEmail });
    console.log('Fresh backend response:', data);
    if (data?.success) {
      cacheData(cacheKey, data);
      console.log('Backend data:', data);
      renderTeamPage(data);
    } else {
      console.warn('Backend call returned unsuccessful response:', data);
    }
  } catch (err) {
    console.error('Error loading team page data:', err);
  } finally {
    setLoading(false);
    attachRefreshListener();
  }
}




// --- Helper: attach refresh listener once ---
function attachRefreshListener() {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn && !refreshBtn.dataset.listenerAttached) {
    refreshBtn.addEventListener('click', refreshData);
    refreshBtn.dataset.listenerAttached = 'true';
    console.log('Refresh button listener attached.');
  }
}

// --- Helper: background refresh overlay with spinner ---
function showRefreshOverlay(show) {
  let overlay = document.getElementById('refreshOverlay');

  if (show) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'refreshOverlay';
      overlay.innerHTML = `
        <div class="refresh-spinner"></div>
        <span>Refreshing…</span>
      `;
      Object.assign(overlay.style, {
        position: 'fixed',
        bottom: '16px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        background: 'rgba(0,0,0,0.7)',
        color: '#fff',
        borderRadius: '8px',
        fontSize: '14px',
        zIndex: '9999',
        opacity: '0',
        transition: 'opacity 0.3s ease'
      });

      const spinnerStyle = document.createElement('style');
      spinnerStyle.textContent = `
        .refresh-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(spinnerStyle);

      document.body.appendChild(overlay);
      requestAnimationFrame(() => (overlay.style.opacity = '1'));
    }
  } else if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 400);
  }
}

function attachDeleteHandlers() {

  const deleteLinks = document.querySelectorAll('.delete-link');
  if (!deleteLinks.length) {
    console.log('attachDeleteHandlers(): no delete links found');
    return;
  }

  deleteLinks.forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();

      const url = new URL(link.href);
      const action = url.searchParams.get('action');
      const id = url.searchParams.get('id');
      const team = getNormalizedTeamParam();

      if (action !== 'delete' || !id) {
        console.warn('Invalid delete link:', link.href);
        return;
      }

      const confirmDelete = confirm('Are you sure you want to delete this announcement?');
      if (!confirmDelete) return;

      setLoading(true);

      try {
        const backendUrl = `${url.origin}${url.pathname}`;
        const result = await callBackend({
          team,
          action,
          id,
          email: currentUser?.email || '',
        });

        if (result?.success) {
          alert('Announcement deleted successfully.');
          console.log('Delete response:', result);

          // Reload UI after delete
          await handleLoginSuccess(); 
        } else {
          alert(`Delete failed: ${result?.message || 'Unknown error'}`);
          console.warn('Delete error:', result);
        }
      } catch (err) {
        console.error('Delete request failed:', err);
        alert('Failed to delete announcement.');
      } finally {
        setLoading(false);
      }
    });
  });
}

/**
 * Manually refresh data from backend.
 */
async function refreshData() {
  const refreshBtn = document.getElementById('refreshBtn');
  const team = getNormalizedTeamParam();
  if (!team) return;

  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Refreshing...';

  localStorage.removeItem(`teamData_${team}`);
  console.log(`Cache cleared for team "${team}"`);

  setLoading(true);
  try {
    await init(currentUser);
  } catch (err) {
    console.error('Error refreshing data:', err);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Refresh Data';
    setLoading(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const updateContainer = document.getElementById('teamUpdateContainer');
  const auth = window.firebaseAuth;
  if (!auth) {
    console.error('Firebase auth not initialized yet');
    return;
  }

  // Hook up login/logout buttons
  setupAuthUI();

  // DO NOT call loadBackend here.
  // Auth state listener will handle the initial load.
});

