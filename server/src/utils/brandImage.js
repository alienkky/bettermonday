const path = require('path');
const multer = require('multer');

// ── Brand image handling ───────────────────────────────────────────
// Logos / favicons are stored as base64 data URLs directly in the
// `BrandSettings.logoUrl` / `.faviconUrl` DB columns. Railway's container
// filesystem is ephemeral and wipes uploaded files on every redeploy, which
// previously caused logos to "disappear". Storing the image payload inline
// in the DB removes the problem at the source.

const BRAND_UPLOAD_MAX = 1024 * 1024; // 1 MB per image

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.gif': 'image/gif',
};

// In-memory multer instance — used only if a legacy client still posts
// multipart/form-data. The buffer is converted to a data URL without touching
// disk.
const brandUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BRAND_UPLOAD_MAX },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Object.keys(MIME_BY_EXT).includes(ext));
  },
});

function fileToDataUrl(file) {
  if (!file) return null;
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = MIME_BY_EXT[ext] || file.mimetype || 'application/octet-stream';
  return `data:${mime};base64,${file.buffer.toString('base64')}`;
}

// Accept either a base64 data URL, or an absolute http(s) URL. Empty string
// clears the field. Anything else is ignored.
function sanitizeImageUrl(value) {
  if (typeof value !== 'string') return undefined;
  if (value === '') return null;
  if (value.startsWith('data:image/') && value.length <= BRAND_UPLOAD_MAX * 1.5) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return undefined;
}

// Shared extractor used by admin.js and master.js brand routes.
function extractBrandData(req) {
  const data = {};
  const fields = [
    'brandName', 'primaryColor', 'secondaryColor', 'accentColor',
    'dangerColor', 'headerBg', 'headerTextColor', 'bodyBg',
    'fontFamily', 'borderRadius',
  ];
  for (const f of fields) {
    if (req.body[f] !== undefined && req.body[f] !== '') data[f] = req.body[f];
  }

  // multipart path
  if (req.files?.logo?.[0]) data.logoUrl = fileToDataUrl(req.files.logo[0]);
  if (req.files?.favicon?.[0]) data.faviconUrl = fileToDataUrl(req.files.favicon[0]);

  // JSON path
  if (data.logoUrl === undefined) {
    const v = sanitizeImageUrl(req.body.logoUrl);
    if (v !== undefined) data.logoUrl = v;
  }
  if (data.faviconUrl === undefined) {
    const v = sanitizeImageUrl(req.body.faviconUrl);
    if (v !== undefined) data.faviconUrl = v;
  }

  if (req.body.removeLogo === 'true' || req.body.removeLogo === true) data.logoUrl = null;
  if (req.body.removeFavicon === 'true' || req.body.removeFavicon === true) data.faviconUrl = null;

  return data;
}

module.exports = {
  brandUpload,
  fileToDataUrl,
  sanitizeImageUrl,
  extractBrandData,
  BRAND_UPLOAD_MAX,
};
