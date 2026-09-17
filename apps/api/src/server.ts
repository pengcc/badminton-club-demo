import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import helmet from 'helmet';
import { config, resolveApiStartupConfig } from './config/index.js';
import {
  COMBINED_DEVELOPMENT_SESSION_ENV,
  DEVELOPMENT_API_STARTUP_SIGNALS,
} from './developmentStartupContract';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import playerRoutes from './routes/players';
import teamRoutes from './routes/teams';
import matchRoutes from './routes/matches';
import contentRoutes from './routes/content';
import clubInformationRoutes from './routes/clubInformation';
import membershipApplicationRoutes from './routes/membershipApplications';
import tasterSessionRequestRoutes from './routes/tasterSessionRequests';
import guestPlayRoutes from './routes/guestPlay';
import emailTemplateRoutes from './routes/emailTemplates';
import settingsRoutes from './routes/settings';
import teamPublicContentRoutes from './routes/teamPublicContent';
import auditRoutes from './routes/audit';
import announcementRoutes from './routes/announcements';
import locationRoutes from './routes/locations';
import activityRoutes from './routes/activities';
import contactEntryRoutes from './routes/contactEntries';
import publicDocumentRoutes from './routes/publicDocuments';
import tasterSessionPublicContentRoutes from './routes/tasterSessionPublicContent';
import membershipPublicContentRoutes from './routes/membershipPublicContent';
import recruitmentPublicContentRoutes from './routes/recruitmentPublicContent';
import membershipTerminationRoutes from './routes/membershipTerminations';
import demoEditingRoutes from './routes/demoEditing';
import demoRuntimeRoutes from './routes/demoRuntime';
import { initMembershipTerminationCron } from './scripts/processMembershipTerminations';
import { initMembershipApplicationRetentionCron } from './scripts/processMembershipApplicationRetention';
import { errorHandler } from './middleware/errorHandler';
import { startApi } from './bootstrap';
import { connectInitialMongo } from './services/initialMongoConnectionService';
import { runtimeReadinessService } from './services/runtimeReadinessService';
import { registerRuntimeOperationalRoutes } from './routes/runtimeReadiness';
import { enforceDemoMutationFirewall } from './middleware/demoRuntime';

const app = express();
app.set('trust proxy', config.trustProxy);
const port = config.port;
const startupConfig = resolveApiStartupConfig();

const combinedDevelopmentSession =
  config.nodeEnv === 'development' &&
  process.env[COMBINED_DEVELOPMENT_SESSION_ENV] === '1';

function reportDevelopmentStartupSignal(signal: string): void {
  if (combinedDevelopmentSession) {
    process.stdout.write(`${signal}\n`);
  }
}

// CORS configuration - MUST be before other middleware to ensure headers are always set
const corsOptions = {
  origin: config.nodeEnv === 'production' ? startupConfig.frontendUrl : true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Registration-Key',
    'Idempotency-Key',
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('/{*splat}', cors(corsOptions));

// Security middleware
app.use(helmet());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(enforceDemoMutationFirewall);

// Static file serving for uploaded files (dev fallback; production uses Nginx)
// Cross-Origin-Resource-Policy: cross-origin allows images to load from a different port in dev
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(config.publicUploadsRoot)
);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/demo-editing', demoEditingRoutes);
app.use('/api/demo-runtime', demoRuntimeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/club-information', clubInformationRoutes);
app.use('/api/membership', membershipApplicationRoutes);
app.use('/api/taster-session-requests', tasterSessionRequestRoutes);
app.use('/api/guest-play', guestPlayRoutes);
app.use('/api', emailTemplateRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/team-public-content', teamPublicContentRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/contact-entries', contactEntryRoutes);
app.use('/api/public-documents', publicDocumentRoutes);
app.use('/api/taster-session-content', tasterSessionPublicContentRoutes);
app.use('/api/membership-content', membershipPublicContentRoutes);
app.use('/api/recruitment-content', recruitmentPublicContentRoutes);
app.use('/api/membership-terminations', membershipTerminationRoutes);

registerRuntimeOperationalRoutes(app, {
  getRuntimeSnapshot: () => runtimeReadinessService.snapshot(),
  getMongoReadyState: () => mongoose.connection.readyState,
});

// Global error handler (must be last)
app.use(errorHandler);

void startApi({
  connectToMongo: () =>
    connectInitialMongo(mongoose, startupConfig.mongoUri, config.nodeEnv),
  disconnectFromMongo: () => mongoose.disconnect(),
  initializeMembershipTerminationCron: initMembershipTerminationCron,
  initializeMembershipApplicationRetentionCron:
    initMembershipApplicationRetentionCron,
  startListener: (onListening) => {
    return app.listen(port, (error) => {
      if (error) {
        if (!combinedDevelopmentSession) {
          if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
            console.error(
              `API startup failed: port ${port} is already in use. This process did not acquire the API listener, and the existing listener was not stopped or reused. Inspect the process using the port, stop the correct process manually if appropriate, then restart the API.`
            );
          } else {
            console.error(
              'API startup failed: the configured listener could not be started. This process did not acquire the API listener. Review the bounded startup output, correct the listener failure, then restart the API.'
            );
          }
        }
        reportDevelopmentStartupSignal(
          DEVELOPMENT_API_STARTUP_SIGNALS.listenerFailure
        );
        process.exitCode = 1;
        return;
      }

      onListening();
      reportDevelopmentStartupSignal(DEVELOPMENT_API_STARTUP_SIGNALS.ready);
      console.log(`Server running on port ${port}`);
    });
  },
  reportMongoReady: () => console.log('MongoDB connected successfully'),
  reportInitialMongoFailure: () => {
    if (!combinedDevelopmentSession) {
      console.error(
        'API startup failed: initial MongoDB connection could not be established. Verify MONGODB_URI and MongoDB availability.'
      );
    }
    reportDevelopmentStartupSignal(
      DEVELOPMENT_API_STARTUP_SIGNALS.initialMongoFailure
    );
  },
  reportSchedulerDegradation: (reasonCode) =>
    console.error('API capability degraded during startup', { reasonCode }),
  recordSchedulerDegradation: (reasonCode) =>
    runtimeReadinessService.recordDegradation(reasonCode),
  markRuntimeReady: () => runtimeReadinessService.markListening(),
  markStartupFailed: () => {
    process.exitCode = 1;
  },
  initializeSchedulers: !config.demoRuntime.enabled,
}).then((runtime) => {
  if (!runtime) return;

  const requestShutdown = () => {
    void runtime.shutdown().catch(() => {
      console.error('API shutdown failed before graceful cleanup completed', {
        reasonCode: 'API_SHUTDOWN_FAILED',
      });
      process.exitCode = 1;
    });
  };

  process.on('SIGTERM', requestShutdown);
  process.on('SIGINT', requestShutdown);
});
