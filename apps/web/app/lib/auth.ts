import jwt from 'jsonwebtoken';

export async function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
    return decoded;
  } catch (_error) {
    throw new Error('Invalid token');
  }
}