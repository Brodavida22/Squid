module.exports = {
    name: 'ping',
    description: 'Check real-time latency with message editing',
    async execute(sock, m, from) {
        const start = Date.now();

        const loadingText = `┏━━━ 👑 *QUEEN VIDA-MD* 👑 ━━━┓\n` +
                            `┃ Status: *PINGING* ✅\n` +
                            `┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `┃ 🏓 *Status:* Measuring latency...\n` +
                            `┗━━━ 👑 *QUEEN VIDA-MD* 👑 ━━━┛\n` +
                            `> _Please wait_`;

        const sentMsg = await sock.sendMessage(from, { text: loadingText }, { quoted: m });

        const latency = Date.now() - start;

        const successText = `┏━━━ 👑 *QUEEN VIDA-MD* 👑 ━━━┓\n` +
                            `┃ Status: *PONG* ✅\n` +
                            `┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `┃ 🏓 *Latency:* *${latency}ms*\n` +
                            `┗━━━ 👑 *QUEEN VIDA-MD* 👑 ━━━┛\n` +
                            `> _Success_`;

        await sock.sendMessage(from, {
            text: successText,
            edit: sentMsg.key
        });
    }
};
