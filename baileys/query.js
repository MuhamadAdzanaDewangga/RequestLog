const sqlite3 = require('sqlite3').verbose();

// Buka koneksi ke database SQLite
const db = new sqlite3.Database('./messages.db', (err) => {
    if (err) {
        return console.error('Gagal membuka database:', err.message);
    }
    console.log('Koneksi ke database SQLite berhasil.');
});

// Query untuk menampilkan data
const query = `SELECT * FROM messages`;

db.all(query, [], (err, rows) => {
    if (err) {
        console.error('Gagal menjalankan query:', err.message);
        return;
    }

    // Tampilkan data
    console.log('Data dalam tabel:');
    rows.forEach((row) => {
        console.log(row);
    });
});

// Tutup koneksi database
db.close((err) => {
    if (err) {
        return console.error('Gagal menutup database:', err.message);
    }
    console.log('Koneksi ke database SQLite ditutup.');
});
