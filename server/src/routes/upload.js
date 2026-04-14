const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { parseDXF, parseSVG } = require('../utils/floorplanParser');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// POST /api/upload/floorplan
router.post('/floorplan', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 없습니다.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const content = req.file.buffer.toString('utf-8');

    let result;

    if (ext === '.dxf') {
      result = parseDXF(content);
    } else if (ext === '.svg') {
      result = parseSVG(content);
    } else if (ext === '.dwg') {
      return res.status(400).json({
        error: 'DWG 파일은 직접 파싱이 불가합니다. CAD 프로그램에서 DXF로 내보내기 후 업로드하세요. (파일 → 다른 이름으로 저장 → DXF 형식)',
      });
    } else if (ext === '.eps') {
      return res.status(400).json({
        error: 'EPS 파일은 직접 파싱이 불가합니다. Illustrator에서 SVG로 내보내기 후 업로드하세요. (파일 → 다른 이름으로 저장 → SVG 형식)',
      });
    } else {
      return res.status(400).json({ error: '지원하지 않는 파일 형식입니다. DXF 또는 SVG 파일을 업로드하세요.' });
    }

    res.json(result);
  } catch (err) {
    console.error('Floorplan parse error:', err.message);
    res.status(422).json({ error: err.message || '도면 파싱 실패' });
  }
});

module.exports = router;
