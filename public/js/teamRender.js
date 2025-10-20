import { callBackend } from './api.js';
import { config } from './config.js';

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

let currentUser = null;

// --- Setup login/logout UI ---
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

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      userInfo.innerText = `Signed in as ${user.email}`;
      loginBtn.hidden = true;
      logoutBtn.hidden = false;
    } else {
      // userInfo.innerText = 'Not signed in';
      loginBtn.hidden = false;
      logoutBtn.hidden = true;
    }
    // Load team data (reloads when user state changes)
    init();
  });
}

document.addEventListener('DOMContentLoaded', setupAuthUI);

let data = null;

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCachedData(team) {
  const cached = localStorage.getItem(`teamData_${team}`);
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < CACHE_TTL) {
      console.log(`Using cached data for team "${team}"`);
      return parsed.data;
    } else {
      console.log(`Cache expired for team "${team}"`);
      localStorage.removeItem(`teamData_${team}`);
      return null;
    }
  } catch (err) {
    console.warn('Error reading cache:', err);
    return null;
  }
}

function cacheData(team, data) {
  try {
    localStorage.setItem(
      `teamData_${team}`,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch (err) {
    console.warn('Error caching data:', err);
  }
}


/**
 * Wait until an element exists in the DOM before using it.
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = performance.now();

    function check() {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      if (performance.now() - start > timeout) return reject(new Error(`Element ${selector} not found`));
      requestAnimationFrame(check);
    }

    check();
  });
}

/**
 * Show or hide the loading spinner.
 */
function setLoading(loading) {
  const spinner = document.getElementById('loadingSpinner');
  if (!spinner) return;
  spinner.style.opacity = loading ? '1' : '0';
  spinner.style.pointerEvents = loading ? 'auto' : 'none';
}

/**
 * Main init function: fetch data and render page.
 */
async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const page = urlParams.get('page') || 'team';
  const team = urlParams.get('team') || '';

  const cached = getCachedData(team);
  if (cached) {
    console.log('Using cached data immediately');
    renderTeamPage(cached);
    setLoading(false);

    // ✅ Attach refresh button listener (once)
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn && !refreshBtn.dataset.listenerAttached) {
      refreshBtn.addEventListener('click', refreshData);
      refreshBtn.dataset.listenerAttached = 'true';
    }

    // Trigger backend update *without waiting*
    callBackend({ page, team })
      .then(fresh => {
        if (fresh?.success) {
          cacheData(team, fresh);
          renderTeamPage(fresh); // silently refresh page
        }
      })
      .catch(err => console.error('Background refresh failed:', err));
    return; // done — don’t block on await
  }

  // Fallback when no cache
  setLoading(true);
  try {
    const data = await callBackend({ page, team });
    if (data?.success) {
      cacheData(team, data);
      renderTeamPage(data);
    }
  } catch (err) {
    console.error('Error loading team page data:', err);
  } finally {
    setLoading(false);

    // Attach refresh button listener (once)
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn && !refreshBtn.dataset.listenerAttached) {
      refreshBtn.addEventListener('click', refreshData);
      refreshBtn.dataset.listenerAttached = 'true';
    }
  }
}





/**
 * Render the team page after data is ready.
 */
export async function renderTeamPage(data) {
  console.log(data);
  // Wait for critical DOM elements
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


  // Show Refresh button only if user is a Team Page Editor
  const refreshBtn = document.getElementById('refreshBtn');
  if (data.isTeamPageEditor) {
    refreshBtn.style.display = 'inline-block';
  } else {
    refreshBtn.style.display = 'none';
  }

  const team = data.teamObj || {};
  title.innerText = data.page === 'teamLinks'
    ? 'Team Links'
    : `${team.teamName || 'Unknown'} Team`;

  // Announcements
  announcementsDiv.innerHTML = '';

  if (data.announcements?.length) {
    data.announcements.forEach(a => {
      const div = document.createElement('div');
      div.className = 'announcement-item';

      // Add admin controls if the user is a team page editor
      let adminBlock = '';
      if (data.isTeamPageEditor) {
        const deleteURLWithParams = `${a.deleteURL}&page=team&team=${data.teamObj.shortName}`;
        adminBlock = `
          <div class="announcement-admin" style="margin-top: 6px;">
            <a href="${a.editURL}" class="edit-link">Edit</a>
            &nbsp;|&nbsp;
            <a href="${deleteURLWithParams}" class="delete-link">Delete</a>
          </div>
        `;
      }

      div.innerHTML = `
        <h3>${a.title}</h3>
        <p>${a.body}</p>
        <small>${new Date(a.timestamp).toLocaleString()}</small>
        ${adminBlock}
      `;

      announcementsDiv.appendChild(div);
    });
  } else {
    announcementsDiv.innerHTML = `<p>No announcements found for ${data.teamObj.teamName}.</p>`;
  }


  // Minutes
  minutesDiv.innerHTML = '';
  if (data.minutes?.length) {
    const ul = document.createElement('ul');
    data.minutes.forEach(m => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="https://drive.google.com/open?id=${m.id}" target="_blank">${m.name}</a>`;
      ul.appendChild(li);
    });
    minutesDiv.appendChild(ul);
  } else {
    minutesDiv.innerHTML = `<p>No minutes found for ${team.teamName}.</p>`;
  }

  // Events
  eventsDiv.innerHTML = `<p>No calendar found for ${team.teamName}.</p>`;
  opsDiv.innerHTML = `<p>No operations plan found for ${team.teamName}.</p>`;

  // Group email
  groupDiv.innerHTML = team.groupEmail
    ? `<a href="mailto:${team.groupEmail}">${team.groupEmail}</a>`
    : `<p>No Google group found for ${team.teamName}.</p>`;

  // Drive link
  driveDiv.innerHTML = team.teamDrive
    ? `<a href="${team.teamDrive}" target="_blank">Team Drive</a>`
    : `<p>Shared Drive for ${team.teamName} has not been set up yet.</p>`;
}

async function refreshData() {
  const refreshBtn = document.getElementById('refreshBtn');
  const urlParams = new URLSearchParams(window.location.search);
  const team = urlParams.get('team') || '';
  if (!team) return;

  // Disable button while refreshing
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Refreshing...';

  // Clear cached data
  localStorage.removeItem(`teamData_${team}`);
  console.log(`Cache cleared for team "${team}"`);

  // Show spinner while reloading
  setLoading(true);

  try {
    await init(); // re-fetch and re-render
  } catch (err) {
    console.error('Error refreshing data:', err);
  } finally {
    // Re-enable button after reload
    refreshBtn.disabled = false;
    refreshBtn.textContent = '🔄 Refresh Data';
  }
}

document.addEventListener('DOMContentLoaded', setupAuthUI);