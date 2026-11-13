const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');

const authRoutes      = require('./routes/auth.routes');
const userRoutes      = require('./routes/user.routes');
const noticeRoutes    = require('./routes/notice.routes');
const complaintRoutes = require('./routes/complaint.routes');
const maintenanceRoutes = require('./routes/maintenance.routes');
const ragRoutes       = require('./routes/rag.routes');
const societyRoutes   = require('./routes/society.routes');
const wingRoutes      = require('./routes/wing.routes');
const notFound        = require('./middlewares/notFound');
const errorHandler    = require('./middlewares/errorHandler');

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-origin' },
}));

// ── CORS — explicit whitelist, no wildcard ────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow non-browser / mobile clients
    if (env.allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
}));

// ── Auth endpoints – stricter limiter (applied in route) ─────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' },
});

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// NOTE: /uploads is NOT statically served — all attachment access goes through
// the authenticated  GET /api/complaints/attachment/:filename  route.

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ success: true, message: 'Server healthy', version: '2.0.0' }));

app.use('/api/auth',        authLimiter, authRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/notices',     noticeRoutes);
app.use('/api/complaints',  complaintRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/rag',         ragRoutes);
app.use('/api/societies',   societyRoutes);
app.use('/api/wings',       wingRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
