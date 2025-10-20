function doGet(e) {
  console.log('--- doGet called ---');
  console.log('Raw e object:', JSON.stringify(e)); // full visibility into incoming params

  try {
    // extract parameters
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || '';
    const responseId = params.id || '';
    const page = params.page || 'team';
    const team = params.team || '';
    const emailParam = params.email || ''; // renamed for clarity
    const callback = params.callback;



    console.log(`doGet: page=${page}, team=${team}, emailParam=${emailParam}`);
    console.log('all params:', JSON.stringify(params));

    // more explicit session + auth info
    const activeUser = Session.getActiveUser();
    const activeUserEmail = activeUser ? activeUser.getEmail() : null;
    const authMode = e ? e.authMode : 'none';
    const effectiveEmail = emailParam || activeUserEmail || 'anonymous@public';

    console.log({
      authMode,
      activeUserEmail,
      emailParam,
      effectiveEmail
    });

    // check roles using effectiveEmail (the merged source)
    const isAdmin = checkGroupMembership(ADMIN_GROUP_EMAIL, effectiveEmail);
    const isTeamLead = checkGroupMembership(TEAM_LEADS_GROUP_EMAIL, effectiveEmail);
    const isTeamPageEditor = (isTeamLead && effectiveEmail.includes(team)) || isAdmin;

    console.log('Email:', effectiveEmail, 'isAdmin:', isAdmin, 'isTeamLead:', isTeamLead, 'isTeamPageEditor:', isTeamPageEditor);

    // load data
    const teamObj = globalLookup(team);
    const announcements = getRecentAnnouncements(teamObj);
    const minutes = getLatestMinutesFiles(teamObj, MINUTES_FOLDER_ID, 10);
    const opsPlanLink = getLatestOpsFile(teamObj, OPS_FOLDER_ID);

    let message = null;
    let responseData;

    if (action === 'delete' && responseId) {
      console.log('Attempting delete for responseId:', responseId);
      const deleted = deleteFormResponse(responseId);
      message = deleted ? 'Announcement deleted successfully.' : 'Failed to delete announcement.';
      responseData = { success: deleted, message };
    } else if (page === 'teamLinks') {
      responseData = { success: true, message: 'success: teamLinks', page: 'teamLinks' };
    } else {
      responseData = {
        success: true,
        message: 'success: team',
        page,
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

    // return JSON or JSONP
    const json = JSON.stringify(responseData);
    if (callback) {
      return ContentService
        .createTextOutput(`${callback}(${json})`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);

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
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }
}
