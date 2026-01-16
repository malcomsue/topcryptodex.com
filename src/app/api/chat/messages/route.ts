import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

const DEFAULT_MESSAGE = 'Hi, how can i help you';

async function ensureConversation(userId: string) {
  const { data: existing, error } = await supabaseAdmin
    .from('chat_conversations')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error('Failed to load conversation');
  }

  if (existing?.id) {
    return existing.id as string;
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from('chat_conversations')
    .insert({ user_id: userId })
    .select('id')
    .single();

  if (createError || !created?.id) {
    throw new Error('Failed to create conversation');
  }

  await supabaseAdmin.from('chat_messages').insert({
    conversation_id: created.id,
    sender: 'bot',
    body: DEFAULT_MESSAGE,
  });

  return created.id as string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = String(searchParams.get('user_id') ?? '').trim();
  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }

  try {
    const conversationId = await ensureConversation(userId);
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select('id, sender, body, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    }

    return NextResponse.json({
      conversation_id: conversationId,
      messages: data ?? [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to load conversation' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userId = String(body?.user_id ?? '').trim();
  const message = String(body?.message ?? '').trim();

  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 });
  }

  try {
    const conversationId = await ensureConversation(userId);
    const { error } = await supabaseAdmin.from('chat_messages').insert({
      conversation_id: conversationId,
      sender: 'user',
      body: message,
    });

    if (error) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    await supabaseAdmin
      .from('chat_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to send message' }, { status: 500 });
  }
}
