/* =====================================================================
   Supabase initialisation, auth + RLS guard helpers
   Use the ANON key only. Never put the service-role key in browser code.
   ===================================================================== */
const SUPABASE_URL = 'https://mxwrtjjmsgjicdjouztg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14d3J0amptc2dqaWNkam91enRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNjU4NzAsImV4cCI6MjEwNTg0MTg3MH0.umjMhONKtYWpnx1vhL28SyEvnWkXAUJo7O1qd0yDG5Y';

const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let ME = null, PROFILE_ERR = '';   // ME = { id, full_name, role, avatar_url, active }

async function loadProfile() {
  PROFILE_ERR = '';
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return (ME = null);
  const { data, error } = await sb.from('profiles').select('id,full_name,role,avatar_url,active').eq('id', user.id).maybeSingle();
  if (error) { PROFILE_ERR = 'Profile error: ' + error.message; return (ME = null); }
  if (!data) { PROFILE_ERR = 'No profile for this login yet. Run schema.sql (or the profile SQL) in Supabase, then log in again.'; return (ME = null); }
  if (!data.active) { PROFILE_ERR = 'This account is disabled.'; return (ME = null); }
  return (ME = data);
}

// UI-side guard (real enforcement is Row Level Security in Postgres). ADMIN passes every check.
const can = (...roles) => !!ME && (ME.role === 'ADMIN' || roles.includes(ME.role));

// Query helpers
const must = r => { if (r.error) throw r.error; return r.data; };
async function rpc(name, args) { const { data, error } = await sb.rpc(name, args); if (error) throw error; return data; }
// Page through PostgREST's 1000-row limit. `build` must return a fresh, ORDERED query each call.
async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

if (sb) sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && typeof onSignedOut === 'function') onSignedOut(); });
