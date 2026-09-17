import type { Connection } from 'mongoose';
import { User } from '../models/User';
import { digestEmailChangeToken } from './userService';

export interface EmailChangeTokenMigrationReport {
  scanned: number;
  migrated: number;
}

export async function migrateLegacyEmailChangeTokens(
  connection: Connection
): Promise<EmailChangeTokenMigrationReport> {
  const collection = connection.collection(User.collection.name);
  const cursor = collection.find({ emailChangeToken: { $type: 'string' } });
  let scanned = 0;
  let migrated = 0;

  for await (const document of cursor) {
    scanned += 1;
    const token = document.emailChangeToken;
    if (typeof token !== 'string') continue;
    const result = await collection.updateOne(
      { _id: document._id, emailChangeToken: token },
      {
        $set: { emailChangeTokenDigest: digestEmailChangeToken(token) },
        $unset: { emailChangeToken: '' },
      }
    );
    migrated += result.modifiedCount;
  }

  return { scanned, migrated };
}
