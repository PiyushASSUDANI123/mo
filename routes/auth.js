import { Router } from 'express';
import bcrypt from 'bcryptjs';
import authenticate, { generateToken } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { users, kycStore } from '../store.js';

const router = Router();

router.post('/signup', validate(schemas.signup), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const existing = users.find(u => u.email === email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = {
      id: `usr_${Date.now()}`,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      kycStep: 0,
      kycStatus: 'pending',
      isApproved: false,
      createdAt: new Date().toISOString(),
    };

    users.push(user);

    const token = generateToken(user.id);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        kycStep: user.kycStep,
        kycStatus: user.kycStatus,
        isApproved: user.isApproved,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = users.find(u => u.email === email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ message: 'Account not found. Please sign up first.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password. Please try again.' });
    }

    const token = generateToken(user.id);

    const kyc = kycStore[user.id] || {};

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        kycStep: user.kycStep,
        kycStatus: user.kycStatus,
        isApproved: user.isApproved,
        storeName: kyc.storeName || null,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

router.get('/me', authenticate, (req, res) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const kyc = kycStore[req.userId] || {};

  res.json({
    user: {
      id: user.id,
      email: user.email,
      kycStep: user.kycStep,
      kycStatus: user.kycStatus,
      isApproved: user.isApproved,
      storeName: kyc.storeName || null,
    },
  });
});

export default router;
