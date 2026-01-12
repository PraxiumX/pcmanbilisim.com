const express = require('express');
const router = express.Router();
const path = require('path');

// Explicit routes only - no catch-all patterns
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

router.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'about.html'));
});

router.get('/services', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'services.html')); // Fixed: should be services.html
});

router.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'contact.html'));
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

module.exports = router;