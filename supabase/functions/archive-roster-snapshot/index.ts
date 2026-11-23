import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArchiveRequestBody {
  periodId: number;
  fileName: string;
  pdfBase64: string;
  year: string;
  month: string;
  periodStart: string;
  revision: number;
  canonicalPayload: Record<string, unknown>;
  canonicalHash: string;
  pdfSha256: string;
  reason?: string;
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
    throw new Error(
      'Missing Google Drive credentials (GOOGLE_SERVICE_ACCOUNT_JSON or OAuth secrets)',
    );
  }
  const sa = JSON.parse(saJsonRaw) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive',
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

async function ensureFolder(token: string, parentId: string, folderName: string): Promise<string> {
  const q = `name='${folderName.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const listJson = await listRes.json();
  if (listRes.ok && Array.isArray(listJson.files) && listJson.files.length > 0) {
    return listJson.files[0].id as string;
  }

  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    },
  );
  const created = await createRes.json();
  if (!createRes.ok || !created.id) {
    throw new Error(`Failed to create Drive folder ${folderName}: ${JSON.stringify(created)}`);
  }
  return created.id as string;
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

    const body = (await req.json()) as ArchiveRequestBody;
    const rootFolderId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID');
    if (!rootFolderId) {
      throw new Error('Missing GOOGLE_DRIVE_ROOT_FOLDER_ID secret');
    }

    const accessToken = await getGoogleAccessToken();
    const rostersFolderId = await ensureFolder(accessToken, rootFolderId, '02 - Rosters');
    const yearFolderId = await ensureFolder(accessToken, rostersFolderId, body.year);
    const monthFolderId = await ensureFolder(
      accessToken,
      yearFolderId,
      body.month.padStart(2, '0'),
    );

    const pdfBytes = Uint8Array.from(atob(body.pdfBase64), (c) => c.charCodeAt(0));
    const boundary = `ed_roster_${crypto.randomUUID()}`;
    const metadataPart = JSON.stringify({
      name: body.fileName,
      parents: [monthFolderId],
      mimeType: 'application/pdf',
      appProperties: {
        period_id: String(body.periodId),
        pdf_sha256: body.pdfSha256,
      },
    });

    const encoder = new TextEncoder();
    const part1 = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
    );
    const part3 = encoder.encode(`\r\n--${boundary}--`);
    const multipartBody = new Uint8Array(part1.length + pdfBytes.length + part3.length);
    multipartBody.set(part1, 0);
    multipartBody.set(pdfBytes, part1.length);
    multipartBody.set(part3, part1.length + pdfBytes.length);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      },
    );
    const uploadJson = await uploadRes.json();
    if (!uploadRes.ok || !uploadJson.id) {
      throw new Error(`Google Drive upload failed: ${JSON.stringify(uploadJson)}`);
    }

    const { data: snapshot, error: rpcErr } = await supabase.rpc('create_or_get_roster_snapshot', {
      p_period_id: body.periodId,
      p_source_revision: body.revision,
      p_canonical_payload: body.canonicalPayload,
      p_canonical_hash: body.canonicalHash,
      p_pdf_sha256: body.pdfSha256,
      p_drive_file_id: uploadJson.id as string,
      p_drive_parent_id: monthFolderId,
      p_file_name: body.fileName,
      p_reason: body.reason ?? undefined,
    });

    if (rpcErr) throw rpcErr;

    let finalSnapshot = snapshot as { id?: string; drive_file_id?: string } | null;
    if (finalSnapshot?.id && finalSnapshot.drive_file_id?.startsWith('drive_')) {
      const oldDriveId = finalSnapshot.drive_file_id;
      const { data: updatedSnap } = await supabase
        .from('roster_snapshots')
        .update({
          drive_file_id: uploadJson.id as string,
          drive_parent_id: monthFolderId,
          file_name: body.fileName,
        })
        .eq('id', finalSnapshot.id)
        .select()
        .single();
      if (updatedSnap) {
        finalSnapshot = updatedSnap;
      }
      await supabase
        .from('document_records')
        .update({
          drive_file_id: uploadJson.id as string,
          drive_parent_id: monthFolderId,
          drive_web_view_link: (uploadJson.webViewLink as string | undefined) ?? null,
        })
        .eq('drive_file_id', oldDriveId);
    }

    return new Response(
      JSON.stringify({
        snapshot: finalSnapshot,
        driveFileId: uploadJson.id,
        driveParentId: monthFolderId,
        webViewLink: uploadJson.webViewLink ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Archive failed';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
