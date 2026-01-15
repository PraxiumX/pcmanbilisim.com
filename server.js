const express = require('express');
const path = require('path');
const compression = require('compression');
const exphbs = require('express-handlebars');
require('dotenv').config();

const { loggingMiddleware } = require('./middleware/logging');
const cspMiddleware = require('./middleware/csp');
const notFoundMiddleware = require('./middleware/404');
const staticMiddleware = require('./middleware/static');

const app = express();

/* ========================
   Environment
======================== */
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const TRUST_PROXY = process.env.TRUST_PROXY || 'loopback';
const isProduction = NODE_ENV === 'production';

/* ========================
   Handlebars Setup
======================== */
const hbs = exphbs.create({
    extname: '.hbs',
    defaultLayout: false,
    partialsDir: path.join(__dirname, 'views/partials'),
    helpers: {
        eq(v1, v2) {
            return v1 === v2;
        },
        json(context) {
            return JSON.stringify(context);
        },
        contains(array, value) {
            return Array.isArray(array) && array.includes(value);
        }
    },
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true
    }
});

// Register Handlebars
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

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
    res.setHeader('X-XSS-Protection', '1; mode=block');

    res.removeHeader('X-Powered-By');
    next();
});

/* ========================
   CSP (ONE PLACE ONLY)
======================== */
app.use(cspMiddleware);

/* ========================
   Static Files (CENTRALIZED)
======================== */
app.use(
    staticMiddleware({
        publicDir: 'public',
        isProduction: isProduction
    })
);

// Uploads (optional)
if (process.env.UPLOAD_PATH) {
    app.use(
        '/uploads',
        express.static(path.join(__dirname, process.env.UPLOAD_PATH))
    );
}

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
        isProduction && status === 500
            ? 'Internal Server Error'
            : err.message;

    try {
        res.status(status).render('error', {
            status,
            message,
            isProduction
        });
    } catch {
        res.status(status).send(`
<!DOCTYPE html>
<html>
<head>
    <title>Error ${status}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: sans-serif; padding: 2rem; text-align: center; }
        h1 { color: #e74c3c; }
    </style>
</head>
<body>
    <h1>Error ${status}</h1>
    <p>${message}</p>
    ${!isProduction ? `<pre>${err.stack}</pre>` : ''}
</body>
</html>
        `);
    }
});

/* ========================
   Start Server
======================== */
const server = app.listen(PORT, () => {
    console.log('🚀 Server running');
    console.log(`   Mode: ${NODE_ENV}`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Views: ${path.join(__dirname, 'views')}`);
    console.log(`   Static: ${path.join(__dirname, 'public')}`);
    console.log(`   URL: http://localhost:${PORT}`);
});

/* ========================
   Graceful Shutdown
======================== */
const shutdown = () => {
    console.log('🛑 Shutting down server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });

    setTimeout(() => {
        console.error('⏰ Forced shutdown');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', err => {
    console.error('🔥 Uncaught Exception:', err);
    shutdown();
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 Unhandled Rejection:', promise, reason);
});

module.exports = app;
