import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAuth, unauthorizedResponse } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Verify authentication
  let authResult;
  try {
    authResult = await verifyAuth(request);
  } catch (error: any) {
    return unauthorizedResponse(error.message);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const orderId = String(body?.order_id ?? '').trim();
  if (!orderId) {
    return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
  }

  // Use atomic function for order cancellation
  const { data, error } = await supabaseAdmin.rpc('cancel_order_atomic', {
    p_user_id: authResult.userId,
    p_order_id: orderId,
  });

  if (error) {
    console.error('Cancel order error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  const result = data as any;
  if (result?.error) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
  }

  return NextResponse.json({ ok: true, unlocked_amount: result.unlocked_amount });
}
