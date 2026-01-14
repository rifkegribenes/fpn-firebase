import { setupAuthUI, getCurrentUser, setCurrentUser } from './auth.js';
import {
  fetchTeamLinks,
  fetchTeamData,
  deriveAuthFromEmail
} from './fetch.js';
import { config } from './config.js';
import { showUpdateForm, handleDeleteAnnouncement } from './submit.js';
import { getNormalizedTeamParam, 
	setLoading, 
	waitForElement,
	normalizeAnnouncement,
	formatDate,
	getCalendarEditUrl } from './helpers.js';
import { getAuth, onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const WORKER_URL = 'https://sheet-proxy.rifkegribenes.workers.dev';

console.log('currentUser:', getCurrentUser());

/**
 * Render the team page after data is ready.
 */
export async function renderTeamPage(data, user) {
  console.log('renderTeamPage() data:', data);
  if (!data.teamData.success) {
    console.log('failed to load team data');
    return;
  }
  const updateContainer = document.getElementById('teamUpdateContainer');
  if (!updateContainer) console.warn('#teamUpdateContainer not found');

  const auth = data.auth;
  const teamObj = data?.teamData?.teamObj;

  const pageTeamSlug =
    teamObj?.shortName ||
    getNormalizedTeamParam();

  const normalizeSlug = s => (s || '').trim().toLowerCase();

  console.log('EDITOR CHECK', {
    email: auth?.email,
    isAdmin: auth?.isAdmin,
    isTeamLead: auth?.isTeamLead,
    teamLeadSlug: auth?.teamLeadSlug,
    pageTeamSlug,
    normalizedMatch:
      normalizeSlug(auth?.teamLeadSlug) === normalizeSlug(pageTeamSlug)
  });

  const isTeamPageEditor =
    auth?.isAdmin ||
    (
      auth?.isTeamLead &&
      normalizeSlug(auth?.teamLeadSlug) === normalizeSlug(pageTeamSlug)
    );

  const refreshBtn = await waitForElement('#refreshBtn');

  if (refreshBtn) {
    if (isTeamPageEditor) {
      refreshBtn.style.display = 'inline-block';
      attachRefreshListener();
    } else {
      refreshBtn.style.display = 'none';
    }
  }

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

  const team = data?.teamData?.teamObj || {};
  const teamName = data?.teamData?.teamObj?.teamName || getNormalizedTeamParam();

  title.innerText = team.teamName
  ? `${team.teamName} NET`
  : 'Team Links'; 

  // --- Banner ---
  bannerDiv.innerHTML = '';
  const bannerData = data?.teamData?.banner[0];

  if (bannerData && bannerData.publicUrl) {
    bannerSection.style.display = 'block';
    bannerDiv.innerHTML = `
      <div class="bannerImgCont">
        <img class="bannerImg"
           src="${bannerData.publicUrl}${bannerData.publicUrl.includes('?') ? '&' : '?'}v=${bannerData.rowId || Date.now()}"
           alt="${bannerData.alt}">
      </div>
    `;

    // Add admin links after the image
    if (isTeamPageEditor) {

	    const adminDiv = document.createElement('div');
	    adminDiv.className = 'announcement-admin links';
	    adminDiv.style.marginTop = '8px';
	    adminDiv.style.fontSize = '0.9em';

	    // --- Edit / New Image ---
	    const editLink = document.createElement('a');
	    editLink.href = "#";
	    editLink.className = 'edit-link';
	    editLink.innerHTML = '<i class="fa fa-edit" style="color: #df683a;" aria-hidden="true"></i>';
	    editLink.addEventListener('click', async (evt) => {
		    evt.preventDefault();
		    console.log('editLink click');
		    await showUpdateForm(data?.teamData, {
		      updateType: 'banner'
		    });
		  });
	    adminDiv.appendChild(editLink);

	    // --- Delete / Trash ---
	    const trash = document.createElement('span');
	    trash.className = 'delete-link';
	    trash.style.cursor = 'pointer';
	    trash.innerHTML = '<i class="fa fa-trash" style="color: #df683a;" aria-hidden="true"></i>';

	    // Click handler to delete banner row from back end
	    trash.addEventListener('click', async () => {
	      if (!confirm(`Delete banner for "${teamName}"?`)) return;

	      const teamParam = getNormalizedTeamParam();
	      try {
          const res = await fetch(
            `${WORKER_URL}?sheet=TeamPageUpdateForm&Id=${encodeURIComponent(bannerData.rowId)}`,
            { method: 'DELETE' }
          );
	        const dataRes = await res.json();

	        if (res.ok) {
            alert('Banner deleted.');
            location.reload();
          } else {
            console.error('Failed to delete banner:', dataRes);
            alert('Failed to delete banner. See console for details.');
          }

	      } catch (err) {
	        console.error('Error deleting banner:', err);
	        alert('Error deleting banner: ' + err.message);
	      }
	    });

	    adminDiv.appendChild(trash);
	    bannerDiv.appendChild(adminDiv);

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
    // console.log(`no team lead assigned for ${data?.teamData?.teamObj?.teamName}`);
  }

  // --- Announcements ---
  announcementsDiv.innerHTML = '';
  if (data?.teamData?.announcements?.length || data?.announcements?.length) {
    renderAnnouncements({
      announcements: data.teamData.announcements,
      container: announcementsDiv,
      isEditor: isTeamPageEditor,
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
    data?.teamData?.minutes.sort((a, b) => {
      const aDate = new Date(a.meetingDate || a.timestamp || 0);
      const bDate = new Date(b.meetingDate || b.timestamp || 0);
      return bDate - aDate; // newest first
    })
    .forEach(file => {
      const li = document.createElement('li');
      li.classList.add('icon-pdf')
      const createdDateStr = file.createdTime || null;
      let formattedDate = 'Unknown date';

      if (file.meetingDate) {
        formattedDate = formatDate(file.meetingDate);
      }
      
      // const linkText = `${file.fileName}`;
      const linkText = `${team.teamName} minutes ${formattedDate}`;
      const url = `https://drive.google.com/file/d/${file.id}/view`;
      
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.textContent = linkText;
      li.appendChild(link);  

      // Trash icon for team page editors ---
      if (isTeamPageEditor) {
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
            // DELETE row from back end
            const res = await fetch(
              `${WORKER_URL}?sheet=TeamPageUpdateForm&Id=${encodeURIComponent(file.rowId)}`,
              { method: 'DELETE' }
            );

            const dataRes = await res.json();

            if (res.ok) {
              alert('Minutes deleted.');
              location.reload();
            } else {
              console.error('Failed to delete minutes row:', dataRes);
              alert('Failed to delete minutes. See console for details.');
            }

          } catch (err) {
            console.error('Error deleting minutes row:', err);
            alert('Error deleting minutes: ' + err.message);
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

    // --- Admin edit icon ---
	  if (isTeamPageEditor) {
	    const editUrl = getCalendarEditUrl(baseUrl);

	    if (editUrl) {
	      const adminDiv = document.createElement('div');
	      adminDiv.className = 'announcement-admin links';
	      adminDiv.style.marginTop = '8px';
	      adminDiv.style.fontSize = '0.9em';

	      const adminNote = document.createElement('span');
	      adminNote.className = 'adminNote';
	      adminNote.innerText = `Opens calendar in a new tab. You must be logged in as ${data.auth.email} to edit. Once calendar opens, switch users by clicking avatar at top right.`

	      const editIcon = document.createElement('a');
	      editIcon.href = editUrl;
	      editIcon.target = '_blank';
	      editIcon.rel = 'noopener noreferrer';
	      editIcon.innerHTML =
	        '<i class="fa fa-edit" style="color: #df683a;" aria-hidden="true"></i>';

	      adminDiv.appendChild(adminNote);  
	      adminDiv.appendChild(editIcon);
	      eventsDiv.appendChild(adminDiv);
	    }
	  }
  } else {
    eventsDiv.innerHTML = `<p>No calendar found for ${data.teamData?.teamObj?.teamName}.</p>`;
  }



  // --- Operations Plan ---
	opsDiv.innerHTML = '';
  const file = data?.teamData?.opsPlanFile?.[0];

  if (file?.id && file?.rowId) {
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
	  if (isTeamPageEditor) {
	    const trash = document.createElement('span');
	    trash.className = 'trash-icon';
	    trash.style.cursor = 'pointer';
	    trash.style.marginLeft = '8px';
	    trash.innerHTML = '<i class="fa fa-trash" style="color: #df683a;" aria-hidden="true"></i>';

	    trash.addEventListener('click', async () => {
        if (!file.rowId) {
          alert('This file no longer exists.');
          li.remove();
          return;
        }
	      if (!confirm(`Delete "${linkText}" from the team data?`)) return;

	      const teamParam = getNormalizedTeamParam();
	      try {
	        // DELETE row from back end
	        const res = await fetch(
              `${WORKER_URL}?sheet=TeamPageUpdateForm&Id=${encodeURIComponent(file.rowId)}`,
              { method: 'DELETE' }
            );
	        const dataRes = await res.json();

	        if (res.ok) {
            alert('Operations plan deleted.');
            location.reload();
          } else {
            console.error('Failed to delete operations plan row:', dataRes);
            alert('Failed to delete operations plan. See console for details.');
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

  if (isTeamPageEditor && data?.teamData?.teamObj?.teamName) {
    updateContainer.style.display = '';
    const updateBtn = document.createElement('button');
    updateBtn.id = 'teamUpdateBtn';
    updateBtn.type = 'button';
    updateBtn.className = 'responsiveLink';
    updateBtn.textContent = 'Update page';
    updateContainer.appendChild(updateBtn);

    updateBtn.addEventListener('click', async () => {
      await showUpdateForm(data.teamData); 
    });


  }

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
    if (teamUpdateContainer) teamUpdateContainer.style.display = '';
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

  }
}

// --- Global Firebase Auth Listener ---
const auth = window.firebaseAuth;
let prevUser = null; // track previous state

onAuthStateChanged(auth, async (user) => {
  setCurrentUser(user);
  updateAuthUI(user);

  const team = getNormalizedTeamParam();
  await loadBackend(team, user);
});



export async function loadBackend(team, user = null) {
  setLoading(true);

  try {
    const authRes = deriveAuthFromEmail(user?.email || '');

    // Team links page
    if (!team) {
      const teamLinks = await fetchTeamLinks();
      renderTeamLinks(teamLinks);
      return;
    }

    // Team page
    const teamData = await fetchTeamData(team);

    if (!teamData?.success) {
      throw new Error('Team not found');
    }

    renderTeamPage(
      {
        teamData,
        auth: authRes
      },
      user
    );

  } catch (err) {
    console.error('loadBackend failed:', err);
  } finally {
    setLoading(false);
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
    // console.log('Refresh button listener attached.');
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

  // Deduplicate announcements by id (last write wins)
  if (Array.isArray(announcements)) {
    const map = new Map();
    announcements.forEach(item => {
      const a = normalizeAnnouncement(item);
      if (a?.id) map.set(a.id, a);
    });
    announcements = Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
  }

  if (!Array.isArray(announcements) || !announcements.length) {
    container.innerHTML = `<p>No announcements found for ${teamShortName}.</p>`;
    return;
  }

  announcements.forEach(a => {
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
    a.className = link.active ? 'teamLinkBtn teamLinkActive' : 'teamLinkBtn';
    container.appendChild(a);
  });
}


function refreshData() {
  location.reload();
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
