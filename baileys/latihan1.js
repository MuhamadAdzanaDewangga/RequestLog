const { makeWASocket, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = './auth_info'; // Direktori untuk menyimpan sesi autentikasi
const P = require('pino'); // Library untuk logging, digunakan oleh Baileys

async function connectToWhatsApp() {
    // Pastikan direktori untuk auth ada
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path);
        console.log('Direktori auth_info berhasil dibuat.');
    }

    // Gunakan metode autentikasi multi-file
    const { state, saveCreds } = await useMultiFileAuthState(path);

    // Dapatkan versi WhatsApp terbaru
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Menggunakan versi Baileys: ${version}, isLatest: ${isLatest}`);

    // Membuat instance socket
    const sock = makeWASocket({
        version,
        auth: state, // Gunakan state untuk autentikasi
        printQRInTerminal: true, // Menampilkan QR code di terminal
		logger: P({ level: 'silent' }), // Atur level log ke "silent"
    });

    // Menyimpan sesi autentikasi setiap kali ada perubahan
    sock.ev.on('creds.update', saveCreds);

    // Menangani event ketika koneksi berhasil atau gagal
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect =
                (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus, mencoba koneksi ulang:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Berhasil terhubung ke WhatsApp');
        }
    });

    // Menangani pesan masuk
    sock.ev.on('messages.upsert', (message) => {
        console.log('Pesan masuk:', JSON.stringify(message, null, 2));
    });

    return sock;
}

// Panggil fungsi untuk konek ke WhatsApp
connectToWhatsApp().catch(err => console.error('Gagal konek ke WhatsApp:', err));
