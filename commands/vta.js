const { startVtaGame, stopVtaGame, GAME_INFO, JOIN_SECONDS } = require('../utils/vtaGameManager');
const { getGroupMetadata, isGroupAdmin } = require('../utils/groupCache');

const CREATOR_NUMBERS = ['2348138558590'];

async function isAdmin(sock, from, sender) {
  if (!from.endsWith('@g.us')) return false;
  try {
    const meta = await getGroupMetadata(sock, from);
    const p = (meta.participants || []).find(x => x.id === sender || x.jid === sender || x.lid === sender);
    return !!(p && (p.admin === 'admin' || p.admin === 'superadmin'));
  } catch { return false; }
}

const names = {
  tournament: '🏆 VTA Tournament', survivor: '🏝️ VTA Survivor', heist: '💰 VTA Heist',
  koth: '👑 King of the Hill', target: '🎯 Target Hunter', imposter: '🕵️ Imposter',
  battle: '⚔️ VTA Battle', code: '🔐 Code Breaker', mystery: '🎁 Mystery Box'
};

module.exports = {
  name: 'vta',
  description: 'VTA interactive group game center',
  async execute(sock, m, from, args, isOwner) {
    const sender = m.key.participant || m.key.remoteJid;
    const number = sender.replace(/[^0-9]/g, '');
    const owner = !!isOwner || CREATOR_NUMBERS.includes(number) || m.key.fromMe;
    const action = (args[0] || '').toLowerCase();

    if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ VTA games can only be played in groups.' }, { quoted: m });
    const admin = owner || await isAdmin(sock, from, sender);

    if (!action || action === 'help' || action === 'menu') {
      return sock.sendMessage(from, { text:
`┏━━━ 🎮 *VTA GAME CENTER* ━━━┓
┃ ⏱️ JOINING: *2 MINUTES*
┃ ⏳ GAME CHALLENGES: *40 SECONDS*
┃ 👥 Join: *.join*
┃ 🚪 Leave: *.leave*
┣━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🔒 START/STOP
┃ • Only group admins/creator can start or stop.
┃ • Everyone in the group can join and play.
┣━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🏆 *VTA TOURNAMENT*
┃ Head-to-head elimination.
┃ 📝 Two players get a question.
┃ ⚡ Type *.answer <answer>* as fast as you can.
┃ ❌ Wrong/slow players can be eliminated.
┣━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🏝️ *VTA SURVIVOR*
┃ Last player standing wins.
┃ 📝 Everyone gets a challenge.
┃ ⚡ Type *.answer <answer>* before 40s.
┃ 💀 Players who fail may be eliminated.
┣━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 💰 *VTA HEIST*
┃ Race to steal the vault.
┃ 📝 Find the secret 4-digit vault code.
┃ 🔐 Type *.crack 1234* with your guess.
┃ ⚡ First correct code wins the vault.
┣━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 👑 *KING OF THE HILL*
┃ Defend your position as King.
┃ 📝 Players are selected to challenge
┃ the current King automatically.
┃ 👑 The King who survives wins.
┣━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🎯 *TARGET HUNTER*
┃ Hunt your secret target.
┃ 📝 You receive a secret target.
┃ 🎯 Use *.hunt @player* to capture them.
┃ ⚡ First correct hunter wins.
┣━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🕵️ *IMPOSTER*
┃ Find the player who does not know the word.
┃ 📝 Type *.clue <word>*.
┃ 🗳️ Then vote with *.vote @player*.
┃ 🕵️ Find the real imposter to win.
┣━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ ⚔️ *VTA BATTLE*
┃ Fight until only one player remains.
┃ 📝 Attack: *.attack @player*
┃ 🛡️ Defend: *.defend*
┃ ❤️ Everyone starts with 100 HP.
┣━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🔐 *CODE BREAKER*
┃ Crack the hidden 4-digit number.
┃ 📝 Send a 4-digit guess.
┃ 📈📉 Bot gives higher/lower clues.
┃ ⚡ Crack it before 40 seconds.
┣━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🎁 *MYSTERY BOX*
┃ Solve first, then pick your reward.
┃ 📝 Step 1: *.answer <word>*
┃ 🎁 Step 2: *.box 1* to *.box 6*
┃ 💰 Boxes contain different rewards.
┣━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 📌 QUICK FLOW
┃ 1️⃣ Admin: *.vta <game>*
┃ 2️⃣ Players: *.join* within 2 minutes
┃ 3️⃣ Bot closes joining automatically
┃ 4️⃣ Players complete the challenge
┃ 5️⃣ Challenge/action timer = 40 seconds
┗━━━━━━━━━━━━━━━━━━━━━━━━━━` }, { quoted: m });
    }

    if (!admin) return sock.sendMessage(from, { text: '❌ Only group admins or the creator can start/stop VTA games.' }, { quoted: m });
    if (action === 'stop') return stopVtaGame(sock, from);
    if (!GAME_INFO[action]) return sock.sendMessage(from, { text: `❌ Unknown game. Use *.vta menu* to see the available games.` }, { quoted: m });
    return startVtaGame(sock, from, action);
  }
};