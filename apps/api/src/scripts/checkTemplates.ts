import mongoose from 'mongoose';
import { EmailTemplate } from '../models/EmailTemplate';
import dotenv from 'dotenv';

dotenv.config();

async function checkTemplates() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/badminton-club';
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB: ${mongoUri}`);

    const templates = await EmailTemplate.find({}, 'name');
    console.log(
      'Found templates:',
      templates.map((t) => t.name)
    );

    const verificationTemplate = await EmailTemplate.findOne({
      name: 'email_change_verification',
    });
    if (verificationTemplate) {
      console.log('✅ email_change_verification found');
    } else {
      console.log('❌ email_change_verification NOT found');
    }
  } catch (error) {
    console.error('Email template check failed', {
      operation: 'check_email_templates',
      reasonCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
    });
  } finally {
    await mongoose.disconnect();
  }
}

checkTemplates();
