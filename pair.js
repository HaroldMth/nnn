const express = require('express');
const fs = require('fs');
const pino = require('pino');
const {
    default: makeWASocket,
    Browsers,
    delay,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    PHONENUMBER_MCC,
    makeCacheableSignalKeyStore,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const NodeCache = require('node-cache');
const chalk = require('chalk');
const readline = require('readline');

let router = express.Router();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    let phoneNumber = req.query.number || "";
    const pairingCode = !!phoneNumber || req.query.pairingCode;
    const useMobile = req.query.mobile;

    async function qr() {
        let { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState('./sessions');
        const msgRetryCounterCache = new NodeCache();

        const XeonBotInc = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: Browsers.windows('Firefox'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid);
                let msg = await store.loadMessage(jid, key.id);
                return msg?.message || "";
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: undefined,
        });

        if (pairingCode && !XeonBotInc.authState.creds.registered) {
            if (useMobile) return res.status(400).send('Cannot use pairing code with mobile API');

            if (phoneNumber) {
                phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
                if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                    return res.status(400).send("Please start with your contry code  , exemple : +237696900612");
                }
            } else {
                phoneNumber = await question(chalk.bgBlack(chalk.greenBright("ENTER YOUR PHONE NUMBER WITH CONNTRY CODE🩵\n EXAMPLE : +237696900612 : ")));
                phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

                if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                    return res.status(400).send("Commencez par le code du pays de votre numéro WhatsApp, exemple : +22898133388");
                }
            }

            setTimeout(async () => {
                let code = await XeonBotInc.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }, 3000);
        }

        XeonBotInc.ev.on("connection.update", async (s) => {
            const { connection, lastDisconnect } = s;
            if (connection === "open") {
                await delay(10000);
                await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: `╭═ *HANS V2 CONNECTED* 🎉══⊷
┃❃╭──────────────
┃❃│ THANKS FOR CHOOSING *HANS XMD*
┃❃│ *GITHUB* : https://github.com/haroldmth/hans-xmd
┃❃│ *CHANNEL LINK* : https://www.whatsapp.com/channel/0029VaZDIdxDTkKB4JSWUk1O
┃❃│ *SUPPORT GROUP* : https://chat.whatsapp.com/DIDPLFc7DMSE8OysoRPfdu
┃❃│ *TELEGRAM CHANNEL* : https://t.me/HansTech0
┃❃╰───────────────
╰═════════════════⊷

© 2024-2099 *HANS TECH*` });

                let sessionXeon = fs.readFileSync('./sessions/creds.json');
                await delay(2000);
                const xeonses = await XeonBotInc.sendMessage(XeonBotInc.user.id, { document: sessionXeon, mimetype: 'application/json', fileName: 'creds.json' });
                await XeonBotInc.groupAcceptInvite("Kjm8rnDFcpb04gQNSTbW2d");
                await XeonBotInc.sendMessage(XeonBotInc.user.id, {
                    text: `*⚠︎THIS IS YOUR CREDS.JS FILE UPLOAD IT TO SESSION FOLDER ON YOUR FORKED REPO⚠︎ 😗✌️*

███ █╬█ ███ ██ █ █╬╬█ ███
█▄█ █V█ █▄█ ▄█ █ ██▄█ █╬▄
█╬█ █╬█ █╬█ █▄ █ █╬██ █▄█`
                }, { quoted: xeonses });
                await delay(2000);
                removeFile('./sessions');
                process.exit(0);
            }
            if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                qr();
            }
        });

        XeonBotInc.ev.on('creds.update', saveCreds);
        XeonBotInc.ev.on("messages.upsert", () => { });
    }

    qr().catch(err => {
        console.log("Erreur lors de la configuration du bot:", err);
        if (!res.headersSent) {
            res.status(500).send("Erreur interne du serveur");
        }
    });
});

process.on('uncaughtException', function (err) {
    let e = String(err);
    if (e.includes("conflict") || e.includes("not-authorized") || e.includes("Socket connection timeout") ||
        e.includes("rate-overlimit") || e.includes("Connection Closed") || e.includes("Timed Out") ||
        e.includes("Value not found")) return;
    console.log('Caught exception: ', err);
});

module.exports = router;
