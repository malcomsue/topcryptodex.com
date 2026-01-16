import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get('q') ?? '').trim();
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50')));

  const { data: conversations, error } = await supabaseAdmin
    .from('chat_conversations')
    .select('id, user_id, status, last_message_at, created_at')
    .order('last_message_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 });
  }

  const userIds = (conversations ?? []).map((row) => row.user_id);
  const { data: profiles } = userIds.length
    ? await supabaseAdmin
        .from('user_profiles')
        .select('id, full_name, email, phone')
        .in('id', userIds)
    : { data: [] };

  const profilesById = new Map<string, any>();
  for (const profile of profiles ?? []) {
    profilesById.set(profile.id, profile);
  }

  let result = (conversations ?? []).map((row) => ({
    ...row,
    profile: profilesById.get(row.user_id) ?? null,
  }));

  if (q) {
    const lower = q.toLowerCase();
    result = result.filter((row) => {
      const profile = row.profile ?? {};
      return (
        String(row.user_id).toLowerCase().includes(lower) ||
        String(profile.full_name ?? '').toLowerCase().includes(lower) ||
        String(profile.email ?? '').toLowerCase().includes(lower) ||
        String(profile.phone ?? '').toLowerCase().includes(lower)
      );
    });
  }

  return NextResponse.json({ conversations: result });
}
