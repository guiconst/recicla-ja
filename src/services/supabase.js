import { createClient } from '@supabase/supabase-js';

// As chaves vêm do arquivo .env (que NÃO vai para o GitHub). Veja o .env.example
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const BUCKET = 'fotos-camera';
export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const supabase = supabaseConfigurado
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
