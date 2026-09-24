const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const SETTINGS_PATH = path.join(process.cwd(), 'settings.json');

let settings = {};
let loaded = false;
let saveTimer = null;
let saveInProgress = false;
let saveQueued = false;

function loadSettings() {
  if (loaded) return settings;
  loaded = true;

  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
      settings = raw.trim() ? JSON.parse(raw) : {};
    }
  } catch (err) {
    console.error('⚠️ [SETTINGS] Failed to load settings.json:', err.message);
    settings = {};
  }

  return settings;
}

function getSettings() {
  return loadSettings();
}

function scheduleSave(delay = 250) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushSettings().catch(err =>
      console.error('🔥 [SETTINGS] Save failed:', err.message)
    );
  }, delay);
}

function saveSettings(options = {}) {
  loadSettings();
  if (options.immediate) return flushSettings();
  scheduleSave(options.delay ?? 250);
  return Promise.resolve();
}

async function flushSettings() {
  loadSettings();
  saveQueued = true;
  if (saveInProgress) return;

  saveInProgress = true;
  try {
    while (saveQueued) {
      saveQueued = false;
      const tmpPath = `${SETTINGS_PATH}.tmp`;
      const data = JSON.stringify(settings, null, 2);
      await fsp.writeFile(tmpPath, data, 'utf8');
      await fsp.rename(tmpPath, SETTINGS_PATH);
    }
  } finally {
    saveInProgress = false;
  }
}

function getGroupSettings(jid) {
  const s = loadSettings();
  return {
    antispam: s.antispam?.[jid],
    badwords: s.badwords?.[jid],
    antilink: s.antilink?.[jid],
    agm: s.agm?.[jid]
  };
}

async function shutdown() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  return flushSettings();
}

module.exports = {
  SETTINGS_PATH,
  getSettings,
  getGroupSettings,
  saveSettings,
  flushSettings,
  shutdown
};
