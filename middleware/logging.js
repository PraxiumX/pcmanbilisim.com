const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

// Get environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// Analytics + Compact configuration
const LOG_CONFIG = {
    // File settings
    MAX_FILE_SIZE: 1024 * 1024 * 1024,      // 1GB per file
    MAX_ACTIVE_FILES: 2,                    // 2 active files (2GB)
    MAX_ARCHIVE_FILES: 1000,                // 1000 archive files
    
    // Buffering
    BUFFER_SIZE: 200,                       // Buffer size
    FLUSH_INTERVAL: 3000,                   // 3 seconds
    
    // Archiving
    ARCHIVE_INTERVAL: 60000,                // Check every minute for archiving
    ARCHIVE_SIZE_THRESHOLD: 1024 * 1024 * 1024, // 1GB for archiving
    COMPRESS_ARCHIVES: true,                // Gzip archives
};

// Directory structure
const logsDir = path.join(__dirname, '../logs');
const activeDir = path.join(logsDir, 'active');
const archiveDir = path.join(logsDir, 'archive');

[logsDir, activeDir, archiveDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Enhanced URL compression utility
const compressURL = (url) => {
    if (!url || typeof url !== 'string') return '';
    if (url.length < 30) return url;
    
    try {
        // Remove protocol and www
        let compressed = url.replace(/^(https?:\/\/)/, '')
                           .replace(/^www\./, '');
        
        // Common TLD replacements
        const tldReplacements = {
            '.com': '.c',
            '.org': '.o', 
            '.net': '.n',
            '.io': '.i',
            '.gov': '.g',
            '.edu': '.e',
            '.co.uk': '.uk',
            '.co': '.co',
        };
        
        Object.entries(tldReplacements).forEach(([find, replace]) => {
            compressed = compressed.replace(new RegExp(find + '(?=\/|$|\\?|#)', 'gi'), replace);
        });
        
        // File extension handling
        const fileExtensions = {
            '.html': '.h',
            '.htm': '.h',
            '.php': '.p',
            '.aspx': '.a',
            '.jsp': '.j',
            '.asp': '.a',
            '.css': '.c',
            '.js': '.j',
            '.json': '.j',
            '.xml': '.x',
        };
        
        Object.entries(fileExtensions).forEach(([find, replace]) => {
            compressed = compressed.replace(new RegExp(find + '(?=$|\\?|#)', 'gi'), replace);
        });
        
        // Index file handling - shorten index files
        compressed = compressed.replace(/\/index(\.[a-z]+)?(?=$|\/|\?|#)/gi, '/i');
        
        // Common path replacements
        const pathReplacements = {
            '/api/': '/a/',
            '/admin/': '/ad/',
            '/dashboard/': '/d/',
            '/account/': '/ac/',
            '/user/': '/u/',
            '/product/': '/p/',
            '/service/': '/s/',
            '/contact/': '/c/',
            '/about/': '/ab/',
            '/blog/': '/b/',
            '/post/': '/po/',
            '/article/': '/ar/',
        };
        
        Object.entries(pathReplacements).forEach(([find, replace]) => {
            compressed = compressed.replace(new RegExp(find, 'gi'), replace);
        });
        
        // Remove query strings and fragments for compression
        compressed = compressed.split('?')[0].split('#')[0];
        
        return compressed.substring(0, 200); // Max 200 chars
        
    } catch (err) {
        return url.substring(0, 200); // Fallback to truncated original
    }
};

// Extract domain from referrer
const extractReferrerDomain = (referrer) => {
    if (!referrer) return '';
    
    try {
        // Remove protocol
        let domain = referrer.replace(/^(https?:\/\/)/, '')
                           .replace(/^www\./, '');
        
        // Extract domain only (remove path, query, fragment)
        domain = domain.split('/')[0];
        
        // Keep only the main domain for common sites
        const commonDomains = {
            'google.com': 'google',
            'bing.com': 'bing',
            'yahoo.com': 'yahoo',
            'duckduckgo.com': 'duckduckgo',
            'facebook.com': 'facebook',
            'twitter.com': 'twitter',
            'linkedin.com': 'linkedin',
            'instagram.com': 'instagram',
            'youtube.com': 'youtube',
            'reddit.com': 'reddit',
            'pinterest.com': 'pinterest',
            'tumblr.com': 'tumblr',
        };
        
        if (commonDomains[domain]) {
            return commonDomains[domain];
        }
        
        // For other domains, keep just the main part
        const parts = domain.split('.');
        if (parts.length >= 2) {
            return parts[parts.length - 2]; // Get second-level domain
        }
        
        return domain;
        
    } catch (err) {
        return '';
    }
};

// Enhanced Analytics-ready COMPACT log format
const createCompactAnalyticsLog = (req, res, duration) => {
    const timestamp = Date.now();
    const url = req.url || '/';
    const method = req.method || 'GET';
    const status = res.statusCode || 200;
    const userAgent = req.get('User-Agent') || '';
    const referrer = req.get('Referer') || req.get('Referrer') || '';
    const ip = req.ip || req.connection?.remoteAddress || '';
    
    // Session hash (compact)
    const sessionKey = ip + userAgent;
    const sessionId = crypto.createHash('md5').update(sessionKey).digest('hex').substring(0, 8);
    
    // Device detection (compact)
    const uaLower = userAgent.toLowerCase();
    let device = 'd'; // desktop
    if (/mobile|android|iphone|ipad|ipod/i.test(uaLower)) device = 'm';
    if (/bot|crawler|spider/i.test(uaLower)) device = 'b';
    
    // Browser detection (compact codes)
    let browser = 'o'; // other
    if (/chrome/i.test(uaLower)) browser = 'c';
    else if (/firefox/i.test(uaLower)) browser = 'f';
    else if (/safari/i.test(uaLower)) browser = 's';
    else if (/edge/i.test(uaLower)) browser = 'e';
    else if (/msie|trident/i.test(uaLower)) browser = 'i';
    
    // OS detection (compact codes)
    let os = 'o'; // other
    if (/windows/i.test(uaLower)) os = 'w';
    else if (/mac os x/i.test(uaLower)) os = 'm';
    else if (/linux/i.test(uaLower)) os = 'l';
    else if (/android/i.test(uaLower)) os = 'a';
    else if (/ios|iphone|ipad/i.test(uaLower)) os = 'i';
    
    // Page type detection - automatic based on URL patterns
    let page = 'o'; // other
    const urlLower = url.toLowerCase();
    
    // Home page
    if (url === '/' || url === '/index' || url === '/index.html' || url === '/index.htm' || 
        url === '/index.php' || url === '/index.aspx' || url === '/default' || url === '/default.html') {
        page = 'h';
    }
    // Static resources
    else if (urlLower.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf|eot)$/)) {
        page = 'r';
    }
    // API endpoints
    else if (urlLower.includes('/api/') || urlLower.startsWith('/api')) {
        page = 'x';
    }
    // Common page patterns
    else if (urlLower.includes('/about') || urlLower.includes('/about.')) {
        page = 'a';
    }
    else if (urlLower.includes('/contact') || urlLower.includes('/contact.')) {
        page = 'c';
    }
    else if (urlLower.includes('/service') || urlLower.match(/\/services?\./)) {
        page = 's';
    }
    else if (urlLower.includes('/product') || urlLower.includes('/products') || 
             urlLower.includes('/shop') || urlLower.includes('/store')) {
        page = 'p';
    }
    else if (urlLower.includes('/blog') || urlLower.includes('/post') || 
             urlLower.includes('/article') || urlLower.includes('/news')) {
        page = 'b';
    }
    else if (urlLower.includes('/admin') || urlLower.includes('/dashboard') || 
             urlLower.includes('/cp') || urlLower.includes('/control')) {
        page = 'd';
    }
    // File extensions detection
    else if (urlLower.match(/\.(html|htm)$/)) {
        page = 'h'; // HTML page
    }
    else if (urlLower.match(/\.(php|asp|aspx|jsp)$/)) {
        page = 's'; // Server page
    }
    else if (urlLower.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/)) {
        page = 'f'; // File download
    }
    
    // Referrer type (compact codes) with domain extraction
    let refType = 'd'; // direct
    let refDomain = '';
    
    if (referrer) {
        refDomain = extractReferrerDomain(referrer);
        
        if (refDomain.includes('google') || refDomain.includes('bing') || 
            refDomain.includes('yahoo') || refDomain.includes('duckduckgo')) {
            refType = 's'; // search
        }
        else if (refDomain.includes('facebook') || refDomain.includes('twitter') || 
                refDomain.includes('linkedin') || refDomain.includes('instagram') ||
                refDomain.includes('youtube') || refDomain.includes('reddit') ||
                refDomain.includes('pinterest')) {
            refType = 'm'; // social
        }
        else if (referrer.includes(req.hostname)) {
            refType = 'i'; // internal
        }
        else {
            refType = 'e'; // external
        }
    }
    
    // Check if this is a real error (500+ status codes)
    const isRealError = status >= 500;
    
    // COMPACT analytics-ready log
    return {
        // Core (8 fields)
        t: Math.floor(timestamp / 1000),      // Unix timestamp (seconds)
        id: crypto.randomBytes(3).toString('hex'), // Request ID
        sid: sessionId,                       // Session ID (8 chars)
        
        // Request (5 fields)
        m: method.charAt(0),                  // G=GET, P=POST, etc
        u: compressURL(url),                  // Compressed URL
        s: status,                            // Status code
        rt: Math.round(duration),             // Response time
        sz: parseInt(res.get('Content-Length') || 0), // Size
        
        // User & Device (4 fields)
        d: device,                            // Device: d=desktop, m=mobile, b=bot
        br: browser,                          // Browser code
        os: os,                               // OS code
        ip: isProduction ? ip.substring(0, 15) : ip, // Truncated IP in prod
        
        // Analytics (4 fields)
        p: page,                              // Page type code
        ref: refType,                         // Referrer type code
        rf: refDomain,                        // Referrer domain only (not full URL)
        ua: userAgent.substring(0, 80),       // Truncated user agent
        
        // Environment & Errors (3 fields)
        env: isProduction ? 'p' : 'd',        // Environment
        err: isRealError ? 1 : 0,             // Error flag - ONLY for 500+ codes
        errc: isRealError ? status : 0,       // Error code (if real error)
        
        // Additional analytics (optional)
        ...(req.query && Object.keys(req.query).length > 0 && {
            qp: Object.keys(req.query).length // Query param count
        }),
        
        ...(req.headers['content-type'] && {
            ct: req.headers['content-type'].substring(0, 20) // Content type
        }),
        
        // Performance metrics
        mem: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB used
    };
};

// JSONL Log Manager
class AnalyticsLogManager {
    constructor() {
        this.accessStream = null;
        this.errorStream = null;
        this.accessBuffer = [];
        this.errorBuffer = [];
        this.currentAccessFile = '';
        this.currentErrorFile = '';
        this.accessSize = 0;
        this.errorSize = 0;
        this.fileCounter = { access: 0, error: 0 };
        
        this.init();
    }
    
    init() {
        console.log('📊 Analytics JSONL Logging Initialized');
        
        // Load existing counters and find the latest file to continue writing to
        this.findLatestFiles();
        
        // Create or continue with existing files
        this.openOrCreateAccessFile();
        this.openOrCreateErrorFile();
        
        // Start buffer flusher
        setInterval(() => this.flushAll(), LOG_CONFIG.FLUSH_INTERVAL);
        
        // Start file rotation check
        setInterval(() => this.checkRotation(), 10000);
        
        // Start archiving scheduler (check every minute for size-based archiving)
        setInterval(() => this.checkAndArchiveBySize(), LOG_CONFIG.ARCHIVE_INTERVAL);
        
        // Graceful shutdown
        this.setupGracefulShutdown();
        
        // Initial archive check
        setTimeout(() => this.checkAndArchiveBySize(), 60000);
    }
    
    findLatestFiles() {
        try {
            const files = fs.readdirSync(activeDir);
            
            // Find latest access file (highest number)
            const accessFiles = files.filter(f => f.startsWith('a-'))
                .map(f => {
                    const match = f.match(/a-(\d+)\.jsonl/);
                    return match ? { filename: f, number: parseInt(match[1]) } : null;
                })
                .filter(f => f !== null)
                .sort((a, b) => b.number - a.number);
            
            if (accessFiles.length > 0) {
                this.fileCounter.access = accessFiles[0].number;
                this.currentAccessFile = path.join(activeDir, accessFiles[0].filename);
                
                // Get the current file size
                try {
                    const stats = fs.statSync(this.currentAccessFile);
                    this.accessSize = stats.size;
                    console.log(`📁 Continuing with access log: ${accessFiles[0].filename} (${this.formatBytes(this.accessSize)})`);
                } catch (err) {
                    console.warn(`Could not get size of ${accessFiles[0].filename}:`, err.message);
                    this.accessSize = 0;
                }
            } else {
                this.fileCounter.access = 0;
            }
            
            // Find latest error file (highest number)
            const errorFiles = files.filter(f => f.startsWith('e-'))
                .map(f => {
                    const match = f.match(/e-(\d+)\.jsonl/);
                    return match ? { filename: f, number: parseInt(match[1]) } : null;
                })
                .filter(f => f !== null)
                .sort((a, b) => b.number - a.number);
            
            if (errorFiles.length > 0) {
                this.fileCounter.error = errorFiles[0].number;
                this.currentErrorFile = path.join(activeDir, errorFiles[0].filename);
                
                // Get the current file size
                try {
                    const stats = fs.statSync(this.currentErrorFile);
                    this.errorSize = stats.size;
                    console.log(`📁 Continuing with error log: ${errorFiles[0].filename} (${this.formatBytes(this.errorSize)})`);
                } catch (err) {
                    console.warn(`Could not get size of ${errorFiles[0].filename}:`, err.message);
                    this.errorSize = 0;
                }
            } else {
                this.fileCounter.error = 0;
            }
            
        } catch (err) {
            console.warn('No existing log files found or error reading directory');
        }
    }
    
    openOrCreateAccessFile() {
        if (this.currentAccessFile && fs.existsSync(this.currentAccessFile)) {
            // Open existing file for appending
            this.accessStream = fs.createWriteStream(this.currentAccessFile, {
                flags: 'a',  // Append mode
                encoding: 'utf8'
            });
            console.log(`📁 Opened existing access log: ${path.basename(this.currentAccessFile)}`);
        } else {
            // Create new file
            this.rotateAccessFile();
        }
    }
    
    openOrCreateErrorFile() {
        if (this.currentErrorFile && fs.existsSync(this.currentErrorFile)) {
            // Open existing file for appending
            this.errorStream = fs.createWriteStream(this.currentErrorFile, {
                flags: 'a',  // Append mode
                encoding: 'utf8'
            });
            console.log(`📁 Opened existing error log: ${path.basename(this.currentErrorFile)}`);
        } else {
            // Create new file
            this.rotateErrorFile();
        }
    }
    
    rotateAccessFile() {
        if (this.accessStream) {
            this.accessStream.end();
        }
        
        this.fileCounter.access++;
        const filename = `a-${this.fileCounter.access.toString().padStart(6, '0')}.jsonl`;
        this.currentAccessFile = path.join(activeDir, filename);
        this.accessSize = 0;
        
        this.accessStream = fs.createWriteStream(this.currentAccessFile, {
            flags: 'a',
            encoding: 'utf8'
        });
        
        console.log(`📁 Created new access log: ${filename}`);
    }
    
    rotateErrorFile() {
        if (this.errorStream) {
            this.errorStream.end();
        }
        
        this.fileCounter.error++;
        const filename = `e-${this.fileCounter.error.toString().padStart(6, '0')}.jsonl`;
        this.currentErrorFile = path.join(activeDir, filename);
        this.errorSize = 0;
        
        this.errorStream = fs.createWriteStream(this.currentErrorFile, {
            flags: 'a',
            encoding: 'utf8'
        });
        
        console.log(`📁 Created new error log: ${filename}`);
    }
    
    checkRotation() {
        // Check access file size - rotate when it reaches 1GB
        if (this.accessSize > LOG_CONFIG.MAX_FILE_SIZE) {
            console.log(`🔄 Rotating access log (size limit: ${this.formatBytes(this.accessSize)} > ${this.formatBytes(LOG_CONFIG.MAX_FILE_SIZE)})`);
            this.rotateAccessFile();
        }
        
        // Check error file size - rotate when it reaches 1GB
        if (this.errorSize > LOG_CONFIG.MAX_FILE_SIZE) {
            console.log(`🔄 Rotating error log (size limit: ${this.formatBytes(this.errorSize)} > ${this.formatBytes(LOG_CONFIG.MAX_FILE_SIZE)})`);
            this.rotateErrorFile();
        }
    }
    
    // Check total active directory size and archive old files if > 1GB
    checkAndArchiveBySize() {
        try {
            // Calculate total size of active directory
            const files = fs.readdirSync(activeDir);
            let totalSize = 0;
            const fileStats = [];
            
            files.forEach(filename => {
                const filepath = path.join(activeDir, filename);
                const stats = fs.statSync(filepath);
                totalSize += stats.size;
                fileStats.push({
                    filename,
                    filepath,
                    size: stats.size,
                    mtimeMs: stats.mtimeMs
                });
            });
            
            // Sort files by modification time (oldest first)
            fileStats.sort((a, b) => a.mtimeMs - b.mtimeMs);
            
            // If total size exceeds threshold, archive old files until below threshold
            if (totalSize > LOG_CONFIG.ARCHIVE_SIZE_THRESHOLD) {
                console.log(`📊 Active logs size: ${this.formatBytes(totalSize)} (> ${this.formatBytes(LOG_CONFIG.ARCHIVE_SIZE_THRESHOLD)} threshold)`);
                
                let archived = 0;
                let archivedSize = 0;
                
                for (const fileStat of fileStats) {
                    // Skip current active files
                    if (fileStat.filename === path.basename(this.currentAccessFile) || 
                        fileStat.filename === path.basename(this.currentErrorFile)) {
                        continue;
                    }
                    
                    // Archive the file
                    this.moveToArchive(fileStat.filepath, fileStat.filename);
                    archived++;
                    archivedSize += fileStat.size;
                    totalSize -= fileStat.size;
                    
                    // Stop if we're below threshold
                    if (totalSize <= LOG_CONFIG.ARCHIVE_SIZE_THRESHOLD) {
                        break;
                    }
                }
                
                if (archived > 0) {
                    console.log(`📦 Archived ${archived} files (${this.formatBytes(archivedSize)}) to stay below ${this.formatBytes(LOG_CONFIG.ARCHIVE_SIZE_THRESHOLD)} limit`);
                }
            }
            
        } catch (err) {
            console.error('Archive size check error:', err.message);
        }
    }
    
    moveToArchive(filepath, filename) {
        const archivePath = path.join(archiveDir, filename);
        
        // Move to archive
        fs.renameSync(filepath, archivePath);
        
        // Compress if enabled
        if (LOG_CONFIG.COMPRESS_ARCHIVES) {
            this.compressFile(archivePath);
        }
    }
    
    compressFile(filepath) {
        const gzPath = filepath + '.gz';
        
        const input = fs.createReadStream(filepath);
        const output = fs.createWriteStream(gzPath);
        const gzip = zlib.createGzip({ level: 6 });
        
        return new Promise((resolve, reject) => {
            input.pipe(gzip).pipe(output)
                .on('finish', () => {
                    fs.unlinkSync(filepath); // Remove original
                    resolve();
                })
                .on('error', reject);
        });
    }
    
    // Remove old archives only if we exceed MAX_ARCHIVE_FILES (safety limit)
    limitArchiveFiles() {
        try {
            const files = fs.readdirSync(archiveDir)
                .filter(f => f.endsWith('.jsonl') || f.endsWith('.jsonl.gz'))
                .sort((a, b) => {
                    // Sort by file number for proper ordering
                    const numA = parseInt(a.match(/\d+/)?.[0] || 0);
                    const numB = parseInt(b.match(/\d+/)?.[0] || 0);
                    return numA - numB;
                });
            
            // Only remove if we exceed MAX_ARCHIVE_FILES (safety limit)
            if (files.length > LOG_CONFIG.MAX_ARCHIVE_FILES) {
                const toRemove = files.slice(0, files.length - LOG_CONFIG.MAX_ARCHIVE_FILES);
                
                toRemove.forEach(filename => {
                    fs.unlinkSync(path.join(archiveDir, filename));
                    console.log(`⚠️  Removed archive (safety limit): ${filename}`);
                });
            }
            
        } catch (err) {
            console.warn('Archive limit error:', err.message);
        }
    }
    
    logAccess(data) {
        const jsonLine = JSON.stringify(data) + '\n';
        this.accessBuffer.push(jsonLine);
        
        if (this.accessBuffer.length >= LOG_CONFIG.BUFFER_SIZE) {
            this.flushAccess();
        }
    }
    
    logError(data) {
        // Only log to error file if it's a real error (500+ status code)
        // 404 and other 400-level statuses are NOT logged as errors
        if (data.s >= 500) {
            const jsonLine = JSON.stringify(data) + '\n';
            this.errorBuffer.push(jsonLine);
            
            if (this.errorBuffer.length >= LOG_CONFIG.BUFFER_SIZE) {
                this.flushError();
            }
        }
    }
    
    flushAccess() {
        if (!this.accessBuffer.length || !this.accessStream) return;
        
        const data = this.accessBuffer.join('');
        this.accessBuffer = [];
        
        this.accessStream.write(data, 'utf8', (err) => {
            if (err) console.error('Access log write failed:', err.message);
        });
        
        this.accessSize += Buffer.byteLength(data);
    }
    
    flushError() {
        if (!this.errorBuffer.length || !this.errorStream) return;
        
        const data = this.errorBuffer.join('');
        this.errorBuffer = [];
        
        this.errorStream.write(data, 'utf8', (err) => {
            if (err) console.error('Error log write failed:', err.message);
        });
        
        this.errorSize += Buffer.byteLength(data);
    }
    
    flushAll() {
        this.flushAccess();
        this.flushError();
    }
    
    setupGracefulShutdown() {
        const shutdown = () => {
            console.log('🛑 Shutting down logger...');
            this.flushAll();
            
            setTimeout(() => {
                if (this.accessStream) this.accessStream.end();
                if (this.errorStream) this.errorStream.end();
                process.exit(0);
            }, 1000);
        };
        
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }
    
    getStats() {
        let activeSize = 0;
        let archiveSize = 0;
        
        try {
            // Calculate active directory size
            const activeFiles = fs.readdirSync(activeDir);
            activeFiles.forEach(filename => {
                const filepath = path.join(activeDir, filename);
                const stats = fs.statSync(filepath);
                activeSize += stats.size;
            });
            
            // Calculate archive directory size
            const archiveFiles = fs.readdirSync(archiveDir);
            archiveFiles.forEach(filename => {
                const filepath = path.join(archiveDir, filename);
                const stats = fs.statSync(filepath);
                archiveSize += stats.size;
            });
        } catch (err) {
            console.warn('Stats calculation error:', err.message);
        }
        
        return {
            active: {
                files: this.countFilesInDir(activeDir),
                size: this.formatBytes(activeSize),
                usage: `${((activeSize / LOG_CONFIG.ARCHIVE_SIZE_THRESHOLD) * 100).toFixed(1)}% of 1GB limit`,
                buffer: this.accessBuffer.length,
                currentFile: path.basename(this.currentAccessFile),
                currentFileSize: this.formatBytes(this.accessSize)
            },
            archive: {
                files: this.countFilesInDir(archiveDir),
                size: this.formatBytes(archiveSize),
                retention: 'FOREVER (no automatic deletion)'
            },
            config: {
                maxFileSize: this.formatBytes(LOG_CONFIG.MAX_FILE_SIZE),
                archiveThreshold: this.formatBytes(LOG_CONFIG.ARCHIVE_SIZE_THRESHOLD),
                maxArchiveFiles: LOG_CONFIG.MAX_ARCHIVE_FILES,
                errorLogging: '500+ status codes only (404 NOT logged as error)'
            }
        };
    }
    
    countFilesInDir(dir) {
        try {
            return fs.readdirSync(dir).length;
        } catch {
            return 0;
        }
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Create global instance
const logManager = new AnalyticsLogManager();

// Main logging middleware
const loggingMiddleware = (app) => {
    console.log(`📊 Analytics Logging (${NODE_ENV}) - Compact JSONL Format`);
    
    // Development console logging
    if (!isProduction) {
        app.use((req, res, next) => {
            const start = Date.now();
            
            res.on('finish', () => {
                const duration = Date.now() - start;
                const status = res.statusCode;
                const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
                console.log(`${req.method} ${req.url} ${color}${status}\x1b[0m ${duration}ms`);
            });
            
            next();
        });
    }
    
    // JSONL Analytics logging
    app.use((req, res, next) => {
        const startTime = Date.now();
        
        const originalEnd = res.end;
        
        res.end = function(...args) {
            const duration = Date.now() - startTime;
            
            try {
                // Create compact analytics log
                const logEntry = createCompactAnalyticsLog(req, res, duration);
                
                // Always log to access
                logManager.logAccess(logEntry);
                
                // Log to error file ONLY if status >= 500 (real server errors)
                // 404 and other 400-level statuses are NOT logged as errors
                if (res.statusCode >= 500) {
                    logManager.logError(logEntry);
                    
                    // Log server errors to console in production
                    if (isProduction) {
                        console.error(`🚨 ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
                    }
                }
                
            } catch (logError) {
                console.error('Logging error:', logError.message);
            }
            
            return originalEnd.apply(this, args);
        };
        
        next();
    });
    
    // ============ SECURE API ROUTES ============
    // Disable ALL log API endpoints in production for security
    
    // Stats endpoint - DISABLED IN PRODUCTION
    if (!isProduction) {
        app.get('/api/logs/stats', (req, res) => {
            const stats = logManager.getStats();
            res.json({
                success: true,
                data: stats,
                environment: 'development',
                message: 'Full logging statistics'
            });
        });
        
        // View recent logs
        app.get('/api/logs/recent', (req, res) => {
            try {
                const type = req.query.type || 'access';
                const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
                const prefix = type === 'error' ? 'e-' : 'a-';
                
                const files = fs.readdirSync(activeDir)
                    .filter(f => f.startsWith(prefix))
                    .sort()
                    .reverse();
                
                if (files.length === 0) {
                    return res.json({ logs: [], message: 'No log files found' });
                }
                
                const latestFile = files[0];
                const filePath = path.join(activeDir, latestFile);
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.trim().split('\n');
                
                const logs = lines
                    .slice(-limit)
                    .map(line => {
                        try { return JSON.parse(line); } catch { return null; }
                    })
                    .filter(log => log !== null);
                
                res.json({
                    success: true,
                    file: latestFile,
                    total_lines: lines.length,
                    logs: logs,
                    format: 'compact_analytics_jsonl'
                });
                
            } catch (err) {
                res.status(500).json({
                    success: false,
                    error: err.message
                });
            }
        });
        
        // Download log file (development only)
        app.get('/api/logs/download', (req, res) => {
            const filename = req.query.file;
            if (!filename || !filename.match(/^[a-e]-\d+\.jsonl$/)) {
                return res.status(400).json({ error: 'Invalid filename' });
            }
            
            const filePath = path.join(activeDir, filename);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }
            
            res.download(filePath, filename);
        });
        
    } else {
        // In production, return 404 for ALL log endpoints
        const productionHandler = (req, res) => {
            res.status(404).json({
                error: 'Not found',
                message: 'Log API endpoints are disabled in production'
            });
        };
        
        app.get('/api/logs/stats', productionHandler);
        app.get('/api/logs/recent', productionHandler);
        app.get('/api/logs/download', productionHandler);
    }
    
    console.log(`
✅ Analytics Logging Configured:
   - Format: Compact JSONL
   - Files: ${activeDir}/
   - Archives: ${archiveDir}/ (compressed)
   - Max file size: ${(LOG_CONFIG.MAX_FILE_SIZE / 1024 / 1024 / 1024).toFixed(1)}GB
   - Archive when active > 1GB
   - Archive retention: FOREVER (no auto deletion)
   - Max archive files: ${LOG_CONFIG.MAX_ARCHIVE_FILES} (safety limit)

    `);
    
    return app;
};

// Export utilities for analytics processing
module.exports = {
    loggingMiddleware,
    createCompactAnalyticsLog,
    compressURL,
    extractReferrerDomain,
    LOG_CONFIG
};