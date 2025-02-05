//const { makeWASocket, fetchLatestBaileysVersion, useMultiFileAuthState, jidDecode } = require('@whiskeysockets/baileys');
const { makeWASocket, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState, jidDecode } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose(); // Menggunakan SQLite untuk penyimpanan
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const path = require('path');

const http = require('http');
const socketIo = require('socket.io');

const XLSX = require('xlsx');

const authPath = path.join(__dirname, 'auth_info'); // Path absolut untuk auth
const server = http.createServer(app);

server.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});

// Membuat server HTTP menggunakan http.createServer
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Server is running');
});

// Menambahkan Socket.IO ke server
const io = socketIo(server, {
    cors: {
        origin: ['https://railway.com/project/b6bfbfc8-55a9-4586-8c66-09fa85805f37/index.html'],  // Ganti dengan domain tempat frontend Anda di-host
        methods: ['GET', 'POST'],
        allowedHeaders: ['my-custom-header'],
        credentials: true
    }
});

// Menangani event koneksi
io.on('connection', (socket) => {
    console.log('A user connected');
    
    // Mendengarkan event dari client
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});


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
        date TEXT,
		Apps TEXT,
		Source TEXT,
		group_name TEXT,
        content TEXT,
		sender TEXT,
		Agent Text,
        Status TEXT,
        Star TEXT,
		End Text
        
    )`
);

// Fungsi utama untuk koneksi WhatsApp
async function connectToWhatsApp() {
    // Pastikan direktori auth tersedia
    if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath);
        console.log('📂 Direktori auth_info berhasil dibuat.');
    }

    // Gunakan metode autentikasi multi-file
    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    // Dapatkan versi WhatsApp terbaru
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`🆕 Menggunakan versi Baileys: ${version}, isLatest: ${isLatest}`);

    // Membuat instance socket
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true, // Menampilkan QR Code di terminal
        logger: P({ level: 'silent' }), // Atur level log ke "debug" agar lebih informatif
    });

    // Menyimpan sesi autentikasi setiap kali ada perubahan
    sock.ev.on('creds.update', saveCreds);

    // Menangani event koneksi & QR Code
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📸 Scan QR Code ini untuk login:");
            console.log(qr); // QR bisa dipindai pakai aplikasi pemindai QR
        }

        if (connection === 'close') {
            const shouldReconnect =
                (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔌 Koneksi terputus, mencoba koneksi ulang:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log("🚪 Logged out, silakan scan QR lagi.");
            }
        } else if (connection === 'open') {
            console.log('✅ Berhasil terhubung ke WhatsApp');
        }
    });

    // Menangani pesan masuk
    sock.ev.on('messages.upsert', async (message) => {
        if (!message.messages) return;

        for (const msg of message.messages) {
            if (!msg.message) continue; // Abaikan jika tidak ada pesan
            if (msg.key.fromMe) {
                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
				const keywords = ['on cek', 'kami cek dahulu', 'on progress'];
                
                // Periksa apakah Anda mengirim balasan dengan kata "on cek"
                if (
					 msg.message?.extendedTextMessage?.contextInfo &&  // Pastikan ini adalah balasan
					keywords.some(keyword => text.toLowerCase().includes(keyword)) // Cek kata kunci
				
				) {
                    const repliedMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage;
                    const quotedMsgKey = msg.message.extendedTextMessage.contextInfo.stanzaId;
                    const quotedSender = msg.message.extendedTextMessage.contextInfo.participant;

                    // Ambil detail pesan yang direply
					const now = new Date();
					const offset = now.getTimezoneOffset() * 60000; // Offset dalam milidetik
					const date = new Date(now.getTime() - offset).toISOString().split('T').join(' ').split('.')[0];
                    //const date = new Date(msg.messageTimestamp * 1000).toISOString().split('T').join(' ').split('.')[0];// Tanggal pesan
                    const content = repliedMessage.conversation || repliedMessage.extendedTextMessage?.text || '';
                    //const time = new Date(msg.messageTimestamp * 1000).toISOString().split('T')[1].slice(0, 5); // Waktu pesan
                    const sender = jidDecode(quotedSender)?.user || quotedSender.split('@')[0]; // Nomor pengirim
                    const type = msg.key.remoteJid.includes('@g.us') ? 'group' : 'japri';
					const agent = "N/A";
					const sttus = "1";
					const start = "N/A";
					const end = "N/A";
					const Apps = "N/A";
					const Source = "Whatsapp";

                    // Ambil nama grup jika pesan dari grup
                    let groupName = 'Japri';
                    if (type === 'group') {
                        try {
                            const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
                            groupName = groupMetadata.subject || 'Unknown Group';
                        } catch (err) {
                            console.error('Error mendapatkan metadata grup:', err.message);
                        }
                    }

                    // Log data
                    console.log(`Date: ${date}, Group Name: ${groupName || 'Japri'}, Content: "${content}", Sender: ${sender}, Agent: ${agent}, Status: ${sttus}, Start: ${start}, End: ${end}`);

                    // Simpan ke database
                    db.run(
                        `INSERT INTO messages (date, Apps, Source, group_name, content, sender, Agent, Status, Star, End) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [date, Apps, Source, groupName,  content, sender, agent, sttus, start, end],
                        (err) => {
                            if (err) {
                                console.error('Error menyimpan ke database:', err.message);
                            } else {
                                console.log('Pesan berhasil disimpan ke database.');
								    // Kirim pesan terbaru ke frontend via Socket.io
								const newMessage = { date, Apps, Source, group_name: groupName, content, sender, Agent: agent, Status: sttus, Star: start, End: end };
								io.emit('newMessage', newMessage);
                            }
                        }
                    );
                }
            }
        }
    });
	
    return sock;
}



// Endpoint untuk mendapatkan semua pesan
app.get('/messages', (req, res) => {
    const query = `SELECT * FROM messages order by id DESC`;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error membaca data dari database:', err.message);
            res.status(500).json({ error: 'Error membaca data dari database.' });
            return;
        }

        if (rows.length === 0) {
            res.status(404).json({ message: 'Tidak ada pesan yang tersimpan di database.' });
        } else {
            res.json(rows); // Kirim data ke klien dalam format JSON
        }
    });
});

//download
//===========================
// Endpoint untuk mengunduh file Excel
app.get('/downloadtxt', (req, res) => {
    db.all('SELECT * FROM messages', [], (err, rows) => {
        if (err) {
            console.error('Error fetching data:', err);
            return res.status(500).send('Database error');
        }

        // Mapping status
        const mappedRows = rows.map(row => ({
            ...row, 
            Status: row.Status === '3' ? 'HANDOVER' : row.Status === '4' ? 'DONE' : 'INPROGRESS'
        }));

        // Ubah data ke format Excel
        const worksheet = XLSX.utils.json_to_sheet(mappedRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Users');

        // Simpan file sementara
        const filePath = './data.xlsx';
        XLSX.writeFile(workbook, filePath);

        // Kirim file ke frontend
        res.download(filePath, 'data.xlsx', (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                res.status(500).send('Download error');
            }

            // Hapus file setelah dikirim (opsional)
            fs.unlinkSync(filePath);
        });
    });
});








//============================================

app.use(express.static(path.join(__dirname, 'public')));

// Routing utama
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Middleware untuk parsing JSON
app.use(express.json());

// Tambahkan route dari file routes/updateStatus.js
const updateStatusRoute = require('./routes/updateStatus');
app.use('/', updateStatusRoute);


app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});



// Endpoint untuk cloning data
app.post('/add-message', (req, res) => {
    const { id } = req.body;
	
	console.log('Data yang diterima:', req.body);
	
    if (!id) {
        return res.status(400).json({ success: false, message: 'ID pesan diperlukan.' });
    }
	
	const newMessage = {
            date: req.body.date,
			Apps: req.body.Apps,
			Source: req.body.Source,
            group_name: req.body.group_name,
            content: req.body.content,
            sender: req.body.sender,
            Agent: req.body.Agent,
            Status: '1', // Status default On Cek
            Star: 'N/A', // Isi data Star jika ada, jika tidak null
            End: 'N/A',   // Isi data End jika ada, jika tidak null
        };
		
	const query = `
            INSERT INTO messages (date, Apps, Source, group_name, content, sender, Agent, Status, Star, End)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ? ,?)
        `;
	
	db.run(
            query,
            [
                newMessage.date,
				newMessage.Apps,
				newMessage.Source,
                newMessage.group_name,
                newMessage.content,
                newMessage.sender,
                newMessage.Agent,
                newMessage.Status,
                newMessage.Star,
                newMessage.End,
            ],
            function (err) {
                if (err) {
                    console.error('Kesalahan saat menambahkan data baru:', err.message);
                    return res.status(500).json({ success: false, message: 'Kesalahan saat menambahkan data baru.' });
                }

                // Berikan respons sukses dengan data baru
                res.json({
                    success: true,
                    message: 'Pesan berhasil di-clone.',
                    newId: this.lastID, // ID pesan baru yang dibuat
                });
            }
        );
	
});


app.post('/update-agent', (req, res) => {
    const { id, newAgent } = req.body;

    if (!id || !newAgent) {
        return res.status(400).json({ success: false, message: 'Missing id or newAgent' });
    }

    // Query untuk memperbarui Agent di database
    db.run(
        'UPDATE messages SET Agent = ? WHERE id = ?',
        [newAgent, id],
        function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to update Agent', details: err.message });
            }

            res.json({ success: true, message: 'Agent updated successfully' });
        }
    );
});

app.post('/update-apps', (req, res) => {
    const { id, newApps } = req.body;

    if (!id || !newApps) {
        return res.status(400).json({ success: false, message: 'Missing id or newApps' });
    }

    // Query untuk memperbarui Apps di database
    db.run(
        'UPDATE messages SET Apps = ? WHERE id = ?',
        [newApps, id],
        function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to update Apps', details: err.message });
            }

            res.json({ success: true, message: 'Apps updated successfully' });
        }
    );
});

app.post('/Add-Request', (req, res) => {
//    const { Request, Requestor, source } = req.body;

    //if (!Request || !Requestor) {
    //    return res.status(400).json({ success: false, message: 'data tidak boleh kosong' });
    //}
	
	const AddNewRequest = {
            date: req.body.date,
			Apps: req.body.Apps,
			source: req.body.Source,
            group_name: req.body.group_name,
            content: req.body.content,
            sender: req.body.sender,
            Agent: req.body.Agent,
            Status: req.body.Status,
            Star: req.body.Star,
            End: req.body.End,   
        };


    // Query untuk memperbarui Apps di database
    db.run(
        `INSERT INTO messages (date, Apps, Source, group_name, content, sender, Agent, Status, Star, End) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [AddNewRequest.date, AddNewRequest.Apps, AddNewRequest.source, AddNewRequest.group_name, AddNewRequest.content, AddNewRequest.sender, AddNewRequest.Agent, AddNewRequest.Status, AddNewRequest.Star, AddNewRequest.End,],
        function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Faild Menambahkan data', details: err.message });
            }

            res.json({ success: true, message: 'Apps updated successfully' });
        }
    );
});


app.post('/update-message', (req, res) => {
    const updatemessage = {
		id: req.body.id,
		date: req.body.date,
		Source: req.body.Source,
		group_name: req.body.group_name,
		sender: req.body.sender,
		Star: req.body.Star,
		End: req.body.End,
		content: req.body.content
	}

    db.run(
        'UPDATE messages SET date = ?, Source = ?, group_name = ?, sender = ?, Star = ?, End = ?, content = ? WHERE id = ?',
        [updatemessage.date, updatemessage.Source, updatemessage.group_name, updatemessage.sender, updatemessage.Star, updatemessage.End, updatemessage.content, updatemessage.id],
        function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to update data', details: err.message });
            }

            res.json({ success: true, message: 'data updated successfully' });
        }
    );
});

app.post('/delete-except-status3', (req, res) => {
    const { remainingMessages } = req.body;

    // Hapus data dari database kecuali yang statusnya "3"
    db.run(`DELETE FROM messages WHERE Status != '3'`, function (err) {
        if (err) {
            console.error("Gagal menghapus data:", err);
            return res.json({ success: false, message: "Gagal menghapus data." });
        }

        console.log("Data berhasil dihapus kecuali status 3.");
        res.json({ success: true });
    });
});

connectToWhatsApp().catch(console.error);
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error menutup database:', err.message);
        } else {
            console.log('Koneksi ke database ditutup.');
        }
        process.exit(0);
    });
});


