'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { addVendorDocument } from '@/app/actions/vendor';
import { Alert, inputClass } from '@/components/ui';
import { DOC_TYPES } from '@/lib/types';

export function DocumentUpload({ userId }: { userId: string }) {
  const router = useRouter();
  const [docType, setDocType] = useState('gst');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > 10 * 1024 * 1024) return setError('File must be under 10 MB');
    setBusy(true);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
    const path = `${userId}/${docType}-${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const { error: upErr } = await supabase.storage.from('vendor-docs').upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(false);
      return setError(upErr.message);
    }
    const res = await addVendorDocument(docType, path);
    setBusy(false);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select className={`${inputClass} sm:w-64`} value={docType} onChange={(e) => setDocType(e.target.value)}>
          {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          <Upload className="h-4 w-4" /> {busy ? 'Uploading…' : 'Upload file (PDF / image)'}
          <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
