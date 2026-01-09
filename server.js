const express = require('express');
const path = require('path');
const compression = require('compression');
require('dotenv').config();

// Import middleware
const { loggingMiddleware } = require('./middleware/logging');

// Initialize app
const app = express();

// ========================
// Environment Configuration
// ========================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const TRUST_PROXY = process.env.TRUST_PROXY || 'loopback';
const isProduction = NODE_ENV === 'production';

// ========================
// Configure Trust Proxy (FIXED)
// ========================
// Handle trust proxy configuration properly
if (TRUST_PROXY === 'true' || TRUST_PROXY === '1') {
    app.set('trust proxy', true);
} else if (TRUST_PROXY === 'false' || TRUST_PROXY === '0') {
    app.set('trust proxy', false);
} else if (TRUST_PROXY === 'loopback') {
    app.set('trust proxy', 'loopback');
} else {
    // For comma-separated list of IPs or other valid values
    app.set('trust proxy', TRUST_PROXY);
}

// ========================
// Basic Middleware
// ========================
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ========================
// Apply Logging Middleware
// ========================
loggingMiddleware(app);

// ========================
// Security Headers
// ========================
app.use((req, res, next) => {
    // Basic security headers
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // CSP - Allow Formspree
    if (req.accepts('html')) {
        res.setHeader(
            'Content-Security-Policy',
            [
                "default-src 'self'",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
                "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
                "script-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https:",
                "frame-src https://www.google.com https://www.google.com/maps https://maps.google.com",
                "form-action 'self' https://formspree.io"
            ].join('; ')
        );
    }
    next();
});

// ========================
// Static Files
// ========================
const staticOptions = {
    maxAge: isProduction ? '7d' : '0',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath);
        if (ext === '.html') {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg'].includes(ext)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
    }
};

app.use(express.static(path.join(__dirname, 'public'), staticOptions));

// ========================
// Import and Use Routes
// ========================
const pageRoutes = require('./routes/pageRoutes');
app.use('/', pageRoutes);

// ========================
// 404 Handler - Don't treat as error
// ========================
app.use((req, res) => {
    if (req.url.startsWith('/api/')) {
        return res.status(404).json({
            status: 'error',
            message: `Cannot find ${req.url} on this server`
        });
    }
    
    const fs = require('fs');
    const errorPagePath = path.join(__dirname, 'public', '404.html');
    
    if (fs.existsSync(errorPagePath)) {
        return res.status(404).sendFile(errorPagePath);
    }
    
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Page Not Found</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                h1 { font-size: 50px; color: #333; }
                p { font-size: 20px; color: #666; }
                a { color: #0066cc; text-decoration: none; font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>404</h1>
            <p>Page Not Found</p>
            <p>The page you're looking for doesn't exist.</p>
            <a href="/">Go back to homepage</a>
        </body>
        </html>
    `);
});

// ========================
// Global Error Handler - For REAL errors only
// ========================
app.use((err, req, res, next) => {
    console.error('🚨 SERVER ERROR:', err.message);
    console.error(err.stack);
    
    const statusCode = err.statusCode || 500;
    
    const message = isProduction && statusCode === 500 
        ? 'Something went wrong!' 
        : err.message;
    
    if (req.accepts('json')) {
        return res.status(statusCode).json({
            status: 'error',
            message: message,
            ...(!isProduction && { stack: err.stack })
        });
    }
    
    res.status(statusCode).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Hata! ${statusCode}</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                h1 { font-size: 50px; color: #${statusCode === 500 ? 'c00' : 'f60'}; }
                pre { text-align: left; background: #f5f5f5; padding: 20px; margin: 20px auto; max-width: 800px; }
            </style>
        </head>
        <body>
            <h1>Error ${statusCode}</h1>
            <p>${message}</p>
            ${!isProduction ? `<pre>${err.stack}</pre>` : ''}
            <a href="/">Anasayfaya Dön -></a>
        </body>
        </html>
    `);
});

// ========================
// Start Server
// ========================
const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`
    =========================================
    🚀 Server is running!
    
    Environment: ${NODE_ENV}
    Port: ${PORT}
    Trust Proxy: ${TRUST_PROXY}
    URL: http://127.0.0.1:${PORT}
    =========================================
    `);
});

// ========================
// Graceful Shutdown
// ========================
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
    
    setTimeout(() => {
        console.error('⏰ Forcing shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ========================
// Process Error Handlers
// ========================
process.on('uncaughtException', (err) => {
    console.error('🚨 UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

module.exports = app;