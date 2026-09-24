const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { getPrefix } = require('../utils/prefix');

// ============================================================
// MESSAGE HELPERS
// ============================================================

function unwrapMessage(message) {
    if (!message) return null;
    let current = message;

    if (current.ephemeralMessage?.message) current = current.ephemeralMessage.message;
    if (current.viewOnceMessage?.message) current = current.viewOnceMessage.message;
    if (current.viewOnceMessageV2?.message) current = current.viewOnceMessageV2.message;
    if (current.viewOnceMessageV2Extension?.message) current = current.viewOnceMessageV2Extension.message;

    return current;
}

function getQuotedContext(m) {
    return (
        m?.message?.extendedTextMessage?.contextInfo ||
        m?.message?.imageMessage?.contextInfo ||
        m?.message?.videoMessage?.contextInfo ||
        m?.message?.documentMessage?.contextInfo ||
        {}
    );
}

function getQuotedMessage(m) {
    const contextInfo = getQuotedContext(m);
    return contextInfo?.quotedMessage || null;
}

function getMedia(message) {
    const current = unwrapMessage(message);
    if (!current) return null;

    if (current.imageMessage) return { type: 'image', message: current.imageMessage };
    if (current.videoMessage) return { type: 'video', message: current.videoMessage };

    return null;
}

function getText(message) {
    const current = unwrapMessage(message);
    if (!current) return '';

    return (
        current.conversation ||
        current.extendedTextMessage?.text ||
        current.imageMessage?.caption ||
        current.videoMessage?.caption ||
        current.documentMessage?.caption ||
        ''
    ).trim();
}

function getCommandText(args) {
    if (!Array.isArray(args)) return '';
    return args.join(' ').trim();
}

// ============================================================
// DOWNLOAD REPLIED MEDIA
// ============================================================

async function downloadQuotedMedia(m, from, quoted) {
    const contextInfo = getQuotedContext(m);
    if (!contextInfo?.stanzaId) {
        throw new Error('Could not identify the replied message.');
    }

    const quotedKey = {
        remoteJid: from,
        id: contextInfo.stanzaId,
        participant: contextInfo.participant,
        fromMe: false
    };

    const buffer = await downloadMediaMessage(
        { key: quotedKey, message: quoted },
        'buffer',
        {},
        { logger: console }
    );

    if (!buffer || !buffer.length) {
        throw new Error('Downloaded media is empty.');
    }

    return buffer;
}

// ============================================================
// STATUS SENDER (real Baileys API — posts to the bot's own
// WhatsApp Status, broadcast to its contacts)
// ============================================================

const STATUS_JID = 'status@broadcast';

async function sendTextStatus(sock, text) {
    if (!text || !String(text).trim()) {
        throw new Error('Status text is empty.');
    }

    return sock.sendMessage(
        STATUS_JID,
        { text: String(text).trim() },
        { backgroundColor: '#25D366', font: 1 }
    );
}

async function sendImageStatus(sock, buffer, caption = '') {
    if (!buffer || !buffer.length) {
        throw new Error('Image buffer is empty.');
    }

    return sock.sendMessage(STATUS_JID, { image: buffer, caption: caption || undefined });
}

async function sendVideoStatus(sock, buffer, caption = '') {
    if (!buffer || !buffer.length) {
        throw new Error('Video buffer is empty.');
    }

    return sock.sendMessage(STATUS_JID, { video: buffer, caption: caption || undefined });
}

// ============================================================
// COMMAND
// ============================================================

module.exports = {
    name: 'gstatus',
    description: "Post text, images or videos to the bot's own WhatsApp Status",

    async execute(sock, m, from, args, isOwner) {
        const prefix = getPrefix();

        // ========================================================
        // OWNER ONLY
        // ========================================================

        if (!isOwner) {
            return sock.sendMessage(
                from,
                { text: '❌ This command is restricted to the bot creator only.' },
                { quoted: m }
            );
        }

        try {
            const commandText = getCommandText(args);
            const quoted = getQuotedMessage(m);

            // ====================================================
            // REPLIED MESSAGE
            // ====================================================

            if (quoted) {
                const media = getMedia(quoted);

                if (media) {
                    const buffer = await downloadQuotedMedia(m, from, quoted);
                    const caption = commandText || media.message?.caption || '';

                    if (media.type === 'image') {
                        await sendImageStatus(sock, buffer, caption);
                    } else {
                        await sendVideoStatus(sock, buffer, caption);
                    }

                    await sock.sendMessage(
                        from,
                        { text: `✅ ${media.type === 'image' ? 'Image' : 'Video'} posted to WhatsApp Status.` },
                        { quoted: m }
                    );
                    return;
                }

                const quotedText = getText(quoted);
                if (quotedText && !commandText) {
                    await sendTextStatus(sock, quotedText);
                    await sock.sendMessage(from, { text: '✅ Text posted to WhatsApp Status.' }, { quoted: m });
                    return;
                }
            }

            // ====================================================
            // DIRECT TEXT / LINK
            // ====================================================

            if (commandText) {
                await sendTextStatus(sock, commandText);
                await sock.sendMessage(from, { text: '✅ Text/link posted to WhatsApp Status.' }, { quoted: m });
                return;
            }

            // ====================================================
            // HELP
            // ====================================================

            await sock.sendMessage(
                from,
                {
                    text:
                        `📢 *GSTATUS*\n\n` +
                        `📝 Text:\n${prefix}gstatus Hello everyone\n\n` +
                        `🔗 Link:\n${prefix}gstatus https://example.com\n\n` +
                        `🖼️ Image:\nReply to an image with ${prefix}gstatus\n\n` +
                        `🎥 Video:\nReply to a video with ${prefix}gstatus Your caption`
                },
                { quoted: m }
            );
        } catch (error) {
            console.error('🔥 [GSTATUS ERROR]:', error);

            await sock.sendMessage(
                from,
                { text: `❌ *Status post failed.*\n\nError: ${error?.message || 'Unknown error'}` },
                { quoted: m }
            ).catch(() => {});
        }
    }
};
