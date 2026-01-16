import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = String(searchParams.get('user_id') ?? '').trim();
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('full_name, email, phone, kyc_document_url, profile_completed, kyc_status')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
    }

    const profile = (data ?? {}) as {
      full_name?: string | null;
      email?: string | null;
      phone?: string | null;
      kyc_document_url?: string | null;
      profile_completed?: boolean | null;
      kyc_status?: string | null;
    };
    const missing = {
      full_name: !profile.full_name,
      email_or_phone: !profile.email && !profile.phone,
      kyc_document_url: !profile.kyc_document_url,
    };

    const isComplete = !missing.full_name && !missing.email_or_phone && !missing.kyc_document_url;

    return NextResponse.json({
      profile,
      missing,
      complete: isComplete,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Server error', hint: 'Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 },
    );
  }
}
