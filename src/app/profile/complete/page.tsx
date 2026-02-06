'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';

const DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'national_id', label: 'National ID' },
];

export default function ProfileCompletePage() {
  const router = useRouter();
  const { user, loading, signIn } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0].value);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUrl, setDocumentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    const initialEmail =
      (user as any)?.email?.address ??
      (user as any)?.email ??
      '';
    const initialPhone =
      (user as any)?.phone?.number ??
      (user as any)?.phone ??
      '';
    const initialName =
      (user as any)?.name ??
      (user as any)?.display_name ??
      '';
    setEmail((initialEmail ?? '').toString());
    setPhone((initialPhone ?? '').toString());
    setFullName((initialName ?? '').toString());
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchStatus = async () => {
      try {
        const res = await fetch(
          `/api/profile/status?user_id=${encodeURIComponent(String((user as any).id ?? ''))}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data?.complete) {
          router.replace('/');
        } else if (data?.profile?.kyc_document_url) {
          setDocumentUrl(String(data.profile.kyc_document_url));
        }
      } catch (error) {
        console.error('Failed to load profile status', error);
      }
    };

    void fetchStatus();
  }, [router, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    if (!user) {
      await signIn();
      return;
    }

    if (!fullName.trim()) {
      setMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setMessage('Please provide an email or phone number.');
      return;
    }
    if (!documentUrl && !documentFile) {
      setMessage('Please upload your ID document.');
      return;
    }

    setSubmitting(true);
    try {
      let uploadUrl = documentUrl;

      if (!uploadUrl && documentFile) {
        const formData = new FormData();
        formData.append('user_id', String((user as any).id ?? ''));
        formData.append('document_type', documentType);
        formData.append('file', documentFile);

        const uploadRes = await fetch('/api/profile/kyc-upload', {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) {
          const text = await uploadRes.text();
          throw new Error(text || 'Failed to upload document');
        }
        const uploadData = await uploadRes.json();
        uploadUrl = uploadData?.publicUrl ?? '';
        setDocumentUrl(uploadUrl);
      }

      const res = await fetch('/api/profile/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: (user as any).id,
          full_name: fullName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          kyc_document_url: uploadUrl,
          kyc_document_type: documentType,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to save profile');
      }

      router.replace('/');
    } catch (error: any) {
      setMessage(error?.message ?? 'Failed to submit profile.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1115] text-white flex items-center justify-center">
        <p className="text-sm text-gray-300">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f1115] text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#151a23] border border-white/10 rounded-2xl p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Complete your profile</h1>
          <p className="text-sm text-gray-400">
            Please log in to complete your onboarding and submit your ID document.
          </p>
          <button
            onClick={() => signIn()}
            className="w-full px-4 py-3 rounded-full bg-white text-black text-sm font-semibold"
          >
            Continue with login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1115] text-white">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-[#151a23] border border-white/10 rounded-2xl p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">Complete your profile</h1>
            <p className="text-sm text-gray-400 mt-2">
              We need a few details and a document upload to finish onboarding.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm text-gray-300">Full name</label>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-2 w-full rounded-xl bg-[#0f1115] border border-white/10 px-4 py-3 text-sm"
                placeholder="Enter your full name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm text-gray-300">Email</label>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-xl bg-[#0f1115] border border-white/10 px-4 py-3 text-sm"
                  placeholder="name@email.com"
                  type="email"
                />
              </div>
              <div>
                <label className="text-sm text-gray-300">Phone</label>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-2 w-full rounded-xl bg-[#0f1115] border border-white/10 px-4 py-3 text-sm"
                  placeholder="+1234567890"
                  type="tel"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-300">Document type</label>
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                className="mt-2 w-full rounded-xl bg-[#0f1115] border border-white/10 px-4 py-3 text-sm"
              >
                {DOCUMENT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-300">Upload ID document</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                className="mt-2 w-full rounded-xl bg-[#0f1115] border border-white/10 px-4 py-3 text-sm"
              />
              {documentUrl ? (
                <p className="text-xs text-emerald-400 mt-2">Document uploaded.</p>
              ) : null}
            </div>

            {message ? <p className="text-sm text-rose-400">{message}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-3 rounded-full bg-white text-black text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
