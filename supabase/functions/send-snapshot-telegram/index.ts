import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramRequestBody {
  snapshotId: string;
  idempotencyKey?: string;
  caption?: string;
}

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getGoogleAccessToken(): Promise<string> {
  const refreshToken = Deno.env.get('GOOGLE_OAUTH_REFRESH_TOKEN');
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (refreshToken && clientId && clientSecret) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.access_token) {
      throw new Error(
        `Google OAuth token exchange failed: ${json.error_description ?? res.status}`,
      );
    }
    return json.access_token as string;
  }

  const saJsonRaw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!saJsonRaw) {
    throw new Error('Missing Google Drive credentials');
  }
  const sa = JSON.parse(saJsonRaw) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(sigBuf))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Service account token exchange failed: ${json.error_description ?? res.status}`,
    );
  }
  return json.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: allowRow } = await supabase
      .from('allowed_users')
      .select('role, status')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!allowRow || allowRow.status !== 'active' || allowRow.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Owner permission required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const ownerChatId = Deno.env.get('TELEGRAM_OWNER_CHAT_ID');
    if (!botToken || !ownerChatId) {
      throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_OWNER_CHAT_ID secret');
    }

    const body = (await req.json()) as TelegramRequestBody;
    const idempotencyKey = body.idempotencyKey || crypto.randomUUID();

    const { data: snapshot, error: snapErr } = await supabase
      .from('roster_snapshots')
      .select('id, drive_file_id, file_name, snapshot_version, snapshot_type')
      .eq('id', body.snapshotId)
      .single();

    if (snapErr || !snapshot) {
      throw new Error(`Snapshot ${body.snapshotId} not found`);
    }

    const driveToken = await getGoogleAccessToken();
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(snapshot.drive_file_id)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${driveToken}` } },
    );
    if (!driveRes.ok) {
      const errTxt = await driveRes.text();
      throw new Error(`Failed to fetch PDF from Google Drive (${driveRes.status}): ${errTxt}`);
    }
    const pdfArrayBuf = await driveRes.arrayBuffer();

    const form = new FormData();
    form.append('chat_id', ownerChatId);
    form.append('protect_content', 'false');
    form.append(
      'caption',
      body.caption ??
        `ED Roster — Snapshot v${String(snapshot.snapshot_version).padStart(2, '0')} (${snapshot.snapshot_type})`,
    );
    form.append(
      'document',
      new Blob([pdfArrayBuf], { type: 'application/pdf' }),
      snapshot.file_name,
    );

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: form,
    });
    const tgJson = await tgRes.json();

    if (!tgRes.ok || !tgJson.ok) {
      await supabase.rpc('record_snapshot_delivery', {
        p_snapshot_id: body.snapshotId,
        p_idempotency_key: idempotencyKey,
        p_telegram_chat_id: ownerChatId,
        p_telegram_message_id: null,
        p_status: 'failed',
      });
      throw new Error(`Telegram sendDocument failed: ${tgJson.description ?? tgRes.status}`);
    }

    const messageId = String(tgJson.result?.message_id ?? '');
    const { data: deliveryRow, error: delErr } = await supabase.rpc('record_snapshot_delivery', {
      p_snapshot_id: body.snapshotId,
      p_idempotency_key: idempotencyKey,
      p_telegram_chat_id: ownerChatId,
      p_telegram_message_id: messageId,
      p_status: 'sent',
    });
    if (delErr) throw delErr;

    return new Response(
      JSON.stringify({
        delivery: deliveryRow,
        telegramMessageId: messageId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Telegram delivery failed';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
