function doGet(e) {
  console.log('doGet');
  try {
    const action = e.parameter.action;
    const responseId = e.parameter.id;
    const page = e.parameter.page || 'team'; // default page
    const team = e.parameter.team || '';
    const email = e.parameter.email || '';
    const callback = e.parameter.callback; // JSONP callback function name

    isAdmin = checkGroupMembership(ADMIN_GROUP_EMAIL, userEmail);
    isTeamLead = checkGroupMembership(TEAM_LEADS_GROUP_EMAIL, userEmail);
    isTeamPageEditor = (isTeamLead && userEmail.includes(userTeam)) || isAdmin;

    let message = null;
    let responseData;

    const teamObj = globalLookup(team);
    console.log(`*****TEAM OBJECT doGET*******`);
    console.log(teamObj);

    if (action === 'delete' && responseId) {
      console.log('trying to delete');
      const deleted = deleteFormResponse(responseId);
      message = deleted ? 'Announcement deleted successfully.' : 'Failed to delete announcement.';
      responseData = { success: deleted, message: message };
    } else if (page === 'teamLinks') {
      responseData = { success: true, message: "It works: teamLinks!", page: "teamLinks" };
    } else {
      responseData = {
        success: true,
        message: "It works: team!",
        page,
        team,
        teamObj,
        isAdmin,
        isTeamLead,
        isTeamPageEditor
      };
    }

    const json = JSON.stringify(responseData);

    // If callback exists → wrap in JSONP response
    if (callback) {
      const jsonp = `${callback}(${json})`;
      return ContentService
        .createTextOutput(jsonp)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    // Otherwise, return plain JSON (still works for direct API access)
    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error("Error in doGet:", err);
    const errorData = {
      success: false,
      error: err.message
    };

    const json = JSON.stringify(errorData);

    if (e.parameter.callback) {
      return ContentService
        .createTextOutput(`${e.parameter.callback}(${json})`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService
        .createTextOutput(json)
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
}