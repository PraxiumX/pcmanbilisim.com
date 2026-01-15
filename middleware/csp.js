// middleware/csp.js
module.exports = function cspMiddleware(req, res, next) {
    // Only apply CSP to HTML responses
    if (!req.accepts('html')) return next();

    res.setHeader(
        'Content-Security-Policy',
        [
            "default-src 'self'",

            // Styles & Fonts
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
            "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",

            // Scripts (FIXED: Google Ads + GTM + GA + Cloudflare)
            "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://ssl.google-analytics.com https://static.cloudflareinsights.com https://googleads.g.doubleclick.net",

            // Network calls (XHR / fetch / beacon)
            "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.google-analytics.com https://*.googletagmanager.com https://static.cloudflareinsights.com https://cloudflareinsights.com",

            // Images
            "img-src 'self' data: https:",

            // Frames (FIXED: GTM iframe error)
            "frame-src https://www.google.com https://www.googletagmanager.com https://www.google.com/maps https://maps.google.com",

            // Forms
            "form-action 'self' https://formspree.io",

            // Security
            "object-src 'none'",
            "base-uri 'self'",
            "frame-ancestors 'self'"
        ].join('; ')
    );

    next();
};
