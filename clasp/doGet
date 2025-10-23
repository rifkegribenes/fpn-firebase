function doGet(e) {
  console.log('--- doGet called ---');
  console.log('Raw e object:', JSON.stringify(e));

  try {
    // --- Extract params safely ---
    const params = e?.parameter || {};
    const action = params.action || '';
    const responseId = params.id || '';
    const team = params.team || '';
    const emailParam = params.email || '';
    const callback = params.callback;

    console.log(`doGet: team=${team}, emailParam=${emailParam}`);
    console.log('all params:', JSON.stringify(params));

    // --- EARLY RETURN: teamLinks page (no team param) ---
    if (!team) {
      console.log('Serving teamLinks only – skipping auth and team lookups.');
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
      if (callback) {
        return ContentService
          .createTextOutput(`${callback}(${json})`)
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      } else {
        return ContentService
          .createTextOutput(json)
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // --- AUTH & ROLE LOGIC (only if team param exists) ---
    const activeUser = Session.getActiveUser();
    const activeUserEmail = activeUser ? activeUser.getEmail() : null;
    const authMode = e?.authMode || 'none';
    const effectiveEmail = emailParam || activeUserEmail || 'anonymous@public';

    console.log({
      authMode,
      activeUserEmail,
      emailParam,
      effectiveEmail
    });

    const isAdmin = checkGroupMembership(ADMIN_GROUP_EMAIL, effectiveEmail);
    const isTeamLead = checkGroupMembership(TEAM_LEADS_GROUP_EMAIL, effectiveEmail);
    const isTeamPageEditor = (isTeamLead && effectiveEmail.includes(team)) || isAdmin;

    console.log(
      'Email:',
      effectiveEmail,
      'isAdmin:',
      isAdmin,
      'isTeamLead:',
      isTeamLead,
      'isTeamPageEditor:',
      isTeamPageEditor
    );

    // --- MAIN TEAM DATA LOOKUPS ---
    const teamObj = globalLookup(team);
    const announcements = getRecentAnnouncements(teamObj);
    const minutes = getLatestMinutesFiles(teamObj, MINUTES_FOLDER_ID, 10);
    const opsPlanLink = getLatestOpsFile(teamObj, OPS_FOLDER_ID);

    let responseData;
    if (action === 'delete' && responseId) {
      console.log('Attempting delete for responseId:', responseId);
      const deleted = deleteFormResponse(responseId);
      const message = deleted
        ? 'Announcement deleted successfully.'
        : 'Failed to delete announcement.';
      responseData = { success: deleted, message };
    } else {
      responseData = {
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
    }

    // --- RETURN JSON or JSONP ---
    const json = JSON.stringify(responseData);
    if (callback) {
      return ContentService
        .createTextOutput(`${callback}(${json})`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService
        .createTextOutput(json)
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    console.error('doGet ERROR:', err);
    const stack = err.stack || '';
    let file = 'unknown';
    let line = null;

    const match = stack.match(/\(([^:]+):(\d+)(?::\d+)?\)/);
    if (match) {
      file = match[1];
      line = match[2];
    }

    const errorResponse = {
      success: false,
      error: err.message,
      file,
      line,
      stack,
      debug: {
        timestamp: new Date().toISOString(),
        params: e?.parameter || {},
      }
    };

    const callback = e?.parameter?.callback;
    const json = JSON.stringify(errorResponse);
    const output = callback ? `${callback}(${json})` : json;

    return ContentService
      .createTextOutput(output)
      .setMimeType(callback
        ? ContentService.MimeType.JAVASCRIPT
        : ContentService.MimeType.JSON);
  }
}
