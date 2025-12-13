function doGet(e) {
  // Helper to safely log to sheet without crashing
  

  safeLog('doGet', 'info', `--- doGet called ---, rawE: ${ JSON.stringify(e) }`);

  try {
    // --- Extract params safely ---
    const params = e?.parameter || {};
    const action = params.action || '';
    const responseId = params.id || '';
    const team = params.team || '';
    const emailParam = params.email || '';
    const callback = params.callback;

    safeLog('doGet', 'info', `doGet: team=${team}, emailParam=${emailParam}, allParams: ${params}`);

    // --- EARLY RETURN: teamLinks page (NO valid team param) ---
    const hasValidTeamParam =
      team && team !== "default" && team !== "teamLinks";

    if (!hasValidTeamParam) {
      safeLog('doGet', 'info', 'Serving TEAM LINKS (no valid team param).');

      const teamLinks = getTeamLinks();
      const responseData = {
        success: true,
        page: 'teamLinks',
        teamLinks,
        message: 'success: teamLinks',
        debug: {
          timestamp: new Date().toISOString()
        }
      };

      const json = JSON.stringify(responseData);
      return callback
        ? ContentService.createTextOutput(`${callback}(${json})`)
            .setMimeType(ContentService.MimeType.JAVASCRIPT)
        : ContentService.createTextOutput(json)
            .setMimeType(ContentService.MimeType.JSON);
    }


    // --- AUTH & ROLE LOGIC (only if team param exists) ---
    const activeUser = Session.getActiveUser();
    const activeUserEmail = activeUser ? activeUser.getEmail() : null;
    const authMode = e?.authMode || 'none';
    const effectiveEmail = emailParam || activeUserEmail || 'anonymous@public';

    safeLog('doGet', 'info', `Auth details: authMode: ${authMode}, activeUserEmail: ${activeUserEmail}, emailParam: ${emailParam}, effectiveEmail: ${effectiveEmail}`);

    // Wrap membership checks in try/catch to avoid crashing if API fails
    let isAdmin = false;
    let isTeamLead = false;

    try {
      isAdmin = checkGroupMembership(ADMIN_GROUP_EMAIL, effectiveEmail);
    } catch (err) {
      safeLog('doGet', 'error', `checkGroupMembership ADMIN error, effectiveEmail: ${effectiveEmail}, error: ${err.message}, stack: ${err.stack}`);
      isAdmin = false;
    }

    try {
      isTeamLead = checkGroupMembership(TEAM_LEADS_GROUP_EMAIL, effectiveEmail);
    } catch (err) {
      safeLog('doGet', 'error', `checkGroupMembership TEAM_LEADS error, effectiveEmail: ${effectiveEmail}, error: ${err.message}, stack: ${err.stack}`);
      isTeamLead = false;
    }

    const isTeamPageEditor = (isTeamLead && effectiveEmail.includes(team)) || isAdmin;

    safeLog('doGet', 'info', `Role check: ${effectiveEmail}, isAdmin: ${isAdmin}, isTeamLead: ${isTeamLead}, isTeamPageEditor: ${isTeamPageEditor}`);

    // --- MAIN TEAM DATA LOOKUPS ---
    let teamObj = null, announcements = [], minutes = [], opsPlanLink = null, banner = null;
    try {
      teamObj = globalLookup(team);
      announcements = getRecentAnnouncements(teamObj);
      minutes = getLatestMinutesFiles(teamObj, MINUTES_FOLDER_ID, 10);
      opsPlanLink = getLatestOpsFile(teamObj, OPS_FOLDER_ID);
      banner = getBanner(teamObj);
    } catch (err) {
      safeLog('doGet', 'error', `Team data fetch error: team: ${team}, error: ${err.message}, stack: ${err.stack}`);
    } finally {
        safeLog('doGet', 'info', `Finally: teamObj: ${teamObj}, announcements: ${announcements}, minutes: ${minutes} opsPlanLink: ${opsPlanLink}, banner: ${banner}`);
      }

    // --- Handle delete action ---
    if (action === 'delete' && responseId) {
      safeLog('doGet', 'info', `Attempting delete for responseId: ${responseId}`);
      let deleted = false;
      try {
        deleted = deleteFormResponse(responseId);
      } catch (err) {
        safeLog('doGet', 'error', `deleteFormResponse error, responseId: ${responseId}, error: ${err.message}, stack: ${err.stack}`);
      } 

      const message = deleted
        ? '✅ Announcement deleted successfully.'
        : '❌ Failed to delete announcement.';

      const html = `
        <html>
          <head><title>Delete Result</title></head>
          <body style="font-family: Lato, sans-serif; padding: 20px;">
            <h2>${message}</h2>
            <p>You can now close this tab and refresh the team page.</p>
          </body>
        </html>
      `;

      return HtmlService.createHtmlOutput(html);
    }

    if (action === 'deleteBanner') {
      const fileUrl = e.parameter.fileUrl;
      safeLog('doGet', 'info', `Attempting banner delete for team: ${team}, fileUrl: ${fileUrl}`);

      let deleted = false;
      try {
        deleted = deleteBanner(fileUrl);
      } catch (err) {
        safeLog('doGet', 'error', `deleteBanner error, team: ${team}, error: ${err.message}`);
      }

      const message = deleted
        ? '✅ Banner deleted successfully.'
        : '❌ Failed to delete banner.';

      const html = `
        <html>
          <head><title>Delete Banner</title></head>
          <body style="font-family: Lato, sans-serif; padding: 20px;">
            <h2>${message}</h2>
            <p>You can now close this tab and refresh the team page.</p>
          </body>
        </html>
      `;

      return HtmlService.createHtmlOutput(html);
    }



    // --- Standard JSON/JSONP response ---
    const responseData = {
      success: true,
      message: 'success: team',
      page: 'team',
      team,
      teamObj,
      announcements,
      minutes,
      opsPlanLink,
      banner,
      auth: {
        email: effectiveEmail,
        isAdmin,
        isTeamLead,
        isTeamPageEditor
      },
      debug: {
        authMode,
        activeUserEmail,
        emailParam,
        effectiveEmail,
        activeUser: activeUserEmail || null,
        teamObjKeys: teamObj ? Object.keys(teamObj) : [],
        announcementsCount: announcements?.length || 0,
        minutesCount: minutes?.length || 0,
        timestamp: new Date().toISOString()
      }
    };

    const json = JSON.stringify(responseData);
    return callback
      ? ContentService.createTextOutput(`${callback}(${json})`).setMimeType(ContentService.MimeType.JAVASCRIPT)
      : ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    // Top-level catch ensures backend never returns undefined
    safeLog('doGet', 'fatal', `doGet top-level ERROR, error: ${err.message}, stack: ${err.stack}, rawE: ${e}`);

    const stack = err.stack || '';
    const errorResponse = {
      success: false,
      error: err.message || 'Unknown error',
      stack,
      debug: {
        timestamp: new Date().toISOString(),
        params: e?.parameter || {}
      }
    };
    const callback = e?.parameter?.callback;
    const json = JSON.stringify(errorResponse);
    return ContentService
      .createTextOutput(callback ? `${callback}(${json})` : json)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }
}
