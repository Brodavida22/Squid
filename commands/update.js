module.exports = {
    name: 'update',
    description: 'Restarts the bot application',
    async execute(sock, m, from, args, isOwner) {
        // Allow execution if it's the owner OR if the message is from the bot itself (fromMe)
        if (!isOwner && !m.key.fromMe) {
            await sock.sendMessage(from, { text: '❌ Access Denied! Only the bot owner or the bot itself can use the update command.' }, { quoted: m });
            return;
        }

        await sock.sendMessage(from, { text: '🔄 Restarting bot application...' }, { quoted: m });

        setTimeout(() => {
            process.exit(0);
        }, 1500);
    }
};
