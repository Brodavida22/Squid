const activeVtaGames = {};
const JOIN_SECONDS = 120;
const ACTION_SECONDS = 40;
const PREFIX = 'VTA';

const GAME_INFO = {
  tournament: { title: '🏆 VTA TOURNAMENT', min: 2, reward: 500 },
  survivor: { title: '🏝️ VTA SURVIVOR', min: 3, reward: 1000 },
  heist: { title: '💰 VTA HEIST', min: 2, reward: 1200 },
  koth: { title: '👑 KING OF THE HILL', min: 2, reward: 900 },
  target: { title: '🎯 TARGET HUNTER', min: 3, reward: 1100 },
  imposter: { title: '🕵️ IMPOSTER', min: 4, reward: 1300 },
  battle: { title: '⚔️ VTA BATTLE', min: 2, reward: 1000 },
  code: { title: '🔐 CODE BREAKER', min: 1, reward: 800 },
  mystery: { title: '🎁 MYSTERY BOX', min: 1, reward: 1000 }
};

const WORDS = ['BEACH','JUNGLE','DIAMOND','PIZZA','ROCKET','CASTLE','DRAGON','THUNDER','MIRROR','TIGER'];

const MATH_CHALLENGES = [
  () => { const a = 2 + Math.floor(Math.random() * 8), b = 2 + Math.floor(Math.random() * 8); return { q: `What is *${a} × ${b}*?`, answer: String(a * b) }; },
  () => { const a = 20 + Math.floor(Math.random() * 50), b = 10 + Math.floor(Math.random() * 30); return { q: `What is *${a} + ${b}*?`, answer: String(a + b) }; },
  () => { const b = 3 + Math.floor(Math.random() * 7), a = b * (2 + Math.floor(Math.random() * 8)); return { q: `What is *${a} ÷ ${b}*?`, answer: String(a / b) }; },
  () => { const a = 30 + Math.floor(Math.random() * 40), b = 5 + Math.floor(Math.random() * 20); return { q: `What is *${a} − ${b}*?`, answer: String(a - b) }; }
];

const WORD_CHALLENGES = [
  { q: 'Unscramble: *RTAE*', answer: 'RATE' },
  { q: 'Unscramble: *NIGK*', answer: 'KING' },
  { q: 'Unscramble: *LPEPA*', answer: 'APPLE' },
  { q: 'Unscramble: *RFEI*', answer: 'FIRE' },
  { q: 'Unscramble: *NOMO*', answer: 'MOON' },
  { q: 'Unscramble: *RTAEHW*', answer: 'EARTH' }
];

function shuffle(a) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function uid(m) { return m.key.participant || m.key.remoteJid; }
function num(jid) { return String(jid).replace(/[^0-9]/g, ''); }
function mention(jid) { return `@${num(jid)}`; }
function normalize(s) { return String(s || '').trim().toUpperCase(); }
function getMentions(m) { return m.message?.extendedTextMessage?.contextInfo?.mentionedJid || m.message?.contextInfo?.mentionedJid || []; }
function playerList(s) { return Object.keys(s.players || {}); }
function activePlayers(s) { return playerList(s).filter(id => s.players[id].alive !== false); }
function clearSessionTimer(s) { if (s.timer) clearTimeout(s.timer); s.timer = null; }

async function send(sock, from, text, mentions = []) {
  return sock.sendMessage(from, { text, ...(mentions.length ? { mentions } : {}) });
}

function dashboard(info, game, extra = '') {
  return `┏━━━ ${info.title} ━━━┓\n┃ 👥 Players: *${Object.keys(game.players).length}*\n┃ ⏳ Joining: *${JOIN_SECONDS}s*\n┣━━━━━━━━━━━━━━━━━━━━\n${extra ? `┃ ${extra.replace(/\n/g, '\n┃ ')}\n┣━━━━━━━━━━━━━━━━━━━━\n` : ''}┃ Type *.join* to enter\n┗━━━━━━━━━━━━━━━━━━━━┛`;
}

async function startVtaGame(sock, from, type) {
  if (!GAME_INFO[type]) return send(sock, from, '❌ Unknown VTA game.');
  if (activeVtaGames[from]) return send(sock, from, '❌ A VTA game is already running in this group. Use *.vta stop* first.');
  if (!from.endsWith('@g.us')) return send(sock, from, '❌ VTA games can only run in groups.');

  const info = GAME_INFO[type];
  const session = activeVtaGames[from] = {
    type, phase: 'joining', players: {}, createdAt: Date.now(), sock, timer: null,
    data: {}, joinedClosed: false
  };

  const challengeHelp = {
    tournament: '⚔️ Players will face head-to-head questions. Type *.answer <answer>* to win your matchup.',
    survivor: '🧠 Every survivor must solve a challenge. Type *.answer <answer>* before the timer ends or you may be eliminated.',
    heist: '🔐 Crack the vault challenge. Type *.crack <4-digit code>* to steal the vault.',
    target: '🎯 Find your secret target and type *.hunt @player* to make a capture attempt.',
    imposter: '🕵️ Give clues, identify the imposter, then vote with *.vote @player*.',
    mystery: '🎁 Complete a box challenge, then choose with *.box 1* to *.box 6*.'
  }[type] || '🎮 Follow the instructions sent when the challenge starts.';

  await send(sock, from, dashboard(info, session, `🚀 Game opened!\n🎟️ Minimum players: *${info.min}*\n💰 Winner reward: *${info.reward} VTA Coins*\n\n${challengeHelp}`));
  session.timer = setTimeout(() => closeJoining(from).catch(console.error), JOIN_SECONDS * 1000);
}

async function closeJoining(from) {
  const s = activeVtaGames[from];
  if (!s || s.phase !== 'joining') return;
  clearSessionTimer(s);
  s.joinedClosed = true;
  const ids = playerList(s);
  const info = GAME_INFO[s.type];
  if (ids.length < info.min) {
    await send(s.sock, from, `❌ *${info.title}* cancelled.\nOnly *${ids.length}* player(s) joined; minimum is *${info.min}*.\n\nUse *.vta ${s.type}* to try again.`);
    delete activeVtaGames[from];
    return;
  }
  s.phase = 'playing';
  await send(s.sock, from, `🔒 *JOINING CLOSED!*\n\n${info.title}\n👥 Players: *${ids.length}*\n\n🎮 Your challenge is starting...`);
  setTimeout(() => beginGame(from).catch(console.error), 1800);
}

function addPlayer(s, m) {
  const id = uid(m);
  if (!id || id.endsWith('@g.us')) return false;
  if (s.players[id]) return false;
  s.players[id] = { id, name: m.pushName || num(id), alive: true, coins: 0, hp: 100, score: 0 };
  return true;
}

async function beginGame(from) {
  const s = activeVtaGames[from]; if (!s) return;
  switch (s.type) {
    case 'tournament': return tournamentRound(from);
    case 'survivor': return survivorRound(from);
    case 'heist': return heistRound(from);
    case 'koth': return kothStart(from);
    case 'target': return targetStart(from);
    case 'imposter': return imposterStart(from);
    case 'battle': return battleStart(from);
    case 'code': return codeStart(from);
    case 'mystery': return mysteryStart(from);
  }
}

async function finish(from, winner, message = '') {
  const s = activeVtaGames[from]; if (!s) return;
  clearSessionTimer(s);
  if (winner && s.players[winner]) {
    s.players[winner].score += GAME_INFO[s.type].reward;
    await send(s.sock, from, `${message}\n\n🏆 WINNER: ${mention(winner)}\n💰 +${GAME_INFO[s.type].reward} VTA Coins`, [winner]);
  } else await send(s.sock, from, message);
  delete activeVtaGames[from];
}

function nextMathChallenge() { return pick(MATH_CHALLENGES)(); }

async function tournamentRound(from) {
  const s = activeVtaGames[from]; if (!s) return;
  const alive = shuffle(activePlayers(s));
  if (alive.length <= 1) return finish(from, alive[0], '🏆 Tournament completed!');
  const a = alive[0], b = alive[1];
  s.phase = 'challenge';
  s.data.challenge = nextMathChallenge();
  s.data.responders = {};
  s.data.duel = [a, b];
  await send(s.sock, from,
    `🏆 *VTA TOURNAMENT — ROUND ${s.data.round = (s.data.round || 0) + 1}*\n\n` +
    `⚔️ ${mention(a)} VS ${mention(b)}\n\n` +
    `🧠 CHALLENGE:\n${s.data.challenge.q}\n\n` +
    `⚡ First player to type *.answer <answer>* correctly advances!\n⏱️ You have *40 seconds*.`, [a, b]);
  s.timer = setTimeout(() => tournamentTimeout(from).catch(console.error), ACTION_SECONDS * 1000);
}

async function tournamentTimeout(from) {
  const s = activeVtaGames[from]; if (!s || s.type !== 'tournament' || s.phase !== 'challenge') return;
  const [a, b] = s.data.duel;
  const answered = Object.keys(s.data.responders || {});
  const winner = answered.find(id => s.data.responders[id] === true);
  const loser = winner === a ? b : winner === b ? a : pick([a, b]);
  s.players[loser].alive = false;
  s.phase = 'playing';
  await send(s.sock, from, winner
    ? `⚡ ${mention(winner)} was correct first!\n💀 ${mention(loser)} is eliminated from the tournament.`
    : `⏰ Time is up! Nobody solved it.\n💀 ${mention(loser)} is eliminated.`, winner ? [winner, loser] : [loser]);
  setTimeout(() => tournamentRound(from).catch(console.error), 2500);
}

async function survivorRound(from) {
  const s = activeVtaGames[from]; if (!s) return;
  const alive = activePlayers(s);
  if (alive.length <= 1) return finish(from, alive[0], '🏝️ The island has chosen its final survivor!');
  s.phase = 'challenge';
  s.data.challenge = nextMathChallenge();
  s.data.correct = {};
  s.data.round = (s.data.round || 0) + 1;
  await send(s.sock, from,
    `🏝️ *VTA SURVIVOR — CHALLENGE ${s.data.round}*\n\n` +
    `🧠 ${s.data.challenge.q}\n\n` +
    `👥 Every survivor must answer with *.answer <answer>*.\n` +
    `⏱️ You have *40 seconds*.\n\n` +
    `💀 Anyone who fails to answer correctly is at risk of elimination.`, alive);
  s.timer = setTimeout(() => survivorTimeout(from).catch(console.error), ACTION_SECONDS * 1000);
}

async function survivorTimeout(from) {
  const s = activeVtaGames[from]; if (!s || s.type !== 'survivor' || s.phase !== 'challenge') return;
  const alive = activePlayers(s);
  const correct = Object.keys(s.data.correct || {});
  const wrong = alive.filter(id => !correct.includes(id));
  const eliminateCount = alive.length > 4 ? Math.min(2, wrong.length) : 1;
  const eliminated = shuffle(wrong).slice(0, eliminateCount);
  if (!eliminated.length) return survivorRound(from);
  eliminated.forEach(id => { s.players[id].alive = false; });
  s.phase = 'playing';
  await send(s.sock, from,
    `🏝️ *SURVIVOR RESULTS*\n\n` +
    `✅ Correct survivors: *${correct.length}*\n` +
    `💀 Eliminated: ${eliminated.map(mention).join(', ')}\n\n` +
    `👥 Survivors left: *${activePlayers(s).length}*\n` +
    `⏱️ Next challenge in 4 seconds...`, eliminated);
  setTimeout(() => survivorRound(from).catch(console.error), 4000);
}

async function heistRound(from) {
  const s = activeVtaGames[from]; if (!s) return;
  s.phase = 'challenge';
  s.data.vault = String(Math.floor(1000 + Math.random() * 9000));
  s.data.crackedBy = null;
  await send(s.sock, from,
    `💰 *VTA HEIST — VAULT CHALLENGE*\n\n` +
    `🔐 The vault has a secret *4-digit code*.\n` +
    `💡 Clue: the first digit is *${s.data.vault[0]}*.\n` +
    `💡 Clue: the last digit is *${s.data.vault[3]}*.\n\n` +
    `🎯 Try to crack it with *.crack <4-digit code>*.\n` +
    `⚡ First correct crack steals the vault!\n⏱️ 40 seconds.`);
  s.timer = setTimeout(() => heistTimeout(from).catch(console.error), ACTION_SECONDS * 1000);
}

async function heistTimeout(from) {
  const s = activeVtaGames[from]; if (!s || s.type !== 'heist' || s.phase !== 'challenge') return;
  await finish(from, null, `🚨 *HEIST FAILED!*\n\nNobody cracked the vault.\n🔐 The code was *${s.data.vault}*.\n💸 The crew escaped empty-handed.`);
}

async function kothStart(from) {
  const s = activeVtaGames[from]; if (!s) return;
  s.phase = 'playing';
  s.data.king = pick(activePlayers(s));
  await send(s.sock, from, `👑 *KING OF THE HILL*\n\nCurrent King: ${mention(s.data.king)}\n\n⚔️ Challenges will begin automatically!`, [s.data.king]);
  s.timer = setTimeout(() => kothRound(from).catch(console.error), 6000);
}
async function kothRound(from) {
  const s = activeVtaGames[from]; if (!s) return;
  const challengers = activePlayers(s).filter(id => id !== s.data.king);
  if (!challengers.length) return finish(from, s.data.king, '👑 The King defended the hill!');
  const challenger = pick(challengers);
  const old = s.data.king;
  s.data.king = Math.random() < 0.5 ? challenger : old;
  await send(s.sock, from, `👑 *KING OF THE HILL*\n\n⚔️ ${mention(challenger)} challenged ${mention(old)}!\n🏆 Winner: ${mention(s.data.king)}\n\n⏱️ Next challenge begins in 4 seconds...`, [challenger, old, s.data.king]);
  s.timer = setTimeout(() => kothRound(from).catch(console.error), 4000);
}

async function targetStart(from) {
  const s = activeVtaGames[from]; if (!s) return;
  const ids = shuffle(activePlayers(s));
  s.phase = 'challenge';
  s.data.targets = {};
  s.data.captured = {};
  ids.forEach((id, i) => { s.data.targets[id] = ids[(i + 1) % ids.length]; });
  for (const id of ids) {
    await send(s.sock, id, `🎯 *TARGET HUNTER — YOUR MISSION*\n\nYour secret target is: *${s.players[s.data.targets[id]].name}*\n\n🎯 In the group, use *.hunt @player* when you think you found them.\n⚡ Correct capture = you win. Wrong capture = your hunt is wasted.`, []);
  }
  await send(s.sock, from, `🎯 *TARGET HUNTER STARTED!*\n\n🔎 Everyone has a secret target.\n🎯 Capture your target with *.hunt @player*.\n⚡ First correct hunter wins!\n⏱️ Game ends in 40 seconds.`);
  s.timer = setTimeout(() => targetEnd(from).catch(console.error), ACTION_SECONDS * 1000);
}
async function targetEnd(from) {
  const s = activeVtaGames[from]; if (!s) return;
  const winner = Object.keys(s.data.captured || {})[0] || null;
  await finish(from, winner, winner
    ? `🎯 *TARGET HUNTER OVER!*\n\n${mention(winner)} completed the mission first!`
    : `🎯 *TARGET HUNTER OVER!*\n\nNobody captured their target in time.`);
}

async function imposterStart(from) {
  const s = activeVtaGames[from]; if (!s) return;
  const ids = activePlayers(s); const imp = pick(ids); const word = pick(WORDS);
  s.phase = 'clue';
  s.data.imposter = imp; s.data.word = word; s.data.votes = {}; s.data.clues = {};
  for (const id of ids) {
    await send(s.sock, id, id === imp
      ? '🕵️ *YOU ARE THE IMPOSTER!*\n\nYou do NOT know the secret word.\n\n💬 Give a believable one-word clue after seeing other clues, but do not reveal that you are the imposter.'
      : `🕵️ *IMPOSTER GAME*\n\nSecret word: *${word}*\n\n💬 Your challenge: give a one-word clue that proves you know the word without making it too obvious.\n\nIn the group, type *.clue <word>*`, []);
  }
  await send(s.sock, from, `🕵️ *IMPOSTER CHALLENGE STARTED!*\n\n💬 Everyone must submit a clue with *.clue <word>*.\n🕵️ One player does not know the secret word.\n⏱️ Clue phase: *40 seconds*.\n\nAfter clues, voting will open.`);
  s.timer = setTimeout(() => imposterVoteOpen(from).catch(console.error), ACTION_SECONDS * 1000);
}
async function imposterVoteOpen(from) {
  const s = activeVtaGames[from]; if (!s) return;
  s.phase = 'voting';
  const clues = Object.entries(s.data.clues || {}).map(([id, clue]) => `${mention(id)} → *${clue}*`).join('\n') || 'No clues submitted.';
  await send(s.sock, from, `🗳️ *VOTING OPEN!*\n\n${clues}\n\nUse *.vote @player* to identify the imposter.\n⏳ You have 40 seconds.`);
  s.timer = setTimeout(() => imposterEnd(from).catch(console.error), ACTION_SECONDS * 1000);
}
async function imposterEnd(from) {
  const s = activeVtaGames[from]; if (!s) return;
  const entries = Object.entries(s.data.votes);
  const counts = {}; entries.forEach(([, target]) => counts[target] = (counts[target] || 0) + 1);
  const guessed = Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0];
  const won = guessed === s.data.imposter;
  const winner = won ? guessed : s.data.imposter;
  await finish(from, winner, `🕵️ *IMPOSTER RESULTS*\n\nSecret word: *${s.data.word}*\nActual Imposter: ${mention(s.data.imposter)}\nGroup guess: ${guessed ? mention(guessed) : 'No votes'}`);
}

async function battleStart(from) {
  const s = activeVtaGames[from]; if (!s) return;
  s.phase = 'playing';
  activePlayers(s).forEach(id => s.players[id].hp = 100);
  await send(s.sock, from, `⚔️ *VTA BATTLE STARTED!*\n\nPlayers have *100 HP*.\nUse *.attack @player* to attack someone.\n💥 Each successful attack deals 20–40 damage.\n🛡️ Type *.defend* to restore 10 HP.\n\nLast player standing wins!`);
  s.data.lastAction = {};
}

async function battleAction(sock, from, m, text) {
  const s = activeVtaGames[from]; if (!s || s.type !== 'battle' || s.phase !== 'playing') return false;
  const me = uid(m); if (!s.players[me] || !s.players[me].alive) return true;
  const cmd = normalize(text).split(/\s+/)[0];
  if (cmd === '.DEFEND' || cmd === 'DEFEND') {
    s.players[me].hp = Math.min(100, s.players[me].hp + 10);
    await send(sock, from, `🛡️ ${mention(me)} restored *10 HP* → ${s.players[me].hp}/100`, [me]); return true;
  }
  if (cmd !== '.ATTACK' && cmd !== 'ATTACK') return false;
  const targets = getMentions(m); const target = targets.find(id => s.players[id] && id !== me && s.players[id].alive);
  if (!target) { await send(sock, from, '⚔️ Mention a living player: *.attack @player*', [me]); return true; }
  const dmg = 20 + Math.floor(Math.random() * 21); s.players[target].hp -= dmg;
  let msg = `⚔️ ${mention(me)} attacked ${mention(target)} for *${dmg} damage*!\n❤️ ${mention(target)} HP: *${Math.max(0,s.players[target].hp)}/100*`;
  if (s.players[target].hp <= 0) { s.players[target].alive = false; msg += `\n💀 ${mention(target)} has been eliminated!`; }
  const alive = activePlayers(s); if (alive.length === 1) { await finish(from, alive[0], msg + '\n\n⚔️ Battle complete!'); } else await send(sock, from, msg, [me,target]);
  return true;
}

async function codeStart(from) {
  const s = activeVtaGames[from]; if (!s) return;
  s.phase = 'playing';
  s.data.code = String(Math.floor(1000 + Math.random() * 9000)); s.data.attempts = {};
  await send(s.sock, from, `🔐 *CODE BREAKER*\n\nCrack the secret 4-digit code!\n🎯 Send any 4-digit guess in the group.\n💡 I will give Higher/Lower clues.\n\n⏳ Time limit: 40 seconds.`);
  s.timer = setTimeout(() => finish(from, null, `⏰ *TIME'S UP!*\n\n🔐 The secret code was *${s.data.code}*.`), ACTION_SECONDS * 1000);
}

async function mysteryStart(from) {
  const s = activeVtaGames[from]; if (!s) return;
  s.phase = 'challenge';
  s.data.claimed = {}; s.data.boxes = shuffle([1000, 500, 250, -150, 750, 2000]);
  s.data.challenge = pick(WORD_CHALLENGES);
  await send(s.sock, from, `🎁 *MYSTERY BOX — CHALLENGE*\n\n🧩 ${s.data.challenge.q}\n\n🎯 Type *.answer <word>* to prove you solved the challenge.\n⚡ Only players who solve it can open a box.\n⏱️ Challenge time: *40 seconds*.`);
  s.timer = setTimeout(() => mysteryBoxPhase(from).catch(console.error), ACTION_SECONDS * 1000);
}
async function mysteryBoxPhase(from) {
  const s = activeVtaGames[from]; if (!s || s.type !== 'mystery' || s.phase !== 'challenge') return;
  s.phase = 'boxes';
  const qualified = Object.keys(s.data.qualified || {});
  if (!qualified.length) return finish(from, null, `🎁 *MYSTERY BOX OVER!*\n\nNobody solved the challenge.`);
  await send(s.sock, from, `🎁 *BOXES ARE OPEN!*\n\nQualified players: ${qualified.map(mention).join(', ')}\n\nChoose one box with *.box 1* through *.box 6*.\n⚡ One box may contain the jackpot!\n⏱️ 40 seconds.`, qualified);
  s.timer = setTimeout(() => mysteryEnd(from).catch(console.error), ACTION_SECONDS * 1000);
}
async function mysteryEnd(from) {
  const s = activeVtaGames[from]; if (!s) return;
  const entries = Object.entries(s.data.claimed || {});
  if (!entries.length) return finish(from, null, '🎁 *MYSTERY BOX OVER!*\nNobody picked a box.');
  const [winner, amount] = entries.sort((a,b) => b[1] - a[1])[0];
  await finish(from, winner, `🎁 *MYSTERY BOX RESULTS*\n\n${mention(winner)} found the best box: *${amount} VTA Coins*!`);
}

async function handleVtaMessage(sock, m, from, text) {
  const s = activeVtaGames[from]; if (!s) return false;
  const raw = String(text || '').trim(); const lower = raw.toLowerCase(); const me = uid(m);
  if (s.phase === 'joining') {
    if (lower === '.join' || lower === 'join') {
      const added = addPlayer(s, m);
      await send(sock, from, added ? `✅ ${mention(me)} joined *${GAME_INFO[s.type].title}*!\n👥 Players: *${playerList(s).length}*` : `ℹ️ ${mention(me)}, you are already in the game.`, [me]);
      return true;
    }
    if (lower === '.leave' || lower === 'leave') {
      if (s.players[me]) delete s.players[me];
      await send(sock, from, `🚪 ${mention(me)} left the game.\n👥 Players: *${playerList(s).length}*`, [me]); return true;
    }
    return false;
  }

  // Shared answer command for Tournament, Survivor and Mystery Box.
  if (/^\.?answer\s+/i.test(raw)) {
    const answer = raw.replace(/^\.?answer\s+/i, '').trim();
    if (!s.players[me]) return true;
    if (s.type === 'tournament' && s.phase === 'challenge' && s.data.duel.includes(me)) {
      if (normalize(answer) === normalize(s.data.challenge.answer)) {
        if (!s.data.responders[me]) {
          s.data.responders[me] = true;
          clearSessionTimer(s);
          s.phase = 'playing';
          const loser = s.data.duel.find(id => id !== me);
          s.players[loser].alive = false;
          await send(sock, from, `⚡ CORRECT! ${mention(me)} wins the duel!\n🏆 Answer: *${s.data.challenge.answer}*\n💀 ${mention(loser)} is eliminated.`, [me, loser]);
          setTimeout(() => tournamentRound(from).catch(console.error), 2500);
        }
      } else {
        await send(sock, from, `❌ ${mention(me)} — wrong answer. Try again before time runs out!`, [me]);
      }
      return true;
    }
    if (s.type === 'survivor' && s.phase === 'challenge' && s.players[me].alive) {
      if (normalize(answer) === normalize(s.data.challenge.answer)) {
        s.data.correct[me] = true;
        await send(sock, from, `✅ ${mention(me)} solved it! You are safe this round.`, [me]);
      } else await send(sock, from, `❌ ${mention(me)} — wrong answer. Keep trying!`, [me]);
      return true;
    }
    if (s.type === 'mystery' && s.phase === 'challenge') {
      if (normalize(answer) === normalize(s.data.challenge.answer)) {
        s.data.qualified = s.data.qualified || {};
        s.data.qualified[me] = true;
        await send(sock, from, `✅ ${mention(me)} solved the mystery challenge and qualified for the boxes! 🎁`, [me]);
      } else await send(sock, from, `❌ ${mention(me)} — not correct.`, [me]);
      return true;
    }
  }

  if (s.type === 'heist' && s.phase === 'challenge' && /^\.?crack\s+\d{4}$/i.test(raw)) {
    const guess = raw.replace(/^\.?crack\s+/i, '').trim();
    if (guess === s.data.vault) {
      clearSessionTimer(s); s.phase = 'playing';
      await finish(from, me, `💰 *VAULT CRACKED!*\n\n🔓 ${mention(me)} entered the correct code: *${guess}*\n💎 The entire vault belongs to the winner!`);
    } else {
      await send(sock, from, `🚨 ${mention(me)} tried *${guess}* — wrong code!`, [me]);
    }
    return true;
  }

  if (s.type === 'target' && s.phase === 'challenge' && /^\.?hunt\b/i.test(raw)) {
    const target = getMentions(m)[0];
    if (!target || !s.players[target]) { await send(sock, from, '🎯 Use *.hunt @player* to make your capture attempt.', [me]); return true; }
    if (s.data.targets[me] === target) {
      s.data.captured[me] = target; clearSessionTimer(s);
      await finish(from, me, `🎯 *DIRECT HIT!*\n\n${mention(me)} found their secret target ${mention(target)}!`);
    } else {
      await send(sock, from, `❌ ${mention(me)} missed! That is not your target.`, [me]);
    }
    return true;
  }

  if (s.type === 'imposter' && s.phase === 'clue' && /^\.?clue\s+\S+/i.test(raw)) {
    const clue = raw.replace(/^\.?clue\s+/i, '').trim().split(/\s+/)[0];
    if (s.players[me]) {
      s.data.clues[me] = clue;
      await send(sock, from, `💬 ${mention(me)} submitted a clue.`, [me]);
    }
    return true;
  }

  if (s.type === 'imposter' && s.phase === 'voting' && /^\.?vote\b/i.test(raw)) {
    const target = getMentions(m)[0];
    if (!target || !s.players[target]) { await send(sock, from, '🗳️ Use *.vote @player* to vote.'); return true; }
    s.data.votes[me] = target; await send(sock, from, `🗳️ ${mention(me)} voted.`, [me]); return true;
  }

  if (s.type === 'battle') return battleAction(sock, from, m, raw);
  if (s.type === 'code') {
    const guess = raw.replace(/\D/g, '');
    if (/^\d{4}$/.test(guess)) {
      if (guess === s.data.code) { clearSessionTimer(s); await finish(from, me, `🎉 ${mention(me)} cracked the code: *${guess}*!`); }
      else await send(sock, from, `🔐 ${mention(me)} guessed *${guess}* — ${guess < s.data.code ? '📈 Try a higher number!' : '📉 Try a lower number!'}`, [me]);
      return true;
    }
  }
  if (s.type === 'mystery' && s.phase === 'boxes' && /^\.?box\s+[1-6]$/i.test(raw)) {
    if (!s.data.qualified?.[me]) { await send(sock, from, `❌ ${mention(me)}, you must solve the challenge before opening a box.`, [me]); return true; }
    const n = parseInt(raw.split(/\s+/)[1], 10);
    if (s.data.claimed[me] !== undefined) { await send(sock, from, `ℹ️ ${mention(me)}, you already opened a box.`, [me]); return true; }
    s.data.claimed[me] = s.data.boxes[n - 1];
    await send(sock, from, `🎁 ${mention(me)} opened Box *${n}*: *${s.data.claimed[me] >= 0 ? '+' : ''}${s.data.claimed[me]} coins*!`, [me]); return true;
  }
  return false;
}

async function stopVtaGame(sock, from) {
  const s = activeVtaGames[from];
  if (!s) return send(sock, from, '❌ No active VTA game in this group.');
  clearSessionTimer(s); delete activeVtaGames[from];
  return send(sock, from, '🛑 *VTA game stopped by an admin/creator.*');
}
function isVtaActive(from) { return !!activeVtaGames[from]; }
module.exports = { startVtaGame, stopVtaGame, handleVtaMessage, isVtaActive, GAME_INFO, JOIN_SECONDS, ACTION_SECONDS };
