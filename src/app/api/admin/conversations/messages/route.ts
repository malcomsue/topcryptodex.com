import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const conversationId = String(searchParams.get('conversation_id') ?? '').trim();

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id, sender, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const conversationId = String(body?.conversation_id ?? '').trim();
  const message = String(body?.message ?? '').trim();

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('chat_messages').insert({
    conversation_id: conversationId,
    sender: 'admin',
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
}
