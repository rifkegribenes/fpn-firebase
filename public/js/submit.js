import { 
	getNormalizedTeamParam, 
	waitForElement, 
	getQueryParams,
	setLoading,
	cacheKeyFor,
	normalizeAnnouncement } from './helpers.js';
import { config } from './config.js';
import { initGoogleDriveAuth, getTokenClient, getCurrentUser } from './auth.js';
import { cacheData, getCachedData, renderAnnouncements, loadBackend } from './main.js';

const WORKER_URL = 'https://sheet-proxy.rifkegribenes.workers.dev';


function generateRowId() {
  return 'row_' + ([1e7]+-1e3+-4e3+-8e3+-1e11)
    .replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

function buildDriveFileName({
	  file,
	  team,
	  fileType,   // 'minutes' | 'ops' | 'banner'
	  meetingDate // string from input[type="date"] or null
	}) {
    console.log('buildDriveFileName');
	  const mtgDate = meetingDate
	    ? formatDateFileName(meetingDate)
	    : null;

	  const originalName = file.name;

	  if (mtgDate) {
	    return `${team}_${fileType}_${mtgDate}_${originalName}`;
	  }

	  return `${team}_${fileType}_${originalName}`;
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

function normalizeUpdateType(value) {
  console.log('normalizeUpdateType');
  const lower = (value || '').toLowerCase();
  if (lower.includes('announcement')) return 'announcement';
  if (lower.includes('minutes')) return 'minutes';
  if (lower.includes('operations')) return 'ops';
  if (lower.includes('banner')) return 'banner';

  return value;
}

function initUpdateForm(onComplete, teamObj, user) {
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
  if (user?.email && emailInput) {
    emailInput.value = user?.email;
  }

  // Radio buttons logic
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      Object.entries(sections).forEach(([key, section]) => {
        const inputs = section.querySelectorAll('input, textarea, select');
        if (radio.value === key) {
          section.style.display = 'block';
          submitBtn.style.display = 'block';
          inputs.forEach(input => input.required = true);
        } else {
          // Keep display: none but do NOT reset file inputs
          section.style.display = 'none';
          inputs.forEach(input => {
            if (input.type !== 'file') input.required = false;
          });
        }
      });
    });
  });


  // Form submit
  document.getElementById('updateFormForm').addEventListener('submit', (evt) => {
	    handleFormSubmitasync(evt, teamObj, user, onComplete);
	});

} // close initUpdateForm()

async function handleFormSubmitasync (evt, teamObj, user, onComplete) {
    evt.preventDefault();

    const query = getQueryParams();

		const selectedRadio = document.querySelector(
		  'input[name="entry.1192593661"]:checked'
		);

		if (!selectedRadio) {
      alert('Please select what to update');
      return;
    }

		const updateType = normalizeUpdateType(selectedRadio?.value);

		// Only announcements can be edited
		const idInput = document.getElementById('entry_announcement_id');
    const existingId = idInput?.value || null;

    const isAnnouncementEdit =
      updateType === 'announcement' && !!existingId;

    const rowId = isAnnouncementEdit
      ? existingId
      : generateRowId();

    console.log(`isAnnouncementEdit: ${isAnnouncementEdit}`);
    console.log(`rowId: ${rowId}`);


    let minutesFileId = '';
    let minutesUrl = '';
    let opsFileId = '';
    let opsUrl = '';
    let bannerFileId = '';
    let bannerUrl = '';

    if (updateType === 'minutes') {
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

      console.log('config.MINUTES_FOLDER_ID', config.MINUTES_FOLDER_ID);

      minutesFileId = await uploadFileToDrive(
        file,
        config.MINUTES_FOLDER_ID,
        filename
      );

      minutesUrl = minutesFileId
      ? `https://drive.google.com/open?id=${minutesFileId}`
      : '';

      console.log(`minutesUrl: ${minutesUrl}`);
    }

    if (updateType === 'ops') {
      const file =
        document.getElementById('entry_operations_plan')?.files[0];

      const filename = buildDriveFileName({
        file,
        team: teamObj.shortName,
        fileType: 'ops',
        meetingDate: null
      });

      opsFileId = await uploadFileToDrive(
        file,
        config.OPS_FOLDER_ID,
        filename
      );

      opsUrl = opsFileId
      ? `https://drive.google.com/open?id=${opsFileId}`
      : '';

    }

    if (updateType === 'banner') {
      const file =
        document.getElementById('entry_banner_upload')?.files[0];

      console.log('banner file input', file);

      if (!file) {
        console.error('No banner file selected');
        alert('Please select a banner file.');
        return;
      }

      const filename = buildDriveFileName({
        file,
        team: teamObj.shortName,
        fileType: 'banner'
      });

      console.log(`submit.js: 215: banner filename: ${filename}`);

      bannerFileId = await uploadFileToDrive(
        file,
        config.BANNER_FOLDER_ID,
        filename
      );

      console.log(`submit.js: 223: bannerFileId: ${bannerFileId}`);
    }

    bannerUrl = bannerFileId
      ? `https://drive.google.com/open?id=${bannerFileId}`
      : '';

    console.log(`submit.js: 230: bannerUrl: ${bannerUrl}`);

    const payload = {
      data: [
        {
          // Timestamp is not set here, it's in the GWS Automations script attached to the sheet
          "Email Address": user?.email || "",
          "Your Team": teamObj.teamName,
          "What do you want to update?": selectedRadio.value,

          "Announcement Title":
            document.getElementById('entry_announcement_title')?.value || "",

          "Announcement Body":
            document.getElementById('entry_announcement_body')?.value || "",

          "Date of meeting":
            document.getElementById('entry_meeting_date')?.value || "",

          "Upload your meeting minutes here (.pdf, .docx or URL to Google Document)":
            minutesUrl || "",

          "Upload your team's operations plan here (.pdf, .docx or URL to Google Document)":
            opsUrl || "",

          "Upload banner photo here":
            bannerUrl || "",

          "Image alt text (brief image description for screen readers)":
            document.getElementById('entry_banner_alt')?.value || "",

          // "BannerPublicURL": "",
          // "Edit URL": "",
          "Id": rowId,
          // "Delete URL": ""
        }
      ]
    };

    try {
      setLoading(true, 'Submitting…');

      let res;

      if (isAnnouncementEdit) {
        console.log('Submitting edit payload', rowId);

        const updateUrl = `${WORKER_URL}?sheet=TeamPageUpdateForm&Id=${encodeURIComponent(rowId)}`;

        res = await fetch(updateUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: [{
              "Announcement Title":
                document.getElementById('entry_announcement_title')?.value || "",
              "Announcement Body":
                document.getElementById('entry_announcement_body')?.value || ""
            }]
          })
        });


      } else {
        res = await fetch(`${WORKER_URL}?sheet=TeamPageUpdateForm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

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
      
      alert(
        isAnnouncementEdit
          ? 'Edit saved successfully.'
          : 'Update submitted successfully.'
      );

      // Full reload guarantees fresh backend state
      location.reload();


    } catch (err) {
      alert('Submission failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }; 

  export async function showUpdateForm(teamData, prefill = {}) {
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
	  const teamParam = getNormalizedTeamParam();
	  const teamSelect = formMount.querySelector('select[name="entry.538407109"]');
	  if (teamSelect) teamSelect.innerHTML = `<option value="${teamParam}" selected>${teamParam}</option>`;

	  const emailInput = formMount.querySelector('input[type="email"][name="entry.123456789"]');
	  const currentUserEmail = teamData.auth?.email || '';
		if (emailInput) emailInput.value = currentUserEmail;

		const user = getCurrentUser();

    console.log(user);
    console.log(user.email);

	  // --- INITIALIZE FORM LOGIC (radios & sections) ---
	  initUpdateForm(
	    async () => {
	      formMount.innerHTML = '';
	      formMount.style.display = 'none';
	      teamContent.style.display = 'block';
	      const team = getNormalizedTeamParam();
	      setLoading(true);
	      try {
	        await loadBackend(team, getCurrentUser());
	      } finally {
	        setLoading(false);
	      }
	    },
	    teamData.teamObj,
	    user
	  );

	  // --- PREFILL UPDATE TYPE RADIO (always allowed) ---
		if (prefill?.updateType) {
		  const ut = normalizeUpdateType(prefill.updateType);

		  const updateTypeRadio = Array.from(
		    formMount.querySelectorAll('input[name="entry.1192593661"]')
		  ).find(input =>
		    input.value.toLowerCase().includes(ut)
		  );

		  if (updateTypeRadio) {
		    updateTypeRadio.checked = true;
		    updateTypeRadio.dispatchEvent(
		      new Event('change', { bubbles: true })
		    );
		  }
		}

		// --- PREFILL ANNOUNCEMENT CONTENT (edit-only) ---
		if (prefill?.id && normalizeUpdateType(prefill.updateType) === 'announcement') {
      const titleInput = formMount.querySelector('#entry_announcement_title');
      const bodyInput = formMount.querySelector('#entry_announcement_body');
      const idInput = formMount.querySelector('#entry_announcement_id');

      if (titleInput) titleInput.value = prefill.title || '';
      if (bodyInput) bodyInput.value = prefill.body || '';
      if (idInput) idInput.value = prefill.id;
    }




	}

export async function handleDeleteAnnouncement(announcement, team) {
  if (!confirm('Are you sure you want to delete this announcement?')) return;

  const rowId = announcement?.id || announcement?.Id;

  if (!rowId) {
    console.error('Delete called with invalid announcement:', announcement);
    alert('Delete failed: announcement ID missing');
    return;
  }

  const url = `${WORKER_URL}?sheet=TeamPageUpdateForm&Id=${encodeURIComponent(rowId)}`;

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

    alert('Announcement deleted. Click Refresh Data to see updated content.');

  } catch (err) {
    console.error('Delete failed:', err);
    alert('Failed to delete announcement: ' + err.message);
  }
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

  <!-- Announcement ID (for updates) -->
  <input type="hidden" id="entry_announcement_id">  

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

async function ensureDriveAccessToken() {
  // Ensure token client exists
  initGoogleDriveAuth();

  const client = getTokenClient();

  if (!client) {
    throw new Error('Google Drive auth not initialized');
  }

  // Reuse existing token
  if (window.googleDriveAccessToken) {
    return window.googleDriveAccessToken;
  }

  return new Promise((resolve, reject) => {
    client.callback = (token) => {
      if (!token || !token.access_token) {
        reject(new Error('Failed to obtain Drive access token'));
        return;
      }

      window.googleDriveAccessToken = token.access_token;
      resolve(token.access_token);
    };

    client.requestAccessToken({ prompt: '' });
  });
}



async function uploadFileToDrive(file, folderId) {
  console.log('uploadFileToDrive called');
  if (!file) {
    console.error('No file sent to uploadFileToDrive');
    return;
  }

  const accessToken = await ensureDriveAccessToken();

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

  let res;

  try {
    res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + accessToken
        },
        body: form
      }
    );

  } catch(err) {
    console.log(`uploadFileToDrive err: ${err}`)
  };

  const data = await res.json();
  console.log('uploadFileToDrive', data);
  if (!res.ok) throw new Error(data.error?.message || 'File upload failed');

  return data.id;
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