import {
  getNormalizedTeamParam,
  waitForElement,
  getQueryParams,
  setLoading
} from './helpers.js';
import { getCurrentUser, initGoogleDriveAuth, getTokenClient } from './auth.js';
import { loadBackend } from './main.js';
import { config } from './config.js';

const WORKER_URL = 'https://sheet-proxy.rifkegribenes.workers.dev';
let quill = null;


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

    if (!file) {
      alert('Please select a file.');
      return;
    }
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
  return value || '';
}

// async function uploadImage(file, teamShortName, fileType, folderId, userFileName) {

//     const MAX_FILE_SIZE_MB = 1;
//     const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

//     if (file.size > MAX_FILE_SIZE_BYTES) {
//         throw new Error("Image too large.");
//     }

//     file = await resizeImage(file);

//     if (file.size > MAX_FILE_SIZE_BYTES) {
//         throw new Error("Image too large after resize.");
//     }

//     const filename = userFileName ? userFileName : buildDriveFileName({
//         file,
//         team: teamShortName,
//         fileType
//     });

//     const fileId = await uploadFileToDrive(file, folderId, filename);

//     return `https://drive.google.com/uc?export=view&id=${fileId}`;
// }

function initUpdateForm(onComplete, teamObj, user) {
  const radios = document.querySelectorAll('input[name="entry.1192593661"]');
  const submitBtn = document.getElementById('form_submit');
  const teamSelect = document.getElementById('entry.538407109');
  const emailInput = document.getElementById('entry.123456789');

  const sections = {
    announcement: document.getElementById("section_post_announcement"),
    minutes: document.getElementById("section_meeting_minutes"),
    ops: document.getElementById("section_operations_plan"),
    banner: document.getElementById("section_banner")
  };

  // initialize Quill, even if not editing announcement
  const editor = document.getElementById('editor');
  console.log(`editor: ${editor}`);
  quill = new Quill(editor, {
    theme: 'snow',
    modules: {
      toolbar: [
        ['bold', 'italic'],
        [{ header: 5 }],
        // ['link', 'image'],
        ['link']
      ]
    }
  });

  // remove required attribute from tooltip inputs
  document
  .querySelectorAll('.ql-tooltip input')
  .forEach(input => input.removeAttribute('required'));

  function checkSubmitButtonState() {
    // Find visible section
    const visibleSection = Object.values(sections).find(
      section => section.style.display !== 'none'
    );

    if (!visibleSection) {
      submitBtn.disabled = true;
      return;
    }

    // const inputs = visibleSection.querySelectorAll('input, textarea, select');
    const inputs = Array.from(
      visibleSection.querySelectorAll('input, textarea, select')
    ).filter(input => input.name?.startsWith('entry.'));

    // Array.from(inputs).forEach(input => {
    //   console.log({
    //     id: input.id,
    //     class: input.className,
    //     parent: input.parentElement,
    //     html: input.outerHTML
    //   });
    // });

    let allFilled = Array.from(inputs).every(input => {

      // Skip hidden inputs
      if (input.type === 'hidden') return true;

      // Skip non-required inputs (except file which we handle manually)
      if (!input.required && input.type !== 'file') return true;

      // Special case: meeting minutes or ops file OR Drive
      if (input.type === 'file' &&
          (input.id === 'entry_meeting_upload' || input.id === 'entry_operations_plan')) {

        const driveFieldId = input.id === 'entry_meeting_upload'
          ? 'entry_meeting_drive_url'
          : 'entry_ops_drive_url';

        const selectedDriveUrl =
          document.getElementById(driveFieldId)?.value;

        const hasFile = input.files.length > 0;
        const hasDriveSelection = !!selectedDriveUrl;

        return hasFile || hasDriveSelection;
      }


      return input.value.trim() !== '';
    });

    // console.log({
    //   beforeQuill: allFilled,
    //   visibleSection: visibleSection.id,
    //   quillLength: quill.getText().trim().length
    // });

    // Additional validation for Quill
    if (visibleSection.id === 'section_post_announcement') {
      allFilled = allFilled &&
        quill &&
        quill.getText().trim().length > 0;
    }

    submitBtn.disabled = !allFilled;
  }

  quill.on('text-change', () => {
    document.getElementById('entry_announcement_body').value =
        quill.root.innerHTML;
    checkSubmitButtonState();
  });


  Object.values(sections).forEach(section => {
    section.querySelectorAll('input, textarea, select').forEach(input => {
      input.addEventListener('input', checkSubmitButtonState);
      input.addEventListener('change', checkSubmitButtonState); // for file inputs & selects

      if (input.type === 'file' && input.id === 'entry_meeting_upload') {
        input.addEventListener('change', () => {
          if (input.files.length > 0) {
            document.getElementById('entry_meeting_drive_url').value = '';
            document.getElementById('entry_meeting_drive_file_id').value = '';
            document.getElementById('minutes_selected_file').innerText = '';

            input.required = true; // re-enable validation for manual file
          }
        });
      }

      if (input.type === 'file' && input.id === 'entry_operations_plan') {
        input.addEventListener('change', () => {
          if (input.files.length > 0) {
            document.getElementById('entry_ops_drive_url').value = '';
            document.getElementById('entry_ops_drive_file_id').value = '';
            document.getElementById('ops_selected_file').innerText = '';
            
            input.required = true; // re-enable validation for manual file
          }
        });
      }



    });
  });


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
      const selectedType = normalizeUpdateType(radio.value);

      Object.entries(sections).forEach(([type, section]) => {
        const inputs = section.querySelectorAll('input, textarea, select');

        if (type === selectedType) {
          section.style.display = 'block';
          submitBtn.style.display = 'block';
          inputs.forEach(input => {

            // Special case for meeting minutes file input
            if (input.id === 'entry_meeting_upload') {
              input.required = false; // handled manually
            } else {
              input.required = true;
            }

          });
        } else {
          section.style.display = 'none';
          inputs.forEach(input => {
            input.required = false;
          });
        }
      });

      checkSubmitButtonState();  // <-- update button enabled/disabled
    });
  });

    // -------------------------------
    // Drive Picker (Meeting Minutes)
    // -------------------------------

    const pickMinutesBtn =
      document.getElementById('btn_pick_minutes_drive');

    if (pickMinutesBtn) {
      pickMinutesBtn.addEventListener('click', async () => {
        try {
          await openDrivePicker((file) => {

            document.getElementById('entry_meeting_drive_file_id').value = file.id;
            document.getElementById('entry_meeting_drive_url').value = file.url;

            document.getElementById('minutes_selected_file').innerText =
              `Selected: ${file.name}`;

            // Clear manual upload if used
            document.getElementById('entry_meeting_upload').value = '';

            checkSubmitButtonState(); // re-check form validity
          });
        } catch (err) {
          alert('Drive picker failed: ' + err.message);
        }
      });
    }

    // -------------------------------
    // Drive Picker (Operations Plan)
    // -------------------------------

    const pickOpsBtn = document.getElementById('btn_pick_ops_drive');

    if (pickOpsBtn) {
      pickOpsBtn.addEventListener('click', async () => {
        try {
          await openDrivePicker((file) => {

            document.getElementById('entry_ops_drive_file_id').value = file.id;
            document.getElementById('entry_ops_drive_url').value = file.url;

            document.getElementById('ops_selected_file').innerText =
              `Selected: ${file.name}`;

            // Clear manual upload if used
            const fileInput = document.getElementById('entry_operations_plan');
            fileInput.value = '';
            fileInput.required = false; // <-- ADD THIS LINE

            checkSubmitButtonState(); // re-check form validity
          });
        } catch (err) {
          alert('Drive picker failed: ' + err.message);
        }
      });
    }




  // Form submit
  document.getElementById('updateFormForm').addEventListener('submit', async (evt) => {
	    await handleFormSubmitAsync(evt, teamObj, user, onComplete, quill);
	});

} // close initUpdateForm()


async function handleFormSubmitAsync (evt, teamObj, user, onComplete, quill) {
    evt.preventDefault();
    let html = "";

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

    const isBanner =
      updateType === 'banner';

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

      const fileInput =
        document.getElementById('entry_meeting_upload');

      const pickedUrl =
        document.getElementById('entry_meeting_drive_url')?.value;

      const file = fileInput?.files[0];

      // ---- OPTION 1: uploaded file ----
      if (file) {

        const filename = buildDriveFileName({
          file,
          team: teamObj.shortName,
          fileType: 'minutes',
          meetingDate
        });

        minutesFileId = await uploadFileToDrive(
          file,
          config.MINUTES_FOLDER_ID,
          filename
        );

        minutesUrl = minutesFileId
          ? `https://drive.google.com/open?id=${minutesFileId}`
          : '';
      }

      // ---- OPTION 2: File picked from Drive ----
      else if (pickedUrl) {

        minutesUrl = pickedUrl;

      }

      // ---- ERROR: Neither provided ----
      else {
        alert('Please upload a file or choose one from Google Drive.');
        return;
      }

      console.log(`minutesUrl: ${minutesUrl}`);
    }


    if (updateType === 'ops') {

      const fileInput =
        document.getElementById('entry_operations_plan');

      const pickedOpsUrl =
        document.getElementById('entry_ops_drive_url')?.value;

      const file = fileInput?.files[0];

      // ---- OPTION 1: uploaded file ----
      if (file) {

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

      // ---- OPTION 2: File picked from Drive ----
      else if (pickedOpsUrl) {

        opsUrl = pickedOpsUrl;

      }

      // ---- ERROR: Neither provided ----
      else {
        alert('Please upload a file or choose one from Google Drive.');
        return;
      }
    }



    if (updateType === 'banner') {
      const bannerInput = document.getElementById('entry_banner_upload');
      let file = bannerInput?.files[0];

      if (!file) {
        alert('Please select a banner file.');
        return;
      }

      const MAX_FILE_SIZE_MB = 1;
      const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

      // Step 1: Reject immediately if file too big
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum allowed is ${MAX_FILE_SIZE_MB} MB. Please crop images to 850 x 300px before uploading.`);
        bannerInput.value = ''; // clear selection
        return;
      }

      // Step 2: Resize image
      const resizedFile = await resizeImage(file);

      // Step 3: Reject again if resize didn't shrink enough
      if (resizedFile.size > MAX_FILE_SIZE_BYTES) {
        alert(`File is too large (${(resizedFile.size / 1024 / 1024).toFixed(2)} MB). Maximum allowed is ${MAX_FILE_SIZE_MB} MB. Please crop images to 850 x 300px before uploading.`);
        bannerInput.value = ''; // clear selection
        return;
      }

      file = resizedFile; // use resized file

      const filename = buildDriveFileName({
        file,
        team: teamObj.shortName,
        fileType: 'banner'
      });

      bannerFileId = await uploadFileToDrive(file, config.BANNER_FOLDER_ID, filename);
      bannerUrl = bannerFileId ? `https://drive.google.com/open?id=${bannerFileId}` : '';
    }

    if (updateType === 'announcement') {
      html = quill.root.innerHTML;
      console.log('html:');
      console.log(html);
    }

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
            // document.getElementById('entry_announcement_body')?.value || "",
            html,

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
          : isBanner ? 'Image uploaded. Banner edits may take up to a minute to render on your page. Please wait a minute and then reload the page to see new images.'
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
        const idInput = formMount.querySelector('#entry_announcement_id');

        if (titleInput) titleInput.value = prefill.title || '';
        if (idInput) idInput.value = prefill.id;

        if (quill) {
            quill.root.innerHTML = prefill.body || '';
        }
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

    alert('Announcement deleted.');
    location.reload();

  } catch (err) {
    console.error('Delete failed:', err);
    alert('Failed to delete announcement: ' + err.message);
  }
}

function renderUpdateFormHTML() {
  console.log('new update form 20260626');
  return `
  <div class="form-wrapper">
<form id="updateFormForm" novalidate>
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
        <input type="radio" name="entry.1192593661" value="announcement"> Post announcement (or edit existing announcement)
      </label>
      <label>
        <input type="radio" name="entry.1192593661" value="minutes"> Upload meeting minutes
      </label>
      <label>
        <input type="radio" name="entry.1192593661" value="ops"> Upload operations plan
      </label>
      <label>
        <input type="radio" name="entry.1192593661" value="banner"> Add or replace a banner image
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
      <div id="editor"></div>
      <!-- <textarea id="entry_announcement_body" name="entry.1206794665" required></textarea> -->
      <input type="hidden" id="entry_announcement_body" name="entry.1206794665" required>
    </div>
  </section>

  <section id="section_meeting_minutes">
    <h3>Upload meeting minutes</h3>
    <p class="formSmall">
      Please upload all files in PDF or docx format, or browse to an existing document in Google Drive.
    </p>

    <div>
      <label for="entry_meeting_date">Date of meeting</label>
      <input type="date"
             id="entry_meeting_date"
             name="entry.358896631"
             required
             max="2075-01-01">
    </div>

    <div>
      <label for="entry_meeting_upload">
        Upload your meeting minutes here (.pdf, .docx)
      </label>

      <!-- File Upload -->
      <input type="file"
             id="entry_meeting_upload"
             name="entry.1637818725"
             accept=".pdf,.docx">

      <small>Upload 1 supported file: PDF or document. Max 10 MB.</small>

      <!-- OR Divider -->
      <div style="margin:12px 0; font-size:0.9em; color:#666;">
        — OR —
      </div>

      <!-- Drive Picker Button -->
      <button type="button"
              id="btn_pick_minutes_drive"
              style="padding:6px 12px; cursor:pointer;">
        Browse Google Drive
      </button>

      <!-- Hidden fields to store selection -->
      <input type="hidden" id="entry_meeting_drive_file_id">
      <input type="hidden" id="entry_meeting_drive_url">

      <!-- Display selected file -->
      <div id="minutes_selected_file"
           style="margin-top:8px; font-size:0.9em; color:#444;">
      </div>
    </div>
  </section>


  <section id="section_operations_plan">
    <h3>Upload operations plan</h3>
    <p class="formSmall">Please upload all files in PDF or doc format, or choose one from Google Drive.</p>
    <div>
      <label for="entry_operations_plan">Upload your team's operations plan (.pdf, .docx)</label>

      <!-- File Upload -->
      <input type="file"
             id="entry_operations_plan"
             name="entry.1704615082"
             accept=".pdf,.docx">

      <small>Upload 1 supported file: PDF or document. Max 10 MB.</small>

      <!-- OR Divider -->
      <div style="margin:12px 0; font-size:0.9em; color:#666;">
        — OR —
      </div>

      <!-- Drive Picker Button -->
      <button type="button"
              id="btn_pick_ops_drive"
              style="padding:6px 12px; cursor:pointer;">
        Browse Google Drive
      </button>

      <!-- Hidden fields to store selection -->
      <input type="hidden" id="entry_ops_drive_file_id">
      <input type="hidden" id="entry_ops_drive_url">

      <!-- Display selected file -->
      <div id="ops_selected_file"
           style="margin-top:8px; font-size:0.9em; color:#444;">
      </div>
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
    <button type="submit" id="form_submit" style="display:none;" disabled>Submit</button>
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



async function uploadFileToDrive(file, folderId, filename) {
  if (!file) return;

  const accessToken = await ensureDriveAccessToken();

  const metadata = {
    name: filename ?? file.name,
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

function resizeImage(file, maxWidth = 850, maxHeight = 300) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => {
        resolve(new File([blob], file.name, { type: file.type }));
      }, file.type, 0.8); // quality 80%
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

let pickerApiLoaded = false;

function loadPickerApi() {
  return new Promise((resolve) => {
    if (pickerApiLoaded) {
      resolve();
      return;
    }

    gapi.load('picker', {
      callback: () => {
        pickerApiLoaded = true;
        resolve();
      }
    });
  });
}

async function openDrivePicker(onPicked) {
  const accessToken = await ensureDriveAccessToken();
  await loadPickerApi();

  const view = new google.picker.DocsView();
  view.setSelectFolderEnabled(false); // files only

  const picker = new google.picker.PickerBuilder()
    .addView(view)
    .setOAuthToken(accessToken)
    .setDeveloperKey(config.firebase.apiKey)
    .setCallback((data) => {
      if (data.action === google.picker.Action.PICKED) {
        const doc = data.docs[0];

        onPicked({
          id: doc.id,
          name: doc.name,
          url: `https://drive.google.com/open?id=${doc.id}`
        });
      }
    })
    .build();

  picker.setVisible(true);
}


