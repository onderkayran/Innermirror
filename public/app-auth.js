/* global INNERMIRROR_CONFIG, supabase */

let sb = null;
let currentUser = null;
let userProfile = null;
let dailyUsed = 0;
let dailyLimitVal = 1;

function initSupabase() {
  const cfg = window.INNERMIRROR_CONFIG;
  if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) return false;
  if (cfg.supabaseUrl.includes('YOUR_PROJECT')) return false;
  if (typeof supabase === 'undefined') return false;
  sb = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  return true;
}

function getClientDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isPremiumUser() {
  if (!userProfile || userProfile.plan !== 'premium') return false;
  if (!userProfile.premium_until) return true;
  return new Date(userProfile.premium_until) > new Date();
}

function getDailyLimit() {
  return isPremiumUser() ? 5 : 1;
}

function canAnalyzeToday() {
  return dailyUsed < dailyLimitVal;
}

async function getAccessToken() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token || null;
}

async function apiPost(anthropicPayload) {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const resp = await fetch('/api/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...anthropicPayload,
      clientDate: getClientDate(),
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const err = data.error || {};
    const e = new Error(err.message || `HTTP ${resp.status}`);
    e.code = err.code;
    e.limit = err.limit;
    e.used = err.used;
    throw e;
  }

  if (data.meta?.dailyUsed != null) {
    dailyUsed = data.meta.dailyUsed;
    dailyLimitVal = data.meta.dailyLimit ?? getDailyLimit();
    if (typeof updateQuotaUI === 'function') updateQuotaUI();
  }

  return data;
}

async function loadProfile() {
  if (!sb || !currentUser) return;
  const { data, error } = await sb
    .from('profiles')
    .select('plan, premium_until')
    .eq('id', currentUser.id)
    .single();

  if (error) {
    console.error('loadProfile', error);
    userProfile = { plan: 'free', premium_until: null };
  } else {
    userProfile = data;
  }
  dailyLimitVal = getDailyLimit();
}

async function loadDailyUsage() {
  if (!sb || !currentUser) return;
  const today = getClientDate();
  const { data } = await sb
    .from('daily_usage')
    .select('photo_count')
    .eq('user_id', currentUser.id)
    .eq('usage_date', today)
    .maybeSingle();

  dailyUsed = data?.photo_count ?? 0;
  dailyLimitVal = getDailyLimit();
}

async function loadEntriesFromDb() {
  if (!sb || !currentUser) return [];
  const { data, error } = await sb
    .from('entries')
    .select('id, ts, note, img_thumb, result')
    .eq('user_id', currentUser.id)
    .order('ts', { ascending: false });

  if (error) {
    console.error('loadEntries', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    ts: row.ts,
    note: row.note || '',
    imgThumb: row.img_thumb,
    result: row.result,
  }));
}

async function insertEntry(entry) {
  if (!sb || !currentUser) return null;
  const { data, error } = await sb
    .from('entries')
    .insert({
      user_id: currentUser.id,
      ts: entry.ts,
      note: entry.note || null,
      img_thumb: entry.imgThumb,
      result: entry.result,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function deleteEntryFromDb(id) {
  if (!sb || !currentUser) return;
  await sb.from('entries').delete().eq('id', id).eq('user_id', currentUser.id);
}

async function deleteAllEntriesFromDb() {
  if (!sb || !currentUser) return;
  await sb.from('entries').delete().eq('user_id', currentUser.id);
}

async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  currentUser = data.user;
  await afterAuth();
  return data;
}

async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  if (data.user) {
    currentUser = data.user;
    await afterAuth();
  }
  return data;
}

async function signOut() {
  if (sb) await sb.auth.signOut();
  currentUser = null;
  userProfile = null;
  dailyUsed = 0;
  if (typeof onSignedOut === 'function') onSignedOut();
}

async function afterAuth() {
  await loadProfile();
  await loadDailyUsage();
  if (typeof onAuthenticated === 'function') await onAuthenticated();
}

async function initAuth() {
  if (!initSupabase()) return false;

  const { data: sessionData } = await sb.auth.getSession();
  if (sessionData.session?.user) {
    currentUser = sessionData.session.user;
    await afterAuth();
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      await afterAuth();
    }
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      userProfile = null;
      if (typeof onSignedOut === 'function') onSignedOut();
    }
  });

  return true;
}

Object.assign(window, {
  initAuth,
  signIn,
  signUp,
  signOut,
  isPremiumUser,
  getDailyLimit,
  canAnalyzeToday,
  apiPost,
  loadEntriesFromDb,
  insertEntry,
  deleteEntryFromDb,
  deleteAllEntriesFromDb,
  getClientDate,
});
