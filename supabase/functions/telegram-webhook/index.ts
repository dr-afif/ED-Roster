import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: {
      id: number | string;
    };
    from?: {
      username?: string;
      first_name?: string;
    };
  };
}

async function sendTelegramReply(botToken: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const expectedSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    if (expectedSecret) {
      const providedSecret = req.headers.get('x-telegram-bot-api-secret-token');
      if (providedSecret !== expectedSecret) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!botToken || !supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing TELEGRAM_BOT_TOKEN, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY');
    }

    const update = (await req.json()) as TelegramUpdate;
    const message = update.message;
    const chatId = message?.chat?.id ? String(message.chat.id) : '';
    const text = (message?.text ?? '').trim();

    if (!chatId || !text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/);
      const token = (parts[1] ?? '').trim();

      if (!token) {
        await sendTelegramReply(
          botToken,
          chatId,
          'To link your ED-Roster account, please open the app → My Profile → Notifications & Telegram and tap "Link Telegram".',
        );
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      const { data: profile, error: lookupError } = await adminClient
        .from('staff_profiles')
        .select('staff_id, full_name, telegram_link_token_expires_at')
        .eq('telegram_link_token', token)
        .maybeSingle();

      if (lookupError || !profile) {
        await sendTelegramReply(
          botToken,
          chatId,
          'This link is invalid or has already been used. Please tap "Link Telegram" again in ED-Roster → My Profile.',
        );
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const expiresAt = profile.telegram_link_token_expires_at
        ? new Date(profile.telegram_link_token_expires_at).getTime()
        : 0;
      if (!expiresAt || expiresAt < Date.now()) {
        await sendTelegramReply(
          botToken,
          chatId,
          'This link has expired. Please tap "Link Telegram" again in ED-Roster → My Profile.',
        );
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const username = message?.from?.username ? `@${message.from.username}` : null;

      const { error: updateError } = await adminClient
        .from('staff_profiles')
        .update({
          telegram_chat_id: chatId,
          telegram_username: username,
          telegram_linked_at: new Date().toISOString(),
          telegram_alerts_enabled: true,
          telegram_link_token: null,
          telegram_link_token_expires_at: null,
        })
        .eq('staff_id', profile.staff_id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      await sendTelegramReply(
        botToken,
        chatId,
        `Linked to ${profile.full_name}!\nYou will now receive ED-Roster duty alerts here.`,
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook error';
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
