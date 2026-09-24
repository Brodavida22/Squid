const fs = require('fs');
const path = require('path');

const CREATOR_NAME = "VidaTech";
const DISPLAY_CREATOR_NUMBER = "2348138558590";

module.exports = {
    name: 'botcreator',
    description: 'Displays information about the bot creator and developer contact',
    async execute(sock, m, from, args, isOwner) {
        const creatorText =
`┏━━━ 👑 *BOT CREATOR INFO* 👑 ━━━┓\n` +
`┃ 🤖 *Bot Name:* QUEEN VIDA-MD\n` +
`┃ ⚙️ *Version:* v3.0.0\n` +
`┃ 👤 *Creator & Owner:* ${CREATOR_NAME}\n` +
`┃ 👨‍💻 *Developer Contact:* \n` +
`┃ https://wa.me/${DISPLAY_CREATOR_NUMBER}\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ _"Built with power and precision for ultimate WhatsApp automation"_ \n` +
`┗━━━ 👑 *QUEEN VIDA-MD* 👑 ━━━┛`;

        const bannerPath = path.join(__dirname, '..', 'banner.png');
        if (fs.existsSync(bannerPath)) {
            try {
                const imageBuffer = fs.readFileSync(bannerPath);
                await sock.sendMessage(from, {
                    image: imageBuffer,
                    caption: creatorText
                }, { quoted: m });
                return;
            } catch (err) {
                console.error('Failed to send banner image for botcreator, falling back to text:', err.message);
            }
        }
        
        await sock.sendMessage(from, { text: creatorText }, { quoted: m });
    }
};
