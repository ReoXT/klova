import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { config } from '../config';

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false },
  // Node < 22 has no native WebSocket — provide the ws package as the transport
  realtime: { transport: ws as unknown as typeof WebSocket },
});
