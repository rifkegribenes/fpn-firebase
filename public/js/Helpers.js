// run this function from the script editor to grant oAuth scopes for different GWS assets (sendMail, access drive, groups, etc.)
function authorizeOnce() {
  DriveApp.getRootFolder();
}

function logSheetIds() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = spreadsheet.getSheets();
  
  sheets.forEach(sheet => {
    Logger.log(`Name: ${sheet.getName()} | ID: ${sheet.getSheetId()}`);
  });
}

function toSpinalCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')      // Add space between camelCase
    .replace(/[\s_]+/g, '-')                  // Replace spaces and underscores with hyphens
    .toLowerCase();                           // Convert to lowercase
}

const SheetCache = (() => {
  let idToSheetMap = null;

  function buildCache() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
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
  console.log('globalLookup');
  console.log(`team: ${team}`);

  // if there's no team input, the function doesn't run
    if (!team) {
      console.log('no team provided');
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
  //   console.log(`${name}: ${value}`);
  // }

  // loop through the rows in the location lookup sheet
  // in each row, check to see if the team value sent to the function matches the team in that row,
  // in EITHER the short name or team columns
  for (let r of tmRows ) {
    // check for team match
    // console.log(String(r[tIdxL]).trim().toLowerCase(), team.trim().toLowerCase());
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
        teamCal,
        teamDrive
      };
      console.log(teamObj);
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
  console.log(`neighborhood: ${neighborhood}`);
    // if there's no neighborhood input, the function doesn't run
    if (!neighborhood) {
      console.log('no neighborhood provided');
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
      console.log('246');
      // declare the return object and leads array as empty variables
      const returnObj = {};

      // loop through the rows in the location lookup sheet
      // in each row, check to see if the neighborhood value passed to this function
      // matches the neighborhood value in that row

      let teamShortName;
      locRows.forEach((r, i) => {
        if (String(r[nIdx]).trim() === neighborhood) {

          // if we find a match on neighborhood, get the teamShortName to send to the next lookup function
          console.log(`shortName: ${r[sIdxN]}`);
          teamShortName = r[sIdxN]
        }
      });

      // loop through the rows in the team lookup sheet
      // in each row, check to see if the team short name value 
      // matches the short name in that row

      for (const r of tRows) {
        // console.log(String(r[sIdxT]).trim().toLowerCase(), teamShortName.trim().toLowerCase());
        if (String(r[sIdxT]).trim().toLowerCase() === teamShortName.trim().toLowerCase()) {
          // console.log('MATCH: 279');
        // gather the group email, team name, calendar link, and team page URL from that row
          const group = String(r[gIdx] || '').trim();
          const team = String(r[tIdx] || '').trim();
          const teamPageURL = String(r[tpIdx] || '').trim();
          const teamCalendar = String(r[cIdx] || '').trim();
          // check if the 'team lead email assigned' column is filled
          // if so, return the teamLeadEmail; otherwise return null
          // console.log(`is the ${team} team email assigned? ${!!r[tlaIdx]}`)
          teamLeadEmail = !!r[tlaIdx] ?  String(r[tleIdx]) : null;
          const teamLeadName = teamLeadEmail ? String(r[tlaIdx] || '').trim() : null;
          // console.log(`teamLeadEmail: ${teamLeadEmail}, teamLeadName: ${teamLeadName}`);

          // store those values in the return object
          returnObj.group = group;
          returnObj.team = team;
          returnObj.teamPageURL = teamPageURL;
          returnObj.teamCalendar = teamCalendar;
          returnObj.teamLeadEmail = teamLeadEmail;
          returnObj.teamLeadName = teamLeadName;

          console.log(`############################### returnObj`);
          console.log(returnObj);

          if (!returnObj.teamLeadName) {
            console.log(`no team lead found for ${returnObj.team}`);
          }

          return returnObj;
          break;
        }

      };
      // console.log('304');
    } 


function readSheet_(sheet) {
  if (!sheet) {
    console.log(`no sheet provided to readSheet`);
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
    console.log(`error in readSheet: ${err}`);
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

  console.log(`copyRowToAnotherSheet`);
  
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
  console.log(`sourceEmail: ${sourceEmail}`);

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
          console.log(`match found: row ${rIdxT + 2}, ${r[eIdxT]}`);
          // if we find a match, UPDATE this row with values from the form submission instead of adding a new row
          // Set the target row data in the next available row in the target sheet
          // add two to index because array is zero-indexed and we exclude the header row
          targetSheet.getRange(rIdxT + 2, 1, 1, targetRowData.length).setValues([targetRowData]);
          console.log('found match, aborting loop and returning');
          match = true;
          break;
        }
      }
  console.log(`match: ${match}`);
  if (!match) {
    console.log('no match; adding new row');
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
  console.log('renderTemplate');
  console.log(`fileName: ${fileName}`);
  let t;
  try {
    t = HtmlService.createTemplateFromFile(fileName);
  } catch(err) {
    console.log(`renderTemplate_ 454: ${err}`);
  }
  try {
    Object.assign(t, obj);
  } catch(err) {
    console.log(`renderTemplate_ 459: ${err}`);
  }
  let html;
  try {
    html = t.evaluate().getContent(); // full HTML string
  } catch(err) {
    console.log(`renderTemplate_ 464: ${err}`)
  }
  return html
}

function deleteFormResponse(responseId) {
  console.log('deleteFormResponse');
  try {
    const form = FormApp.openById('1SE1N04H87kckCEZdiF56Nq9U5IoH5oSxUMGevqK7LFk');
    console.log(`form: ${form}`);
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
        console.log(`deleted row ${i +1}`);
        break;
      }
    }

    return true;
  } catch (err) {
    Logger.log('Error deleting response: ' + err);
    return false;
  }
}
