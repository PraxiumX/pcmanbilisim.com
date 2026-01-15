const express = require('express');
const path = require('path');

module.exports = function staticMiddleware(options = {}) {
    const {
        publicDir = 'public',
        isProduction = false,
        maxAgeProduction = '7d',
        maxAgeDevelopment = '0'
    } = options;

    const staticPath = path.join(process.cwd(), publicDir);

    return [
        // Serve static files
        express.static(staticPath, {
            maxAge: isProduction ? maxAgeProduction : maxAgeDevelopment,
            etag: true,
            index: false,
            setHeaders: (res, filePath) => {
                // Security & performance headers for static assets
                res.setHeader('X-Content-Type-Options', 'nosniff');

                // Long cache for versioned assets
                if (/\.(css|js|woff2?|ttf|svg|png|jpg|jpeg|webp)$/i.test(filePath)) {
                    if (isProduction) {
                        res.setHeader(
                            'Cache-Control',
                            'public, max-age=604800, immutable'
                        );
                    }
                }
            }
        })
    ];
};
