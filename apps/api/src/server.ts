import express, { Router } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import playerRoutes from './routes/players';
import teamRoutes from './routes/teams';
import matchRoutes from './routes/matches';
import contentRoutes from './routes/content';
import membershipApplicationRoutes from './routes/membershipApplications';
import pdfRoutes from './routes/pdf';
import { initAutoCompleteMatchesCron } from './scripts/autoCompleteMatches';

dotenv.config();

// Helper function to get database URI based on environment
const getDatabaseUri = () => {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'development':
      return process.env.MONGODB_URI_DEV || 'mongodb://localhost:27017/badminton-club-demo-dev';
    default:
      return process.env.MONGODB_URI || 'mongodb://localhost:27017/badminton-club-demo';
  }
};

const app = express();
// Behind proxies (Railway, Vercel, etc.) to ensure correct client IP for rate limiting
app.set('trust proxy', 1);
const port = process.env.PORT || 3003;

// Security middleware
app.use(helmet());

// Rate limiting (configurable via env)
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const max = Number(process.env.RATE_LIMIT_MAX || 100);
const limiter = rateLimit({
  windowMs,
  max,
});
app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const mongoUri = getDatabaseUri();
mongoose.connect(mongoUri)
  .then(() => {
    console.log('MongoDB connected successfully, mongoUri:', mongoUri);
    // Initialize cron jobs after DB connection is established
    initAutoCompleteMatchesCron();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/membership', membershipApplicationRoutes);
app.use('/api/pdf', pdfRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});