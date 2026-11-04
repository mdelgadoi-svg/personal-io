// Personal IO bridge. Runs in your own Google account, as you.
// It keeps your Personal IO data in your Google Drive, reads and writes your Google Calendar,
// and reads (never changes) your recent Gmail when you ask it to find tasks,
// so the app never has to ask you to sign in. Only someone with your key can use it.
// Setup: Personal IO > Settings > Google bridge. Needs the Google Calendar API service (Services +).

const KEY = '__KEY__';
const FOLDER = 'Personal IO';
const FILE = 'personal-io-data.json';
const CAL = 'primary';

function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    if (KEY === '__' + 'KEY__' || req.key !== KEY) throw new Error('key');
    out = handle(req);
  } catch (err) {
    out = { error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('Personal IO bridge is running.');
}

function handle(req) {
  switch (req.action) {
    case 'ping': return { ok: true, account: Session.getEffectiveUser().getEmail() };
    case 'info': return { savedAt: current().savedAt };
    case 'read': { const c = current(); return { savedAt: c.savedAt, text: c.savedAt ? c.text : null }; }
    case 'write': return write(req);
    case 'events': {
      const res = Calendar.Events.list(req.calendarId || CAL, {
        timeMin: req.timeMin, timeMax: req.timeMax, singleEvents: true, orderBy: 'startTime', maxResults: 250,
      });
      return { items: res.items || [], summary: res.summary || '' };
    }
    case 'emails': return { emails: recentEmails() };
    case 'writeDay': {
      const cal = req.calendarId || CAL;
      // Only removes events Personal IO wrote itself.
      (req.deleteIds || []).forEach((id) => {
        try {
          const ev = Calendar.Events.get(cal, id);
          if (ev.extendedProperties && ev.extendedProperties.private && ev.extendedProperties.private.personalIo === '1') Calendar.Events.remove(cal, id);
        } catch (err) { /* already gone */ }
      });
      const ids = (req.bodies || []).map((body) => Calendar.Events.insert(body, cal).id);
      return { ids };
    }
    default: throw new Error('unknown action');
  }
}

// Read only: the last 2 weeks of mail (no promotions or social): subject, sender, date and Gmail's short preview.
// Uses the Gmail service with the read-only permission set in appsscript.json (Settings > Google > Add Gmail).
// Nothing is changed in Gmail and no attachments are read.
function recentEmails() {
  const q = 'newer_than:14d -category:promotions -category:social -category:forums';
  const list = Gmail.Users.Messages.list('me', { q, maxResults: 40 });
  return (list.messages || []).map((m) => {
    const msg = Gmail.Users.Messages.get('me', m.id, { format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] });
    const head = (name) => (((msg.payload && msg.payload.headers) || []).find((x) => x.name.toLowerCase() === name) || {}).value || '';
    return {
      subject: head('subject') || '(no subject)',
      from: head('from').replace(/<.*>/, '').trim(),
      date: head('date').slice(0, 16),
      snippet: String(msg.snippet || '').slice(0, 220),
      sent: (msg.labelIds || []).indexOf('SENT') >= 0,
    };
  });
}

// Saves only if nobody saved since the app last looked (expect), so two devices never overwrite each other.
function write(req) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const now = current().savedAt;
    if ((req.expect || null) !== now) return { conflict: true, savedAt: now };
    dataFile(true).setContent(req.text);
    return { ok: true, savedAt: req.savedAt };
  } finally {
    lock.releaseLock();
  }
}

// The data file says when it was saved, so a second copy of this script sees the same thing.
function current() {
  const f = dataFile(false);
  if (!f) return { savedAt: null, text: null };
  const text = f.getBlob().getDataAsString('UTF-8');
  let savedAt = null;
  try { savedAt = JSON.parse(text).savedAt || null; } catch (err) { /* empty or unreadable */ }
  return { savedAt, text };
}

// Skips anything in the trash.
function dataFile(create) {
  const folders = DriveApp.searchFolders("title = '" + FOLDER + "' and trashed = false");
  let folder = folders.hasNext() ? folders.next() : null;
  if (!folder) {
    if (!create) return null;
    folder = DriveApp.createFolder(FOLDER);
  }
  const files = folder.searchFiles("title = '" + FILE + "' and trashed = false");
  if (files.hasNext()) return files.next();
  return create ? folder.createFile(FILE, '{}', 'application/json') : null;
}

// Run this once from the editor (select it, then Run) to allow Drive and Calendar access.
function setup() {
  dataFile(true);
  Calendar.Events.list(CAL, { maxResults: 1 });
  Logger.log('Ready. Now Deploy > New deployment > Web app.');
}
