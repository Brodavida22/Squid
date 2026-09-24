const fs = require('fs');
const settingsStore = require('../utils/settings');

module.exports = {
    name: 'clearwarnings',
    description: 'Resets warning count for a group member back to zero',
    async execute(sock, m, from, args) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ This command can only be used inside groups!' }, { quoted: m });
        }

        const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const target = mentioned[0] || (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);

        if (!target) {
            return sock.sendMessage(from, { text: '❌ Please tag or specify the user whose warnings you want to clear! Usage: *!clearwarnings @user*' }, { quoted: m });
        }

        const targetNumber = target.replace(/[^0-9]/g, '');
        let settings = settingsStore.getSettings();
        if (settings.warnings?.[from]?.[target]) {
            settings.warnings[from][target] = 0;
            settingsStore.saveSettings();
        }

        await sock.sendMessage(from, { text: `✅ Warnings for *@${targetNumber}* have been successfully cleared and reset to 0.`, mentions: [target] }, { quoted: m });
    }
};