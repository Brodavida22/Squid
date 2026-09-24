const CACHE_TTL = 60 * 1000;
const cacheBySocket = new WeakMap();

function getCache(sock) {
  let cache = cacheBySocket.get(sock);
  if (!cache) {
    cache = new Map();
    cacheBySocket.set(sock, cache);
  }
  return cache;
}

function normalizeJid(jid) {
  return String(jid || '').trim();
}

async function getGroupMetadata(sock, jid, options = {}) {
  if (!jid || !jid.endsWith('@g.us')) return null;

  const ttl = Number.isFinite(options.ttl) ? options.ttl : CACHE_TTL;
  const force = options.force === true;
  const cache = getCache(sock);
  const now = Date.now();
  const cached = cache.get(jid);

  if (!force && cached) {
    if (cached.value && now - cached.time < ttl) return cached.value;
    if (cached.promise) return cached.promise;
  }

  const promise = sock.groupMetadata(jid)
    .then(meta => {
      cache.set(jid, { value: meta, time: Date.now() });
      return meta;
    })
    .catch(err => {
      if (cached?.value) return cached.value;
      cache.delete(jid);
      throw err;
    });

  cache.set(jid, { ...(cached || {}), promise });
  return promise;
}

function invalidateGroupMetadata(sock, jid) {
  if (!sock || !jid) return;
  const cache = cacheBySocket.get(sock);
  if (cache) cache.delete(normalizeJid(jid));
}

function clearGroupMetadataCache(sock) {
  const cache = cacheBySocket.get(sock);
  if (cache) cache.clear();
}

async function isGroupAdmin(sock, jid, participantJid) {
  const meta = await getGroupMetadata(sock, jid);
  if (!meta) return false;
  const participant = (meta.participants || []).find(p =>
    p.id === participantJid || p.jid === participantJid || p.lid === participantJid
  );
  return !!(participant && (participant.admin === 'admin' || participant.admin === 'superadmin'));
}

module.exports = {
  CACHE_TTL,
  getGroupMetadata,
  invalidateGroupMetadata,
  clearGroupMetadataCache,
  isGroupAdmin
};
