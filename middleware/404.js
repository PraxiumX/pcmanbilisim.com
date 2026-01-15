// middleware/notFound.js
const path = require('path');
const fs = require('fs');

module.exports = function notFoundMiddleware(req, res) {
    if (req.url.startsWith('/api/')) {
        return res.status(404).json({
            status: 'error',
            message: `Cannot find ${req.url}`
        });
    }

    const errorPagePath = path.join(__dirname, '../public/404.html');

    if (fs.existsSync(errorPagePath)) {
        return res.status(404).sendFile(errorPagePath);
    }

    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Page Not Found</title>
            <meta charset="utf-8" />
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 60px;
                    background: #f9f9f9;
                }
                h1 { font-size: 64px; margin-bottom: 10px; }
                p { font-size: 20px; color: #555; }
                a {
                    display: inline-block;
                    margin-top: 20px;
                    color: #0066cc;
                    font-weight: bold;
                    text-decoration: none;
                }
            </style>
        </head>
        <body>
            <h1>404</h1>
            <p>Page not found</p>
            <a href="/">Go to homepage</a>
        </body>
        </html>
    `);
};
