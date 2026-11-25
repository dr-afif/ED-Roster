import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecipientPayload {
  staffId: number;
  messageText: string;
  amendmentEventIds?: number[];
}

interface SendStaffTelegramBody {
  periodId: number;
  notificationType: 'published_broadcast' | 'amendment_update';
  recipients: RecipientPayload[];
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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !botToken) {
      throw new Error(
        'Missing SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, or TELEGRAM_BOT_TOKEN',
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: allowRow } = await userClient
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

    const body = (await req.json()) as SendStaffTelegramBody;
    if (!body.periodId || !body.notificationType || !Array.isArray(body.recipients)) {
      return new Response(JSON.stringify({ error: 'Invalid request payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const staffIds = body.recipients.map((r) => r.staffId);

    const { data: profiles, error: profErr } = await adminClient
      .from('staff_profiles')
      .select('staff_id, telegram_chat_id')
      .in('staff_id', staffIds);

    if (profErr) {
      throw new Error(profErr.message);
    }

    const chatByStaffId = new Map<number, string | null>(
      (profiles ?? []).map((p) => [
        p.staff_id as number,
        (p.telegram_chat_id as string | null) ?? null,
      ]),
    );

    const results: Array<{
      staffId: number;
      status: 'sent' | 'failed' | 'skipped';
      telegramMessageId?: string;
      error?: string;
    }> = [];

    for (const recipient of body.recipients) {
      const chatId = chatByStaffId.get(recipient.staffId) ?? null;
      if (!chatId) {
        results.push({
          staffId: recipient.staffId,
          status: 'skipped',
          error: 'User has not linked Telegram',
        });
        continue;
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: recipient.messageText,
        }),
      });
      const tgJson = await tgRes.json();

      if (!tgRes.ok || !tgJson.ok) {
        const errMsg = String(tgJson.description ?? `Telegram HTTP ${tgRes.status}`);
        await adminClient.from('roster_telegram_deliveries').insert({
          period_id: body.periodId,
          staff_id: recipient.staffId,
          notification_type: body.notificationType,
          amendment_event_ids: recipient.amendmentEventIds ?? null,
          message_text: recipient.messageText,
          telegram_chat_id: chatId,
          telegram_message_id: null,
          status: 'failed',
          error_message: errMsg,
          sent_by: user.id,
        });
        results.push({
          staffId: recipient.staffId,
          status: 'failed',
          error: errMsg,
        });
      } else {
        const msgId = String(tgJson.result?.message_id ?? '');
        await adminClient.from('roster_telegram_deliveries').insert({
          period_id: body.periodId,
          staff_id: recipient.staffId,
          notification_type: body.notificationType,
          amendment_event_ids: recipient.amendmentEventIds ?? null,
          message_text: recipient.messageText,
          telegram_chat_id: chatId,
          telegram_message_id: msgId || null,
          status: 'sent',
          error_message: null,
          sent_by: user.id,
        });
        results.push({
          staffId: recipient.staffId,
          status: 'sent',
          telegramMessageId: msgId || undefined,
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Telegram delivery failed';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
