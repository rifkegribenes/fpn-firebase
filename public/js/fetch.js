import { callBackend } from './api.js';
import { getDriveFileId } from './helpers.js';

const TEAM_PAGE_SHEET =
  'https://sheetdb.io/api/v1/ne0v0i21llmeh/search?sheet=TeamPageUpdateForm';

const teamPageCache = new Map();

function normalizeTeamKey(teamName) {
  return teamName.trim().toLowerCase();
}

async function fetchTeamPageRows(teamName) {
  const key = normalizeTeamKey(teamName);

  console.log(
    teamPageCache.size
      ? 'Using in-memory SheetDB cache'
      : 'Fetching fresh rows from SheetDB'
  );

  if (teamPageCache.has(key)) {
    return teamPageCache.get(key);
  }

  const res = await fetch(
    `${TEAM_PAGE_SHEET}&Your%20Team=${encodeURIComponent(teamName)}`
  );

  const rows = await res.json();
  teamPageCache.set(key, rows);
  return rows;
}


const TEAM_LOOKUP_URL =
  'https://sheetdb.io/api/v1/ne0v0i21llmeh?sheet=TeamLookup';

let teamLookupCache = null;

async function fetchTeamLookupRows() {
  if (teamLookupCache) return teamLookupCache;

  const res = await fetch(TEAM_LOOKUP_URL);
  teamLookupCache = await res.json();
  return teamLookupCache;
}

export function clearTeamPageCache(teamName) {
  if (!teamName) return;

  const key = teamName.trim().toLowerCase();
  teamPageCache.delete(key);

  console.log(`Cleared in-memory teamPageCache for "${key}"`);
}


export function clearTeamLookupCache() {
  teamLookupCache = null;
  console.log('Cleared teamLookupCache');
}

function deriveAnnouncements(rows) {
  return rows
    .filter(r =>
      r['What do you want to update?']?.includes('announcement')
    )
    .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
    .slice(0, 3);
}

function deriveBanner(rows) {
  return rows
    .filter(r => !!r.BannerPublicURL)
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

function deriveMinutes(rows) {
  return rows
    .filter(r => {
      const updateType =
        r['What do you want to update?']?.toLowerCase() || '';

      const fileUrl =
        r['Upload your meeting minutes here (.pdf, .docx or URL to Google Document)'] || '';

      return updateType.includes('minutes') && fileUrl.trim();
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

function deriveOpsPlan(rows) {
  return rows
    .filter(r => {
      const updateType =
        r['What do you want to update?']?.toLowerCase() || '';

      const fileUrl =
        r[`Upload your team's operations plan here (.pdf, .docx or URL to Google Document)`] || '';

      return updateType.includes('operations') && fileUrl.trim();
    })
    .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))
    .slice(0, 1)
    .map(r => {
      const fileUrl =
        r[`Upload your team's operations plan here (.pdf, .docx or URL to Google Document)`] || '';

      return {
        id: getDriveFileId(fileUrl) || '',
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
  console.log('fetchTeamData announcements');
  console.log(announcements);

  return {
    success: true,
    message: 'success: team',
    page: 'team',
    team,
    teamObj,
    announcements: deriveAnnouncements(rows),
    minutes: deriveMinutes(rows),
    opsPlanFile: deriveOpsPlan(rows),
    banner: deriveBanner(rows)
  };
}

export async function globalLookup(team) {
  if (!team) return null;

  const rows = await fetchTeamLookupRows();

  const normalized = team.trim().toLowerCase();

  const teamRow = rows.find(r =>
    String(r.Team || '').toLowerCase() === normalized ||
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
    teamLeadSlug = match[1]; // e.g. "woodstock"
  }

  return {
    email: normalized,
    isAdmin,
    isTeamLead: Boolean(teamLeadSlug),
    teamLeadSlug // <-- critical: page comparison key
  };
}



