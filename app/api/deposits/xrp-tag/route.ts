import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const MIN_TAG = 100000;
const MAX_TAG = 999999;

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userId = String(body?.user_id ?? '').trim();
  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('xrp_destination_tags')
    .select('destination_tag')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: 'Failed to load tag' }, { status: 500 });
  }

  if (existing?.destination_tag) {
    return NextResponse.json({ tag: existing.destination_tag });
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const tag = Math.floor(Math.random() * (MAX_TAG - MIN_TAG + 1)) + MIN_TAG;
    const { data: existingTag, error: tagError } = await supabaseAdmin
      .from('xrp_destination_tags')
      .select('user_id')
      .eq('destination_tag', tag)
      .maybeSingle();
    if (tagError) continue;
    if (existingTag?.user_id) continue;

    const { error: updateError } = await supabaseAdmin
      .from('xrp_destination_tags')
      .upsert({ user_id: userId, destination_tag: tag }, { onConflict: 'user_id' });

    if (!updateError) {
      return NextResponse.json({ tag });
    }
  }

  return NextResponse.json({ error: 'Failed to allocate tag' }, { status: 500 });
}
