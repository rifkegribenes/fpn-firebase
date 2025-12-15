function doPost(e) {

  if (!e || !e.postData) {
    return preflightResponse();
  }

  try {
    const data = e.parameter; // works with URL-encoded form submissions
    const sheet = ss.getSheetByName('TeamPageUpdateForm');

    // Map JS payload to sheet columns
    const row = [
      new Date(),                   // Timestamp
      data.email || '',             // Email Address
      data.team || '',              // Your Team
      data.updateType || '',        // What do you want to update?
      data.title || '',             // Announcement Title
      data.body || '',              // Announcement Body
      data.meetingDate || '',       // Date of meeting
      data.meetingFileUrl || '',    // Upload your meeting minutes
      data.operationsFileUrl || '', // Upload operations plan
      data.bannerFileUrl || '',     // Upload banner photo
      data.bannerAlt || '',         // Image alt text
      data.bannerPublicUrl || '',   // BannerPublicURL
      data.editUrl || '',           // Edit URL
      data.id || '',                // Id
      data.deleteUrl || ''          // Delete URL
    ];

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type');


  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type');

  }
}

function preflightResponse() {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

