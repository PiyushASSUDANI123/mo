import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import authenticate from '../middleware/auth.js';
import { validate, schemas, sanitizeKycData } from '../middleware/validate.js';
import { users, kycStore } from '../store.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.userId}_cheque_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, or PDF files are allowed.'));
    }
    cb(null, true);
  },
});

router.get('/draft', authenticate, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const draft = kycStore[req.userId] || {};

  res.json({
    step: user.kycStep,
    data: draft,
    kycStatus: user.kycStatus,
  });
});

router.put('/draft', authenticate, validate(schemas.kycDraft), (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  if (user.kycStatus === 'submitted') {
    return res.status(400).json({ message: 'KYC already submitted. Cannot edit.' });
  }

  const { step, data } = req.body;

  if (!kycStore[req.userId]) {
    kycStore[req.userId] = {};
  }

  const cleanData = sanitizeKycData(data);
  Object.assign(kycStore[req.userId], cleanData);
  user.kycStep = Math.max(user.kycStep, step + 1);

  res.json({
    message: 'Draft saved.',
    step: user.kycStep,
    data: kycStore[req.userId],
  });
});

router.post('/upload', authenticate, (req, res) => {
  upload.single('cheque')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File must be under 5 MB.' });
      }
      return res.status(400).json({ message: err.message });
    }
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    if (!kycStore[req.userId]) {
      kycStore[req.userId] = {};
    }
    kycStore[req.userId].chequePath = req.file.filename;

    res.json({
      message: 'File uploaded.',
      filename: req.file.filename,
    });
  });
});

router.get('/uploads/:filename', authenticate, (req, res) => {
  const { filename } = req.params;
  
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return res.status(403).json({ message: 'Invalid file path' });
  }

  if (!filename.startsWith(`${req.userId}_`)) {
    return res.status(403).json({ message: 'Unauthorized access' });
  }

  const filePath = path.join(process.cwd(), 'uploads', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found' });
  }

  res.sendFile(filePath);
});


router.post('/verify-gst', authenticate, async (req, res) => {
  const { gstin } = req.body;
  if (!gstin || gstin.length !== 15) {
    return res.status(400).json({ message: 'Invalid GSTIN format.' });
  }

  // Simulate government API latency
  await new Promise(resolve => setTimeout(resolve, 800));

  res.json({
    valid: true,
    legalName: `MOCK BUSINESS PVT LTD - ${gstin.substring(0, 4)}`
  });
});

router.post('/mock-approve', authenticate, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  user.isApproved = true;
  res.json({ message: 'Admin approval mock successful.', isApproved: true });
});

router.post('/submit', authenticate, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const draft = kycStore[req.userId];
  if (!draft) {
    return res.status(400).json({ message: 'No KYC data found. Please complete all steps.' });
  }

  if (!draft.agreedToTerms) {
    return res.status(400).json({ message: 'You must accept the Terms of Service.' });
  }

  user.kycStatus = 'submitted';
  user.kycStep = 4;
  draft.submittedAt = new Date().toISOString();

  res.json({
    message: 'KYC submitted successfully.',
    kycStatus: user.kycStatus,
  });
});

router.get('/status', authenticate, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  res.json({
    kycStep: user.kycStep,
    kycStatus: user.kycStatus,
    isApproved: user.isApproved,
  });
});

export default router;
