import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: { message: 'Admin API key required.' } });
    return;
  }
  if (!config.adminApiKey || token !== config.adminApiKey) {
    res.status(403).json({ error: { message: 'Invalid admin API key.' } });
    return;
  }
  next();
}
