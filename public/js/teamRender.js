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

// Request full Google Drive access
provider.addScope('https://www.googleapis.com/auth/drive');


function getNormalizedTeamParam() {
  const urlParams = new URLSearchParams(window.location.search);
  // default fallback empty string if no team specified
  return (urlParams.get('team') || '').toLowerCase();
}

function cacheKeyFor(team) {
  console.log('cacheKeyFor called with:', team);
  return `teamData_${team.toLowerCase()}`;
}

function normalizeAnnouncement(row) {
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


function renderAnnouncements({
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

      // --- Edit ---
      const editLink = document.createElement('a');
      editLink.href = '#';
      editLink.textContent = 'Edit';
      editLink.className = 'edit-link';

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
      adminDiv.appendChild(document.createTextNode(' | '));

      // --- Delete ---
      const deleteLink = document.createElement('a');
      deleteLink.href = '#';
      deleteLink.textContent = 'Delete';
      deleteLink.className = 'delete-link';

      deleteLink.addEventListener('click', (evt) => {
        console.log('deleteLink click');
        evt.preventDefault();
        handleDeleteAnnouncement(a, teamShortName);
      });

      adminDiv.appendChild(deleteLink);
      div.appendChild(adminDiv);
    }

    container.appendChild(div);
  });
}


function renderUpdateFormHTML() {
  return `
  <div class="form-wrapper">
<form id="updateFormForm">
  <section id="section_header">
    <h3>Update team page</h3>
  <!-- Your Team -->
  <input type="hidden" name="entry.538407109" id="entry.538407109">


  <!-- Email -->
  <input type="hidden" name="entry.123456789" id="entry.123456789">

  <!-- What do you want to update? -->
  <div id="update_question">
    <p>What do you want to update? <span aria-label="Required">*</span></p>
    <div class="radio-group" role="radiogroup" aria-required="true">
      <label>
        <input type="radio" name="entry.1192593661" value="Post announcement"> Post announcement (or edit existing announcement)
      </label>
      <label>
        <input type="radio" name="entry.1192593661" value="Upload meeting minutes"> Upload meeting minutes
      </label>
      <label>
        <input type="radio" name="entry.1192593661" value="Upload operations plan"> Upload operations plan
      </label>
      <label>
        <input type="radio" name="entry.1192593661" value="Add or replace banner image"> Add or replace a banner image
      </label>
    </div>
  </div>

  <!-- Sections -->
  <section id="section_post_announcement">
    <h3>Post announcement</h3>
    <p class="formSmall">Edit an existing announcement by clicking the 'Edit' link directly below the announcement on the team page. This link will only be visible if you're logged in as a page editor.</p>
    <div>
      <label for="entry_announcement_title">Announcement Title</label>
      <input type="text" id="entry_announcement_title" name="entry.1513742467" required>
    </div>
    <div>
      <label for="entry_announcement_body">Announcement Body</label>
      <textarea id="entry_announcement_body" name="entry.1206794665" required></textarea>
    </div>
  </section>

  <section id="section_meeting_minutes">
    <h3>Upload meeting minutes</h3>
    <p class="formSmall">Please upload all files in PDF or docx format, or you can browse to an existing Google doc in your drive.</p>
    <div>
      <label for="entry_meeting_date">Date of meeting</label>
      <input type="date" id="entry_meeting_date" name="entry.358896631" required max="2075-01-01">
    </div>
    <div>
      <label for="entry_meeting_upload">Upload your meeting minutes here (.pdf, .docx or URL to Google Document)</label>
      <input type="file" id="entry_meeting_upload" name="entry.1637818725" accept=".pdf,.docx" required>
      <small>Upload 1 supported file: PDF or document. Max 10 MB.</small>
    </div>
  </section>

  <section id="section_operations_plan">
    <h3>Upload operations plan</h3>
    <p class="formSmall">Please upload all files in PDF or doc format.</p>
    <div>
      <label for="entry_operations_plan">Upload your team's operations plan here (.pdf, .docx or URL to Google Document)</label>
      <input type="file" id="entry_operations_plan" name="entry.1704615082" accept=".pdf,.docx" required>
      <small>Upload 1 supported file: PDF or document. Max 10 MB.</small>
    </div>
  </section>

  <section id="section_banner">
    <h3>Add or replace banner image</h3>
    <p class="formSmall">
      Images must be landscape format (wider than it is tall) and at least 850 pixels wide. 
      Ideal crop is 850 x 300px.<br>
      Images that are larger than this will be cropped to 850x300px. New uploads will replace existing banner image.
    </p>
    <div>
      <label for="entry_banner_upload">Upload banner photo here</label>
      <input type="file" id="entry_banner_upload" name="entry.1687052692" accept="image/*" required>
      <small>Upload 1 supported file: image. Max 10 MB.</small>
    </div>
    <div>
      <label for="entry_banner_alt">Image alt text (brief image description for screen readers)</label>
      <input type="text" id="entry_banner_alt" name="entry.1330141932" required>
    </div>
  </section>

  <div>
    <button type="submit" id="form_submit">Submit</button>
  </div>

</form>
</div>`
}

async function uploadFileToDrive(file, folderId) {
  if (!file) return null;

  const accessToken = gapi.auth.getToken().access_token; // assuming gapi is initialized and user logged in
  const metadata = {
    name: file.name,
    parents: [folderId]
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", file);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + accessToken
    },
    body: form
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'File upload failed');
  return data.webViewLink; // this is the URL to store in your sheet
}


async function handleDeleteAnnouncement(announcement, team) {
  if (!confirm('Are you sure you want to delete this announcement?')) return;

  const rowId = announcement?.id || announcement?.Id;

  if (!rowId) {
    console.error('Delete called with invalid announcement:', announcement);
    alert('Delete failed: announcement ID missing');
    return;
  }

  const url =
    `https://sheetdb.io/api/v1/ne0v0i21llmeh/Id/${encodeURIComponent(rowId)}` +
    `?sheet=TeamPageUpdateForm`;

  try {
    const res = await fetch(url, { method: 'DELETE' });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    /* -----------------------------
       Remove from cache
    ----------------------------- */
    const key = cacheKeyFor(team);
    const raw = localStorage.getItem(key);
    if (raw) {
      const cached = JSON.parse(raw);
      const list = cached?.data?.teamData?.announcements;
      if (Array.isArray(list)) {
        cached.data.teamData.announcements = list.filter(
          a => a.id !== rowId
        );
        localStorage.setItem(key, JSON.stringify(cached));
      }
    }

    /* -----------------------------
       Remove from UI immediately
    ----------------------------- */
    const elem = document.querySelector(
      `.announcement-item[data-id="${rowId}"]`
    );
    if (elem) elem.remove();

    alert('Announcement deleted');

  } catch (err) {
    console.error('Delete failed:', err);
    alert('Failed to delete announcement: ' + err.message);
  }
}


function initUpdateForm(onComplete, teamObj, userEmail) {
  const radios = document.querySelectorAll('input[name="entry.1192593661"]');
  const submitBtn = document.getElementById('form_submit');
  const updateDiv = document.getElementById('update_question');
  const teamSelect = document.getElementById('entry.538407109');
  const emailInput = document.getElementById('entry.123456789');

  const sections = {
    "Post announcement": document.getElementById("section_post_announcement"),
    "Upload meeting minutes": document.getElementById("section_meeting_minutes"),
    "Upload operations plan": document.getElementById("section_operations_plan"),
    "Add or replace banner image": document.getElementById("section_banner")
  };

  // Hide all sections initially
  Object.values(sections).forEach(section => {
    section.style.display = 'none';
    // Remove required from all inputs initially
    section.querySelectorAll('input, textarea, select').forEach(input => input.required = false);
  });
  submitBtn.style.display = 'none';

  // Prepopulate hidden team field
  if (teamObj?.teamName && teamSelect) {
    teamSelect.value = teamObj.teamName;
  }

  // Prepopulate email input
  if (userEmail && emailInput) {
    emailInput.value = userEmail;
  }

  // Radio buttons logic
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      Object.entries(sections).forEach(([key, section]) => {
        const inputs = section.querySelectorAll('input, textarea, select');
        if (radio.value === key) {
          section.style.display = 'block';
          submitBtn.style.display = 'block';
          // updateDiv.style.display = 'none'; <== this hides radio question
          // Make visible section inputs required
          inputs.forEach(input => input.required = true);
        } else {
          section.style.display = 'none';
          // Remove required from hidden sections
          inputs.forEach(input => input.required = false);
        }
      });
    });
  });


  function generateRowId() {
    return 'row_' + ([1e7]+-1e3+-4e3+-8e3+-1e11)
      .replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
  }

  function formatDateFileName(dateInput) {
    if (!dateInput) return null;

    // Accepts Date or YYYY-MM-DD string
    const date = typeof dateInput === 'string'
      ? new Date(dateInput + 'T00:00:00')
      : new Date(dateInput);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function buildDriveFileName({
    file,
    team,
    fileType,   // 'minutes' | 'ops' | 'banner'
    meetingDate // string from input[type="date"] or null
  }) {
    const mtgDate = meetingDate
      ? formatDateFileName(meetingDate)
      : null;

    const originalName = file.name;

    if (mtgDate) {
      return `${team}_${fileType}_${mtgDate}_${originalName}`;
    }

    return `${team}_${fileType}_${originalName}`;
  }



  // Form submit
  document.getElementById('updateFormForm').addEventListener('submit', async (evt) => {
    evt.preventDefault();

    const query = getQueryParams();
    const rowId = query.id || generateRowId(); 
    const isUpdate = !!query.id; 

    const selectedRadio = document.querySelector(
      'input[name="entry.1192593661"]:checked'
    );
    if (!selectedRadio) {
      alert('Please select what to update');
      return;
    }

    let minutesURL = '';
    let opsURL = '';

    if (selectedRadio.value === 'Upload meeting minutes') {
      const meetingDate =
        document.getElementById('entry_meeting_date')?.value;

      const file =
        document.getElementById('entry_meeting_upload')?.files[0];

      const filename = buildDriveFileName({
        file,
        team: teamObj.shortName,
        fileType: 'minutes',
        meetingDate
      });

      const minutesFileId = await uploadFileToDrive(
        file,
        config.MINUTES_FOLDER_ID,
        filename
      );

    if (selectedRadio.value === 'Upload operations plan') {
      const file =
        document.getElementById('entry_operations_plan')?.files[0];

      const filename = buildDriveFileName({
        file,
        team: teamObj.shortName,
        fileType: 'ops',
        meetingDate: null
      });

      const opsFileId = await uploadFileToDrive(
        file,
        config.OPS_FOLDER_ID,
        filename
      );

    }

    if (selectedRadio.value === 'Upload banner photo here') {
      const file =
        document.getElementById('entry_banner_upload')?.files[0];

      const filename = buildDriveFileName({
        file,
        team: teamObj.shortName,
        fileType: 'banner',
        meetingDate: null
      });

      const bannerFileId = await uploadFileToDrive(
        file,
        config.BANNER_FOLDER_ID,
        filename
      );
    }


    const payload = {
      data: [
        {
          // Timestamp is not set here, it's in the GWS Automations script attached to the sheet
          "Email Address": currentUser?.email || "",
          "Your Team": teamObj.teamName,
          "What do you want to update?": selectedRadio.value,

          "Announcement Title":
            document.getElementById('entry_announcement_title')?.value || "",

          "Announcement Body":
            document.getElementById('entry_announcement_body')?.value || "",

          "Date of meeting":
            document.getElementById('entry_meeting_date')?.value || "",

          "Upload your meeting minutes here (.pdf, .docx or URL to Google Document)":
            minutesFileId || "",

          "Upload your team's operations plan here (.pdf, .docx or URL to Google Document)":
            opsFileId || "",

          "Upload banner photo here":
            bannerFileId || "",

          "Image alt text (brief image description for screen readers)":
            document.getElementById('entry_banner_alt')?.value || "",

          "BannerPublicURL": "",
          "Edit URL": "",
          "Id": rowId,
          "Delete URL": ""
        }
      ]
    };

    try {
      setLoading(true, 'Submitting…');

      const url = `https://sheetdb.io/api/v1/ne0v0i21llmeh?sheet=TeamPageUpdateForm`;
      const method = isUpdate ? 'PUT' : 'POST';

      const fetchOptions = {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)  // now includes filter if updating
      };

      let res;

      if (isUpdate) {
        const updateUrl = `https://sheetdb.io/api/v1/ne0v0i21llmeh/Id/${rowId}?sheet=TeamPageUpdateForm`;

        res = await fetch(updateUrl, {
          method: 'PATCH', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: [
              {
                "Announcement Title": document.getElementById('entry_announcement_title')?.value || "",
                "Announcement Body": document.getElementById('entry_announcement_body')?.value || "",
                "Delete URL": ""
              }
            ]
          })
        });

      } else {
        res = await fetch(
          'https://sheetdb.io/api/v1/ne0v0i21llmeh?sheet=TeamPageUpdateForm',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );
      }



      const text = await res.text();
      let json;

      console.log('response text', text);

      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }

      if (!res.ok) {
        throw new Error(JSON.stringify(json));
      }

      alert(isUpdate ? 'Edit saved successfully! Click Refresh Data to see updates' : 'Update submitted successfully! Click Refresh Data to see updates');

      // Hide form / restore page
      onComplete();

      const newRow = {
        id: rowId,
        'Announcement Title': payload.data[0]['Announcement Title'],
        'Announcement Body': payload.data[0]['Announcement Body'],
        'Edit URL': payload.data[0]['Edit URL'],
        'Delete URL': '', // or build delete URL if available
        Timestamp: new Date().toISOString()
      };

      console.log('newRow', newRow);


      // 1. Update cache & get the announcement object back
      const announcement = upsertAnnouncementInCache(getNormalizedTeamParam(), newRow);

      // 2. Re-render all announcements via the central function
      if (announcement) {
        const cachedData = getCachedData(getNormalizedTeamParam());
        if (cachedData && cachedData.teamData) {
          renderAnnouncements({
            announcements: cachedData.teamData.announcements,
            container: announcementsDiv,
            isEditor: cachedData.auth.isTeamPageEditor,
            teamShortName: cachedData.teamData.teamObj.shortName,
            teamData: cachedData.teamData
          });
        }
      }


    } catch (err) {
      alert('Submission failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }); // close form submit handler

} // close initUpdateForm()

function normalizeUpdateType(value) {
  console.log('normalizeUpdateType');
  console.log(value);
  const lower = (value || '').toLowerCase();
  console.log(lower);
  if (lower.includes('announcement')) return 'announcement';
  if (lower.includes('minutes')) return 'minutes';
  if (lower.includes('operations')) return 'ops';
  if (lower.includes('banner')) return 'banner';

  return value;
}


function getQueryParams() {
    return Object.fromEntries(new URLSearchParams(window.location.search));
  }

async function showUpdateForm(teamData, prefill = {}) {
  console.log('showUpdateForm');
  console.log('prefill:', prefill);

  const formMount = await waitForElement('#updateForm'); 
  const teamContent = await waitForElement('#teamContent'); 

  // Hide main content 
  teamContent.style.display = 'none';

  // --- RENDER AND SHOW FORM ---
  formMount.innerHTML = renderUpdateFormHTML();
  formMount.style.display = 'block';

  // --- AUTOFILL TEAM & EMAIL ---
  const teamSelect = formMount.querySelector('select[name="entry.538407109"]');
  if (teamSelect) teamSelect.innerHTML = `<option value="${teamParam}" selected>${teamParam}</option>`;

  const emailInput = formMount.querySelector('input[type="email"][name="entry.123456789"]');
  if (emailInput && email) emailInput.value = email;

  // --- INITIALIZE FORM LOGIC (radios & sections) ---
  initUpdateForm(
    async () => {
      formMount.innerHTML = '';
      formMount.style.display = 'none';
      teamContent.style.display = 'block';
      const team = getNormalizedTeamParam();
      setLoading(true);
      try {
        await loadBackend(team, currentUser?.email);
      } finally {
        setLoading(false);
      }
    },
    teamData.teamObj,
    teamData.auth.email
  );

  // --- PREFILL RADIO AND TEXT INPUTS AFTER LISTENERS ARE ATTACHED ---
  if (prefill?.id) {
    const ut = normalizeUpdateType(prefill.updateType);

    const updateTypeRadio = Array.from(
      formMount.querySelectorAll('input[name="entry.1192593661"]')
    ).find(input =>
      input.value.toLowerCase().includes(ut.toLowerCase())
    );

    const titleInput = formMount.querySelector('#entry_announcement_title');
    const bodyInput = formMount.querySelector('#entry_announcement_body');

    if (updateTypeRadio) {
      updateTypeRadio.checked = true;
      updateTypeRadio.dispatchEvent(
        new Event('change', { bubbles: true })
      );
    }

    if (titleInput) titleInput.value = prefill.title || '';
    if (bodyInput) bodyInput.value = prefill.body || '';
  }


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
  const bannerData = data?.teamData?.banner || data?.banner;
  console.log('bannerDiv:', bannerDiv);

  if (bannerData && bannerData.fileUrl) {
    console.log('rendering banner');
    bannerSection.style.display = 'block';
    bannerDiv.innerHTML = `
      <div class="bannerImgCont">
        <img class="bannerImg" src="${bannerData.fileUrl}" alt="${bannerData.altText}">
      </div>
    `;

    // Add admin links after the image
    if (data.auth.isTeamPageEditor) {
      const bannerImg = bannerDiv.querySelector('img.bannerImg'); // query inside bannerDiv
      const currentFileUrl = bannerImg ? bannerImg.src : null;
      const currentUserEmail = data.auth.email || '';

      if (currentFileUrl) {
        const deleteBannerURL = `${config.backendUrl}?team=${teamName}&email=${currentUserEmail}&action=deleteBanner&fileUrl=${encodeURIComponent(currentFileUrl)}`;
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
      
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.textContent = linkText;
      li.appendChild(link);  


      // Trash icon for team page editors ---
      if (currentUser?.isTeamPageEditor) {
        const trash = document.createElement('span');
        trash.className = 'trash-icon';
        trash.innerHTML = '🗑️'; // or use a FontAwesome icon
        trash.style.cursor = 'pointer';
        trash.style.marginLeft = '8px';

        // Click handler to delete row from Sheet & cache
        trash.addEventListener('click', async () => {
          if (!confirm(`Delete "${linkText}" from the team data?`)) return;

          const teamParam = getNormalizedTeamParam();
          try {
            // DELETE row from SheetDB
            const res = await fetch(`https://sheetdb.io/api/v1/YOUR_SHEET_ID/rows/${file.rowId}`, {
              method: 'DELETE',
            });
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



  // Operations Plan
  opsDiv.innerHTML = '';
  if (data?.teamData?.opsPlanLink) {
    const file = data.teamData?.opsPlanLink;
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
    opsDiv.innerHTML = `<ul class="icon-list"><li class="icon-pdf">
      <a href="${url}" target="_blank">
        ${linkText}
      </a></li></ul>`;
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

    // Update cached auth state only (lastUserEmail), do NOT touch team data
    if (isLocalStorageAvailable()) {
      localStorage.setItem('lastUserEmail', '');
      // Keep `teamData_*` cache intact
    }
  }
}



let currentUser = null;

// --- Global Firebase Auth Listener ---
const auth = window.firebaseAuth;
let prevUser = null; // track previous state

onAuthStateChanged(auth, async (user) => {
  const email = user?.email || '';
  console.log('onAuthStateChanged →', email || 'anonymous');

  currentUser = user;
  updateAuthUI(currentUser);

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
      const fresh = await callBackend();
      if (fresh?.success && Array.isArray(fresh.teamLinks)) {
        cacheData(pseudoTeamKey, fresh, fresh.auth);
        renderTeamLinks(fresh.teamLinks);
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

    renderTeamPage(safeData);
    setLoading(false);
    attachRefreshListener();
    return; // skip backend entirely
}


  // No cache or stale → call backend
  try {
    const data = await callBackend({ page: 'team', team, email });
    console.log('Fresh backend data:', data);
    if (data?.success) {
      cacheData(team, data, data.auth);
      const safeData = { teamData: data, auth: data.auth || {} };
      renderTeamPage(safeData);
    }
  } catch (err) {
    console.error('Error fetching team page:', err);
  } finally {
    setLoading(false);
    attachRefreshListener();
  }

}




/**
 * Setup login/logout buttons
 */
function setupAuthUI() {
  const auth = window.firebaseAuth;
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      try {
        const result = await signInWithPopup(auth, provider);

        // The signed-in user info.
        const user = result.user;
        console.log('Logged in as', user.email);

        // Google Access Token with Drive scopes
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential.accessToken;
        console.log('Google Drive access token:', accessToken);

        window.googleDriveAccessToken = accessToken;

        // use this token to call Google Drive APIs directly:
        // fetch('https://www.googleapis.com/drive/v3/files', { headers: { Authorization: `Bearer ${accessToken}` } })

        currentUser = user;
        updateAuthUI(user);

      } catch (error) {
        console.error('Login failed', error);
        alert('Login failed: ' + error.message);
      }
    });
  }
  if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));
}


const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Caches team data along with optional auth info.
 * @param {string} team - team key
 * @param {object} data - backend response for the team
 * @param {object} [auth] - optional auth info { email, isAdmin, isTeamLead, isTeamPageEditor }
 */
function cacheData(team, data, auth) {
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

function getCachedData(team) {
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

function upsertAnnouncementInCache(team, row) {
  const key = cacheKeyFor(team);
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const cached = JSON.parse(raw);
    const list = cached?.data?.teamData?.announcements;
    if (!Array.isArray(list)) return null;

    const announcement = normalizeAnnouncement(row);
    if (!announcement) return null;

    const index = list.findIndex(a => a.id === announcement.id);
    if (index >= 0) {
      list[index] = announcement;
    } else {
      list.unshift(announcement);
    }

    cached.timestamp = Date.now();
    localStorage.setItem(key, JSON.stringify(cached));

    return announcement;
  } catch (err) {
    console.warn('Cache update failed:', err);
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
async function init(user = currentUser, options = {}) {
  const { skipMainSpinner = false } = options;

  console.log('INIT called ******************');
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
    if (!skipMainSpinner) setLoading(false);
    return;
  }

  const effectiveEmail = user?.email || 'anonymous@public'; // default to anonymous
  console.log(`init() called — team=${team}, user=${effectiveEmail || 'anonymous'}`);

  const cached = getCachedData(team);
  console.log('getCachedData() returned:', cached);


  // --- CASE 1: Cached data exists (fresh per CACHE_TTL) ---
  if (cached) {
    console.log(`Using cached data for team "${team}"`);

    const safeCachedData = {
      teamData: cached.data.teamData,
      auth: cached.data.auth || {}
    };

    renderTeamPage(safeCachedData);
    if (!skipMainSpinner) setLoading(false);

    // ensure refresh button works even on cache hit
    if (!document.getElementById('refreshBtn').dataset.listenerAttached) {
      attachRefreshListener();
      document.getElementById('refreshBtn').dataset.listenerAttached = 'true';
    }


    try {
      const effectiveEmail = currentUser?.email || '';
      const fresh = await callBackend({ team, email: effectiveEmail });
      console.log('Background refresh response:', fresh);
      if (fresh?.success) {
        cacheData(team, fresh, fresh.auth);
        const safeData = { teamData: fresh, auth: fresh.auth || {} };
        if (JSON.stringify(fresh) !== JSON.stringify(cached.data)) {
          renderTeamPage(safeData);
        }
      } else {
        console.warn('Background refresh returned unsuccessful response:', fresh);
      }
    } catch (err) {
      console.error('Background refresh failed:', err);
    } finally {
      // clearTimeout(hideTimer);

    }

    return;
  }

  // --- CASE 2: No cache — fetch fresh data ---
  console.log('No cached data found — fetching fresh data from backend...');
  if (!skipMainSpinner) setLoading(true);
  try {
    const effectiveEmail = currentUser?.email || '';
    const data = await callBackend({ team, email: effectiveEmail });
    console.log('Fresh backend response:', data);
    if (data?.success) {
      cacheData(team, data, data.auth);
      const safeData = { teamData: data, auth: data.auth || {} };
      console.log('backend data');
      console.log(safeData);
      renderTeamPage(safeData);
    } else {
      console.warn('Backend call returned unsuccessful response:', data);
    }
  } catch (err) {
    console.error('Error loading team page data:', err);
  } finally {
    if (!skipMainSpinner) setLoading(false);
    if (!document.getElementById('refreshBtn').dataset.listenerAttached) {
      attachRefreshListener();
      document.getElementById('refreshBtn').dataset.listenerAttached = 'true';
    }

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

/**
 * Manually refresh data from backend.
 */
async function refreshData() {
  console.log('refreshData START ******************************');
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
    console.log('calling INIT ******************************');
    // Call init() without setting loading here; init() will manage the spinner itself
    await init(currentUser, { skipMainSpinner: true });
  } catch (err) {
    console.error('Error refreshing data:', err);
    alert('Error refreshing data: ' + err.message);
  } finally {
    console.log('refreshData FINALLY ******************************');
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
