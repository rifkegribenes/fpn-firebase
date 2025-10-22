import { callBackend } from './api.js';
import { config } from './config.js';

// --- GLOBAL GUARDS AND STATE ---
let currentUser = null;
let initHasRun = false;
let lastLoginEmail = null;


// Make this globally persistent so multiple calls skip redundant init
async function safeInit(user) {
  if (initHasRun) {
    console.log('safeInit(): skipped — init already completed this session.');
    return;
  }
  await init(user);
  initHasRun = true;
}


// Global helper
function setLoading(loading, message = "Loading...") {
  const spinner = document.getElementById('loadingSpinner');
  if (!spinner) return;

  const messageEl = spinner.querySelector('p');
  if (messageEl) messageEl.textContent = message;

  // Clear any previous safety timer
  clearTimeout(spinner._safetyTimer);

  if (loading) {
    // Show spinner smoothly
    spinner.style.display = 'flex';
    requestAnimationFrame(() => (spinner.style.opacity = '1'));

    // --- Safety auto-hide after 10s ---
    spinner._safetyTimer = setTimeout(() => {
      spinner.style.opacity = '0';
      setTimeout(() => {
        spinner.style.display = 'none';
      }, 300);
      console.warn('setLoading(): Spinner auto-hidden after 4s safety timeout');
    }, 4000);
  } else {
    // Hide spinner normally
    spinner.style.opacity = '0';
    setTimeout(() => {
      spinner.style.display = 'none';
    }, 300);
  }
}



// --- Firebase imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// --- Initialize Firebase ---
const app = initializeApp(config.firebase);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/**
 * Handle post-login success — clear cache, re-fetch backend, re-render.
 */

async function handleLoginSuccess() {
  const urlParams = new URLSearchParams(window.location.search);
  const team = urlParams.get('team') || '';
  const currentEmail = currentUser?.email;
  const lastEmail = localStorage.getItem('lastUserEmail');

  console.log(`handleLoginSuccess() — current=${currentEmail}, last=${lastEmail}, team="${team}"`);

  // --- Handle user switch ---
  if (currentEmail && lastEmail && currentEmail !== lastEmail) {
    console.log(`User changed from ${lastEmail} → ${currentEmail}, clearing cached team data.`);
    if (team) localStorage.removeItem(`teamData_${team}`);
  } else {
    console.log(`handleLoginSuccess() — same user (${currentEmail}), keeping cached data.`);
  }

  // --- Persist user email for next login ---
  if (currentEmail) localStorage.setItem('lastUserEmail', currentEmail);

  // --- Ensure Firebase currentUser is ready ---
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

  // --- Retrieve cached team data, if any ---
  const cached = team ? getCachedData(team) : null;
  const MAX_CACHE_AGE = 60 * 60 * 1000; // 60 minutes

  // --- CASE 1: Cached data exists ---
  if (cached && cached.data) {
    const ageMs = Date.now() - (cached.timestamp || 0);
    console.log(`handleLoginSuccess(): cache age = ${Math.round(ageMs / 1000)}s`);

    // --- Always re-render immediately using cache for fast load ---
    console.log('handleLoginSuccess(): using cached data — rendering instantly.');
    renderTeamPage(cached.data);
    await new Promise(r => setTimeout(r, 150)); // let DOM settle
    refreshAdminUI(currentUser, cached.data);
    setLoading(false);

    // --- If cache is stale (older than 60 min), do a silent background refresh ---
    if (ageMs > MAX_CACHE_AGE) {
      console.log('Cache is older than 60 minutes — fetching fresh data in background.');
      (async () => {
        try {
          const fresh = await callBackend({ team, email: currentEmail });
          if (fresh?.success) {
            cacheData(team, fresh);
            console.log('Background refresh complete — cache updated.');
            // Optional: update UI silently without spinner
            renderTeamPage(fresh);
            refreshAdminUI(currentUser, fresh);
          } else {
            console.warn('Background refresh returned unsuccessful response:', fresh);
          }
        } catch (err) {
          console.error('Background refresh failed:', err);
        }
      })();
    } else {
      console.log('Cache is fresh (<60 min) — skipping backend call.');
    }

    return;
  }

  // --- CASE 2: No cache found — run full init ---
  console.log('handleLoginSuccess(): no cached data found, running full init.');
  await init(currentUser);
}



/**
 * Setup login/logout buttons and Firebase auth listener.
 */
function setupAuthUI() {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userInfo = document.getElementById("userInfo");

  if (loginBtn) {
    loginBtn.addEventListener('click', () => signInWithPopup(auth, provider));
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut(auth));
  }


  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const urlParams = new URLSearchParams(window.location.search);
    const team = urlParams.get("team") || "";

    console.log("Auth state changed:", user ? `Logged in as ${user.email}` : "Logged out");

    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const userInfo = document.getElementById("userInfo");

    if (!loginBtn || !logoutBtn) {
      console.warn("Auth buttons not found in DOM when onAuthStateChanged fired.");
      return;
    }

    if (user) {
      userInfo.innerText = `Signed in as ${user.email}`;
      loginBtn.hidden = true;
      logoutBtn.hidden = false;

      if (team) {
        try {
          console.log("Auth: user detected — running handleLoginSuccess()");
          await handleLoginSuccess();
        } catch (err) {
          console.error("Error during login success:", err);
        }
      }
    } else {
      userInfo.innerText = "";
      loginBtn.hidden = false;
      logoutBtn.hidden = true;

      if (team) {
        localStorage.removeItem(`teamData_${team}`);
        try {
          console.log("Auth: no user — initializing public view");
          if (!initHasRun) {
            await safeInit();
            initHasRun = true;
          } else {
            console.log("Public init skipped — already initialized.");
          }
        } catch (err) {
          console.error("Error initializing public view:", err);
        }
      }
    }
  });


} // <-- closes setupAuthUI

document.addEventListener('DOMContentLoaded', setupAuthUI);

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function cacheData(team, data) {
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
 * === Handle Team vs TeamLinks View ===
 * If ?team param is missing, show list of teams from data.teamLinks.
 */
document.addEventListener('DOMContentLoaded', async () => {
  setLoading(true); // always show spinner initially

  const params = new URLSearchParams(window.location.search);
  const team = params.get('team') || '';

  const teamContent = document.getElementById('teamContent');
  const linksContent = document.getElementById('linksContent');
  const teamLinksContainer = document.getElementById('teamLinks');

  // --- TEAM PAGE ---
  if (team) {
    linksContent.style.display = 'none';
    teamContent.style.display = 'block';
    return; // handled elsewhere
  }

  // --- TEAM LINKS PAGE (no ?team param) ---
  teamContent.style.display = 'none';
  linksContent.style.display = 'block';

  const pseudoTeamKey = 'teamLinks';
  console.log('Loading teamLinks page…');

  // --- Try to get cached teamLinks ---
  const cached = getCachedData(pseudoTeamKey);
  console.log('getCachedData("teamLinks") returned:', cached);

  if (cached && cached.data?.teamLinks?.length) {
    console.log(`Rendering ${cached.data.teamLinks.length} cached team links`);
    renderTeamLinks(cached.data.teamLinks);
    setLoading(false);

    // --- Background refresh ---
    (async () => {
      try {
        console.log('Refreshing teamLinks in background...');
        const fresh = await callBackend();
        if (fresh?.success && Array.isArray(fresh.teamLinks)) {
          cacheData(pseudoTeamKey, fresh);
          renderTeamLinks(fresh.teamLinks);
          console.log('Background refresh complete — UI updated.');
        } else {
          console.warn('Background refresh returned unexpected response:', fresh);
        }
      } catch (err) {
        console.error('Background refresh failed:', err);
      }
    })();

    return;
  }

  // --- No cache or expired cache: fetch fresh ---
  console.log('No valid cache found — fetching teamLinks from backend...');
  try {
    const data = await callBackend();
    if (data?.success && Array.isArray(data.teamLinks)) {
      cacheData(pseudoTeamKey, data);
      renderTeamLinks(data.teamLinks);
    } else {
      teamLinksContainer.innerHTML = '<p>No teams found.</p>';
    }
  } catch (err) {
    console.error('Error fetching team links:', err);
    teamLinksContainer.innerHTML = '<p>Error loading team links.</p>';
  } finally {
    setLoading(false);
  }
});


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
  console.log('init() entered — initHasRun:', initHasRun);
  if (initHasRun) {
    console.log('init() skipped — already initialized.');
    return;
  }
  initHasRun = true;

  // --- Wait for Firebase auth state if needed ---
  if (!user || !user.email) {
    console.log('init(): user not ready yet — waiting for Firebase auth state...');
    await new Promise(resolve => {
      const unsubscribe = onAuthStateChanged(auth, fbUser => {
        if (fbUser) {
          console.log(`init(): Firebase returned user ${fbUser.email}`);
          currentUser = fbUser;
          unsubscribe();
          resolve();
        } else {
          console.log('init(): No logged-in user — continuing as anonymous.');
          unsubscribe();
          resolve();
        }
      });
    });
    user = currentUser;
  }

  // --- BASIC PARAM SETUP ---
  const urlParams = new URLSearchParams(window.location.search);
  const team = urlParams.get('team') || '';

  if (!team) {
    console.log('init() skipped — no team param in URL.');
    setLoading(false, '', true);
    return;
  }

  const effectiveEmail = user?.email || 'anonymous@public';
  console.log(`init() called — team=${team}, user=${effectiveEmail || 'anonymous'}`);

  const cached = getCachedData(team);
  console.log('getCachedData() returned:', cached);

  // --- CACHE FRESHNESS GUARD ---
  const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes
  const cacheAge = cached?.timestamp ? Date.now() - cached.timestamp : null;

  if (cached && cacheAge < MAX_CACHE_AGE) {
    console.log(`Cache is fresh (age=${Math.round(cacheAge / 1000)}s) — using cache only, skipping backend call.`);
    renderTeamPage(cached.data || cached);
    setLoading(false, '', true); // instant hide spinner
    attachRefreshListener();
    return;
  }

  // --- CASE 1: Cached data exists but stale ---
  if (cached) {
    console.log(`Using stale cached data for team "${team}" (background refresh will run).`);
    renderTeamPage(cached.data || cached);
    setLoading(false, '', true);
    attachRefreshListener();

    // Background refresh, non-blocking
    showRefreshOverlay(true);
    const hideTimer = setTimeout(() => showRefreshOverlay(false), 2000);

    try {
      console.log('callBackend(): refreshing stale data...');
      const fresh = await callBackend({ team, email: effectiveEmail });
      console.log('Background refresh response:', fresh);
      if (fresh?.success) {
        cacheData(team, fresh);
        renderTeamPage(fresh);
        console.log('Background refresh complete — updated cache and UI.');
      } else {
        console.warn('Background refresh returned unsuccessful response:', fresh);
      }
    } catch (err) {
      console.error('Background refresh failed:', err);
    } finally {
      clearTimeout(hideTimer);
      showRefreshOverlay(false);
      setLoading(false, '', true);
    }

    return;
  }

  // --- CASE 2: No cache available ---
  console.log('No cached data found — fetching fresh data from backend...');
  setLoading(true);
  try {
    console.log('callBackend(): no-cache initial fetch...');
    const data = await callBackend({ team, email: effectiveEmail });
    console.log('Fresh backend response:', data);
    if (data?.success) {
      cacheData(team, data);
      renderTeamPage(data);
    } else {
      console.warn('Backend returned unsuccessful response:', data);
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

async function renderAnnouncements(data) {
  try {
    // Wait for #announcements element to exist
    const announcementsDiv = await waitForElement('#announcements', 3000);
    if (!announcementsDiv) {
      console.warn('renderAnnouncements(): #announcements element not found.');
      return;
    }

    // Clear existing announcements
    announcementsDiv.innerHTML = '';

    if (data.announcements?.length) {
      data.announcements.forEach(a => {
        const div = document.createElement('div');
        div.className = 'announcement-item';

        let adminBlock = '';
        if (data.isTeamPageEditor) {
          const deleteURLWithParams = `${a.deleteURL}&team=${data.teamObj.shortName}`;
          adminBlock = `
            <div class="announcement-admin links">
              <a href="${a.editURL}" class="edit-link">Edit</a>
              &nbsp;|&nbsp;
              <a href="${deleteURLWithParams}" class="delete-link">Delete</a>
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
      announcementsDiv.innerHTML = `<p>No announcements found for ${data.teamObj?.teamName || 'this team'}.</p>`;
    }
  } catch (err) {
    console.warn('renderAnnouncements(): failed to render announcements', err);
  }
}



async function refreshAdminUI(user = currentUser, data = window.lastRenderedTeamData) {
  if (!data) {
    console.warn("refreshAdminUI(): no data available yet — waiting for renderTeamPage...");
    return;
  }

  console.log("Refreshing admin UI for user:", user?.email);

  // Wait for adminButtons and announcements to exist
  try {
    await waitForElement('#adminButtons', 3000);
    await waitForElement('#announcements', 3000);
  } catch (err) {
    console.warn("refreshAdminUI(): required elements not ready:", err);
    return;
  }

  const isAdmin = !!(
    user?.email &&
    (data.isAdmin || data.isTeamPageEditor)
  );

  // Toggle visibility of admin buttons
  const adminButtons = document.getElementById('adminButtons');
  if (adminButtons) {
    adminButtons.style.display = isAdmin ? 'flex' : 'none';
  }

  // Re-render announcements block (adds edit/delete links)
  if (typeof renderAnnouncements === 'function') {
    renderAnnouncements(data);
  }

  // Re-render the Update Page link
  const updateContainer = document.getElementById('teamUpdateContainer');
  if (updateContainer) {
    updateContainer.innerHTML = '';
    if (isAdmin && data.teamObj?.teamName) {
      const updateLink = document.createElement('a');
      updateLink.id = 'teamUpdateLink';
      updateLink.href = `https://docs.google.com/forms/d/e/1FAIpQLSe9TU8URPswEVELyy9jOImY2_2vJ9OOE7O8L5JlNUuiJzPQYQ/viewform?usp=pp_url&entry.1458714000=${encodeURIComponent(data.teamObj.teamName)}`;
      updateLink.target = '_blank';
      updateLink.className = 'responsiveLink';
      updateLink.textContent = 'Update page';
      updateContainer.appendChild(updateLink);
    }
  }

  console.log("refreshAdminUI(): UI updated successfully.");
}




/**
 * Render the team page after data is ready.
 */
export async function renderTeamPage(data) {
  console.log('renderTeamPage() data:', data);
  window.lastRenderedTeamData = data;

  const selectors = [
    '#pageTitle',
    '#announcements',
    '#minutes',
    '#events',
    '#ops',
    '#group',
    '#drive'
  ];

  const elements = await Promise.all(
    selectors.map(sel => waitForElement(sel, 3000).catch(err => {
      console.warn(`renderTeamPage(): missing element ${sel}`, err);
      return document.createElement('div'); // safe fallback
    }))
  );

  const [
    title,
    announcementsDiv,
    minutesDiv,
    eventsDiv,
    opsDiv,
    groupDiv,
    driveDiv
  ] = elements;

  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.style.display = data.isTeamPageEditor ? 'inline-block' : 'none';

  const team = data.teamObj || {};
  const urlParams = new URLSearchParams(window.location.search);
  const teamName = data.teamObj?.teamName || urlParams.get('team');

  title.innerText = team.teamName
  ? `${team.teamName} NET`
  : 'Team Links';

  // Set sidebar header
  // const sidebarHeader = document.getElementById('sidebarHeader');
  // if (sidebarHeader && data.teamObj?.teamName) {
  //   sidebarHeader.textContent = `${data.teamObj.teamName} NET`;
  // }  

  renderAnnouncements(data);

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
    ? `<ul><li><a href=https://groups.google.com/a/friendsofportlandnet.org/g/${team.shortName}}>${team.teamName} Google Group</a></li></ul>`
    : `<p>No Google group found for ${team.teamName}.</p>`;

  driveDiv.innerHTML = team.teamDrive
    ? `<ul><li><a href=${team.teamDrive}>${team.teamName} shared Drive</a> (access other team documents here)</li></ul>`
    : `<p>Shared Drive for ${team.teamName} has not been set up yet.</p>`;


  // --- Team Update Link (conditionally rendered) ---
  const updateContainer = document.getElementById('teamUpdateContainer');
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
}

/**
 * Manually refresh data from backend.
 */
async function refreshData() {
  const refreshBtn = document.getElementById('refreshBtn');
  const urlParams = new URLSearchParams(window.location.search);
  const team = urlParams.get('team') || '';
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