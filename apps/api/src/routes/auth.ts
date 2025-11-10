import express, { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { protect, AuthenticatedRequest } from '../middleware/auth.js';

const router: Router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log({ email, password } );

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.membershipStatus === 'suspended') {
      return res.status(401).json({ message: 'Account is suspended' });
    }

    // Create token with standard JWT claims
    const token = jwt.sign(
      { sub: (user._id as any).toString(), role: user.role },
      (process.env.JWT_SECRET || 'fallback_secret') as string,
      { expiresIn: process.env.JWT_EXPIRE || '7d' } as jwt.SignOptions
    );

    // Get user view with computed fields (fullName)
    const userView = await user.toView();

    res.status(200).json({
      success: true,
      token,
      user: userView
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    // Demo-mode registration guards
    if (process.env.DEMO_MODE === 'true') {
      if (process.env.DEMO_DISABLE_REGISTER === 'true') {
        return res.status(403).json({ message: 'Registration is disabled in demo mode' });
      }

      const maxUsers = Number(process.env.DEMO_MAX_USERS || 0);
      if (maxUsers > 0) {
        const currentCount = await User.estimatedDocumentCount();
        if (currentCount >= maxUsers) {
          return res.status(403).json({ message: 'Registration limit reached for demo environment' });
        }
      }
    }

    const { email, password, firstName, lastName, gender, dateOfBirth } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName || !gender || !dateOfBirth) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      gender,
      dateOfBirth,
      role: 'applicant' // Default role
    });

    // Create token with standard JWT claims
    const token = jwt.sign(
      { sub: (user._id as any).toString(), role: user.role },
      (process.env.JWT_SECRET || 'fallback_secret') as string,
      { expiresIn: process.env.JWT_EXPIRE || '7d' } as jwt.SignOptions
    );

    // Get user view with computed fields (fullName)
    const userView = await user.toView();

    res.status(201).json({
      success: true,
      token,
      user: userView
    });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: error.message });
  }
});

// Verify Token (Protected Route)
router.get('/verify', protect, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;

    // Get user with full details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user view with computed fields (fullName)
    const userView = await user.toView();

    res.status(200).json({
      success: true,
      user: userView
    });
  } catch (error: any) {
    console.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Change Password (Protected Route)
router.patch('/password', protect, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest<{ currentPassword: string; newPassword: string }>;
    const { currentPassword, newPassword } = authReq.body;
    const userId = authReq.user.id;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    // Get user with password field
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Logout (Protected Route)
router.post('/logout', protect, async (req, res) => {
  try {
    // For stateless JWT, just return success
    // Client will clear token from storage
    // If session management is added later, invalidate session here

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;