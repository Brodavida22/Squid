const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const ACTIVITY_PATH = path.join(process.cwd(), 'activity.json');
let activity = {};
let loaded = false;
let dirty = false;
let saveTimer = null;
let saveInProgress = false;
let saveQueued = false;

function load() {
  if (loaded) return activity;
  loaded = true;

  try {
    if (fs.existsSync(ACTIVITY_PATH)) {
      const raw = fs.readFileSync(ACTIVITY_PATH, 'utf8');
      activity = raw.trim() ? JSON.parse(raw) : {};
    }
  } catch (err) {
    console.error('⚠️ [ACTIVITY] Failed to load activity.json:', err.message);
    activity = {};
  }
  return activity;
}

function record(groupJid, senderJid) {
  const data = load();
  if (!data[groupJid]) data[groupJid] = {};
  data[groupJid][senderJid] = (data[groupJid][senderJid] || 0) + 1;
  dirty = true;
  scheduleSave();
}

function getGroupActivity(groupJid) {
  return load()[groupJid] || {};
}

function scheduleSave(delay = 5000) {
  if (!dirty) return;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flush().catch(err => console.error('🔥 [ACTIVITY] Save failed:', err.message));
  }, delay);
}

async function flush() {
  load();
  if (!dirty) return;
  saveQueued = true;
  if (saveInProgress) return;

  saveInProgress = true;
  try {
    while (saveQueued) {
      saveQueued = false;
      if (!dirty) continue;
      dirty = false;
      const tmpPath = `${ACTIVITY_PATH}.tmp`;
      await fsp.writeFile(tmpPath, JSON.stringify(activity), 'utf8');
      await fsp.rename(tmpPath, ACTIVITY_PATH);
      if (dirty) saveQueued = true;
    }
  } finally {
    saveInProgress = false;
  }
}

async function shutdown() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  return flush();
}

module.exports = { record, getGroupActivity, flush, shutdown };
