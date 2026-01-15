const express = require('express');
const router = express.Router();

// Home page - Handlebars
router.get('/', (req, res) => {
    res.render('home', { 
        active: { home: true }
    });
});

// About page - Handlebars  
router.get('/about', (req, res) => {
    res.render('about', {
        active: { about: true }
    });
});

// Services page - Handlebars
router.get('/services', (req, res) => {
    res.render('services', {
        active: { services: true }
    });
});

// Contact page - Handlebars
router.get('/contact', (req, res) => {
    res.render('contact', {
        active: { contact: true }
    });
});

// Service detail pages - Add ALL your specific service routes FIRST
router.get('/services/web-design', (req, res) => {
    res.render('services/web-design', {
        active: { services: true }
    });
});

router.get('/services/mobile-app', (req, res) => {
    res.render('services/mobile-app', {
        active: { services: true }
    });
});

router.get('/services/custom-software', (req, res) => {
    res.render('services/custom-software', {
        active: { services: true }
    });
});

router.get('/services/ecommerce', (req, res) => {
    res.render('services/ecommerce', {
        active: { services: true }
    });
});

router.get('/services/office-setup', (req, res) => {
    res.render('services/office-setup', {
        active: { services: true }
    });
});

router.get('/services/repair-maintenance', (req, res) => {
    res.render('services/repair-maintenance', {
        active: { services: true }
    });
});

router.get('/services/camera-systems', (req, res) => {
    res.render('services/camera-systems', {
        active: { services: true }
    });
});

router.get('/services/remote-support', (req, res) => {
    res.render('services/remote-support', {
        active: { services: true }
    });
});

router.get('/services/maintenance-contract', (req, res) => {
    res.render('services/maintenance-contract', {
        active: { services: true }
    });
});

router.get('/services/custom-pc', (req, res) => {
    res.render('services/custom-pc', {
        active: { services: true }
    });
});

// Dynamic service route for any other service pages
router.get('/services/:service', (req, res) => {
    const { service } = req.params;
    try {
        res.render(`services/${service}`, {
            active: { services: true }
        });
    } catch (err) {
        // If template doesn't exist, show 404
        res.status(404).render('404');
    }
});

// Health check endpoint (keep this as is)
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Sitemap - handle this BEFORE the .html redirect
router.get('/sitemap.xml', (req, res) => {
    res.type('xml');
    // If you have a static sitemap file in public folder:
    // res.sendFile(path.join(__dirname, '../public/sitemap.xml'));
    res.send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
});

// IMPORTANT: The .html redirect must be AFTER all specific routes
// Redirect .html extensions to clean URLs
router.get('/:page.html', (req, res) => {
    const page = req.params.page;
    
    // Main pages
    if (['index', 'home', 'about', 'services', 'contact'].includes(page)) {
        return res.redirect(301, `/${page === 'index' ? '' : page}`);
    }
    
    // Service pages (redirect to services/ page-name)
    const servicePages = [
        'web-design', 'mobile-app', 'custom-software', 'ecommerce',
        'office-setup', 'repair-maintenance', 'camera-systems',
        'remote-support', 'maintenance-contract', 'custom-pc'
    ];
    
    if (servicePages.includes(page)) {
        return res.redirect(301, `/services/${page}`);
    }
    
    // If no match, show 404
    res.status(404).render('404');
});

// 404 page route
router.get('/404', (req, res) => {
    res.status(404).render('404', {
        active: {}
    });
});

// Catch-all 404 route - MUST BE LAST
router.use((req, res) => {
    res.status(404).render('404', {
        active: {},
        url: req.originalUrl
    });
});

module.exports = router;