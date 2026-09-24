
const { getPrefix } = require('../utils/prefix');

module.exports = {
    name: 'individual',
    description: 'Displays the individual utilities and private tools menu',
    async execute(sock, m, from) {
        const prefix = getPrefix();
        const individualText = 
`┏━━━ 👑 *QUEEN VIDA-MD : INDIVIDUAL* 👑 ━━━┓\n` +
`┃ 📥 *MEDIA & SAVERS*\n` +
`┃ • *${prefix}save* (Reply to status or view-once media)\n` +
`┃   _Description: Downloads and saves disappearing content._\n` +
`┃ • *${prefix}vv*\n` +
`┃   _Description: Reveals quoted view-once media in current chat._\n` +
`┃ • *${prefix}vv2*\n` +
`┃   _Description: Sends quoted view-once media directly to your DM._\n` +
`┃\n` +
`┃ 🛠️ *GROUP CREATION*\n` +
`┃ • *${prefix}creategroup <group name>*\n` +
`┃   _Description: Creates a brand new WhatsApp group instantly._\n` +
`┃\n` +
`┃ ✏️ *PROFILE & ACCOUNT MANAGEMENT*\n` +
`┃ • *${prefix}changename <new name>*\n` +
`┃   _Description: Changes your WhatsApp profile name._\n` +
`┃ • *${prefix}changebio <new bio>*\n` +
`┃   _Description: Updates your profile status/bio description._\n` +
`┃ • *${prefix}changeprofile* (Send/Reply with an image)\n` +
`┃   _Description: Updates your profile picture directly._\n` +
`┃\n` +
`┃ 🚫 *USER BLOCKING UTILITIES*\n` +
`┃ • *${prefix}block* (Reply to user or tag number)\n` +
`┃   _Description: Instantly blocks a target user._\n` +
`┃ • *${prefix}unblock* (Reply to user or tag number)\n` +
`┃   _Description: Restores a blocked user._\n` +
`┗━━━ 👑 *QUEEN VIDA-MD* 👑 ━━━┛\n` +
`> _Use prefix '${prefix}' before each command_`;

        await sock.sendMessage(from, { text: individualText }, { quoted: m });
    }
};

