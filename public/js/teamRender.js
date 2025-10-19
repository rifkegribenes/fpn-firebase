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

// --- Load and render team page ---
async function init() {
  // parse URL params
  const urlParams = new URLSearchParams(window.location.search);
  const page = urlParams.get('page') || 'team';
  const team = urlParams.get('team') || '';

  try {
    const data = await callBackend({
      page,
      team,
      email: currentUser ? currentUser.email : ''
    });
    renderTeamPage(data);
  } catch (err) {
    console.error('Error loading team page data:', err);
    document.getElementById('teamInfo').innerText = 'Error loading data.';
  }
}

// --- Render function ---
export function renderTeamPage(data) {
  const title = document.getElementById('pageTitle');
  title.innerText = data.page === 'teamLinks'
    ? 'Team Links'
    : `${data.teamObj?.teamName || 'Unknown'} Team`;

  
  const adminDiv = document.getElementById('adminSection');
  const contentDiv = document.getElementById('content');
  const announcementsDiv = document.getElementById('announcements');
  const eventsDiv = document.getElementById('events');
  const minutesDiv = document.getElementById('minutes');
  const opsDiv = document.getElementById('ops');
  const groupDiv = document.getElementById('group');
  const driveDiv = document.getElementById('drive');
  const imageDiv = document.getElementById('image');



  contentDiv.innerHMTL = renderContent(data);


  // const linksDiv = document.getElementById('linksSection');
  // if (data.page === 'teamLinks') {
  //   linksDiv.innerHTML = `<p>Links for team ${data.team}</p>`;
  //   if (data.teamObj?.links) {
  //     const ul = document.createElement('ul');
  //     data.teamObj.links.forEach(link => {
  //       const li = document.createElement('li');
  //       li.innerHTML = `<a href="${link.url}" target="_blank">${link.name}</a>`;
  //       ul.appendChild(li);
  //     });
  //     linksDiv.appendChild(ul);
  //   }
  // }

  // --- If user is admin, show admin tools ---
  if (data.isAdmin && adminDiv) {
    adminDiv.innerHTML = `
      <button id="updateBtn">Update Team Info</button>
      <p>You have admin access.</p>
    `;
    document.getElementById('updateBtn').addEventListener('click', doAdminUpdate);
  } else if (adminDiv) {
    adminDiv.innerHTML = '';
  }
}

// --- Admin-only action ---
async function doAdminUpdate() {
  if (!currentUser) return alert('Please sign in to update.');

  try {
    const data = await callBackend({
      action: 'update',
      team: 'woodstock',
      email: currentUser.email
    });
    alert(data.message);
  } catch (err) {
    console.error('Admin update failed:', err);
    alert('Update failed.');
  }
}

// --- Run on load ---
document.addEventListener('DOMContentLoaded', setupAuthUI);

function renderContent(data) { 
  let isAdmin = false;
  let isTeamLead = false;
  let isTeamPageEditor = false;
  console.log('renderContent');
  console.log(data);
  const userEmail = data.email;
  const userTeam = data.team;
  console.log(`userTeam: ${data.team}, userEmail: ${data.email}`);
  if (userEmail) {
    isAdmin = checkGroupMembership(ADMIN_GROUP_EMAIL, userEmail);
    isTeamLead = checkGroupMembership(TEAM_LEADS_GROUP_EMAIL, userEmail);
    isTeamPageEditor = (isTeamLead && userEmail.includes(userTeam)) || isAdmin;
    console.log(`isAdmin: ${isAdmin}, isTeamLead: ${isTeamLead}, isTeamPageEditor: ${isTeamPageEditor}`);
  }
  

  let content = `
    <div style="padding: 20px; font-family: Lato, sans-serif;">
      ${isTeamPageEditor ? showTeamPageEditorContent(userTeam) : ''}
      ${showPublicContent(isTeamPageEditor)}
    </div>
  `;

  // console.log('content');
  // console.log(content);

  return content;
}

function showPublicContent(isTeamPageEditor, data) {
  console.log('showPublicContent');
  return `
    <div class="publicContent">
      <h2 style="font-size: 2rem; margin-bottom: 16px;">${data.teamObj.teamName}</h2>
      <div class="quickLinks" id="quickLinks>
        <p class="qlHed">Quick Links</p>
        <p class="qlP"><a href="https://volunteerpdx.net" target="_blank">Portland NET Wiki</a>
        <p class="qlP"><a href="https://app.betterimpact.com/" target="_blank">Log hours on MIP</a>
      </div>

      <div class="pcContainer container" style="
        display: flex !important;
        flex-direction: column !important;  /* force single column */
        flex-wrap: nowrap !important;
        width: 100%;
      ">
        <div class="announcements block" style="
          max-width: 100% !important;
          margin-bottom: 24px;
        ">
          <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Announcements</h3>
          <div class="announcements cont" style="
            padding-right: 0 !important;
            margin-right: 0 !important;
            border-right: none !important;
          ">
            ${announcementsBlock(isTeamPageEditor)}
          </div>
        </div>

        <div class="calendar block" style="
          max-width: 100% !important;
          margin-bottom: 24px;
        ">
          <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Upcoming Events</h3>
          <div class="calendar cont" style="
            max-width: 100% !important;
            padding-right: 0 !important;
            margin-right: 0 !important;
            border-right: none !important;
          ">
            ${renderCalendar(data)}
          </div>
        </div>

        <div class="pcColumnContainer container" style="
          display: flex !important;
          flex-direction: column !important;
          flex-wrap: nowrap !important;
          max-width: 100% !important;
        ">
          <div class="minutes block" style="
            padding-bottom: 20px;
            margin-bottom: 20px;
            border-bottom: 1px dotted #ccc;
          ">
            <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Meeting Minutes</h3>
            <div class="minutes cont">
              ${renderMinutesBlock(data)}
            </div>
          </div>

          <div class="ops block" style="
            padding-bottom: 20px;
            margin-bottom: 20px;
            border-bottom: 1px dotted #ccc;
          ">
            <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Operations Plan</h3>
            <div class="ops cont">
              ${renderOpsPlanBlock(data)}
            </div>
          </div>

          <div class="grouplink block" style="
            padding-bottom: 20px;
            margin-bottom: 20px;
            border-bottom: 1px dotted #ccc;
          ">
            <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Google Group</h3>
            <div class="gGroup cont">
              ${renderGoogleGroup(data)}
            </div>
          </div>

          <div class="drivelink block">
            <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Team Drive</h3>
            <div class="gDrive cont">
              ${renderGoogleDrive(data)}
            </div>
          </div>
        </div>
      </div>
    </div>`

}

function showTeamPageEditorContent(data) {
  return `
    <div class="tlContainer container">
      <h3>
        <a 
          id="teamUpdateLink"
          href="https://docs.google.com/forms/d/e/1FAIpQLSe9TU8URPswEVELyy9jOImY2_2vJ9OOE7O8L5JlNUuiJzPQYQ/viewform?usp=pp_url&entry.1458714000=${encodeURIComponent(data.teamObj.teamName)}"
          class="responsiveLink"
          style="
            display: block;
            padding: 10px;
            background-color: #f1f1f1;
            text-decoration: none;
            border-radius: 5px;
            color: #333;
            transition: background-color 0.2s ease;
            width: 100%;
            max-width: 200px;
          "
          onmouseover="this.style.backgroundColor='#e0e0e0';"
          onmouseout="this.style.backgroundColor='#f1f1f1';"
          target="_blank">
            Update team page
        </a>
      </h3>
    </div>`;
}


function announcementsBlock(isTeamPageEditor, data) {
  if (getRecentAnnouncements() && getRecentAnnouncements().length) {
    return getRecentAnnouncements().map(item => renderAnnouncement(item, isTeamPageEditor)).join('');
  } else {
    return `<p>No announcements for ${data.teamObj.teamName}</p>`
  }
  
}

function renderAnnouncement(obj, isTeamPageEditor, data) {
  const deleteURLWithParams = `${obj.deleteURL}&page=team&team=${data.teamObj.shortName}`
  const adminBlock = isTeamPageEditor ? `<a href="${obj.editURL}">Edit</a> | <a href="${deleteURLWithParams}">Delete</a>` : '';
  return `<div class="announcement">
    <h4 class="aTitle" style="margin-bottom: 10px;">${obj.title}&#160;&#160;&#x7C;&#160;&#160;<span class="aDate" style="color:#333;font-weight:400;">${formatDate(obj.timestamp)}</span></h4>
    <p class="aBody">${obj.body}</p>
    ${adminBlock}
  </div>`
}

function renderCalendar(data) {
  console.log(`data.teamObj.teamCal (242): ${data.teamObj.shortName}`);
  console.log(data.teamObj.teamCal);
  
  if (!!data.teamObj.teamCal) {
    return `<iframe 
              style="width: 100%; min-height: 400px; border: none;" 
              src="${data.teamObj.teamCal}"
              loading="lazy"
              allowfullscreen
            ></iframe>`;
  } else {
    return `<p>No calendar available for ${data.teamObj.teamName}</p>`;
  }
}


function renderMinutesBlock(data) {
  console.log('renderMinutesBlock');
  try {
    const folderId = MINUTES_FOLDER_ID; 
    const files = getLatestMinutesFiles(folderId, 10);

    console.log('files: (minutes, 393)');
    console.log(files);

    if (!!files && files.length) {
      let html = `<div class="minutes-block" style="font-family: Lato, sans-serif; font-size: 14px;">`;

      files.forEach(file => {

        const createdDateStr = file.createdTime || null;
        let formattedDate = 'Unknown date';
        let mtgDateParsed;

        if (file.getDescription()) {
          mtgDateParsed = file.getDescription().split(",")[1] || null;
        }
        if (mtgDateParsed) {
          formattedDate = formatDate(new Date(mtgDateParsed));
        } else if (createdDateStr) {
          const createdDate = new Date(createdDateStr);
          formattedDate = Utilities.formatDate(createdDate, Session.getScriptTimeZone(), "MMM d, yyyy");
        }

        const linkText = `${data.teamObj.teamName} minutes ${formattedDate}`;
        const url = `https://drive.google.com/file/d/${file.id}/view`;

        html += `<p style="margin-bottom: 15px;">
          <a href="${url}" target="_blank">${linkText}</a>
        </p>`;
      });

      html += `</ul></div>`;
      return html;
    } else {
      return `<p>No meeting minutes available for ${data.teamObj.teamName}</p>`;
    }
  } catch (e) {
    return `<p>Error: ${e.message}</p><p>No meeting minutes available for ${data.teamObj.teamName}</p>`;
  }
}

function renderOpsPlanBlock(data) {
  try {
    const folderId = OPS_FOLDER_ID; 
    const file = getLatestOpsFile(folderId); 
    console.log('renderOpsPlan');
    console.log(file);
    if (!!file) {
      console.log('310');
      let html = `<div style="font-family: Lato, sans-serif; font-size: 14px;">`;
      const createdDateStr = file.createdTime || null;
      let formattedDate = 'Unknown date';
      if (createdDateStr) {
        const createdDate = new Date(createdDateStr);
        formattedDate = Utilities.formatDate(createdDate, Session.getScriptTimeZone(), "MMM d, yyyy");
      }
      const linkText = `${data.teamObj.teamName} Operations Plan`;
      const url = `https://drive.google.com/file/d/${file.id}/view`;
      html += `<p style="margin-bottom: 10px;"><a href="${url}" target="_blank">${linkText}</a> (${formattedDate})</p></div>`;
      return html;
    } else {
      return `<p>No operations plan available for ${data.teamObj.teamName}</p>`;
    }
  } catch (e) {
    return `<p>Error: ${e.message}</p><p>No operations plan available for ${data.teamObj.teamName}</p>`;
  }
}

function renderGoogleGroup(data) {
  const groupAddress = `https://groups.google.com/a/friendsofportlandnet.org/g/${data.teamObj.shortName}`;
  return `<p><a href=${groupAddress}>${data.teamObj.teamName} Google Group</a></p>`
}

function renderGoogleDrive(data) {
  console.log('renderGoogleDrive()');
  const driveURL = data.teamObj.teamDrive;
  if (driveURL) {
    return `<p><a href=${driveURL}>${data.teamObj.teamName} shared Drive</a> (access other team documents here)</p>`
  } else {
    return `<p>Shared drive for ${data.teamObj.teamName} has not been set up yet.`
  }
  
}
