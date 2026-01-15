import { getDriveFileId } from './helpers.js';

const WORKER_URL = 'https://sheet-proxy.rifkegribenes.workers.dev';

const TEAM_PAGE_SHEET = `${WORKER_URL}?sheet=TeamPageUpdateForm`;
const TEAM_LOOKUP_URL = `${WORKER_URL}?sheet=TeamLookup`;

function normalizeTeamKey(teamName) {
  return teamName.trim().toLowerCase();
}

async function fetchTeamPageRows(teamName) {
  const res = await fetch(
    `${WORKER_URL}?sheet=TeamPageUpdateForm&Your%20Team=${encodeURIComponent(teamName)}`
  );

  if (!res.ok) {
    throw new Error('Failed to fetch team page rows');
  }

  return res.json();
}


async function fetchTeamLookupRows() {
  const res = await fetch(`${WORKER_URL}?sheet=TeamLookup`);

  if (!res.ok) {
    throw new Error('Failed to fetch team lookup');
  }

  return res.json();
}


function deriveAnnouncements(rows, teamName) {
  const normalizedTeam = teamName?.trim().toLowerCase();

  return rows
    .filter(r => {
      const rowTeam = String(r['Your Team'] || '').trim().toLowerCase();
      const updateType = r['What do you want to update?']?.toLowerCase() || '';
      if (!r.Id) return false;
      if (rowTeam !== normalizedTeam) return false;
      if (!updateType.includes('announcement')) return false;
      return true;
    })
    .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
    .slice(0, 3);
}

function deriveBanner(rows, teamName) {
  const normalizedTeam = teamName?.trim().toLowerCase();

  return rows
    .filter(r => {
      const rowTeam = String(r['Your Team'] || '').trim().toLowerCase();
      if (!r.BannerPublicURL) return false;
      if (!r.Id) return false;
      if (rowTeam !== normalizedTeam) return false;
      return true;
    })
    .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
    .slice(0, 1)
    .map(r => {
      const driveUrl = r['Upload banner photo here'] || '';

      return {
        id: getDriveFileId(driveUrl) || '',
        timestamp: r.Timestamp,
        publicUrl: r.BannerPublicURL,
        rowId: r.Id,
        alt: r['Image alt text (brief image description for screen readers)']
      };
    });
}

function deriveMinutes(rows, teamName) {
  const normalizedTeam = teamName.trim().toLowerCase();

  return rows
    .filter(r => {
      const updateType =
        r['What do you want to update?']?.toLowerCase() || '';

      const fileUrl =
        r['Upload your meeting minutes here (.pdf, .docx or URL to Google Document)'] || '';

      const rowTeam =
        String(r['Your Team'] || '').trim().toLowerCase();

      if (!r.Id) return false;                      // orphan row
      if (rowTeam !== normalizedTeam) return false; // wrong team
      if (!updateType.includes('minutes')) return false;
      if (!fileUrl.trim()) return false;

      const driveId = getDriveFileId(fileUrl);
      if (!driveId) return false;

      return true;
    })
    .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
    .slice(0, 10)
    .map(r => ({
      id: getDriveFileId(
        r['Upload your meeting minutes here (.pdf, .docx or URL to Google Document)']
      ),
      timestamp: r.Timestamp,
      meetingDate: r['Date of meeting'],
      fileUrl:
        r['Upload your meeting minutes here (.pdf, .docx or URL to Google Document)'],
      rowId: r.Id,
      fileName: `${r['Your Team']} minutes ${r['Date of meeting']}`
    }));
}


function deriveOpsPlan(rows, teamName) {
  const normalizedTeam = teamName?.trim().toLowerCase();

  return rows
    .filter(r => {
      const rowTeam = String(r['Your Team'] || '').trim().toLowerCase();
      const updateType = r['What do you want to update?']?.toLowerCase() || '';
      const fileUrl =
        r[`Upload your team's operations plan here (.pdf, .docx or URL to Google Document)`] || '';

      if (!r.Id) return false;
      if (rowTeam !== normalizedTeam) return false;
      if (!fileUrl.trim()) return false;
      if (updateType !== 'ops') return false;

      const driveId = getDriveFileId(fileUrl);
      if (!driveId) return false;

      return true;
    })
    .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
    .slice(0, 1)
    .map(r => {
      const fileUrl =
        r[`Upload your team's operations plan here (.pdf, .docx or URL to Google Document)`];

      return {
        id: getDriveFileId(fileUrl),
        timestamp: r.Timestamp,
        fileUrl,
        rowId: r.Id
      };
    });
}


export async function fetchTeamData(team) {
  console.log(`FETCH TEAM DATA ************* ${team}`);

  const teamObj = await globalLookup(team);
  if (!teamObj) {
    return { success: false, message: 'Team not found' };
  }

  const rows = await fetchTeamPageRows(teamObj.teamName);
  const announcements = deriveAnnouncements(rows);
  // console.log('fetchTeamData announcements');
  // console.log(announcements);

  return {
    success: true,
    message: 'success: team',
    page: 'team',
    team,
    teamObj,
    announcements: deriveAnnouncements(rows, teamObj.teamName),
    minutes: deriveMinutes(rows, teamObj.teamName),
    opsPlanFile: deriveOpsPlan(rows, teamObj.teamName),
    banner: deriveBanner(rows, teamObj.teamName)
  };
}

export async function globalLookup(team) {
  console.log(`globalLookup: ${team}`);
  if (!team) return null;

  const rows = await fetchTeamLookupRows();
  // console.log('fetchTeamLookupRows:', rows);

  const normalized = team.trim().toLowerCase();

  const teamRow = rows.find(r =>
    String(r.Team || '').toLowerCase() === normalized ||
    String(r['Short name'] || '').toLowerCase() === normalized
  );

  // console.log('teamRow', teamRow);

  if (!teamRow) return null;

  const teamObj = {
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

  // console.log('teamObj', teamObj);

  return teamObj;
}


export async function fetchTeamLinks() {
  const rows = await fetchTeamLookupRows();

  return rows.map(r => ({
    name: r.Team,
    shortName: r['Short name'],
    active: Boolean(r['Assigned to (name)'])
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
    teamLeadSlug = match[1]; 
  }

  return {
    email: normalized,
    isAdmin,
    isTeamLead: Boolean(teamLeadSlug),
    teamLeadSlug 
  };
}



