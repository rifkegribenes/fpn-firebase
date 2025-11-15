function doGet(e) {
  // Helper to safely log to sheet without crashing
  function safeLog(level, message, extra = {}) {
    try {
      logToSheet({
        level,
        where: 'doGet',
        message,
        ...extra
      });
    } catch (err) {
      // swallow any logging errors
    }
  }

  safeLog('info', '--- doGet called ---', { rawE: JSON.stringify(e) });

  try {
    // --- Extract params safely ---
    const params = e?.parameter || {};
    const action = params.action || '';
    const responseId = params.id || '';
    const team = params.team || '';
    const emailParam = params.email || '';
    const callback = params.callback;

    safeLog('info', `doGet: team=${team}, emailParam=${emailParam}`, { allParams: params });

    // --- EARLY RETURN: teamLinks page (no team param) ---
    if (!team) {
      safeLog('info', 'Serving teamLinks only – skipping auth and team lookups.');
      const teamLinks = getTeamLinks();

      const responseData = {
        success: true,
        message: 'success: teamLinks',
        page: 'teamLinks',
        teamLinks,
        debug: {
          timestamp: new Date().toISOString(),
          note: 'No auth or team lookups were performed for teamLinks page.'
        }
      };

      const json = JSON.stringify(responseData);
      return callback
        ? ContentService.createTextOutput(`${callback}(${json})`).setMimeType(ContentService.MimeType.JAVASCRIPT)
        : ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
    }

    // --- AUTH & ROLE LOGIC (only if team param exists) ---
    const activeUser = Session.getActiveUser();
    const activeUserEmail = activeUser ? activeUser.getEmail() : null;
    const authMode = e?.authMode || 'none';
    const effectiveEmail = emailParam || activeUserEmail || 'anonymous@public';

    safeLog('info', 'Auth details', { authMode, activeUserEmail, emailParam, effectiveEmail });

    // Wrap membership checks in try/catch to avoid crashing if API fails
    let isAdmin = false;
    let isTeamLead = false;

    try {
      isAdmin = checkGroupMembership(ADMIN_GROUP_EMAIL, effectiveEmail);
    } catch (err) {
      safeLog('error', 'checkGroupMembership ADMIN error', { effectiveEmail, error: err.message, stack: err.stack });
      isAdmin = false;
    }

    try {
      isTeamLead = checkGroupMembership(TEAM_LEADS_GROUP_EMAIL, effectiveEmail);
    } catch (err) {
      safeLog('error', 'checkGroupMembership TEAM_LEADS error', { effectiveEmail, error: err.message, stack: err.stack });
      isTeamLead = false;
    }

    const isTeamPageEditor = (isTeamLead && effectiveEmail.includes(team)) || isAdmin;

    safeLog('info', 'Role check', { effectiveEmail, isAdmin, isTeamLead, isTeamPageEditor });

    // --- MAIN TEAM DATA LOOKUPS ---
    let teamObj = null, announcements = [], minutes = [], opsPlanLink = null;
    try {
      teamObj = globalLookup(team);
      announcements = getRecentAnnouncements(teamObj);
      minutes = getLatestMinutesFiles(teamObj, MINUTES_FOLDER_ID, 10);
      opsPlanLink = getLatestOpsFile(teamObj, OPS_FOLDER_ID);
    } catch (err) {
      safeLog('error', 'Team data fetch error', { team, error: err.message, stack: err.stack });
    }

    // --- Handle delete action ---
    if (action === 'delete' && responseId) {
      safeLog('info', `Attempting delete for responseId: ${responseId}`);
      let deleted = false;
      try {
        deleted = deleteFormResponse(responseId);
      } catch (err) {
        safeLog('error', 'deleteFormResponse error', { responseId, error: err.message, stack: err.stack });
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

    // --- Standard JSON/JSONP response ---
    const responseData = {
      success: true,
      message: 'success: team',
      page: 'team',
      team,
      teamObj,
      isAdmin,
      isTeamLead,
      isTeamPageEditor,
      announcements,
      minutes,
      opsPlanLink,
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
    safeLog('fatal', 'doGet top-level ERROR', { error: err.message, stack: err.stack, rawE: e });

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
