const express = require('express');
const path = require('path');
const compression = require('compression');
require('dotenv').config();

const { loggingMiddleware } = require('./middleware/logging');
const cspMiddleware = require('./middleware/csp');
const notFoundMiddleware = require('./middleware/404');

const app = express();

/* ========================
   Environment
======================== */
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const TRUST_PROXY = process.env.TRUST_PROXY || 'loopback';
const isProduction = NODE_ENV === 'production';

/* ========================
   Trust Proxy
======================== */
if (TRUST_PROXY === 'true' || TRUST_PROXY === '1') {
    app.set('trust proxy', true);
} else if (TRUST_PROXY === 'false' || TRUST_PROXY === '0') {
    app.set('trust proxy', false);
} else {
    app.set('trust proxy', TRUST_PROXY);
}

/* ========================
   Basic Middleware
======================== */
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/* ========================
   Logging
======================== */
loggingMiddleware(app);

/* ========================
   Security Headers (NON-CSP)
======================== */
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

/* ========================
   CSP (ONE PLACE ONLY)
======================== */
app.use(cspMiddleware);

/* ========================
   Static Files
======================== */
app.use(
    express.static(path.join(__dirname, 'public'), {
        maxAge: isProduction ? '7d' : '0',
        etag: true
    })
);

/* ========================
   Routes
======================== */
const pageRoutes = require('./routes/pageRoutes');
app.use('/', pageRoutes);

/* ========================
   404 Handler
======================== */
app.use(notFoundMiddleware);

/* ========================
   Global Error Handler
======================== */
app.use((err, req, res, next) => {
    console.error('🚨 ERROR:', err);

    const status = err.statusCode || 500;
    const message =
        isProduction && status === 500 ? 'Internal Server Error' : err.message;

    res.status(status).send(`
        <h1>Error ${status}</h1>
        <p>${message}</p>
    `);
});

/* ========================
   Start Server
======================== */
const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
});

/* ========================
   Graceful Shutdown
======================== */
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());

module.exports = app;
