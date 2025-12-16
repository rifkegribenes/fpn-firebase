let isAdmin, isTeamLead, isTeamPageEditor, teamObj = {};

// run this function from the script editor to grant oAuth scopes for different GWS assets (sendMail, access drive, groups, etc.)
function authorizeOnce() {
  DriveApp.getRootFolder();
}

function logSheetIds() {
  const spreadsheet = SpreadsheetApp.openById('1A5wqQoAZhgk6QLFB4_8stVZUMP7iHdTrQikEa4ur4go');
  const sheets = spreadsheet.getSheets();
  
  sheets.forEach(sheet => {
    Logger.log(`Name: ${sheet.getName()} | ID: ${sheet.getSheetId()}`);
  });
}

function logToSheet(entry) {
  try {
    const sheet = SpreadsheetApp.openById('1A5wqQoAZhgk6QLFB4_8stVZUMP7iHdTrQikEa4ur4go').getSheetByName('ServerLogs');
    sheet.appendRow([
      new Date(),
      entry.level || "",
      entry.where || "",
      entry.groupEmail || "",
      entry.userEmail || "",
      entry.message || "",
      entry.stack || ""
    ]);
  } catch (err) {
    Logger.log(`logToSheet() failed: ${err.message}`);
  }
}

function safeLog(where, level, message, extra = {}) {
    try {
      logToSheet({
        level,
        where,
        message,
        ...extra
      });
    } catch (err) {
      // swallow any logging errors
    }
  }

function toSpinalCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')      // Add space between camelCase
    .replace(/[\s_]+/g, '-')                  // Replace spaces and underscores with hyphens
    .toLowerCase();                           // Convert to lowercase
}

function testGroupCheck() {
  const user = "admin@friendsofportlandnet.org";
  Logger.log(checkGroupMembership(user));
}

// --- Configurable fallback lists ---
const ADMIN_EMAILS = [
  "admin@friendsofportlandnet.org", 
  "bec@friendsofportlandnet.org", 
  "carolyn@friendsofportlandnet.org", 
  "sarah1@friendsofportlandnet.org"
]; 
const TEAM_LEADS_EMAILS = [
  "tl.arbor@friendsofportlandnet.org",
  "tl.argay@friendsofportlandnet.org",
  "tl.arlington@friendsofportlandnet.org",
  "tl.arnold@friendsofportlandnet.org",
  "tl.askcreek@friendsofportlandnet.org",
  "tl.bwa@friendsofportlandnet.org",
  "tl.beh@friendsofportlandnet.org",
  "tl.brentwood@friendsofportlandnet.org",
  "tl.bridlemile@friendsofportlandnet.org",
  "tl.buckman@friendsofportlandnet.org",
  "tl.cathedral@friendsofportlandnet.org",
  "tl.centennial@friendsofportlandnet.org",
  "tl.collins@friendsofportlandnet.org",
  "tl.concordia@friendsofportlandnet.org",
  "tl.creston@friendsofportlandnet.org",
  "tl.cully@friendsofportlandnet.org",
  "tl.eastcolumbia@friendsofportlandnet.org",
  "tl.foster@friendsofportlandnet.org",
  "tl.goose@friendsofportlandnet.org",
  "tl.grant@friendsofportlandnet.org",
  "tl.hayden@friendsofportlandnet.org",
  "tl.hayhurst@friendsofportlandnet.org",
  "tl.hazellwood@friendsofportlandnet.org",
  "tl.hillsdale@friendsofportlandnet.org",
  "tl.hillside@friendsofportlandnet.org",
  "tl.hollywood@friendsofportlandnet.org",
  "tl.homestead@friendsofportlandnet.org",
  "tl.hosford@friendsofportlandnet.org",
  "tl.irvington@friendsofportlandnet.org",
  "tl.kerns@friendsofportlandnet.org",
  "tl.king@friendsofportlandnet.org",
  "tl.kingsgate@friendsofportlandnet.org",
  "tl.laurelhurst@friendsofportlandnet.org",
  "tl.lents@friendsofportlandnet.org",
  "tl.linnton@friendsofportlandnet.org",
  "tl.lloyd@friendsofportlandnet.org",
  "tl.madison@friendsofportlandnet.org",
  "tl.maplewood@friendsofportlandnet.org",
  "tl.markham@friendsofportlandnet.org",
  "tl.marshall@friendsofportlandnet.org",
  "tl.mtscott@friendsofportlandnet.org",
  "tl.multnomah@friendsofportlandnet.org",
  "tl.northportland@friendsofportlandnet.org",
  "tl.northwest@friendsofportlandnet.org",
  "tl.northwestindustrial@friendsofportlandnet.org",
  "tl.oldtown@friendsofportlandnet.org",
  "tl.overlook@friendsofportlandnet.org",
  "tl.parkrose@friendsofportlandnet.org",
  "tl.pearl@friendsofportlandnet.org",
  "tl.piedmont@friendsofportlandnet.org",
  "tl.pleasant@friendsofportlandnet.org",
  "tl.downtown@friendsofportlandnet.org",
  "tl.portsmouth@friendsofportlandnet.org",
  "tl.reed@friendsofportlandnet.org",
  "tl.richmond@friendsofportlandnet.org",
  "tl.riverdale@friendsofportlandnet.org",
  "tl.rosecity@friendsofportlandnet.org",
  "tl.roseway@friendsofportlandnet.org",
  "tl.russell@friendsofportlandnet.org",
  "tl.sabin@friendsofportlandnet.org",
  "tl.sellwood@friendsofportlandnet.org",
  "tl.southburlingame@friendsofportlandnet.org",
  "tl.southportland@friendsofportlandnet.org",
  "tl.southwaterfront@friendsofportlandnet.org",
  "tl.southwesthills@friendsofportlandnet.org",
  "tl.stjohns@friendsofportlandnet.org",
  "tl.sullivans@friendsofportlandnet.org",
  "tl.sumner@friendsofportlandnet.org",
  "tl.sunderland@friendsofportlandnet.org",
  "tl.sunnyside@friendsofportlandnet.org",
  "tl.sylvan@friendsofportlandnet.org",
  "tl.taborvilla@friendsofportlandnet.org",
  "tl.westsideheights@friendsofportlandnet.org",
  "tl.wilkes@friendsofportlandnet.org",
  "tl.woodstock@friendsofportlandnet.org"
];

const membershipCache = {};

function checkGroupMembership(groupEmail, userEmail) {
  const key = `${groupEmail}:${userEmail}`;
  if (membershipCache.hasOwnProperty(key)) return membershipCache[key];

  let result = false;
  if (groupEmail === ADMIN_GROUP_EMAIL) {
    result = ADMIN_EMAILS.includes(userEmail);
  } else if (groupEmail === TEAM_LEADS_GROUP_EMAIL) {
    result = TEAM_LEADS_EMAILS.includes(userEmail) || (userEmail.includes("tl.") && userEmail.includes("friendsofportlandnet.org"));
  } else {
    try {
      const member = AdminDirectory.Members.get(groupEmail, userEmail);
      result = member && member.status === "ACTIVE";
    } catch (err) {
      const msg = err.message || "";
      if (
        msg.includes("Resource Not Found") ||
        msg.includes("memberKey") ||
        msg.includes("not a member") ||
        msg.includes("Invalid Input")
      ) {
        logToSheet({level: "warn", where:"checkGroupMembership", groupEmail, userEmail, message: `Not a member (handled gracefully): ${msg}`});
        result = false;
      } else {
        logToSheet({level: "error", where:"checkGroupMembership", groupEmail, userEmail, message: `API error: ${msg}`, stack: err.stack});
        result = false;
      }
    }
  }

  membershipCache[key] = result;
  return result;
}

function getRecentAnnouncements(teamObj) {
  if (!teamObj) {
    safeLog('getRecentAnnouncements', 'error', `186: no team object sent to getRecentAnnouncements`);
    return;
  }
  const data = updatesSheet.getDataRange().getValues();

  // Get header indexes
  const headers = data[0];
  const TIMESTAMP_COL = headers.indexOf('Timestamp');
  const UPDATE_TYPE_COL = headers.indexOf('What do you want to update?');
  const TITLE_COL = headers.indexOf('Announcement Title');
  const BODY_COL = headers.indexOf('Announcement Body');
  const TEAM_COL = headers.indexOf('Your Team');
  const ID_COL = headers.indexOf('Id');
  const EDIT_URL_COL = headers.indexOf('Edit URL');
  const DELETE_URL_COL = headers.indexOf('Delete URL');

  if (TIMESTAMP_COL === -1 || UPDATE_TYPE_COL === -1 || TITLE_COL === -1 || BODY_COL === -1 || TEAM_COL === -1, EDIT_URL_COL === -1, DELETE_URL_COL === -1) {
    throw new Error("Required columns are missing from the update your team page sheet.");
  }

  // Filter rows where 'What do you want to update?' includes'announcement' and team matches function input
  const announcementRows = data.slice(1).filter(row => {
    return row[UPDATE_TYPE_COL].includes('announcement') && row[TEAM_COL] === teamObj.teamName;
  });

  safeLog('_Helpers: getRecentAnnouncements', 'info', `${teamObj.teamName} announcemntRows: ${announcementRows.length}`);

  // Sort by Timestamp descending
  announcementRows.sort((a, b) => {
    return new Date(b[TIMESTAMP_COL]) - new Date(a[TIMESTAMP_COL]);
  });

  // Get the top 3 announcements
  // deleteURL is set in the formResponseHandler attached to the team page update form: 
  // https://script.google.com/u/0/home/projects/1xWX3LCTgnR5oa0xSbH57MNif6BVLTtQnjpe7WmfSdcbstiXy6T5eCxoV/edit
  // onFormSubmitHandler
  const recentAnnouncements = announcementRows.slice(0, 3).map(row => {
    return {
      id: row[ID_COL],
      timestamp: new Date(row[TIMESTAMP_COL]),
      title: row[TITLE_COL],
      body: row[BODY_COL],
      editURL: row[EDIT_URL_COL],
      deleteURL: row[DELETE_URL_COL]
    };
  });
  // Logger.log(recentAnnouncements);
  return recentAnnouncements;
}

function renameFile(team, file, fileType, meetingDate) {
  Logger.log('####################   renameFile');
  safeLog('renameFile', 'info', `230: team: ${team}, file: ${file}, fileType: ${fileType}, meetingDate: ${meetingDate},`);
  // Only touch recently added files (e.g. last 60 seconds)
  const created = file.getDateCreated();
  const now = new Date();
  const ageInSeconds = (now - created) / 1000;
  // Logger.log(`ageInSeconds: ${ageInSeconds}`);

  const mtgDate = meetingDate ? formatDateFileName(new Date(meetingDate)) : null;
  Logger.log(`mtgDate: ${mtgDate}`);

  if (ageInSeconds < 60) {
    // Logger.log(`ageInSeconds < 60`);
    Logger.log('renameFile');
    const originalName = file.getName();
    let newName = '';
    if (mtgDate) {
      newName = `${team}_${fileType}_${mtgDate}_${originalName}`;
    } else {
      newName = `${team}_${fileType}_${originalName}`;
    }
    // Logger.log(`originalName: ${originalName}`);
    // Logger.log(`newName: ${newName}`);
    safeLog('renameFile', 'info', `originalName: ${originalName}, newName: ${newName}, team: ${team}`);
    file.setName(newName);
    file.setDescription(team);
    // Logger.log(`file description: *********************`);
    // Logger.log(file.getDescription());
    // Logger.log(`mtgDate: ${mtgDate}`);
    if (mtgDate) {
      let currentDesc = file.getDescription() || "";
      currentDesc = currentDesc += `,${mtgDate}`;
      file.setDescription(currentDesc);
      Logger.log(`file description with mtgDate:`);
      Logger.log(file.getDescription());
      safeLog('renameFile', 'info', `mtgDate: ${mtgDate}, file description: ${file.getDescription()}`);
    }
  } else {
    Logger.log(`skipping older file ${ageInSeconds}`);
  }
}


function getLatestMinutesFiles(teamObj, folderId, maxFiles) {
  Logger.log(`getLatestMinutesFiles`);
  if (!teamObj) { 
    safeLog('getLatestMinutesFiles', 'error', `279 no team object provided to getLatestMinutesFiles`);
    return;
  }  
  Logger.log(`getLatestMinutesFiles`);
  const teamPrefix = `${teamObj.shortName}_minutes`;
  Logger.log(`teamPrefix: ${teamPrefix}`);
  safeLog('getLatestMinutesFiles', 'info', `teamObj: ${teamObj}, folderId: ${folderId}, maxFiles: ${maxFiles}, teamPrefix: ${teamPrefix}`);
  const response = Drive.Files.list({
    q: `'${folderId}' in parents and (mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='application/msword') and trashed=false and name contains '${teamPrefix}'`,
    orderBy: 'createdTime desc',
    maxResults: maxFiles,
    fields: 'files(id,name,createdTime,description)'
  });
  Logger.log('##########################');
  Logger.log(response);
  safeLog('getLatestMinutesFiles', 'info', `response: ${response}, response.items: ${response.items}`);
  return response.files || response.items || [];
}

function getLatestOpsFile(teamObj, folderId) {
  // Logger.log(`getLatestOpsFile`);
  const teamPrefix = `${teamObj.shortName}_ops`;
  // Logger.log(`teamPrefix: ${teamPrefix}`);
  const response = Drive.Files.list({
    q: `'${folderId}' in parents and (mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='application/msword') and trashed=false and name contains '${teamPrefix}'`,
    orderBy: 'createdTime desc',
    maxResults: 10, // get a few in case of false positives
    fields: 'files(id,name,createdTime,description)'
  });

  // Filter to the most recently created ops file
  const matchingFile = response.files.find(file => file.name.startsWith(teamPrefix));
  // Logger.log(matchingFile);
  return matchingFile || null; // Return the matching file or null if none found
}


/**
 * Get the latest banner for a team from a 2D sheet array.
 * 
 * @param {Array[]} values - 2D array from the sheet (including header row).
 * @param {string} team - team name to match.
 * @returns {{ fileUrl: string, altText: string } | null}
 */
function getBanner(teamObj) {
  safeLog('getBanner', 'info', `teamObj.shortName: ${teamObj.shortName}, teamObj.teamName: ${teamObj.teamName}`);
  const values = updatesSheet.getDataRange().getValues();
  if (!values || values.length === 0) return null;

  const headers = values[0];
  const rows = values.slice(1);

  // Column indices
  const tsCol = headers.indexOf("Timestamp");
  const teamCol = headers.indexOf("Your Team");
  const urlCol = headers.indexOf("BannerPublicURL");
  const altCol = headers.indexOf("Image alt text (brief image description for screen readers)");

  if (tsCol < 0 || teamCol < 0 || urlCol < 0 || altCol < 0) {
    safeLog('getBanner', 'error', `"Missing required column(s) in sheet`);
    console.error("Missing required column(s) in sheet");
    return null;
  }

  // Filter rows for this team with a BannerPublicURL
  const matches = rows.filter(row =>
    (row[teamCol] || "").trim() === teamObj.teamName &&
    (row[urlCol] || "").toString().trim() !== ""
  );

  if (matches.length === 0) return null;

  // Sort by timestamp desc
  matches.sort((a, b) => new Date(b[tsCol]) - new Date(a[tsCol]));

  const latest = matches[0];

  safeLog('getBanner', 'info', `latest: ${latest}`);

  return {
    fileUrl: latest[urlCol],
    altText: latest[altCol] || ""
  };
}


function getTeamLinks() {
  safeLog('getTeamLinks', 'info', `function called`);
  const sheet = teamSheet;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const teamIndex = headers.indexOf('Team');
  const shortNamIndex = headers.indexOf('Short name');

  const links = data.slice(1).map(row => ({
    name: row[teamIndex],
    shortName: row[shortNamIndex]
  }));
  safeLog('getTeamLinks', 'info', `${links}`);
  return links;
}

const SheetCache = (() => {
  let idToSheetMap = null;

  function buildCache() {
    const spreadsheet = SpreadsheetApp.openById('1A5wqQoAZhgk6QLFB4_8stVZUMP7iHdTrQikEa4ur4go');
    const sheets = spreadsheet.getSheets();
    idToSheetMap = {};
    sheets.forEach(sheet => {
      idToSheetMap[sheet.getSheetId()] = sheet;
    });
  }

  return {
    getSheetById: function(sheetId) {
      if (!idToSheetMap) {
        buildCache();
      }

      const sheet = idToSheetMap[sheetId];
      if (!sheet) {
        throw new Error(`No sheet found with ID ${sheetId}`);
      }
      return sheet;
    },

    // Optional: Reset cache manually if needed
    clearCache: function() {
      idToSheetMap = null;
    }
  };
})();

function showLinkedFormUrl() {
  const url = ss.getFormUrl(); // null if no assigned form
  Logger.log(url || 'No form assigned to this spreadsheet.');
}

function logAccess(email, params) {
  const sheet = LOGSHEET.getSheetByName('Access');
  sheet.appendRow([new Date(), email, JSON.stringify(params)]);
}

function formatDate(date) {
  const normalizedDate = normalizeSheetDate(date);
  return Utilities.formatDate(normalizedDate, Session.getScriptTimeZone(), "MMM d, yyyy");
}

function formatDateFileName(date) {
  const normalizedDate = normalizeSheetDate(date);
  return Utilities.formatDate(normalizedDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function normalizeSheetDate(sheetDate) {
  const timeZone = Session.getScriptTimeZone();  // e.g., "America/Los_Angeles"
  const year = Utilities.formatDate(sheetDate, timeZone, 'yyyy');
  const month = Utilities.formatDate(sheetDate, timeZone, 'MM');
  const day = Utilities.formatDate(sheetDate, timeZone, 'dd');

  // Create a new Date using local time
  return new Date(Number(year), Number(month) - 1, Number(day));
}


function getEditUrlFromSheet() {
  const editUrl = ss.getFormUrl(); // null if no assigned form
  Logger.log(editUrl || 'No form assigned');
}

// adds checkbox to column A
function onFormSubmitHandler(e) {
  const sheet = e.source.getActiveSheet();
  const lastRow = sheet.getLastRow();
  const checkboxCol = 1; // Column A

  const checkboxCell = sheet.getRange(lastRow, checkboxCol);
  
  // Only set value to false (unchecked); assumes cell already formatted as checkbox
  if (checkboxCell.getValue() === '') {
    checkboxCell.setValue(false);
  }
}

/** takes a team name OR short name as input,
   * returns an object containing all other fields in the lookup sheet as output
   * 
   * */
function globalLookup(team) {
  Logger.log('globalLookup');
  Logger.log(`team: ${team}`);

  // if there's no team input, the function doesn't run
    if (!team) {
      Logger.log('no team provided');
      return null;
    }

  // find header and rows in team lookup sheet
  const tmHeaders = [ ...readSheet_(teamSheet).headers ];
  const tmRows = [ ...readSheet_(teamSheet).rows ];

  // identify the indices (position in the row array) for each of the field names we care about in the team lookup sheet
  const sIdx = tmHeaders.indexOf('Short name');
  const tIdx = tmHeaders.indexOf('Team');
  const eIdx = tmHeaders.indexOf('Team Group Email');
  const pIdx = tmHeaders.indexOf('Team page');
  const dIdx = tmHeaders.indexOf('District');
  const lIdx = tmHeaders.indexOf('Team Lead email');
  const aIdx = tmHeaders.indexOf('Assigned to (name)');
  const aeIdx = tmHeaders.indexOf('Alt email');
  const cIdx = tmHeaders.indexOf('Team calendar link');
  const drIdx = tmHeaders.indexOf('Team drive link');

  // if those field headers don't exist, the function doesn't work; throw error
  const indices = {
    sIdx,
    tIdx,
    eIdx,
    pIdx,
    dIdx,
    lIdx,
    aIdx,
    aeIdx,
    cIdx,
    drIdx
  };

  if (Object.values(indices).some(value => value === -1)) {
    throw new Error("TeamLookup sheet is missing required headers");
  }

  // for (const [name, value] of Object.entries(indices)) {
  //   Logger.log(`${name}: ${value}`);
  // }

  // loop through the rows in the location lookup sheet
  // in each row, check to see if the team value sent to the function matches the team in that row,
  // in EITHER the short name or team columns
  for (let r of tmRows ) {
    // check for team match
    // Logger.log(String(r[tIdxL]).trim().toLowerCase(), team.trim().toLowerCase());
    if (String(r[tIdx]).trim().toLowerCase() === team.trim().toLowerCase() ||
      String(r[sIdx]).trim().toLowerCase() === team.trim().toLowerCase()  ) {

      // if we find a match, save the rest of the values to an object and return the object
      const shortName = String(r[sIdx] || '').trim();
      const teamName = String(r[tIdx] || '').trim();
      const groupEmail = String(r[eIdx] || '').trim();
      const teamPage = String(r[pIdx] || '').trim();
      const district = String(r[dIdx] || '').trim();
      const tlEmail = String(r[lIdx] || '').trim();
      const tlAssigned = !!r[aIdx] && !!r[aeIdx]; // team lead is assigned if values in these two columns are not blank
      const tlName = String(r[aIdx] || '').trim();
      const teamCal = String(r[cIdx] || '').trim();
      const teamDrive = String(r[drIdx] || '').trim();
      const teamObj = {
        shortName,
        teamName,
        groupEmail,
        teamPage,
        district,
        tlEmail,
        tlAssigned,
        tlName,
        teamCal,
        teamDrive
      };
      Logger.log(teamObj);
      return teamObj;
    }
  }
}

/** takes a neighborhood as input,
   * returns an object containing a group name, team page URL, team calendar link, and an array of team lead names and emails as output 
   * 
   * returnObj: {
   *  group: 'testteam@friendsofportlandnet.org',
   *  team: 'teamName',
   *  teamPageURL: 'https://sites.google.com/view/fpn/testteam',
   *  teamCalendar: 'https://calendar.google.com/calendar/u/0/embed?color=%23cabdbf&src=c_e33f3b624ab1918a14909f825850c630ac8db222a4459c2b80643c03930d856c@group.calendar.google.com'
   *  teamLeadEmail: 'tl.bwa@friendsofportlandnet.org'
   *  teamLeadName: 'Bec Lawson'
   * }
   * 
   * */
function teamLookup(neighborhood) {
  Logger.log(`neighborhood: ${neighborhood}`);
    // if there's no neighborhood input, the function doesn't run
    if (!neighborhood) {
      Logger.log('no neighborhood provided');
      return null;
    }   
      // find header and rows in neighborhood lookup sheet
      const locHeaders = [ ...readSheet_(locSheet).headers ];
      const locRows = [ ...readSheet_(locSheet).rows ];

      // find header and rows in master members sheet
      const mbrHeaders = [ ...readSheet_(membersSheet).headers ];
      const mbrRows = [ ...readSheet_(membersSheet).rows ];

      // find header and rows in team lookup sheet
      const tHeaders = [ ...readSheet_(teamSheet).headers ];
      const tRows = [ ...readSheet_(teamSheet).rows ];

      // get teamShortName from neighborhood

      // identify the indices (position in the row array) for each of the field names we care about in the neighborhood lookup sheet
      const nIdx = locHeaders.indexOf('Neighborhood');
      const sIdxN = locHeaders.indexOf('Short name');

      // if those field headers don't exist, the function doesn't work; throw error
      if (nIdx === -1 || sIdxN === -1) {
        throw new Error(`NeighborhoodLookup must have headers "Neighborhood" and "Short name"`);
      }
      // identify the indices (position in the row array) for each of the field names we care about in the team lookup sheet
      const tIdx = tHeaders.indexOf('Team');
      const sIdxT = tHeaders.indexOf('Short name')
      const gIdx = tHeaders.indexOf('Team Group Email');
      const tpIdx = tHeaders.indexOf('Team page');
      const cIdx = tHeaders.indexOf('Team calendar link');
      const tleIdx = tHeaders.indexOf('Team Lead email');
      const tlaIdx = tHeaders.indexOf('Assigned to (name)');

      // if those field headers don't exist, the function doesn't work; throw error
      if (tIdx === -1 || sIdxT === -1 || gIdx === -1 || tpIdx === -1 || cIdx === -1, tleIdx === -1, tlaIdx === -1) {
        throw new Error(`TeamLookup must have headers "Team, "Short name", "Team Group Email", "Team calendar link", "Team page", and "Team Lead email"`);
      }
      Logger.log('246');
      // declare the return object and leads array as empty variables
      const returnObj = {};

      // loop through the rows in the location lookup sheet
      // in each row, check to see if the neighborhood value passed to this function
      // matches the neighborhood value in that row

      let teamShortName;
      locRows.forEach((r, i) => {
        if (String(r[nIdx]).trim() === neighborhood) {

          // if we find a match on neighborhood, get the teamShortName to send to the next lookup function
          Logger.log(`shortName: ${r[sIdxN]}`);
          teamShortName = r[sIdxN]
        }
      });

      // loop through the rows in the team lookup sheet
      // in each row, check to see if the team short name value 
      // matches the short name in that row

      for (const r of tRows) {
        // Logger.log(String(r[sIdxT]).trim().toLowerCase(), teamShortName.trim().toLowerCase());
        if (String(r[sIdxT]).trim().toLowerCase() === teamShortName.trim().toLowerCase()) {
          // Logger.log('MATCH: 279');
        // gather the group email, team name, calendar link, and team page URL from that row
          const group = String(r[gIdx] || '').trim();
          const team = String(r[tIdx] || '').trim();
          const teamPageURL = String(r[tpIdx] || '').trim();
          const teamCalendar = String(r[cIdx] || '').trim();
          // check if the 'team lead email assigned' column is filled
          // if so, return the teamLeadEmail; otherwise return null
          // Logger.log(`is the ${team} team email assigned? ${!!r[tlaIdx]}`)
          teamLeadEmail = !!r[tlaIdx] ?  String(r[tleIdx]) : null;
          const teamLeadName = teamLeadEmail ? String(r[tlaIdx] || '').trim() : null;
          // Logger.log(`teamLeadEmail: ${teamLeadEmail}, teamLeadName: ${teamLeadName}`);

          // store those values in the return object
          returnObj.group = group;
          returnObj.team = team;
          returnObj.teamPageURL = teamPageURL;
          returnObj.teamCalendar = teamCalendar;
          returnObj.teamLeadEmail = teamLeadEmail;
          returnObj.teamLeadName = teamLeadName;

          Logger.log(`############################### returnObj`);
          Logger.log(returnObj);

          if (!returnObj.teamLeadName) {
            Logger.log(`no team lead found for ${returnObj.team}`);
          }

          return returnObj;
          break;
        }

      };
      // Logger.log('304');
    } 


function readSheet_(sheet) {
  if (!sheet) {
    Logger.log(`no sheet provided to readSheet`);
    return null;
  }
  try {
    const rng = sheet.getDataRange();
    const values = rng.getValues();
    if (values.length === 0) return { headers: [], rows: [] };
    const headers = values[0].map(v => String(v).trim());
    const rows = values.slice(1);
    return { headers, rows };
  } catch (err) {
    Logger.log(`error in readSheet: ${err}`);
  }
  
}

/** Idempotent add: checks membership first; uses AdminDirectory for reliability */
function addToGroupIdempotent_(groupEmail, userEmail) {
  const groupKey  = (groupEmail  || '').trim();
  const memberKey = (userEmail || '').trim();
  if (!groupKey || !memberKey) throw new Error('groupKey and memberKey are required');

  // Check membership (Admin SDK returns 404 if not found)
  let isMember = false;
  try {
    AdminDirectory.Members.get(groupKey, memberKey);
    isMember = true;
  } catch (err) {
    if (err && err.message && err.message.indexOf('Not Found') >= 0) {
      isMember = false;
    } else {
      // If it's a different error (e.g., forbidden), surface it
      Logger.log(err);
    }
  }

  if (isMember) {
    Logger.log(`OK: ${userEmail} already in ${groupEmail}`);
    return;
  }

  // Insert as MEMBER (not OWNER/MANAGER)
  const member = {
    email: userEmail,
    role: 'MEMBER',   // MEMBER | MANAGER | OWNER
    delivery_settings: 'ALL_MAIL' // optional
  };

  const res = AdminDirectory.Members.insert(member, groupEmail);
  Logger.log(`ADDED: ${userEmail} → ${groupEmail} (${res.status || 'ok'})`);
}

/** now idempotent: checks for matching email address in target sheet and updates existing if finds match */
function copyRowToAnotherSheet(sourceSheet, targetSheet) {

  Logger.log(`copyRowToAnotherSheet`);
  
  // Get the header row from the source sheet (assuming headers are in the first row)
  const sourceHeaders = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
  
  // Get the active row number in the source sheet (the row you want to copy)
  const activeRow = sourceSheet.getActiveCell().getRow();
  
  // Get the data from the active row in the source sheet
  const sourceRowData = sourceSheet.getRange(activeRow, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
  
  // Get the header row from the target sheet (assuming headers are also in the first row of the target sheet)
  const targetHeaders = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
  
  // Create an empty array to store the row data in the order of the target sheet headers
  const targetRowData = new Array(targetHeaders.length).fill(""); // Empty array to match the number of target columns
  
  // identify the index (position in the row array) of the email column in each sheet
  const eIdxT = targetHeaders.indexOf('Email');
  const eIdxS = sourceHeaders.indexOf('Email');

  // save the email from the source row to a variable
  const sourceEmail = sourceRowData[eIdxS];
  Logger.log(`sourceEmail: ${sourceEmail}`);

  // Loop through the source headers and match with the target headers
  for (var i = 0; i < sourceHeaders.length; i++) {
    const sourceHeader = sourceHeaders[i];
    
    // Check if the source header matches any header in the target sheet
    const targetIndex = targetHeaders.indexOf(sourceHeader);
    
    // If there's a match, copy the source row data to the correct column in the target row
    if (targetIndex !== -1) {
      targetRowData[targetIndex] = sourceRowData[i];
    }
  }

  // Before adding the row, search the target sheet for a record matching the new row on email address
  const targetRows = [ ...readSheet_(targetSheet).rows ];

  let match = false; // setting this variable so we can test whether a match was found later

  // loop through the rows in the target sheet
      // in each row, check to see if the email matches the email in the form submission
      for (const [rIdxT, r] of targetRows.entries() ) {
        if (String(r[eIdxT]).trim() === sourceEmail) {
          Logger.log(`match found: row ${rIdxT + 2}, ${r[eIdxT]}`);
          // if we find a match, UPDATE this row with values from the form submission instead of adding a new row
          // Set the target row data in the next available row in the target sheet
          // add two to index because array is zero-indexed and we exclude the header row
          targetSheet.getRange(rIdxT + 2, 1, 1, targetRowData.length).setValues([targetRowData]);
          Logger.log('found match, aborting loop and returning');
          match = true;
          break;
        }
      }
  Logger.log(`match: ${match}`);
  if (!match) {
    Logger.log('no match; adding new row');
    // If no match, find the next empty row in the target sheet to paste the data
    const nextRow = targetSheet.getLastRow() + 1;
    
    // Set the target row data in the next available row in the target sheet
    targetSheet.getRange(nextRow, 1, 1, targetRowData.length).setValues([targetRowData]);
  }
  
}

function whoRunsMe() {
  Logger.log('Effective user: ' + Session.getEffectiveUser().getEmail());
}

function testHasMember() {
  const group = 'all-members@friendsofportlandnet.org';
  const user  = 'sarah1@friendsofportlandnet.org';
  // Optional third arg to include nested (derived) membership
  const res = AdminDirectory.Members.hasMember(group, user, {
    includeDerivedMembership: true
  });
  Logger.log(res.isMember); // true/false
}

function renderTemplate_(fileName, obj) {
  Logger.log('renderTemplate');
  Logger.log(`fileName: ${fileName}`);
  let t;
  try {
    t = HtmlService.createTemplateFromFile(fileName);
  } catch(err) {
    Logger.log(`renderTemplate_ 454: ${err}`);
  }
  try {
    Object.assign(t, obj);
  } catch(err) {
    Logger.log(`renderTemplate_ 459: ${err}`);
  }
  let html;
  try {
    html = t.evaluate().getContent(); // full HTML string
  } catch(err) {
    Logger.log(`renderTemplate_ 464: ${err}`)
  }
  return html
}

function deleteFormResponse(responseId) {
  Logger.log('deleteFormResponse');
  try {
    const form = FormApp.openById('1SE1N04H87kckCEZdiF56Nq9U5IoH5oSxUMGevqK7LFk');
    Logger.log(`form: ${form}`);
    form.deleteResponse(responseId); // Delete the actual form response

    // Open the sheet and get data
    const sheet = updatesSheet;
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) return false; // No data beyond header

    // Find the column index where the header is "Id"
    const headers = data[0];
    const idColIndex = headers.indexOf('Id');
    if (idColIndex === -1) {
      Logger.log('Id column not found in header row.');
      return false;
    }

    // Find and delete the row where responseId matches
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColIndex] === responseId) {
        sheet.deleteRow(i + 1); // +1 to skip header
        Logger.log(`deleted row ${i +1}`);
        break;
      }
    }

    return true;
  } catch (err) {
    Logger.log('Error deleting response: ' + err);
    return false;
  }
}

function deleteBanner(fileUrl) {
  const sheet = updatesSheet;
  const data = sheet.getDataRange().getValues();
  let found = false;

  for (let i = data.length - 1; i >= 1; i--) { // skip header row
    if (data[i].includes(fileUrl)) {
      sheet.deleteRow(i + 1); // Sheet rows are 1-indexed
      Logger.log(`Deleted row ${i + 1} containing ${fileUrl}`);
      found = true;
    }
  }

  return found; 
}

