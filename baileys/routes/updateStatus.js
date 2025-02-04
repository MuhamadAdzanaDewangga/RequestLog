const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./messages.db');

// Endpoint untuk memperbarui status
router.post('/update-status', (req, res) => {
	console.log('Request body:', req.body); // Tambahkan log ini
    const { id, newStatus } = req.body;
	console.log('data status:', newStatus)
    // Pastikan id dan newStatus ada
    if (!id || !newStatus) {
        return res.status(400).json({ error: 'Missing id or newStatus' });
    }
	
	if (newStatus === '2') {
		const now = new Date();
		const offset = now.getTimezoneOffset() * 60000; // Offset dalam milidetik
		const start = new Date(now.getTime() - offset).toISOString().split('T').join(' ').split('.')[0];
		//const start = new Date().toISOString().split('T').join(' ').split('.')[0];
		// Query untuk memperbarui status di database
		db.run(
			'UPDATE messages SET Status = ?, Star = ? WHERE id = ?',
			[newStatus, start, id],
			function (err) {
				if (err) {
					return res.status(500).json({ error: 'Failed to update status', details: err.message });
				}
	
				// Kirim respons sukses
				res.json({ success: true, message: 'Status updated successfully' });
			}
		);
		
	} else {
		const now = new Date();
		const offset = now.getTimezoneOffset() * 60000; // Offset dalam milidetik
		const End = new Date(now.getTime() - offset).toISOString().split('T').join(' ').split('.')[0];
		//const End = new Date().toISOString().split('T').join(' ').split('.')[0];
		// Query untuk memperbarui status di database
		db.run(
			'UPDATE messages SET Status = ?, End = ? WHERE id = ?',
			[newStatus, End, id],
			function (err) {
				if (err) {
					return res.status(500).json({ error: 'Failed to update status', details: err.message });
				}
	
				// Kirim respons sukses
				res.json({ success: true, message: 'Status updated successfully' });
			}
		);
		
	}

    
});

module.exports = router;
