

// function renderContent(userTeam, userEmail) { //userTeam is shortname
//   Logger.log('renderContent');
//   Logger.log(`userTeam: ${userTeam}, userEmail: ${userEmail}`);
//   isAdmin = checkGroupMembership(ADMIN_GROUP_EMAIL, userEmail);
//   isTeamLead = checkGroupMembership(TEAM_LEADS_GROUP_EMAIL, userEmail);
//   isTeamPageEditor = (isTeamLead && userEmail.includes(userTeam)) || isAdmin;
//   Logger.log(`isAdmin: ${isAdmin}, isTeamLead: ${isTeamLead}, isTeamPageEditor: ${isTeamPageEditor}`);

//   let content = `
//     <div style="padding: 20px; font-family: Lato, sans-serif;">
//       ${isTeamPageEditor ? showTeamPageEditorContent(userTeam) : ''}
//       ${showPublicContent(isTeamPageEditor)}
//     </div>
//   `;

//   // Logger.log('content');
//   // Logger.log(content);

//   return content;
// }

// function showPublicContent(isTeamPageEditor) {
//   Logger.log('showPublicContent');
//   return `
//     <div class="publicContent">
//       <h2 style="font-size: 2rem; margin-bottom: 16px;">${teamObj.teamName}</h2>
//       <div class="quickLinks" id="quickLinks>
//         <p class="qlHed">Quick Links</p>
//         <p class="qlP"><a href="https://volunteerpdx.net" target="_blank">Portland NET Wiki</a>
//         <p class="qlP"><a href="https://app.betterimpact.com/" target="_blank">Log hours on MIP</a>
//       </div>

//       <div class="pcContainer container" style="
//         display: flex !important;
//         flex-direction: column !important;  /* force single column */
//         flex-wrap: nowrap !important;
//         width: 100%;
//       ">
//         <div class="announcements block" style="
//           max-width: 100% !important;
//           margin-bottom: 24px;
//         ">
//           <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Announcements</h3>
//           <div class="announcements cont" style="
//             padding-right: 0 !important;
//             margin-right: 0 !important;
//             border-right: none !important;
//           ">
//             ${announcementsBlock(isTeamPageEditor)}
//           </div>
//         </div>

//         <div class="calendar block" style="
//           max-width: 100% !important;
//           margin-bottom: 24px;
//         ">
//           <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Upcoming Events</h3>
//           <div class="calendar cont" style="
//             max-width: 100% !important;
//             padding-right: 0 !important;
//             margin-right: 0 !important;
//             border-right: none !important;
//           ">
//             ${renderCalendar()}
//           </div>
//         </div>

//         <div class="pcColumnContainer container" style="
//           display: flex !important;
//           flex-direction: column !important;
//           flex-wrap: nowrap !important;
//           max-width: 100% !important;
//         ">
//           <div class="minutes block" style="
//             padding-bottom: 20px;
//             margin-bottom: 20px;
//             border-bottom: 1px dotted #ccc;
//           ">
//             <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Meeting Minutes</h3>
//             <div class="minutes cont">
//               ${renderMinutesBlock()}
//             </div>
//           </div>

//           <div class="ops block" style="
//             padding-bottom: 20px;
//             margin-bottom: 20px;
//             border-bottom: 1px dotted #ccc;
//           ">
//             <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Operations Plan</h3>
//             <div class="ops cont">
//               ${renderOpsPlanBlock()}
//             </div>
//           </div>

//           <div class="grouplink block" style="
//             padding-bottom: 20px;
//             margin-bottom: 20px;
//             border-bottom: 1px dotted #ccc;
//           ">
//             <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Google Group</h3>
//             <div class="gGroup cont">
//               ${renderGoogleGroup()}
//             </div>
//           </div>

//           <div class="drivelink block">
//             <h3 class="blockhead" style="font-size: 1.5rem; margin-bottom: 12px;">Team Drive</h3>
//             <div class="gDrive cont">
//               ${renderGoogleDrive()}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>`

// }

// function showTeamPageEditorContent() {
//   return `
//     <div class="tlContainer container">
//       <h3>
//         <a 
//           id="teamUpdateLink"
//           href="https://docs.google.com/forms/d/e/1FAIpQLSe9TU8URPswEVELyy9jOImY2_2vJ9OOE7O8L5JlNUuiJzPQYQ/viewform?usp=pp_url&entry.1458714000=${encodeURIComponent(teamObj.teamName)}"
//           class="responsiveLink"
//           style="
//             display: block;
//             padding: 10px;
//             background-color: #f1f1f1;
//             text-decoration: none;
//             border-radius: 5px;
//             color: #333;
//             transition: background-color 0.2s ease;
//             width: 100%;
//             max-width: 200px;
//           "
//           onmouseover="this.style.backgroundColor='#e0e0e0';"
//           onmouseout="this.style.backgroundColor='#f1f1f1';"
//           target="_blank">
//             Update team page
//         </a>
//       </h3>
//     </div>`;
// }


// function announcementsBlock(isTeamPageEditor) {
//   if (getRecentAnnouncements() && getRecentAnnouncements().length) {
//     return getRecentAnnouncements().map(item => renderAnnouncement(item, isTeamPageEditor)).join('');
//   } else {
//     return `<p>No announcements for ${teamObj.teamName}</p>`
//   }
  
// }

// function renderAnnouncement(obj, isTeamPageEditor) {
//   const deleteURLWithParams = `${obj.deleteURL}&page=team&team=${teamObj.shortName}`
//   const adminBlock = isTeamPageEditor ? `<a href="${obj.editURL}">Edit</a> | <a href="${deleteURLWithParams}">Delete</a>` : '';
//   return `<div class="announcement">
//     <h4 class="aTitle" style="margin-bottom: 10px;">${obj.title}&#160;&#160;&#x7C;&#160;&#160;<span class="aDate" style="color:#333;font-weight:400;">${formatDate(obj.timestamp)}</span></h4>
//     <p class="aBody">${obj.body}</p>
//     ${adminBlock}
//   </div>`
// }

// function renderCalendar() {
//   Logger.log(`teamObj.teamCal (242): ${teamObj.shortName}`);
//   Logger.log(teamObj.teamCal);
  
//   if (!!teamObj.teamCal) {
//     return `<iframe 
//               style="width: 100%; min-height: 400px; border: none;" 
//               src="${teamObj.teamCal}"
//               loading="lazy"
//               allowfullscreen
//             ></iframe>`;
//   } else {
//     return `<p>No calendar available for ${teamObj.teamName}</p>`;
//   }
// }


// function renderMinutesBlock() {
//   Logger.log('renderMinutesBlock');
//   try {
//     const folderId = MINUTES_FOLDER_ID; 
//     const files = getLatestMinutesFiles(folderId, 10);

//     Logger.log('files: (minutes, 393)');
//     Logger.log(files);

//     if (!!files && files.length) {
//       let html = `<div class="minutes-block" style="font-family: Lato, sans-serif; font-size: 14px;">`;

//       files.forEach(file => {

//         const createdDateStr = file.createdTime || null;
//         let formattedDate = 'Unknown date';
//         let mtgDateParsed;

//         if (file.getDescription()) {
//           mtgDateParsed = file.getDescription().split(",")[1] || null;
//         }
//         if (mtgDateParsed) {
//           formattedDate = formatDate(new Date(mtgDateParsed));
//         } else if (createdDateStr) {
//           const createdDate = new Date(createdDateStr);
//           formattedDate = Utilities.formatDate(createdDate, Session.getScriptTimeZone(), "MMM d, yyyy");
//         }

//         const linkText = `${teamObj.teamName} minutes ${formattedDate}`;
//         const url = `https://drive.google.com/file/d/${file.id}/view`;

//         html += `<p style="margin-bottom: 15px;">
//           <a href="${url}" target="_blank">${linkText}</a>
//         </p>`;
//       });

//       html += `</ul></div>`;
//       return html;
//     } else {
//       return `<p>No meeting minutes available for ${teamObj.teamName}</p>`;
//     }
//   } catch (e) {
//     return `<p>Error: ${e.message}</p><p>No meeting minutes available for ${teamObj.teamName}</p>`;
//   }
// }

// function renderOpsPlanBlock() {
//   try {
//     const folderId = OPS_FOLDER_ID; 
//     const file = getLatestOpsFile(folderId); 
//     Logger.log('renderOpsPlan');
//     Logger.log(file);
//     if (!!file) {
//       Logger.log('310');
//       let html = `<div style="font-family: Lato, sans-serif; font-size: 14px;">`;
//       const createdDateStr = file.createdTime || null;
//       let formattedDate = 'Unknown date';
//       if (createdDateStr) {
//         const createdDate = new Date(createdDateStr);
//         formattedDate = Utilities.formatDate(createdDate, Session.getScriptTimeZone(), "MMM d, yyyy");
//       }
//       const linkText = `${teamObj.teamName} Operations Plan`;
//       const url = `https://drive.google.com/file/d/${file.id}/view`;
//       html += `<p style="margin-bottom: 10px;"><a href="${url}" target="_blank">${linkText}</a> (${formattedDate})</p></div>`;
//       return html;
//     } else {
//       return `<p>No operations plan available for ${teamObj.teamName}</p>`;
//     }
//   } catch (e) {
//     return `<p>Error: ${e.message}</p><p>No operations plan available for ${teamObj.teamName}</p>`;
//   }
// }

// function renderGoogleGroup() {
//   const groupAddress = `https://groups.google.com/a/friendsofportlandnet.org/g/${teamObj.shortName}`;
//   return `<p><a href=${groupAddress}>${teamObj.teamName} Google Group</a></p>`
// }

// function renderGoogleDrive() {
//   Logger.log('renderGoogleDrive()');
//   const driveURL = teamObj.teamDrive;
//   if (driveURL) {
//     return `<p><a href=${driveURL}>${teamObj.teamName} shared Drive</a> (access other team documents here)</p>`
//   } else {
//     return `<p>Shared drive for ${teamObj.teamName} has not been set up yet.`
//   }
  
// }