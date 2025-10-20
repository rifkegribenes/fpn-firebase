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

/**
 * Handle post-login success — clear cache, re-fetch backend, re-render.
 */
async function handleLoginSuccess() {
  const urlParams = new URLSearchParams(window.location.search);
  const team = urlParams.get('team') || '';

  console.log(`handleLoginSuccess() — refreshing data for team "${team}"`);

  // Clear cached data so roles update
  localStorage.removeItem(`teamData_${team}`);

  // Wait for Firebase to ensure user is current
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

  // Re-init app (pass current user explicitly)
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
    const team = urlParams.get('team') || '';

    if (user) {
      console.log("Logged in as:", user.email);
      userInfo.innerText = `Signed in as ${user.email}`;
      loginBtn.hidden = true;
      logoutBtn.hidden = false;

      await handleLoginSuccess();
    } else {
      console.log("Logged out");
      userInfo.innerText = '';
      loginBtn.hidden = false;
      logoutBtn.hidden = true;

      // Clear any cached data for privacy
      localStorage.removeItem(`teamData_${team}`);

      // Render public (non-admin) version of the page
      await init();
    }
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

function setLoading(loading) {
  const spinner = document.getElementById('loadingSpinner');
  if (!spinner) return;
  spinner.style.opacity = loading ? '1' : '0';
  spinner.style.pointerEvents = loading ? 'auto' : 'none';
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
 * Main init() — loads team data from backend, uses user email if logged in.
 */
async function init(user = currentUser) {
  const urlParams = new URLSearchParams(window.location.search);
  const page = urlParams.get('page') || 'team';
  const team = urlParams.get('team') || '';

  const effectiveEmail = user?.email || '';
  console.log(`init() called — team=${team}, user=${effectiveEmail || 'anonymous'}`);

  const cached = getCachedData(team);
  if (cached) {
    console.log('Using cached data immediately');
    renderTeamPage(cached);
    setLoading(false);

    // Ensure refresh button works
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn && !refreshBtn.dataset.listenerAttached) {
      refreshBtn.addEventListener('click', refreshData);
      refreshBtn.dataset.listenerAttached = 'true';
    }

    // Background refresh (non-blocking)
    callBackend({ page, team, email: effectiveEmail })
      .then(fresh => {
        if (fresh?.success) {
          cacheData(team, fresh);
          renderTeamPage(fresh);
        }
      })
      .catch(err => console.error('Background refresh failed:', err));
    return;
  }

  // Fallback — no cache, fetch fresh data
  setLoading(true);
  try {
    const data = await callBackend({ page, team, email: effectiveEmail });
    if (data?.success) {
      cacheData(team, data);
      renderTeamPage(data);
    }
  } catch (err) {
    console.error('Error loading team page data:', err);
  } finally {
    setLoading(false);

    // Attach refresh listener once
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
  console.log('renderTeamPage() data:', data);

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
  title.innerText = data.page === 'teamLinks'
    ? 'Team Links'
    : `${team.teamName || 'Unknown'} Team`;

  // --- Announcements ---
  announcementsDiv.innerHTML = '';
  if (data.announcements?.length) {
    data.announcements.forEach(a => {
      const div = document.createElement('div');
      div.className = 'announcement-item';

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
    const calendarUrl =
      data.teamObj.calendarUrl ||
      `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(data.teamObj.teamCal)}&ctz=America/Los_Angeles`;
    eventsDiv.innerHTML = `
      <iframe 
        src="${data.teamObj.teamCal}" 
        style="border: 0; width: 100%; height: 400px;" 
        frameborder="0" 
        scrolling="no">
      </iframe>`;
  } else {
    eventsDiv.innerHTML = `<p>No calendar found for ${team.teamName}.</p>`;
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
    opsDiv.innerHTML = `
      <a href="${url}" target="_blank">
        ${linkText}
      </a>`;
  } else {
    opsDiv.innerHTML = `<p>No operations plan found for ${team.teamName}.</p>`;
  }

  groupDiv.innerHTML = team.groupEmail
    ? `<p><a href=https://groups.google.com/a/friendsofportlandnet.org/g/${team.shortName}}>${team.teamName} Google Group</a></p>`
    : `<p>No Google group found for ${team.teamName}.</p>`;

  driveDiv.innerHTML = team.teamDrive
    ? `<p><a href=${team.teamDrive}>${teamObj.teamName} shared Drive</a> (access other team documents here)</p>`
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

document.addEventListener('DOMContentLoaded', setupAuthUI);
