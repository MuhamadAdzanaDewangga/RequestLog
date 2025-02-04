const {
    makeWASocket,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    jidDecode,
} = require('@whiskeysockets/baileys');
const express = require('express');
const P = require('pino');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3000; // Port untuk server Express

// Inisialisasi database SQLite
const db = new sqlite3.Database('./messages.db', (err) => {
    if (err) {
        console.error('Error membuka database:', err.message);
    } else {
        console.log('Terhubung ke database SQLite.');
    }
});

// Membuat tabel untuk menyimpan pesan jika belum ada
db.run(
    `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT,
        content TEXT,
        date TEXT,
        time TEXT,
        type TEXT,
        group_name TEXT
    )`
);

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: 'silent' }),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('Berhasil terhubung ke WhatsApp');
        }
    });

    // Menangani pesan masuk
    sock.ev.on('messages.upsert', async (message) => {
        if (!message.messages) return;

        for (const msg of message.messages) {
            if (!msg.message) continue;
            if (msg.key.fromMe) {
                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

                // Periksa apakah Anda mengirim balasan dengan kata "on cek"
                if (text.toLowerCase() === 'on cek' && msg.message?.extendedTextMessage?.contextInfo) {
                    const repliedMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage;
                    const quotedMsgKey = msg.message.extendedTextMessage.contextInfo.stanzaId;
                    const quotedSender = msg.message.extendedTextMessage.contextInfo.participant;

                    const content = repliedMessage.conversation || repliedMessage.extendedTextMessage?.text || '';
                    const date = new Date(msg.messageTimestamp * 1000).toISOString().split('T')[0];
                    const time = new Date(msg.messageTimestamp * 1000).toISOString().split('T')[1].slice(0, 5);
                    const sender = jidDecode(quotedSender)?.user || quotedSender.split('@')[0];
                    const type = msg.key.remoteJid.includes('@g.us') ? 'group' : 'japri';

                    let groupName = null;
                    if (type === 'group') {
                        try {
                            const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
                            groupName = groupMetadata.subject || 'Unknown Group';
                        } catch (err) {
                            console.error('Error mendapatkan metadata grup:', err.message);
                        }
                    }

                    console.log(`Sender: ${sender}, Content: "${content}", Date: ${date}, Time: ${time}, Type: ${type}, Group Name: ${groupName || 'N/A'}`);

                    db.run(
                        `INSERT INTO messages (sender, content, date, time, type, group_name) VALUES (?, ?, ?, ?, ?, ?)`,
                        [sender, content, date, time, type, groupName],
                        (err) => {
                            if (err) {
                                console.error('Error menyimpan ke database:', err.message);
                            } else {
                                console.log('Pesan berhasil disimpan ke database.');
                            }
                        }
                    );
                }
            }
        }
    });

    return sock;
}

// Fungsi untuk mengambil data dari database
app.get('/messages', (req, res) => {
    db.all(`SELECT * FROM messages`, [], (err, rows) => {
        if (err) {
            console.error('Error membaca data:', err.message);
            res.status(500).json({ error: 'Gagal membaca data dari database.' });
        } else {
            res.json(rows); // Mengembalikan data dalam format JSON
        }
    });
});

// Menjalankan server Express
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});

// Koneksi ke WhatsApp
connectToWhatsApp().catch(console.error);
