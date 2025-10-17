const TEAM_LEADS_GROUP_EMAIL = "team-leads@friendsofportlandnet.org"; 
const ADMIN_GROUP_EMAIL = "adminteam@friendsofportlandnet.org"; 
// console.log(`ss: ${ss}`);

let isAdmin, isTeamLead, isTeamPageEditor, teamObj = {};

function testGroupCheck() {
  const user = "admin@friendsofportlandnet.org";
  Logger.log(checkGroupMembership(user));
}

function doGet(e) {
  console.log('doGet');
  const userEmail = Session.getActiveUser().getEmail();
  // logAccess(userEmail, e.parameter);

  const action = e.parameter.action;
  const responseId = e.parameter.id;
  const page = e.parameter.page || 'team'; // default page
  const team = e.parameter.team || '';
  let message = null;
  teamObj = globalLookup(team);
  console.log(`*****TEAM OBJECT doGET*******`);
  console.log(teamObj);

  if (action === 'delete' && responseId) {
    console.log('trying to delete');
    const deleted = deleteFormResponse(responseId);
    message = deleted ? 'Announcement deleted successfully.' : 'Failed to delete announcement.';
  }

  if (page === 'teamLinks') {
    return HtmlService.createHtmlOutputFromFile('TeamLinksClientTemplate')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } 
  
  else if (page === 'team') {
    const template = HtmlService.createTemplateFromFile('TeamPageClientTemplate');
    template.team = team;
    template.headerImage = LOGO;
    template.message = message;  // Pass message into the template
    return template.evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}




// Called from client-side JS
function getTeamData(teamParam) {
  console.log('getTeamData');
  console.log(`teamParam: ${teamParam}`);

  teamObj = globalLookup(teamParam);
  console.log(`*****TEAM OBJECT getTeamData *******`);
  console.log(teamObj);

  // If no team param, redirect to team links page
  if (!teamParam) {
    window.location.href = 'https://sites.google.com/friendsofportlandnet.org/teamspace/teams';
  }

  const userEmail = Session.getActiveUser().getEmail();

  // teamParam is shortname, fetch full name of team from param
  return renderContent(teamParam, userEmail);
}


function renderContent(userTeam, userEmail) { //userTeam is shortname
  console.log('renderContent');
  console.log(`userTeam: ${userTeam}, userEmail: ${userEmail}`);
  isAdmin = checkGroupMembership(ADMIN_GROUP_EMAIL, userEmail);
  isTeamLead = checkGroupMembership(TEAM_LEADS_GROUP_EMAIL, userEmail);
  isTeamPageEditor = (isTeamLead && userEmail.includes(userTeam)) || isAdmin;
  console.log(`isAdmin: ${isAdmin}, isTeamLead: ${isTeamLead}, isTeamPageEditor: ${isTeamPageEditor}`);

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

function showLogs(userEmail, userTeam, isAdmin, isTeamLead, isTeamPageEditor){
  // return `<div style="padding: 20px; font-family: Lato, sans-serif; color: red;">
  //   userEmail: ${userEmail}<br/>
  //   Session.getActiveUser().getEmail(): ${Session.getActiveUser().getEmail()}<br/>
  //   Team: ${userTeam}<br/>
  //   Is Admin? ${isAdmin}<br/>
  //   Is Team Lead? ${isTeamLead}<br/>
  //   Is Team Page Editor? ${isTeamPageEditor}<br/>
  // </div>`
}

function checkGroupMembership(groupEmail, userEmail) {
  try {
    const member = AdminDirectory.Members.get(groupEmail, userEmail);
    return member && member.status === "ACTIVE";
  } catch (e) {
    return false;
  }
}

function showPublicContent(isTeamPageEditor) {
  console.log('showPublicContent');
  return `
    <div class="publicContent">
      <h2 style="font-size: 2rem; margin-bottom: 16px;">${teamObj.teamName}</h2>
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
            ${renderCalendar()}
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
              ${renderMinutesBlock()}
            </div>
          </div>

          <div class="ops block" style="
            padding-bottom: 20px;
            margin-bottom: 20px;
            border-bottom: 1px dotted #ccc;
          ">
            <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Operations Plan</h3>
            <div class="ops cont">
              ${renderOpsPlanBlock()}
            </div>
          </div>

          <div class="grouplink block" style="
            padding-bottom: 20px;
            margin-bottom: 20px;
            border-bottom: 1px dotted #ccc;
          ">
            <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Google Group</h3>
            <div class="gGroup cont">
              ${renderGoogleGroup()}
            </div>
          </div>

          <div class="drivelink block">
            <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Team Drive</h3>
            <div class="gDrive cont">
              ${renderGoogleDrive()}
            </div>
          </div>
        </div>
      </div>
    </div>`

}

function showTeamPageEditorContent() {
  return `
    <div class="tlContainer container">
      <h3>
        <a 
          id="teamUpdateLink"
          href="https://docs.google.com/forms/d/e/1FAIpQLSe9TU8URPswEVELyy9jOImY2_2vJ9OOE7O8L5JlNUuiJzPQYQ/viewform?usp=pp_url&entry.1458714000=${encodeURIComponent(teamObj.teamName)}"
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


function announcementsBlock(isTeamPageEditor) {
  if (getRecentAnnouncements() && getRecentAnnouncements().length) {
    return getRecentAnnouncements().map(item => renderAnnouncement(item, isTeamPageEditor)).join('');
  } else {
    return `<p>No announcements for ${teamObj.teamName}</p>`
  }
  
}

function renderAnnouncement(obj, isTeamPageEditor) {
  const deleteURLWithParams = `${obj.deleteURL}&page=team&team=${teamObj.shortName}`
  const adminBlock = isTeamPageEditor ? `<a href="${obj.editURL}">Edit</a> | <a href="${deleteURLWithParams}">Delete</a>` : '';
  return `<div class="announcement">
    <h4 class="aTitle" style="margin-bottom: 10px;">${obj.title}&#160;&#160;&#x7C;&#160;&#160;<span class="aDate" style="color:#333;font-weight:400;">${formatDate(obj.timestamp)}</span></h4>
    <p class="aBody">${obj.body}</p>
    ${adminBlock}
  </div>`
}

function renderCalendar() {
  console.log(`teamObj.teamCal (242): ${teamObj.shortName}`);
  console.log(teamObj.teamCal);
  
  if (!!teamObj.teamCal) {
    return `<iframe 
              style="width: 100%; min-height: 400px; border: none;" 
              src="${teamObj.teamCal}"
              loading="lazy"
              allowfullscreen
            ></iframe>`;
  } else {
    return `<p>No calendar available for ${teamObj.teamName}</p>`;
  }
}



function getRecentAnnouncements() {
  const data = updatesSheet.getDataRange().getValues();

  // Get header indexes
  const headers = data[0];
  const TIMESTAMP_COL = headers.indexOf('Timestamp');
  const UPDATE_TYPE_COL = headers.indexOf('What do you want to update?');
  const TITLE_COL = headers.indexOf('Announcement Title');
  const BODY_COL = headers.indexOf('Announcement Body');
  const TEAM_COL = headers.indexOf('Your Team');
  const EDIT_URL_COL = headers.indexOf('Edit URL');
  const DELETE_URL_COL = headers.indexOf('Delete URL');

  if (TIMESTAMP_COL === -1 || UPDATE_TYPE_COL === -1 || TITLE_COL === -1 || BODY_COL === -1 || TEAM_COL === -1, EDIT_URL_COL === -1, DELETE_URL_COL === -1) {
    throw new Error("Required columns are missing from the update your team page sheet.");
  }

  // Filter rows where 'What do you want to update?' == 'Post announcement' and team matches function input
  const announcementRows = data.slice(1).filter(row => {
    return row[UPDATE_TYPE_COL] === 'Post announcement' && row[TEAM_COL] === teamObj.teamName;
  });

  // Sort by Timestamp descending
  announcementRows.sort((a, b) => {
    return new Date(b[TIMESTAMP_COL]) - new Date(a[TIMESTAMP_COL]);
  });

  // Get the top 3 announcements
  const recentAnnouncements = announcementRows.slice(0, 3).map(row => {
    return {
      timestamp: new Date(row[TIMESTAMP_COL]),
      title: row[TITLE_COL],
      body: row[BODY_COL],
      editURL: row[EDIT_URL_COL],
      deleteURL: row[DELETE_URL_COL]
    };
  });
  // console.log(recentAnnouncements);
  return recentAnnouncements;
}

function renameFile(team, file, fileType, meetingDate) {
  console.log('####################   renameFile');
  
  // Only touch recently added files (e.g. last 60 seconds)
  const created = file.getDateCreated();
  const now = new Date();
  const ageInSeconds = (now - created) / 1000;
  // console.log(`ageInSeconds: ${ageInSeconds}`);

  const mtgDate = meetingDate ? formatDateFileName(new Date(meetingDate)) : null;
  console.log(`mtgDate: ${mtgDate}`);

  if (ageInSeconds < 60) {
    // console.log(`ageInSeconds < 60`);
    console.log('renameFile');
    const originalName = file.getName();
    let newName = '';
    if (mtgDate) {
      newName = `${team}_${fileType}_${mtgDate}_${originalName}`;
    } else {
      newName = `${team}_${fileType}_${originalName}`;
    }
    // console.log(`originalName: ${originalName}`);
    // console.log(`newName: ${newName}`);
    file.setName(newName);
    file.setDescription(team);
    // console.log(`file description: *********************`);
    // console.log(file.getDescription());
    // console.log(`mtgDate: ${mtgDate}`);
    if (mtgDate) {
      let currentDesc = file.getDescription() || "";
      currentDesc = currentDesc += `,${mtgDate}`;
      file.setDescription(currentDesc);
      console.log(`file description with mtgDate:`);
      console.log(file.getDescription());
    }
  } else {
    console.log(`skipping older file ${ageInSeconds}`);
  }
}


// prepends the team name to meeting minutes and ops plan files so they can be found later in the drive folder
function onFormSubmitHandler2(e) {
  console.log(`onFormSubmitHandler2`);
  const sheetName = e.range.getSheet().getName();
  console.log(`sheetName = ${sheetName}`);

  // e.source is the Form object that triggered the event
  const submittedFormId = e.source.getId();
  console.log(`onFormSubmitHandler2 submittedFormId: ${submittedFormId}`);
  console.log(`UPDATES_FORM_ID: ${UPDATES_FORM_ID}`);

  if (submittedFormId !== UPDATES_FORM_ID) {
    console.log('Submission ignored: Not from team updates form.');
    return;
  }

  // File upload logic
  const responses = e.namedValues;
  const team = responses["Your Team"][0] || 'Unknown'; 
  const fileType = responses["What do you want to update?"][0].includes('minutes') ? 'minutes' : responses["What do you want to update?"][0].includes('operations') ? 'ops' : '';
  const meetingDate = responses["Date of meeting"][0] || '';
  console.log(`team: ${team}, fileType: ${fileType}`);

  const minutesFolder = DriveApp.getFolderById(MINUTES_FOLDER_ID);
  const opsFolder = DriveApp.getFolderById(OPS_FOLDER_ID);
  const minutesFiles = minutesFolder.getFiles();
  const opsFiles = opsFolder.getFiles();

  if (fileType === 'minutes') {
    while (minutesFiles.hasNext()) {
    const file = minutesFiles.next();
    // console.log('minutesFile');
    // console.log(file.getName());

    renameFile(globalLookup(team).shortName, file, fileType, meetingDate)
  }

  } else if (fileType === 'ops') {
    while (opsFiles.hasNext()) {
    const file = opsFiles.next();
    // console.log('opsFile');
    // console.log(file.getName());

    renameFile(globalLookup(team).shortName, file, fileType)
    
    }
  } else {
    console.log('no fileType found'
    )
  }
}


function renderMinutesBlock() {
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

        const linkText = `${teamObj.teamName} minutes ${formattedDate}`;
        const url = `https://drive.google.com/file/d/${file.id}/view`;

        html += `<p style="margin-bottom: 15px;">
          <a href="${url}" target="_blank">${linkText}</a>
        </p>`;
      });

      html += `</ul></div>`;
      return html;
    } else {
      return `<p>No meeting minutes available for ${teamObj.teamName}</p>`;
    }
  } catch (e) {
    return `<p>Error: ${e.message}</p><p>No meeting minutes available for ${teamObj.teamName}</p>`;
  }
}



function renderOpsPlanBlock() {
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
      const linkText = `${teamObj.teamName} Operations Plan`;
      const url = `https://drive.google.com/file/d/${file.id}/view`;
      html += `<p style="margin-bottom: 10px;"><a href="${url}" target="_blank">${linkText}</a> (${formattedDate})</p></div>`;
      return html;
    } else {
      return `<p>No operations plan available for ${teamObj.teamName}</p>`;
    }
  } catch (e) {
    return `<p>Error: ${e.message}</p><p>No operations plan available for ${teamObj.teamName}</p>`;
  }
}

function getLatestMinutesFiles(folderId, maxFiles) {
  console.log(`getLatestMinutesFiles`);
  const teamPrefix = `${teamObj.shortName}_minutes`;
  console.log(`teamPrefix: ${teamPrefix}`);
  const response = Drive.Files.list({
    q: `'${folderId}' in parents and (mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='application/msword') and trashed=false and name contains '${teamPrefix}'`,
    orderBy: 'createdTime desc',
    maxResults: maxFiles,
    fields: 'files(id,name,createdTime,description)'
  });
  console.log('##########################');
  console.log(response);
  return response.files || response.items || [];
}

function getLatestOpsFile(folderId) {
  // console.log(`getLatestOpsFile`);
  const teamPrefix = `${teamObj.shortName}_ops`;
  // console.log(`teamPrefix: ${teamPrefix}`);
  const response = Drive.Files.list({
    q: `'${folderId}' in parents and (mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='application/msword') and trashed=false and name contains '${teamPrefix}'`,
    orderBy: 'createdTime desc',
    maxResults: 10, // get a few in case of false positives
    fields: 'files(id,name,createdTime,description)'
  });

  // Filter to the most recently created ops file
  const matchingFile = response.files.find(file => file.name.startsWith(teamPrefix));
  // console.log(matchingFile);
  return matchingFile || null; // Return the matching file or null if none found
}

function renderGoogleGroup() {
  const groupAddress = `https://groups.google.com/a/friendsofportlandnet.org/g/${teamObj.shortName}`;
  return `<p><a href=${groupAddress}>${teamObj.teamName} Google Group</a></p>`
}

function renderGoogleDrive() {
  console.log('renderGoogleDrive()');
  const driveURL = teamObj.teamDrive;
  if (driveURL) {
    return `<p><a href=${driveURL}>${teamObj.teamName} shared Drive</a> (access other team documents here)</p>`
  } else {
    return `<p>Shared drive for ${teamObj.teamName} has not been set up yet.`
  }
  
}

function getTeamLinks() {
  const sheet = teamSheet;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const teamIndex = headers.indexOf('Team');
  const urlIndex = headers.indexOf('Team page');

  const links = data.slice(1).map(row => ({
    name: row[teamIndex],
    url: row[urlIndex]
  }));

  return links;
}