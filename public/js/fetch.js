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
  const opsPlanFile = await fetchOpsFile(teamObj.teamName);
  const banner = await fetchBanner(teamObj.teamName);
  console.log('banner', banner);

  return {
      success: true,
      message: 'success: team',
      page: 'team',
      team,
      teamObj,
      announcements,
      minutes,
      opsPlanFile,
      banner
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

// code that copies banner file to github and writes public URL to sheet is in
// FPN Automations AppsScript (Handlers.js)

export async function fetchBanner(team) {

  console.log(`fetchBanner ****************** 99`);

  const res = await fetch(
    `https://sheetdb.io/api/v1/ne0v0i21llmeh/search` +
    `?sheet=TeamPageUpdateForm` +
    `&Your%20Team=${encodeURIComponent(team)}`
  );
  const rows = await res.json();

  return rows
    .filter(r => !!r.BannerPublicURL)
    .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
    .slice(0, 1)
    .map(r => {
      const publicUrl =
        r['BannerPublicURL'] || '';
      const driveUrl = r['Upload banner photo here'] || '';
      const id = getDriveFileId(driveUrl) || '';
      console.log(`banner FILE ID: ${id}`);

      return {
        id,
        timestamp: r.Timestamp,
        publicUrl,
        rowId: r.Id,
        alt: r['Image alt text (brief image description for screen readers)']
      };
    });
}

export async function fetchMinutes(team) {

  const res = await fetch(
    `https://sheetdb.io/api/v1/ne0v0i21llmeh/search` +
    `?sheet=TeamPageUpdateForm` +
    `&Your%20Team=${encodeURIComponent(team)}`
  );

  const rows = await res.json();

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



export async function fetchOpsFile(team) {
  // console.log(`fetchOpsFile ****************** 149`);

  const res = await fetch(
    `https://sheetdb.io/api/v1/ne0v0i21llmeh/search` +
    `?sheet=TeamPageUpdateForm` +
    `&Your%20Team=${encodeURIComponent(team)}`
  );

  const rows = await res.json();

  // console.log(rows.map(r => ({
  //   team: r['Your Team'],
  //   update: r['What do you want to update?'],
  //   file: r['Upload your meeting minutes here (.pdf, .docx or URL to Google Document)']
  // })));

  return rows
    .filter(r => {
      const updateType =
        r['What do you want to update?']?.toLowerCase() || '';

      const fileUrl =
        r[`Upload your team's operations plan here (.pdf, .docx or URL to Google Document)`] || '';

      return (
        updateType.includes('operations') &&
        fileUrl.trim().length > 0
        );
      })
      .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
      .slice(0, 1)
      .map(r => {
        const fileUrl =
          r[`Upload your team's operations plan here (.pdf, .docx or URL to Google Document)`] || '';
          const id = getDriveFileId(fileUrl) || '';
          // console.log(`opsPlan FILE ID: ${id}`);

        return {
          id,
          timestamp: r.Timestamp,
          fileUrl,
          rowId: r.Id
        };
      });
}

export async function fetchTeamLinks() {
  const res = await fetch(
    'https://sheetdb.io/api/v1/ne0v0i21llmeh?sheet=TeamLookup'
  );
  const rows = await res.json();

  return rows.map(r => ({
    name: r.Team,
    shortName: r['Short name'],
    active: !!r['Assigned to (name)']
  }));
}


/** EDIT THESE LISTS ONLY */
const ADMIN_EMAILS = [
  "admin@friendsofportlandnet.org", 
  "bec@friendsofportlandnet.org", 
  "carolyn@friendsofportlandnet.org", 
  "sarah1@friendsofportlandnet.org"
];

const TEAM_LEAD_REGEX = /^tl\.([^@]+)@friendsofportlandnet\.org$/i;

/**
 * Derive global auth facts from email ONLY
 * (no page-specific logic here)
 */
export function deriveAuthFromEmail(email = '') {
  const normalized = email.trim().toLowerCase();

  const isAdmin = ADMIN_EMAILS.includes(normalized);

  let teamLeadSlug = null;
  const match = normalized.match(TEAM_LEAD_REGEX);
  if (match) {
    teamLeadSlug = match[1]; // e.g. "woodstock"
  }

  return {
    email: normalized,
    isAdmin,
    isTeamLead: Boolean(teamLeadSlug),
    teamLeadSlug // <-- critical: page comparison key
  };
}



