import { setupAuthUI, getCurrentUser, setCurrentUser } from './auth.js';
import { fetchTeamLinks, fetchTeamData, deriveAuthFromEmail } from './fetch.js';
import { config } from './config.js';
import { showUpdateForm, handleDeleteAnnouncement } from './submit.js';
import { getNormalizedTeamParam, 
			setLoading, 
			isLocalStorageAvailable, 
			cacheKeyFor, 
			waitForElement,
			normalizeAnnouncement,
			formatDate } from './helpers.js';
import { getAuth, onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

console.log(getCurrentUser());

/**
 * Render the team page after data is ready.
 */
export async function renderTeamPage(data, user) {
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
    driveDiv,
    bannerDiv,
    bannerSection,
    teamLeadEmailDiv
  ] = await Promise.all([
    waitForElement('#pageTitle'),
    waitForElement('#announcements'),
    waitForElement('#minutes'),
    waitForElement('#events'),
    waitForElement('#ops'),
    waitForElement('#group'),
    waitForElement('#drive'),
    waitForElement('#banner'),
    waitForElement('#bannerSection'),
    waitForElement('#teamLeadEmail')
  ]);

  const refreshBtn = document.getElementById('refreshBtn');

  const team = data?.teamData?.teamObj || {};
  const teamName = data?.teamData?.teamObj?.teamName || getNormalizedTeamParam();

  title.innerText = team.teamName
  ? `${team.teamName} NET`
  : 'Team Links'; 

  // --- Banner ---
  bannerDiv.innerHTML = '';
  const bannerData = data?.teamData?.banner[0];
  console.log(data);
  console.log(data.teamData);
  console.log(data.teamData.banner);
  console.log(data.teamData.banner[0]);
  console.log(data.teamData.banner[0].id);
  console.log(`bannerData`);
  console.log(bannerData);

  if (bannerData && bannerData.publicUrl) {
  	console.log(`bannerData MAIN.js 63 #########################`);
  	console.log(bannerData);
    console.log('rendering banner');
    bannerSection.style.display = 'block';
    bannerDiv.innerHTML = `
      <div class="bannerImgCont">
        <img class="bannerImg" src="${bannerData.publicUrl}" alt="${bannerData.alt}">
      </div>
    `;

    // Add admin links after the image
    if (data.auth.isTeamPageEditor) {
      const bannerImg = bannerDiv.querySelector('img.bannerImg'); // query inside bannerDiv
      const currentFileUrl = bannerImg ? bannerImg.src : null;
      const currentUserEmail = data.auth.email || '';

      if (currentFileUrl) {
      	let deleteBannerURL = "#";
        // const deleteBannerURL = `${config.backendUrl}?team=${teamName}&email=${currentUserEmail}&action=deleteBanner&fileUrl=${encodeURIComponent(currentFileUrl)}`;
        const bannerAdminHTML = `
          <div class="announcement-admin links" style="margin-top: 8px; font-size: 0.9em;">
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSe9TU8URPswEVELyy9jOImY2_2vJ9OOE7O8L5JlNUuiJzPQYQ/viewform?usp=pp_url&entry.1458714000=${encodeURIComponent(teamName)}" target="_blank" class="edit-link">New Image</a>
            &nbsp;|&nbsp;
            <a href="${deleteBannerURL}" target="_blank" class="delete-link">Delete</a>
          </div>
        `;
        bannerDiv.insertAdjacentHTML('beforeend', bannerAdminHTML);
      }
    }
  }




  // --- Team Lead Email ---  
  teamLeadEmailDiv.innerHTML = '';
  if (data?.teamData?.teamObj?.tlAssigned) {
    console.log(`team lead for ${data?.teamData?.teamObj?.teamName} is assigned, rendering tl email`);
    teamLeadEmailDiv.style.display = 'block';
    teamLeadEmailDiv.innerHTML = 
      `<h4 id="tlhead">Team Lead</h4>
      <ul class="icon-list">
        <li class="icon-user">${data?.teamData?.teamObj?.tlName}</li>
        <li class="icon-envelope"><a href="mailto:${data?.teamData?.teamObj?.tlEmail}">${data?.teamData?.teamObj?.tlEmail.toLowerCase()}</a></li>
      </ul>`
  } else {
    console.log(`no team lead assigned for ${data?.teamData?.teamObj?.teamName}`);
  }

  const buildDeleteURL = (a, teamName, currentUserEmail) => {
    const base = a.deleteURL;
    const params = new URLSearchParams({
      team: teamName,
      email: currentUserEmail,
    });
    return `${base}&${params.toString()}`;
  }

  // --- Announcements ---
  announcementsDiv.innerHTML = '';
  if (data?.teamData?.announcements?.length || data?.announcements?.length) {
    renderAnnouncements({
      announcements: data.teamData.announcements,
      container: announcementsDiv,
      isEditor: data.auth.isTeamPageEditor,
      teamShortName: data.teamData.teamObj.shortName,
      teamData: data.teamData
    });
  } else {
    announcementsDiv.innerHTML = `<p>No announcements found for ${data.teamData.teamObj.shortName}.</p>`;
  }



  // --- Minutes ---
  minutesDiv.innerHTML = '';
  if (data?.teamData?.minutes?.length) {
    const ul = document.createElement('ul');
    ul.classList.add('icon-list');
    data?.teamData?.minutes.forEach(file => {
      const li = document.createElement('li');
      li.classList.add('icon-pdf')
      const createdDateStr = file.createdTime || null;
      let formattedDate = 'Unknown date';

      if (file.meetingDate) {
        formattedDate = formatDate(file.meetingDate);
      }

      const linkText = `${team.teamName} minutes ${formattedDate}`;
      const url = `https://drive.google.com/file/d/${file.id}/view`;
      
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.textContent = linkText;
      li.appendChild(link);  

      // Trash icon for team page editors ---
      if (data.auth?.isTeamPageEditor) {
        const trash = document.createElement('span');
        trash.className = 'trash-icon';
			  trash.style.cursor = 'pointer';
			  trash.style.marginLeft = '8px';

			  // Add Font Awesome trash icon
			  trash.innerHTML = '<i class="fa fa-trash" style="color: #df683a;" aria-hidden="true"></i>';

        // Click handler to delete row from Sheet & cache
        trash.addEventListener('click', async () => {
          if (!confirm(`Delete "${linkText}" from the team data?`)) return;

          const teamParam = getNormalizedTeamParam();
          try {
            // DELETE row from SheetDB
            const res = await fetch(
          		`https://sheetdb.io/api/v1/ne0v0i21llmeh/Id/${encodeURIComponent(file.rowId)}` +
						  `?sheet=TeamPageUpdateForm`,
						  { method: 'DELETE' }
						);

            const dataRes = await res.json();

            if (res.ok) {
              console.log('Row deleted:', dataRes);

              // Remove from cache
              const cached = getCachedData(teamParam);
              if (cached?.data?.minutes) {
                cached.data.minutes = cached.data.minutes.filter(f => f.rowId !== file.rowId);
                cacheData(teamParam, cached.data, cached.data.auth);
              }

              // Remove from DOM
              li.remove();
            } else {
              console.error('Failed to delete row:', dataRes);
              alert('Failed to delete file row. See console for details.');
            }
          } catch (err) {
            console.error('Error deleting file row:', err);
            alert('Error deleting file row: ' + err.message);
          }
        });

        li.appendChild(trash);
      }

      ul.appendChild(li);

    });

    minutesDiv.appendChild(ul);
  } else {
    minutesDiv.innerHTML = `<p>No minutes found for ${team.teamName}.</p>`;
  }

  // Calendar / Events

  eventsDiv.innerHTML = '';

  if (data?.teamData?.teamObj?.teamCal) {
    // The backend already provides a full embed URL (e.g., https://calendar.google.com/calendar/embed?...).
    const baseUrl = data.teamData?.teamObj.teamCal;

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
    eventsDiv.innerHTML = `<p>No calendar found for ${data.teamData?.teamObj?.teamName}.</p>`;
  }



  // --- Operations Plan ---
opsDiv.innerHTML = '';
if (data?.teamData?.opsPlanFile && data?.teamData?.opsPlanFile[0]?.id) {
  const file = data.teamData?.opsPlanFile[0];
  const linkText = `${team.teamName} Operations Plan`;
  const url = `https://drive.google.com/file/d/${file.id}/view`;

  const ul = document.createElement('ul');
  ul.classList.add('icon-list');

  const li = document.createElement('li');
  li.classList.add('icon-pdf');

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.textContent = linkText;
  li.appendChild(link);

  // Trash icon for team page editors
  if (data.auth?.isTeamPageEditor) {
    const trash = document.createElement('span');
    trash.className = 'trash-icon';
    trash.style.cursor = 'pointer';
    trash.style.marginLeft = '8px';
    trash.innerHTML = '<i class="fa fa-trash" style="color: #df683a;" aria-hidden="true"></i>';

    trash.addEventListener('click', async () => {
      if (!confirm(`Delete "${linkText}" from the team data?`)) return;

      const teamParam = getNormalizedTeamParam();
      try {
        // DELETE row from SheetDB
        const res = await fetch(
      		`https://sheetdb.io/api/v1/ne0v0i21llmeh/Id/${encodeURIComponent(file.rowId)}` +
				  `?sheet=TeamPageUpdateForm`,
				  { method: 'DELETE' }
				);
        const dataRes = await res.json();

        if (res.ok) {
          console.log('Row deleted:', dataRes);
          const cached = getCachedData(teamParam);
          if (cached?.data?.opsPlanLink?.rowId === file.rowId) {
            delete cached.data.opsPlanLink;
            cacheData(teamParam, cached.data, cached.data.auth);
          }
          li.remove();
        } else {
          console.error('Failed to delete row:', dataRes);
          alert('Failed to delete operations plan row. See console for details.');
        }
      } catch (err) {
        console.error('Error deleting file row:', err);
        alert('Error deleting operations plan row: ' + err.message);
      }
    });

    li.appendChild(trash);
  }

  ul.appendChild(li);
  opsDiv.appendChild(ul);
} else {
  opsDiv.innerHTML = `<p>No operations plan found for ${team.teamName}.</p>`;
}


  groupDiv.innerHTML = team.groupEmail
    ? `<ul class="icon-list"><li class="icon-group"><a href="https://groups.google.com/a/friendsofportlandnet.org/g/${team.shortName}" target="_blank">${team.teamName} Google Group</a></li></ul>`
    : `<p>No Google group found for ${team.teamName}.</p>`;

  driveDiv.innerHTML = team.teamDrive
    ? `<ul class="icon-list"><li class="icon-drive"><i class="fab fa-google-drive"></i><a href=${team.teamDrive}>${team.teamName} Documents</a></li></ul>`
    : `<p>Shared Drive for ${team.teamName} has not been set up yet.</p>`;


  // --- Team Update Link (conditionally rendered) ---
  updateContainer.innerHTML = ''; // clear previous content

  if (data?.auth?.isTeamPageEditor && data?.teamData?.teamObj?.teamName) {
    const updateBtn = document.createElement('button');
    updateBtn.id = 'teamUpdateBtn';
    updateBtn.type = 'button';
    updateBtn.className = 'responsiveLink';
    updateBtn.textContent = 'Update page';
    updateContainer.appendChild(updateBtn);

    updateBtn.addEventListener('click', async () => {
      await showUpdateForm(data.teamData); // <-- pass teamData here
    });


  }

  // Always attach refresh listener after rendering
  attachRefreshListener();  

}

export function updateAuthUI(user) {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userInfo = document.getElementById("userInfo");
  const refreshBtn = document.getElementById("refreshBtn");
  const teamUpdateContainer = document.getElementById("teamUpdateContainer");

  if (user) {
    // Logged in
    if (userInfo) userInfo.textContent = `Logged in as ${user?.email}`;
    if (loginBtn) loginBtn.hidden = true;
    if (logoutBtn) logoutBtn.hidden = false;
    if (refreshBtn) {
      refreshBtn.style.display = 'inline-block';
      attachRefreshListener(); 
    }
    if (teamUpdateContainer) teamUpdateContainer.style.display = 'block';
    // Edit/delete links already handled in renderTeamPage
  } else {
    // Logged out
    if (userInfo) userInfo.textContent = 'Not logged in';
    if (loginBtn) loginBtn.hidden = false;
    if (logoutBtn) logoutBtn.hidden = true;

    // Hide admin-only UI
    if (refreshBtn) refreshBtn.style.display = 'none';
    if (teamUpdateContainer) teamUpdateContainer.style.display = 'none';
    document.querySelectorAll('.announcement-admin').forEach(el => el.style.display = 'none');
    // Remove minutes trash icons on logout
		document.querySelectorAll('.trash-icon').forEach(el => el.remove());

    // Update cached auth state only (lastUserEmail), do NOT touch team data
    if (isLocalStorageAvailable()) {
      localStorage.setItem('lastUserEmail', '');
      // Keep `teamData_*` cache intact
    }
  }
}

// --- Global Firebase Auth Listener ---
const auth = window.firebaseAuth;
let prevUser = null; // track previous state

onAuthStateChanged(auth, async (user) => {
  const email = user?.email || '';
  console.log('onAuthStateChanged →', email || 'anonymous');

  setCurrentUser(user);
  updateAuthUI(user);

  // Detect “just logged out”: previously logged in, now null
  const justLoggedOut = prevUser && !user;

  // Load backend if:
  // 1. Initial load (prevUser === null)
  // 2. User is logged in
  if (!justLoggedOut) {
    const team = getNormalizedTeamParam();

    // --- CLEAR CACHE ON LOGIN ---
    const lastEmail = localStorage.getItem('lastUserEmail');
    const currentEmail = user?.email || '';

    if (lastEmail && currentEmail && lastEmail !== currentEmail) {
      console.log(`User changed ${lastEmail} → ${currentEmail}, clearing cache`);
      localStorage.removeItem(cacheKeyFor(team));
      localStorage.removeItem(cacheKeyFor('teamlinks'));
    }

    localStorage.setItem('lastUserEmail', currentEmail);

    console.log('Loading backend for team:', team);
    await loadBackend(team, user);
  } else {
    console.log('User just logged out — skipping backend load.');
  }

  // Update prevUser for next auth change
  prevUser = user;
});

// --- Immediately fetch backend for anonymous user ---
export async function loadBackend(team, user = null) {
  const email = user?.email || '';
  console.log('loadBackend');
  setLoading(true); // always show spinner initially

  // --- TEAM LINKS PAGE (no ?team param) ---
  if (!team) {
    console.log('No team param — rendering team links page');

    const pseudoTeamKey = 'teamlinks';
    const linksContent = document.getElementById('linksContent');
    const teamContent = document.getElementById('teamContent');

    linksContent.style.display = 'block';
    teamContent.style.display = 'none';

    // Cache first
    const cached = getCachedData(pseudoTeamKey);
    const links = cached?.data?.teamData?.teamLinks;

    if (Array.isArray(links) && links.length) {
      console.log(`Rendering ${links.length} cached team links`);
      renderTeamLinks(links);
      setLoading(false);
      return;
    }

    // Fetch fresh
    try {
      const [teamLinks, authRes] = await Promise.all([
			  fetchTeamLinks(),
			  deriveAuthFromEmail(user?.email || '')
			]);

			if (Array.isArray(teamLinks) && teamLinks.length) {
			  const payload = {
			    teamData: { teamLinks },
			    auth: authRes || {
					  email: '',
					  isAdmin: false,
					  isTeamLead: false,
					  isTeamPageEditor: false
					}
				};


			  cacheData(pseudoTeamKey, payload.teamData, payload.auth);
			  renderTeamLinks(teamLinks);
			} else {
			  document.getElementById('teamLinks').innerHTML =
			    '<p>No teams found.</p>';
			}
    } catch (err) {
      console.error('Error fetching team links:', err);
      document.getElementById('teamLinks').innerHTML =
        '<p>Error loading teams.</p>';
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
  const cached = getCachedData(team || 'teamlinks');
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Using cached team page data:', cached.data);

    const safeData = {
      teamData: cached.data.teamData,
      auth: cached.data.auth || { email: '', isAdmin: false, isTeamLead: false, isTeamPageEditor: false }
    };

    renderTeamPage(safeData, user);
    setLoading(false);
    attachRefreshListener();
    return; // skip backend entirely
}


  // No cache or stale → call backend
  try {
    const [teamData, authRes] = await Promise.all([
	  fetchTeamData(team),
	  deriveAuthFromEmail(user?.email || '')
	]);

	if (!teamData) {
	  throw new Error('Team not found');
	}

	const payload = {
	  teamData,
	  auth: authRes || {
	    email: '',
	    isAdmin: false,
	    isTeamLead: false,
	    isTeamPageEditor: false
	  }
	};

	cacheData(team, teamData, payload.auth);
	renderTeamPage(payload, user);

  } catch (err) {
    console.error('Error fetching team page:', err);
  } finally {
    setLoading(false);
    attachRefreshListener();
  }
}

// --- Helper: attach refresh listener once ---
function attachRefreshListener() {
  const refreshBtn = document.getElementById('refreshBtn');
  if (!refreshBtn) return;

  // just attach listener if not attached
  if (!refreshBtn.dataset.listenerAttached) {
    refreshBtn.addEventListener('click', refreshData);
    refreshBtn.dataset.listenerAttached = 'true';
    console.log('Refresh button listener attached.');
  }
}

export function renderAnnouncements({
  announcements,
  container,
  isEditor,
  teamShortName,
  teamData
}) {
  container.innerHTML = '';

  if (!Array.isArray(announcements) || !announcements.length) {
    container.innerHTML = `<p>No announcements found for ${teamShortName}.</p>`;
    return;
  }

  announcements.forEach(raw => {
    const a = normalizeAnnouncement(raw);
    if (!a) return;

    const div = document.createElement('div');
    div.className = 'announcement-item';
    div.dataset.id = a.id;

    div.innerHTML = `
      <h4>${a.title}</h4>
      <div class="date">${new Date(a.timestamp).toLocaleString()}</div>
      <div class="body">${a.body}</div>
    `;

    if (isEditor) {
		  const adminDiv = document.createElement('div');
		  adminDiv.className = 'announcement-admin links';

		  // --- Edit Icon ---
		  const editLink = document.createElement('a');
		  editLink.href = '#';
		  editLink.className = 'edit-link';
		  editLink.innerHTML = '<i class="fa fa-edit" style="color: #df683a;" aria-hidden="true"></i>';
		  editLink.addEventListener('click', async (evt) => {
		    evt.preventDefault();
		    console.log('editLink click');
		    await showUpdateForm(teamData, {
		      id: a.id,
		      updateType: 'announcement',
		      title: a.title,
		      body: a.body
		    });
		  });

		  adminDiv.appendChild(editLink);

		  // --- Delete Icon ---
		  const deleteLink = document.createElement('a');
		  deleteLink.href = '#';
		  deleteLink.className = 'delete-link';
		  deleteLink.innerHTML = '<i class="fa fa-trash" style="color: #df683a;" aria-hidden="true"></i>';
		  deleteLink.addEventListener('click', (evt) => {
		    evt.preventDefault();
		    console.log('deleteLink click');
		    handleDeleteAnnouncement(a, teamShortName);
		  });

		  adminDiv.appendChild(deleteLink);
		  div.appendChild(adminDiv);
		}


    container.appendChild(div);
  });
}

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Caches team data along with optional auth info.
 * @param {string} team - team key
 * @param {object} data - backend response for the team
 * @param {object} [auth] - optional auth info { email, isAdmin, isTeamLead, isTeamPageEditor }
 */
export function cacheData(team, data, auth) {
  if (!isLocalStorageAvailable()) return; // skip caching if localStorage not available
  if (team.startsWith('teamdata_')) {
    console.error('cacheData called with cache key instead of team:', team);
    return;
  }
  const key = cacheKeyFor(team);

  // Wrap the data along with auth info (if provided)
  const payload = {
    timestamp: Date.now(),
    data: {
      teamData: data,
      auth: auth || null, // store auth block if passed
    }
  };

  console.log(`cacheData(): writing to ${key} —`, payload);

  try {
    localStorage.setItem(key, JSON.stringify(payload));
    console.log(`Cached data for team "${team}" at ${new Date(payload.timestamp).toLocaleTimeString()}`);
  } catch (err) {
    console.error('cacheData() failed:', err);
  }
}

export function getCachedData(team) {
  if (!isLocalStorageAvailable()) return null; // skip if localStorage not available

  if (team.startsWith('teamData_')) {
    console.warn('getCachedData(): received cacheKey instead of team:', team);
    team = team.replace(/^teamData_/, '');
  }

  const key = cacheKeyFor(team);
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
      localStorage.removeItem(key);
      return null;
    }

    console.log(`getCachedData(): cache hit for "${key}" (${Math.round(age / 1000)}s old)`);
    return parsed;

  } catch (e) {
    console.error(`getCachedData(): failed to parse cached data for "${key}"`, e);
    return null;
  }
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
 * Manually refresh data from backend.
 */
async function refreshData() {
  // console.log('refreshData START ******************************');
  const refreshBtn = document.getElementById('refreshBtn');
  const team = getNormalizedTeamParam();
  if (!team) return;

  // Prevent double refresh
  if (refreshBtn.dataset.refreshing === 'true') {
    console.log('Refresh already in progress, skipping...');
    return;
  }
  refreshBtn.dataset.refreshing = 'true';
  refreshBtn.disabled = true;

  // Save original text
  const originalText = refreshBtn.textContent;

  console.log('showing refresh text and spinner');
  // Show loading text + spinner
  refreshBtn.innerHTML = `Refreshing... `;

  // Clear cached team data
  localStorage.removeItem(cacheKeyFor(team));
  console.log(`Cache cleared for team "${team}"`);

  try {
    // console.log('calling loadBackend ******************************');
    await loadBackend(team, getCurrentUser());
  } catch (err) {
    console.error('Error refreshing data:', err);
    alert('Error refreshing data: ' + err.message);
  } finally {
    // console.log('refreshData FINALLY ******************************');
    refreshBtn.disabled = false;
    refreshBtn.dataset.refreshing = 'false';
    // Restore original text after DOM updates by init()
    setTimeout(() => {
      refreshBtn.textContent = originalText;
      console.log(`refreshBtn.dataset.refreshing: ${refreshBtn.dataset.refreshing}`);
    }, 0);
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
