require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const spaceRoutes = require('./routes/spaces');
const itemRoutes = require('./routes/items');
const categoryRoutes = require('./routes/categories');
const estimateRoutes = require('./routes/estimates');
const placementRoutes = require('./routes/placements');
const adminRoutes = require('./routes/admin');
const masterRoutes = require('./routes/master');
const versionRoutes = require('./routes/versions');
const uploadRoutes = require('./routes/upload');
const marketPriceRoutes = require('./routes/market-prices');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security headers ──────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow /uploads images
  contentSecurityPolicy: false, // managed by frontend
}));

// ── CORS ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ── Body / Cookie ─────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Static uploads ────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/spaces', spaceRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/placements', placementRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/versions', versionRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/market-prices', marketPriceRoutes);

// ── Health ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── Serve frontend in production ─────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  // Express 5: use /{*splat} instead of '*' for catch-all SPA routing
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 FranchiseSim server running on http://localhost:${PORT}`);
});
