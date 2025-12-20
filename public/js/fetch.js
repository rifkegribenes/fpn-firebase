const auth = await fetch('/auth').then(r => r.json());


export async function fetchTeamData(team) {

  const teamObj = globalLookup(team);
  const announcements = fetchAnnouncements(team);
  // const minutes = fetchMinutesFiles(team);
  // const opsPlanLink = fetchOpsFile(team);
  // const banner = fetchBanner(team);

  return {
      success: true,
      message: 'success: team',
      page: 'team',
      team,
      teamObj,
      announcements,
      // minutes,
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

// export function fetchMinutesFiles(team) {

// }

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

