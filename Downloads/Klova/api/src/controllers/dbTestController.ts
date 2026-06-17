import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

export async function getDbTest(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { data, error } = await supabase.from('connection_test').select('*');
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    res.json({ ok: true, rows: data });
  } catch (err) {
    next(err);
  }
}
