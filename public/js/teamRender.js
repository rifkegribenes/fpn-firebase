// Example function to render the team page
export function renderTeamPage(data) {
  const container = document.getElementById('team-container');
  if (!container) {
    console.error('Missing #team-container');
    return;
  }

  // Example: header
  const header = document.createElement('h1');
  header.innerText = `Team: ${data.teamObj.name || data.team}`;
  container.appendChild(header);

  // Example: message (if any)
  if (data.message) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    msgDiv.innerText = data.message;
    container.appendChild(msgDiv);
  }

  // Example: display teamObj details (customize as per your data)
  if (data.teamObj.members && Array.isArray(data.teamObj.members)) {
    const ul = document.createElement('ul');
    data.teamObj.members.forEach(member => {
      const li = document.createElement('li');
      li.innerText = member.name + (member.role ? ` (${member.role})` : '');
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  // Optionally headerImage
  if (data.headerImage) {
    const img = document.createElement('img');
    img.src = data.headerImage;
    container.insertBefore(img, container.firstChild);
  }
}
