const fs = require('fs');
const settingsStore = require('../utils/settings');
const { getGroupMetadata, isGroupAdmin } = require('../utils/groupCache');

const CREATOR_NUMBERS = ["2348138558590"];

module.exports = {
    name: 'groupinfo',
    description: 'Displays comprehensive information about the current group',
    async execute(sock, m, from, args, isOwner) {
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ This command can only be used inside a WhatsApp group!' }, { quoted: m });
        }

        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender.replace(/[^0-9]/g, '');
        
        // Check if sender is creator, bot itself, or group admin
        const isCreator = CREATOR_NUMBERS.includes(senderNumber) || m.key.fromMe;
        
        let isAdmin = isCreator;
        if (!isAdmin) {
            try {
                const groupMetadata = await getGroupMetadata(sock, from);
                const participants = groupMetadata.participants;
                const senderParticipant = participants.find(p => p.id === sender);
                isAdmin = senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin');
            } catch (e) {
                // Fallback if metadata fails
            }
        }

        if (!isAdmin) {
            return sock.sendMessage(from, { text: '❌ *Access Denied:* This command can only be used by group administrators, the bot creator, or the bot itself!' }, { quoted: m });
        }

        try {
            const groupMetadata = await getGroupMetadata(sock, from);
            const participants = groupMetadata.participants;
            
            const groupName = groupMetadata.subject;
            const groupId = groupMetadata.id;
            const groupOwner = groupMetadata.owner ? groupMetadata.owner.replace(/[^0-9]/g, '') : 'Unknown';
            const creationDate = groupMetadata.creation ? new Date(groupMetadata.creation * 1000).toLocaleString() : 'Unknown';
            
            const totalMembers = participants.length;
            const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
            const regularMembers = totalMembers - admins.length;

            let inviteLink = '🔒 (Bot needs Admin permissions to fetch link)';
            try {
                const code = await sock.groupInviteCode(from);
                inviteLink = `https://chat.whatsapp.com/${code}`;
            } catch (e) {}

            let settings = settingsStore.getSettings();

            const infoText = 
`┏━━━ 👑 *GROUP INFORMATION* 👑 ━━━┓\n` +
`┃ 🏷️ *Name:* ${groupName}\n` +
`┃ 🆔 *ID:* ${groupId}\n` +
`┃ 👑 *Owner:* wa.me/${groupOwner}\n` +
`┃ 📅 *Created:* ${creationDate}\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ 👥 *MEMBERS & STATS*\n` +
`┃ • *Total Members:* ${totalMembers}\n` +
`┃ • *Admins:* ${admins.length}\n` +
`┃ • *Members:* ${regularMembers}\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ 🛡️ *SECURITY FILTERS*\n` +
`┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
`┃ 🔗 *GROUP LINK*\n` +
`┃ ${inviteLink}\n` +
`┗━━━ 👑 *QUEEN VIDA-MD* 👑 ━━━┛`;

            await sock.sendMessage(from, { text: infoText }, { quoted: m });
        } catch (err) {
            console.error('Error executing groupinfo:', err);
            await sock.sendMessage(from, { text: '❌ Failed to fetch group information.' }, { quoted: m });
        }
    }
};