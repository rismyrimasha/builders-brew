import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { connectDb } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import staffRoutes from './routes/staff.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// With SERVE_CLIENT=true and a build present, Express serves the SPA from the
// same origin as the API — no CORS, no VITE_API_URL, no host rewrite rules.
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
const SERVE_CLIENT =
  process.env.SERVE_CLIENT === 'true' &&
  fs.existsSync(path.join(CLIENT_DIST, 'index.html'));

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'builders-brew-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/admin', adminRoutes);

// Any unmatched /api/* path is a JSON 404 (never HTML, never a redirect).
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

if (SERVE_CLIENT) {
  app.use(express.static(CLIENT_DIST));
  // SPA fallback: non-API GETs return index.html so client-side routes
  // (e.g. /admin/rewards) survive a refresh or a direct open.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  // API-only deployment — the client is hosted elsewhere.
  app.get('/', (req, res) => {
    res.json({ ok: true, service: 'builders-brew-api', client: CLIENT_ORIGIN });
  });
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

app.use(errorHandler);

function assertConfig() {
  const errors = [];

  const secret = process.env.JWT_SECRET || '';
  const KNOWN_WEAK = new Set([
    'change-me',
    'builders-brew-dev-secret-change-in-production',
  ]);
  if (!secret || KNOWN_WEAK.has(secret) || secret.length < 32) {
    errors.push(
      'JWT_SECRET must be a strong random value (>= 32 chars, and not the example default)'
    );
  }

  if (!process.env.MONGODB_URI) {
    console.warn(
      '[config] MONGODB_URI not set — falling back to mongodb://127.0.0.1:27017/builders-brew'
    );
  }

  if (errors.length) {
    console.error('\nRefusing to start — fix these environment problems:');
    for (const e of errors) console.error(`  - ${e}`);
    console.error(
      '\nGenerate a secret:\n  node -e "console.log(require(\'node:crypto\').randomBytes(48).toString(\'base64url\'))"\n'
    );
    process.exit(1);
  }
}

async function start() {
  assertConfig();
  await connectDb(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/builders-brew');
  app.listen(PORT, () => {
    console.log(`Builders Brew API listening on http://localhost:${PORT}`);
    if (SERVE_CLIENT) console.log(`Serving client build from ${CLIENT_DIST}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
