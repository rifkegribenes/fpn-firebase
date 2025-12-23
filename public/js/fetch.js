import { callBackend } from './api.js';
import { getDriveFileId } from './helpers.js';

// export async function fetchAuth(user) {
//   const email = user?.email || '';

//   const data = await callBackend({
//     action: 'auth',
//     email
//   });

//   return {
//     email,
//     isAdmin: !!data?.isAdmin,
//     isTeamLead: !!data?.isTeamLead,
//     isTeamPageEditor: !!data?.isTeamPageEditor
//   };
// }


export async function fetchTeamData(team) {
  console.log(`FETCH TEAM DATA ************* 22: ${team}`);

  const teamObj = await globalLookup(team);
  const announcements = await fetchAnnouncements(teamObj.teamName);
  const minutes = await fetchMinutes(teamObj.teamName);
  // const opsPlanLink = fetchOpsFile(teamObj.teamName);
  // const banner = fetchBanner(teamObj.teamName);

  return {
      success: true,
      message: 'success: team',
      page: 'team',
      team,
      teamObj,
      announcements,
      minutes,
      // opsPlanLink,
      // banner,
      // auth: {
      //   email: effectiveEmail,
      //   isAdmin,
      //   isTeamLead,
      //   isTeamPageEditor
      // }
    };
}

let teamLookupCache = null;

export async function globalLookup(team) {
  if (!team) return null;

  if (!teamLookupCache) {
    const res = await fetch(
      'https://sheetdb.io/api/v1/ne0v0i21llmeh?sheet=TeamLookup'
    );
    teamLookupCache = await res.json();
  }

  const normalized = team.trim().toLowerCase();

  const teamRow = teamLookupCache.find(r =>
    String(r['Team'] || '').toLowerCase() === normalized ||
    String(r['Short name'] || '').toLowerCase() === normalized
  );

  if (!teamRow) return null;

  return {
    shortName: teamRow['Short name'],
    teamName: teamRow.Team,
    groupEmail: teamRow['Team Group Email'],
    teamPage: teamRow['Team page'],
    district: teamRow.District,
    tlEmail: teamRow['Team Lead email'],
    tlAssigned: !!teamRow['Assigned to (name)'] && !!teamRow['Alt email'],
    tlName: teamRow['Assigned to (name)'],
    teamCal: teamRow['Team calendar link'],
    teamDrive: teamRow['Team drive link']
  };
}



export async function fetchAnnouncements(team) {
  const res = await fetch(
    `https://sheetdb.io/api/v1/ne0v0i21llmeh/search` +
    `?sheet=TeamPageUpdateForm` +
    `&Your%20Team=${encodeURIComponent(team)}`
  );
  const rows = await res.json();

  return rows
    .filter(r => r['What do you want to update?']?.includes('announcement'))
    .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
    .slice(0, 3);
}

// export function fetchBanner(team) {
//   return rows
//     .filter(r => r['Your Team'] === teamName && r.BannerPublicURL)
//     .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))[0] || null;
// }

export async function fetchMinutes(team) {
  console.log(`FETCH MINUTES ************* 106: ${team}`);
  const res = await fetch(
    `https://sheetdb.io/api/v1/ne0v0i21llmeh/search` +
    `?sheet=TeamPageUpdateForm` +
    `&Your%20Team=${encodeURIComponent(team)}`
  );

  const rows = await res.json();

  console.log('FETCH MINUTES ************* 115');

  console.log(rows.map(r => ({
    team: r['Your Team'],
    update: r['What do you want to update?'],
    file: r['Upload your meeting minutes here (.pdf, .docx or URL to Google Document)']
  })));

  return rows
    .filter(r => {
      const updateType =
        r['What do you want to update?']?.toLowerCase() || '';

      const fileUrl =
        r['Upload your meeting minutes here (.pdf, .docx or URL to Google Document)'] || '';

      return (
        updateType.includes('minutes') &&
        fileUrl.trim().length > 0
      );
    })
    .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
    .slice(0, 10)
    .map(r => {
      const fileUrl =
        r['Upload your meeting minutes here (.pdf, .docx or URL to Google Document)'] || '';

      return {
        id: getDriveFileId(fileUrl) || '',
        timestamp: r.Timestamp,
        meetingDate: r['Date of meeting'],
        fileUrl,
        rowId: r.Id
      };
    });
}



// export function fetchOpsFile(team) {

// }

export async function fetchTeamLinks() {
  const res = await fetch(
    'https://sheetdb.io/api/v1/ne0v0i21llmeh?sheet=TeamLookup'
  );
  const rows = await res.json();

  return rows.map(r => ({
    name: r.Team,
    shortName: r['Short name']
  }));
}


/** EDIT THESE LISTS ONLY */
const ADMIN_EMAILS = [
  "admin@friendsofportlandnet.org", 
  "bec@friendsofportlandnet.org", 
  "carolyn@friendsofportlandnet.org", 
  "sarah1@friendsofportlandnet.org"
];

const TEAM_LEAD_REGEX = /^tl\.[^@]+@friendsofportlandnet\.org$/i;

/**
 * Derive all auth flags from a single email
 */
export function deriveAuthFromEmail(email = '') {
  const normalized = email.trim().toLowerCase();

  const isAdmin = ADMIN_EMAILS.includes(normalized);

  const isTeamLead =
    TEAM_LEAD_REGEX.test(normalized) || isAdmin;

  // Option A: editors include TLs + admins
  const isTeamPageEditor = isTeamLead || isAdmin;

  return {
    email: normalized,
    isAdmin,
    isTeamLead,
    isTeamPageEditor
  };
}


