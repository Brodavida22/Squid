// Bot command prefixes.
// Change BOT_PREFIXES in .env to control which prefixes are accepted.
// Example: BOT_PREFIXES=!,/,. 
function getPrefixes() {
    const raw = (process.env.BOT_PREFIXES || process.env.BOT_PREFIX || '#').trim();
    const prefixes = raw.split(',').map(p => p.trim()).filter(Boolean);
    return prefixes.length ? [...new Set(prefixes)] : ['#'];
}

function getPrefix() {
    return getPrefixes()[0];
}

module.exports = { getPrefixes, getPrefix };
