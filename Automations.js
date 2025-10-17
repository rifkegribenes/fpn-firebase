/** onEditHandler triggers the processNewNET script when a row in the WorkspaceRegForm sheet is edited, IF the edit sets the 'Processed' checkbox to true */ 

function onEditHandler(e) {
  console.log('onEdit');
  if (!e) return;
  const ssActive = e.source;  
  const sh = ssActive.getActiveSheet();

  if (sh.getName() !== 'WorkspaceRegForm') return;   
  if (e.range.getColumn() !== 1) return;       // column A = 1
  if (e.range.getRow() < 2) return;            // skip header
  if (e.value !== 'TRUE') return;              // only when box is checked

  try {
    // console.log('row:');
    // console.log(e.range.getRow()); // this is a row number, not the row data
    processNewNET(e.range.getRow(), ssActive, sh);
  } finally {
    /** to reset the checkbox after the script runs, uncomment the row below this comment. for now it leaves the box checked so we can see who has been processed, and admins can manually uncheck/recheck the box if a row needs to be reprocessed for any reason */ 

    // e.range.setValue(false);
  }
}


/**  processNewNET does 3 things:
  1. copy row to master DB sheet (row containing the new record that has just been manually confirmed)
  2. trigger onboarding email to new member, cc-ing team lead 
  3. add member to appropriate google groups based on team */

function processNewNET(row, ss, sh) {
  console.log('processNewNET:')
  // this function is triggered when an admin clicks the checkbox in the 'Processed' column (column A)

  // step 1: copy values from the selected row in formResponses into the membersMaster sheet, matching on column headers
  // first function parameter = source sheet, second parameter = target sheet

  copyRowToAnotherSheet(sh, ss.getSheetByName('MasterMembers'));

  // step 2: trigger onboarding emails

  // gather data for inserting into template
  // find the row data from the newly-processed row
  const rowData = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];

  // finding the headers for the form responses sheet
  const { headers } = readSheet_(ss.getSheetByName('WorkspaceRegForm'));

  // assign value to role variable
  const role = (rowData[headers.indexOf('Role')] || '').trim();

  // assign value to memberName variable
  const memberName = (rowData[headers.indexOf('First Name')] || '').trim();

  // assign value to memberEmail variable
  const memberEmail = (rowData[headers.indexOf('Email')] || '').trim();

  // assign value to neigbhorhood variable
  const neighborhood = (rowData[headers.indexOf('Neighborhood')] || '').trim();
  console.log(neighborhood);

  // declare variables (blank for now)
  let teamName = '';
  let teamLeadName = '';
  let teamLeadEmail = '';
  let teamPageURL = '';
  console.log('66');
  const teamObj = teamLookup(neighborhood, ss);
  console.log('68');
  console.log(teamObj);
  
  // use neighborhood value to lookup other values in the lookup sheet (team name, team page URL)
  if (neighborhood) {
   teamName = (teamObj.team || '').trim();
   teamLeadName = (teamObj.teamLeadName || '').trim();
   teamLeadEmail = (teamObj.teamLeadEmail || '').trim();
   teamPageURL = (teamObj.teamPageURL || '').trim();
  }

  console.log(`teamName: ${teamName}, teamLeadName: ${teamLeadName}, teamLeadEmail: ${teamLeadEmail}, teamPageURL: ${teamPageURL}`);

  // choose which template to send (team lead or regular member onboarding)
  if (role === 'Team leader') {
    sendEmail('teamLeadOnboardEmail', memberName, memberEmail, teamName, teamPageURL, teamLeadName, teamLeadEmail);
  } else {
    sendEmail('memberOnboardEmail2', memberName, memberEmail, teamName, teamPageURL, teamLeadName, teamLeadEmail);
  }

  console.log('83');

  // step 3: add member to appropriate google groups based on team
  addToGoogleGroups(teamObj, row, ss, sh);
  
}

/** Add new NET to appropriate Team group (idempotent) */
function addToGoogleGroups(teamObj, row, ss, sh) {
  console.log('addToGoogleGroups')
  const rowData = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
  const { headers } = readSheet_(ss.getSheetByName('WorkspaceRegForm'));
  const nIdx = headers.indexOf('Neighborhood');
  const eIdx = headers.indexOf('Email');
  const email = (rowData[eIdx] || '').trim();
  const team = teamObj.team;
  const teamGroupEmail = teamObj.group;

  if (!email || !/@/.test(email)) {
    Logger.log(`SKIP: invalid/missing email. Row: ${JSON.stringify(row)}`);
    return;
  }

  // 1) All‑Member group
  // console.log('skipping add to all-members; only adding individuals to team groups');
  addToGroupIdempotent_('all-members@friendsofportlandnet.org', email);
  console.log(`added ${email} to all-members@friendsofportlandnet.org`);

  // 2) Team group
  if (!teamGroupEmail) {
    Logger.log(`SKIP team group: cannot resolve for team="${team}" email="${email}"`);
    return;
  }
 
  addToGroupIdempotent_(teamGroupEmail, email);
  console.log(`added ${email} to ${teamGroupEmail}`);
}

/** send member onboarding email template */
function sendEmail(templateName, memberName, memberEmail, teamName, teamPageURL, teamLeadName, teamLeadEmail) {
  console.log('sendEmail');
  const data = {
    memberName,
    memberEmail,
    teamName,
    teamLeadName,
    teamLeadEmail,
    teamPageURL
  };
  console.log(data);

  // Render HTML from the template
  let html;
  try {
    html = renderTemplate_(templateName, data);
  } catch(err) {
    console.log(`Automations 144: ${err}`);
  }
  console.log('Automations 146');
  console.log('html');
  console.log(html);
  const logoBlob = DriveApp.getFileById('1xfjK56Z-rSTRF8XqXeDcoTTRrjDdNbl2').getBlob();
  // console.log('logoBlob');
  // console.log(logoBlob);

try {
  GmailApp.sendEmail(
    memberEmail,
    'Welcome to the Portland NET Google Workspace',
    'This email requires an HTML-capable client.',
    {
      htmlBody: html,
      name: 'Friends of Portland NET',
      cc: teamLeadEmail || '',
      inlineImages: { logo: logoBlob } // matches cid:logo in template
    }
  );
} catch (err) {
  console.log(`sendEmail error: ${err}`)
}
  
}



