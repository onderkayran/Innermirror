import { createClient } from '@supabase/supabase-js';

const FREE_DAILY_LIMIT = 1;
const PREMIUM_DAILY_LIMIT = 5;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isPremium(profile) {
  if (!profile || profile.plan !== 'premium') return false;
  if (!profile.premium_until) return true;
  return new Date(profile.premium_until) > new Date();
}

function dailyLimit(premium) {
  return premium ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;
}

function parseClientDate(value) {
  if (typeof value === 'string' && DATE_RE.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'API key not configured' } });
  }

  const supabase = adminClient();
  if (!supabase) {
    return res.status(500).json({ error: { message: 'Supabase not configured' } });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: { message: 'Login required', code: 'AUTH_REQUIRED' } });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: { message: 'Invalid session', code: 'AUTH_INVALID' } });
  }

  const userId = userData.user.id;
  const body = req.body || {};
  const requestType = body.requestType === 'insight' ? 'insight' : 'analyze';
  const clientDate = parseClientDate(body.clientDate);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, premium_until')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return res.status(500).json({ error: { message: 'Profile not found' } });
  }

  const premium = isPremium(profile);
  const limit = dailyLimit(premium);

  if (requestType === 'insight' && !premium) {
    return res.status(403).json({
      error: {
        message: 'Premium required',
        code: 'PREMIUM_REQUIRED',
      },
    });
  }

  if (requestType === 'analyze') {
    const { data: usageRow } = await supabase
      .from('daily_usage')
      .select('photo_count')
      .eq('user_id', userId)
      .eq('usage_date', clientDate)
      .maybeSingle();

    const used = usageRow?.photo_count ?? 0;
    if (used >= limit) {
      return res.status(429).json({
        error: {
          message: 'Daily photo limit reached',
          code: 'DAILY_LIMIT',
          limit,
          used,
          premium,
        },
      });
    }
  }

  const { requestType: _rt, clientDate: _cd, ...anthropicBody } = body;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    if (requestType === 'analyze') {
      const { data: newCount, error: rpcError } = await supabase.rpc(
        'increment_daily_photo_usage',
        { p_user_id: userId, p_usage_date: clientDate }
      );

      if (rpcError) {
        console.error('increment_daily_photo_usage', rpcError);
      }

      const usedAfter = typeof newCount === 'number' ? newCount : undefined;
      return res.status(200).json({
        ...data,
        meta: {
          premium,
          dailyLimit: limit,
          dailyUsed: usedAfter,
          usageDate: clientDate,
        },
      });
    }

    return res.status(200).json({ ...data, meta: { premium } });
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
