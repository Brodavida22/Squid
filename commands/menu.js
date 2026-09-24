const fs = require('fs');
const path = require('path');
const { getMode } = require('../utils/mode');
const { getPrefix } = require('../utils/prefix');



module.exports = {
    name: 'menu',
    description: 'Displays the main command categories and bot status dashboard',
    async execute(sock, m, from) {
        const prefix = getPrefix();
        const botMode = getMode().toUpperCase() === 'PRIVATE' ? '𝗣𝗥𝗜𝗩𝗔𝗧𝗘' : '𝗣𝗨𝗕𝗟𝗜𝗖';

        const menuText =
`╭━━━〔 👑 𝑸𝑼𝑬𝑬𝑵 𝑽𝑰𝑫𝑨-𝑴𝑫 〕━━━╮
┃
┃  🟢 𝗦𝗧𝗔𝗧𝗨𝗦   : 𝗢𝗡𝗟𝗜𝗡𝗘
┃  🔐 𝗠𝗢𝗗𝗘     : ${botMode}
┃  ⚡ 𝗩𝗘𝗥𝗦𝗜𝗢𝗡  : 𝟯.𝟬
┃  📦 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦 : ${sock.commands.size}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

       ✦ 𝑪𝑶𝑴𝑴𝑨𝑵𝑫 𝑪𝑬𝑵𝑻𝑬𝑹 

╭─〔 ⚙️ 𝗦𝗬𝗦𝗧𝗘𝗠 〕
│ ⟡ ${prefix}menu
│ ⟡ ${prefix}ping
│ ⟡ ${prefix}botcreator
│ ⟡ ${prefix}mode
│ ⟡ ${prefix}individual
│ ⟡ ${prefix}update
╰────────────────────────

╭─〔 👥 𝗚𝗥𝗢𝗨𝗣 𝗣𝗢𝗪𝗘𝗥 〕
│ ⟡ ${prefix}add
│ ⟡ ${prefix}kick
│ ⟡ ${prefix}promote
│ ⟡ ${prefix}demote
│ ⟡ ${prefix}tagall
│ ⟡ ${prefix}hidetag
│ ⟡ ${prefix}tagadmins
│ ⟡ ${prefix}mute
│ ⟡ ${prefix}unmute
│ ⟡ ${prefix}groupinfo
│ ⟡ ${prefix}del
│ ⟡ ${prefix}poll
│ ⟡ ${prefix}vcf
│ ⟡ ${prefix}afk
│ ⟡ ${prefix}setpp
│ ⟡ ${prefix}getpp
│ ⟡ ${prefix}setgroupname
│ ⟡ ${prefix}setgroupdesc
│ ⟡ ${prefix}active
│ ⟡ ${prefix}topmembers
│ ⟡ ${prefix}creategroup
│ ⟡ ${prefix}join
│ ⟡ ${prefix}leave
╰────────────────────────

╭─〔 🛡️ 𝗦𝗘𝗖𝗨𝗥𝗜𝗧𝗬 〕
│ ⟡ ${prefix}agm
│ ⟡ ${prefix}warn
│ ⟡ ${prefix}warnings
│ ⟡ ${prefix}clearwarnings
│ ⟡ ${prefix}block
│ ⟡ ${prefix}unblock
╰────────────────────────

╭─〔 🤖 𝗔𝗜 & 𝗧𝗢𝗢𝗟𝗦 〕
│ ⟡ ${prefix}ai
│ ⟡ ${prefix}calc
│ ⟡ ${prefix}weather
│ ⟡ ${prefix}define
│ ⟡ ${prefix}quote
│ ⟡ ${prefix}tts
│ ⟡ ${prefix}lyrics
╰────────────────────────

╭─〔 🎵 𝗠𝗘𝗗𝗜𝗔 〕
│ ⟡ ${prefix}sticker
│ ⟡ ${prefix}save
│ ⟡ ${prefix}music
│ ⟡ ${prefix}tik
│ ⟡ ${prefix}vv
│ ⟡ ${prefix}vv2
│ ⟡ ${prefix}changeprofile
╰────────────────────────

╭─〔 🎮 𝗚𝗔𝗠𝗘𝗦 〕
│ ⟡ ${prefix}game
│ ⟡ ${prefix}vta
│ ⟡ ${prefix}squid
╰────────────────────────

╭─〔 👑 𝗢𝗪𝗡𝗘𝗥 𝗭𝗢𝗡𝗘 〕
│ ⟡ ${prefix}changename
│ ⟡ ${prefix}gstatus
│ ⟡ ${prefix}changebio
│ ⟡ ${prefix}broadcast
╰────────────────────────

╭─〔 🎮 𝗚𝗔𝗠𝗘 𝗖𝗘𝗡𝗧𝗘𝗥 〕
│
│ ⏱️ Joining: *2 minutes* | Challenge: *40s*
│ 👥 Join: ${prefix}join  | 🚪 Leave: ${prefix}leave
│ 🎮 Full guide: ${prefix}vta menu
│
│ 🏆 TOURNAMENT — head-to-head questions
│   → ${prefix}answer <answer>
│ 🏝️ SURVIVOR — solve challenges or risk elimination
│   → ${prefix}answer <answer>
│ 💰 HEIST — crack the 4-digit vault
│   → ${prefix}crack 1234
│ 👑 KOTH — defend the King automatically
│ 🎯 TARGET — find your secret target
│   → ${prefix}hunt @player
│ 🕵️ IMPOSTER — give clues, then vote
│   → ${prefix}clue <word> / ${prefix}vote @player
│ ⚔️ BATTLE — fight with HP
│   → ${prefix}attack @player / ${prefix}defend
│ 🔐 CODE BREAKER — guess the 4-digit code
│   → send a 4-digit number
│ 🎁 MYSTERY BOX — solve, then choose a box
│   → ${prefix}answer <word> / ${prefix}box 1-6
│
│ 🔒 Start/stop: Admins/Creator
│ 🎮 Join/play: Everyone
│
│ ── VTA START COMMANDS ──
│ ${prefix}vta tournament
│ ${prefix}vta survivor
│ ${prefix}vta heist
│ ${prefix}vta koth
│ ${prefix}vta target
│ ${prefix}vta imposter
│ ${prefix}vta battle
│ ${prefix}vta code
│ ${prefix}vta mystery
│
│ ── Classic Games ──
│ 🧠 ${prefix}game start trivia 5
│ 🧩 ${prefix}game start quiz 5
│ 🔀 ${prefix}game start scramble 5
│ 🔢 ${prefix}game start guess 5
│ ⛔ ${prefix}game stop
╰────────────────────────

╭━━〔 👑 𝑸𝑼𝑬𝑬𝑵 𝑽𝑰𝑫𝑨-𝑴𝑫 〕━━╮
┃
┃  ⚡ 𝗣𝗢𝗪𝗘𝗥 • 𝗦𝗣𝗘𝗘𝗗 • 𝗖𝗢𝗡𝗧𝗥𝗢𝗟
┃
┃  💬 Prefix: ${prefix}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        const bannerPath = path.join(__dirname, '..', 'banner.png');
        if (fs.existsSync(bannerPath)) {
            try {
                const imageBuffer = fs.readFileSync(bannerPath);
                await sock.sendMessage(from, {
                    image: imageBuffer,
                    caption: menuText
                }, { quoted: m });
                return;
            } catch (err) {
                console.error('Failed to send banner image, falling back to text menu:', err.message);
            }
        }

        await sock.sendMessage(from, { text: menuText }, { quoted: m });
    }
};
