const fs = require('fs');
const path = require('path');
require('dotenv').config();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const express = require('express');

const { getMode } = require('./utils/mode');
const { handleGameMessage } = require('./utils/gameManager');
const { handleVtaMessage } = require('./utils/vtaGameManager');
const { getPrefixes } = require('./utils/prefix');
const {
    getGroupMetadata,
    invalidateGroupMetadata,
    clearGroupMetadataCache
} = require('./utils/groupCache');
const settingsStore = require('./utils/settings');
const activityStore = require('./utils/activity');

// --- CLOUD HEALTH-CHECK SERVER ---
const PORT = process.env.PORT;
let isExpressRunning = false;

function startExpressServer() {
    if (!PORT || isExpressRunning) return;

    const app = express();
    app.get('/', (_req, res) => {
        res.send('Queen Vida-MD Bot is Running Active!');
    });

    app.listen(PORT, () => {
        isExpressRunning = true;
        console.log(`🌐 Express health-check server listening on port ${PORT}`);
    });
}

// --- BOT IDENTITY & OWNER SETTINGS ---
const CREATOR_NAME = "VidaTech";
const DISPLAY_CREATOR_NUMBER = "2348138558590";
const CREATOR_NUMBERS = ["2348138558590"];
const BOT_PREFIXES = getPrefixes();

// --- HOT-PATH CONSTANTS ---
const LINK_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.)+[a-zA-Z]{2,}(\/[^\s]*)?/i;
const spamTracker = Object.create(null);

// Keep spam state from growing forever in a busy group.
setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const group of Object.keys(spamTracker)) {
        const users = spamTracker[group];
        for (const user of Object.keys(users)) {
            if (users[user].lastTime < cutoff) delete users[user];
        }
        if (!Object.keys(users).length) delete spamTracker[group];
    }
}, 60_000).unref();

// Crash handlers: log the problem, but do not kill the process.
process.on('uncaughtException', (err) => {
    console.error('🔥 [CRASH REPORT - UNCAUGHT EXCEPTION]:', err);
    if (err?.stack) console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 [CRASH REPORT - UNHANDLED REJECTION] At Promise:', promise, 'Reason:', reason);
});

let shuttingDown = false;

async function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`🛑 ${signal} received. Flushing bot data...`);

    try {
        await Promise.allSettled([
            settingsStore.shutdown(),
            activityStore.shutdown()
        ]);
    } finally {
        process.exit(0);
    }
}

process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

function getMessageBody(message) {
    return (
        message?.conversation ||
        message?.extendedTextMessage?.text ||
        message?.imageMessage?.caption ||
        message?.videoMessage?.caption ||
        message?.documentMessage?.caption ||
        message?.buttonsResponseMessage?.selectedButtonId ||
        message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
        message?.templateButtonReplyMessage?.selectedId ||
        ''
    );
}

function isAdminParticipant(participant) {
    return !!(
        participant &&
        (participant.admin === 'admin' || participant.admin === 'superadmin')
    );
}

async function processMessage(sock, m) {
    try {
        if (!m?.message) return;

        const from = m.key?.remoteJid;
        if (!from) return;

        const sender = m.key.participant || m.key.remoteJid;
        const senderNumber = sender ? sender.replace(/[^0-9]/g, '') : '';
        const isOwner = CREATOR_NUMBERS.includes(senderNumber) || m.key.fromMe;

        const isGroup = from.endsWith('@g.us');
        const isChannel = from.endsWith('@newsletter');

        // Keep activity entirely in memory on the hot path.
        // It is flushed asynchronously every few seconds by utils/activity.js.
        if (isGroup && sender) {
            // disabled for large-group performance
        }

        const body = String(getMessageBody(m.message) || '').trim();
        if (!body) return;

        // ---------------------------------------------------------------
        // GROUP SECURITY HOT PATH
        // ---------------------------------------------------------------
        // IMPORTANT: group metadata is cached. The old bot fetched and
        // scanned the full participant list for EVERY single group message.
        if (isGroup && !isOwner) {
            try {
                const allSettings = settingsStore.getSettings();
                const groupSettings = {
                    antispam: allSettings.antispam?.[from],
                    badwords: allSettings.badwords?.[from],
                    antilink: allSettings.antilink?.[from]
                };

                const securityNeeded =
                    groupSettings.antispam === 'on' ||
                    (groupSettings.badwords?.status === 'on' &&
                        Array.isArray(groupSettings.badwords.list)) ||
                    groupSettings.antilink?.warn === 'on' ||
                    groupSettings.antilink?.instant === 'on';

                if (securityNeeded) {
                    const groupMetadata = await getGroupMetadata(sock, from);
                    const participants = groupMetadata?.participants || [];
                    const senderParticipant = participants.find(p =>
                        p.id === sender || p.jid === sender || p.lid === sender
                    );
                    const isAdmin = isAdminParticipant(senderParticipant);

                    if (!isAdmin) {
                        // --- ANTI-SPAM ---
                        if (groupSettings.antispam === 'on') {
                            const now = Date.now();

                            if (!spamTracker[from]) spamTracker[from] = Object.create(null);
                            if (!spamTracker[from][sender]) {
                                spamTracker[from][sender] = { count: 0, lastTime: now };
                            }

                            const userSpam = spamTracker[from][sender];
                            userSpam.count =
                                now - userSpam.lastTime < 3000
                                    ? userSpam.count + 1
                                    : 1;
                            userSpam.lastTime = now;

                            if (userSpam.count >= 5) {
                                userSpam.count = 0;

                                try {
                                    await sock.sendMessage(from, { delete: m.key });
                                } catch {}

                                const settings = settingsStore.getSettings();
                                if (!settings.spamWarns) settings.spamWarns = {};
                                if (!settings.spamWarns[from]) settings.spamWarns[from] = {};
                                settings.spamWarns[from][sender] =
                                    (settings.spamWarns[from][sender] || 0) + 1;

                                const spamWarnCount = settings.spamWarns[from][sender];
                                settingsStore.saveSettings();

                                if (spamWarnCount === 1) {
                                    await sock.sendMessage(from, {
                                        text: `⚠️ *@${senderNumber}*, stop spamming! This is your 1st warning. Next time you will be kicked.`,
                                        mentions: [sender]
                                    });
                                } else {
                                    settings.spamWarns[from][sender] = 0;
                                    settingsStore.saveSettings();

                                    await sock.sendMessage(from, {
                                        text: `🚨 *@${senderNumber}* continued spamming after warning and has been kicked!`,
                                        mentions: [sender]
                                    });

                                    try {
                                        await sock.groupParticipantsUpdate(
                                            from,
                                            [sender],
                                            'remove'
                                        );
                                    } catch {}
                                }

                                return;
                            }
                        }

                        // --- BADWORDS FILTER ---
                        const badWordsConfig = groupSettings.badwords;
                        if (
                            badWordsConfig?.status === 'on' &&
                            Array.isArray(badWordsConfig.list) &&
                            badWordsConfig.list.length
                        ) {
                            const lowerBody = body.toLowerCase();
                            const containsBadWord = badWordsConfig.list.some(
                                word => lowerBody.includes(String(word).toLowerCase())
                            );

                            if (containsBadWord) {
                                try {
                                    await sock.sendMessage(from, { delete: m.key });
                                } catch {}

                                await sock.sendMessage(from, {
                                    text: `⚠️ *@${senderNumber}*, watch your language! Profanity is strictly prohibited in this group.`,
                                    mentions: [sender]
                                });
                                return;
                            }
                        }

                        // --- ANTI-LINK ---
                        const antiLinkConfig = groupSettings.antilink;
                        if (
                            antiLinkConfig?.warn === 'on' ||
                            antiLinkConfig?.instant === 'on'
                        ) {
                            if (LINK_REGEX.test(body)) {
                                try {
                                    await sock.sendMessage(from, { delete: m.key });
                                } catch {}

                                if (antiLinkConfig.instant === 'on') {
                                    await sock.sendMessage(from, {
                                        text: `🚨 *@${senderNumber}*, links are strictly prohibited in this group! You have been removed.`,
                                        mentions: [sender]
                                    });

                                    try {
                                        await sock.groupParticipantsUpdate(
                                            from,
                                            [sender],
                                            'remove'
                                        );
                                    } catch {}

                                    return;
                                }

                                if (antiLinkConfig.warn === 'on') {
                                    const settings = settingsStore.getSettings();

                                    if (!settings.linkWarns) settings.linkWarns = {};
                                    if (!settings.linkWarns[from]) settings.linkWarns[from] = {};
                                    settings.linkWarns[from][sender] =
                                        (settings.linkWarns[from][sender] || 0) + 1;

                                    const warnCount = settings.linkWarns[from][sender];
                                    settingsStore.saveSettings();

                                    if (warnCount < 3) {
                                        await sock.sendMessage(from, {
                                            text: `⚠️ *@${senderNumber}*, links are not allowed here! Warning *(${warnCount}/3)*.`,
                                            mentions: [sender]
                                        });
                                    } else {
                                        settings.linkWarns[from][sender] = 0;
                                        settingsStore.saveSettings();

                                        await sock.sendMessage(from, {
                                            text: `🚨 *@${senderNumber}* reached 3 link warnings and has been kicked from the group!`,
                                            mentions: [sender]
                                        });

                                        try {
                                            await sock.groupParticipantsUpdate(
                                                from,
                                                [sender],
                                                'remove'
                                            );
                                        } catch {}

                                    }
                                    return;
                                }
                            }
                        }
                    }
                }
            } catch (groupSecErr) {
                // A metadata failure should not block command/game processing.
                console.error('🔥 [GROUP SECURITY ERROR]:', groupSecErr.message || groupSecErr);
            }
        }

        // ---------------------------------------------------------------
        // GAME / VTA ROUTING
        // ---------------------------------------------------------------
        const isVtaHandled = await handleVtaMessage(sock, m, from, body);
        if (isVtaHandled) return;

        const isGameHandled = await handleGameMessage(sock, m, from, body);
        if (isGameHandled) return;

        // ---------------------------------------------------------------
        // COMMAND ROUTING
        // ---------------------------------------------------------------
        const usedPrefix =
            BOT_PREFIXES.find(prefix => body.startsWith(prefix)) || null;

        if (!usedPrefix) return;

        const currentMode = getMode();
        if (currentMode === 'private' && !isOwner) return;

        const args = body.slice(usedPrefix.length).trim().split(/\s+/);
        const commandName = args.shift()?.toLowerCase();
        if (!commandName) return;

        const command = sock.commands.get(commandName);
        if (!command) return;

        try {
            await command.execute(
                sock,
                m,
                m.key.remoteJid,
                args,
                isOwner
            );
        } catch (cmdExecErr) {
            console.error(
                `🔥 [COMMAND EXECUTION CRASH] [!${commandName}]:`,
                cmdExecErr
            );

            await sock.sendMessage(from, {
                text:
                    `❌ An error occurred while executing command *!${commandName}*.\n` +
                    `_Details:_ ${cmdExecErr.message}`
            }).catch(() => {});
        }
    } catch (err) {
        console.error('🔥 [MESSAGE PROCESSING ERROR]:', err);
    }
}

async function startBambi() {
    console.log('🔄 Initializing Queen Vida-MD Socket Connection...');

    const authPath = path.join(__dirname, 'auth_info');
    const credsPath = path.join(authPath, 'creds.json');

    if (fs.existsSync(authPath) && fs.existsSync(credsPath)) {
        try {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

            if (!creds.registered) {
                console.log(
                    '⚠️ Detected an incomplete pairing session. Cleaning up auth_info...'
                );
                fs.rmSync(authPath, { recursive: true, force: true });
            }
        } catch (e) {
            console.error('🔥 [AUTH ERROR] Failed reading creds.json:', e);
            fs.rmSync(authPath, { recursive: true, force: true });
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    // ---------------------------------------------------------------
    // GROUP METADATA INVALIDATION
    // ---------------------------------------------------------------
    // We cache metadata for normal messages, but immediately invalidate
    // it when membership changes so admin/security checks stay current.
    sock.ev.on('group-participants.update', (update) => {
        if (update?.id) invalidateGroupMetadata(sock, update.id);
    });

    sock.ev.on('groups.update', (updates) => {
        for (const update of updates || []) {
            if (update?.id) invalidateGroupMetadata(sock, update.id);
        }
    });

    sock.commands = new Map();

    const commandPath = path.join(__dirname, 'commands');

    if (fs.existsSync(commandPath)) {
        try {
            const commandFiles = fs
                .readdirSync(commandPath)
                .filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                try {
                    const filePath = path.join(commandPath, file);
                    delete require.cache[require.resolve(filePath)];

                    const required = require(filePath);

                    if (Array.isArray(required)) {
                        for (const cmd of required) {
                            if (cmd.name) sock.commands.set(cmd.name, cmd);
                        }
                    } else if (required?.name) {
                        sock.commands.set(required.name, required);
                    }
                } catch (cmdLoadErr) {
                    console.error(
                        `🔥 [COMMAND LOAD ERROR] File ${file}:`,
                        cmdLoadErr
                    );
                }
            }

            console.log(`📂 Loaded ${sock.commands.size} commands successfully.`);
        } catch (dirErr) {
            console.error('🔥 [COMMAND DIR ERROR]:', dirErr);
        }
    }

    if (!sock.authState.creds.registered) {
        const phoneNumber = process.env.PHONE_NUMBER || '2348138558590';

        if (!phoneNumber) {
            console.log('❌ [ERROR]: PHONE_NUMBER environment variable is not set!');
            console.log(
                "👉 Please add 'PHONE_NUMBER' with your full WhatsApp number in your panel's Environment/Startup variables tab."
            );
            return;
        }

        console.log(
            `⏳ Automatically requesting pairing code for ${phoneNumber}...`
        );

        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(
                    phoneNumber.trim().replace(/[^0-9]/g, '')
                );

                console.log('✨ ======================================== ✨');
                console.log(`✨ YOUR WHATSAPP PAIRING CODE: ${code} ✨`);
                console.log('✨ ======================================== ✨');
            } catch (pairErr) {
                console.error(
                    '🔥 [PAIRING ERROR] Failed to generate pairing code:',
                    pairErr
                );
            }
        }, 3000);
    }

    let isStartupBannerSent = false;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection) {
            console.log(
                `📡 Connection Status Changed: --> ${connection.toUpperCase()} <--`
            );
        }

        if (connection === 'open') {
            console.log(
                `--- QUEEN VIDA-MD CONNECTED [Creator: ${CREATOR_NAME}] ---`
            );

            if (!isStartupBannerSent) {
                isStartupBannerSent = true;

                try {
                    const botJid =
                        sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    const serverTime = new Date().toLocaleString();

                    const activeBanner =
                        `┏━━━ 👑 *QUEEN VIDA-MD* 👑 ━━━┓\n` +
                        `┃ Status: *V3 ONLINE & ACTIVE* ✅\n` +
                        `┣━━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `┃ 🤖 *Bot Name:* QUEEN VIDA-MD\n` +
                        `┃ ⚙️ *Version:* v3.0.0\n` +
                        `┃ 👤 *Creator:* ${CREATOR_NAME}\n` +
                        `┃ 👨‍💻 *Developer Contact:* https://wa.me/${DISPLAY_CREATOR_NUMBER}\n` +
                        `┃ ⏱️ *Server Time:* ${serverTime}\n` +
                        `┗━━━ 👑 *QUEEN VIDA-MD* 👑 ━━━┛\n` +
                        `> _👑 *QUEEN VIDA-MD* 👑 successfully launched_`;

                    const bannerImagePath = path.join(__dirname, 'banner.png');

                    if (fs.existsSync(bannerImagePath)) {
                        const imageBuffer = fs.readFileSync(bannerImagePath);
                        await sock.sendMessage(botJid, {
                            image: imageBuffer,
                            caption: activeBanner
                        });
                    } else {
                        await sock.sendMessage(botJid, { text: activeBanner });
                    }
                } catch (bannerErr) {
                    console.error(
                        '🔥 [BANNER ERROR] Failed sending startup banner:',
                        bannerErr
                    );
                }
            }
        }

        if (connection === 'close') {
            const statusCode =
                new Boom(lastDisconnect?.error)?.output?.statusCode;

            console.error(
                `🔥 [CONNECTION CLOSED] Status Code: ${statusCode}`,
                lastDisconnect?.error || 'Unknown disconnect reason'
            );

            if (statusCode === DisconnectReason.loggedOut) {
                console.log(
                    '⚠️ Device logged out from WhatsApp session. Clear auth_info folder and re-link.'
                );
            } else {
                console.log(
                    '🔄 Connection closed/dropped, attempting automatic reconnection in 3 seconds...'
                );

                setTimeout(() => {
                    startBambi().catch(err =>
                        console.error('🔥 [RECONNECT ERROR]:', err)
                    );
                }, 3000);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Baileys can deliver multiple messages in one upsert.
    // The old bot only processed messages[0], which could create backlog/
    // delayed handling during busy group bursts. Process every message
    // independently so one slow message does not hold up the batch.
    sock.ev.on('messages.upsert', ({ messages }) => {
        if (!Array.isArray(messages) || !messages.length) return;

        for (const message of messages) {
            void processMessage(sock, message);
        }
    });

    return sock;
}

// Start Express only if PORT is defined, then start WhatsApp bot.
startExpressServer();

startBambi().catch(err => {
    console.error('🔥 [STARTUP ERROR]:', err);
});
