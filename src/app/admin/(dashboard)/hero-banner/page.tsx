'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, Upload } from 'lucide-react';
import ImageUpload from '@/components/admin/ImageUpload';
import { useConfirm } from '@/contexts/ConfirmContext';

type Banner = {
  id: string;
  image_url: string;
};

export default function HeroBannerPage() {
  const confirm = useConfirm();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState({ image_url: '' });

  // Hero text fields
  const [heroText, setHeroText] = useState({
    eyebrow: '',
    title: '',
    subtitle: '',
    btn_text: '',
    btn_link: '',
  });
  const [heroTextSaving, setHeroTextSaving] = useState(false);
  const [heroTextSaved, setHeroTextSaved] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/home-config');
      const json = await res.json();
      if (json.data) {
        setBanners(json.data.banners || []);
        const ht = (json.data.data as any)?.hero_text;
        if (ht) setHeroText(prev => ({ ...prev, ...ht }));
      }
    } catch (err) {
      console.error('Failed to load home config', err);
    } finally {
      setLoading(false);
    }
  };

  const saveData = async (newBanners: Banner[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/home-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banners: newBanners, data: { hero_text: heroText } }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error saving data: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const openNew = () => { setEditing(null); setForm({ image_url: '' }); setOpen(true); };
  const openEdit = (b: Banner) => { setEditing(b); setForm({ image_url: b.image_url }); setOpen(true); };

  const saveBannerModal = async () => {
    const newBanners = editing
      ? banners.map(b => b.id === editing.id ? { ...editing, ...form } : b)
      : [...banners, { id: Date.now().toString(), ...form }];
    setBanners(newBanners);
    setOpen(false);
    await saveData(newBanners);
  };

  const removeBanner = async (id: string) => {
    const ok = await confirm({
      title: "ব্যানার ডিলিট করুন",
      message: "এই ব্যানারটি স্থায়ীভাবে ডিলিট হয়ে যাবে। আপনি কি নিশ্চিত?",
      confirmText: "হ্যাঁ, ডিলিট করুন",
      cancelText: "না",
    });
    if (!ok) return;
    const newBanners = banners.filter(b => b.id !== id);
    setBanners(newBanners);
    await saveData(newBanners);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" /> Loading home configuration...
      </div>
    );
  }

  return (
    <>
      {/* ── Site Banner: icon + logo ─────────────────────────── */}
      <div className="page-heading">
        <div>
          <h1 className="page-title">Site Banner</h1>
          <p className="page-subtitle">সাইট আইকন, লোগো, হিরো ব্যানার এবং ব্যানার টেক্সট — সব এখান থেকে পরিবর্তন করুন।</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 40 }}>
        <SiteAssetUploader
          title="Site Icon (Browser Icon)"
          description="ব্রাউজার ট্যাবে যে ছোট আইকন দেখায়। স্কয়ার ইমেজ দিন (যেমন 512×512 PNG)।"
          endpoint="/api/admin/favicon"
          previewSrc="/favicon.png"
          fallbackSrc="/logo.png"
          previewBox={{ width: 96, height: 96 }}
          maxMB={5}
          successText="✓ Icon updated! ব্রাউজার ট্যাবে দেখতে পেজ রিলোড করুন।"
        />
        <SiteAssetUploader
          title="Site Logo"
          description="হেডার, ফুটার, অ্যাডমিন সাইডবার ও কুরিয়ার লেবেলে দেখানো লোগো।"
          endpoint="/api/admin/logo"
          previewSrc="/logo.png"
          previewBox={{ width: 260, height: 96 }}
          maxMB={20}
          successText="✓ Logo updated! সাইডবার ও হেডারে দেখতে পেজ রিলোড করুন।"
        />
      </div>

      {/* ── Hero Text ───────────────────────────────────────── */}
      <div className="page-heading">
        <div>
          <h2 className="page-title" style={{ fontSize: 20 }}>Hero Banner Text</h2>
          <p className="page-subtitle">Banner-এর উপরে দেখানো text configure করুন।</p>
        </div>
        <button
          className="btn-primary-admin"
          disabled={heroTextSaving}
          style={{ background: heroTextSaved ? '#3ecf8e' : undefined, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={async () => {
            setHeroTextSaving(true);
            try {
              await fetch('/api/home-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ banners, data: { hero_text: heroText } }),
              });
              setHeroTextSaved(true);
              setTimeout(() => setHeroTextSaved(false), 2500);
            } finally { setHeroTextSaving(false); }
          }}
        >
          {heroTextSaving ? 'Saving...' : heroTextSaved ? '✓ Saved!' : 'Save Text'}
        </button>
      </div>
      <div className="section-card" style={{ marginBottom: 40 }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Eyebrow (ছোট টেক্সট)</label><input className="form-input" value={heroText.eyebrow} onChange={e => setHeroText({ ...heroText, eyebrow: e.target.value })} placeholder="New Collection" /></div>
          <div className="form-group"><label className="form-label">Button Text</label><input className="form-input" value={heroText.btn_text} onChange={e => setHeroText({ ...heroText, btn_text: e.target.value })} placeholder="SHOP NOW" /></div>
        </div>
        <div className="form-group"><label className="form-label">Main Title (বড় হেডিং)</label><input className="form-input" value={heroText.title} onChange={e => setHeroText({ ...heroText, title: e.target.value })} placeholder="BEST QUALITY TOOLS" /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Subtitle</label><input className="form-input" value={heroText.subtitle} onChange={e => setHeroText({ ...heroText, subtitle: e.target.value })} placeholder="For The Modern Man" /></div>
          <div className="form-group"><label className="form-label">Button Link</label><input className="form-input" value={heroText.btn_link} onChange={e => setHeroText({ ...heroText, btn_link: e.target.value })} placeholder="/collections/all" /></div>
        </div>
      </div>

      {/* ── Hero Banner ──────────────────────────────────────── */}
      <div className="page-heading">
        <div>
          <h2 className="page-title" style={{ fontSize: 20 }}>Hero Banner</h2>
          <p className="page-subtitle">Manage the homepage hero banner image.</p>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs text-gray-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Saving...</span>}
          <button className="btn-primary-admin" onClick={openNew}><Plus size={15} /> Add Banner</button>
        </div>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Image</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {banners.length === 0 ? (
              <tr><td colSpan={2} className="empty-state">No banners found.</td></tr>
            ) : banners.map(b => (
              <tr key={b.id}>
                <td><img src={b.image_url} alt="" className="thumb" onError={e => (e.currentTarget.style.display='none')} /></td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-edit" onClick={() => openEdit(b)}><Pencil size={13} /> Edit</button>
                    <button className="btn-danger" onClick={() => removeBanner(b.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              {editing ? 'Edit Banner' : 'Add Banner'}
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <ImageUpload
              label="Banner Image"
              value={form.image_url}
              onChange={url => setForm({ ...form, image_url: url })}
              bucket="images"
              folder="hero"
            />
            <div className="form-actions">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-primary-admin" onClick={saveBannerModal}>Save Banner</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SiteAssetUploader({
  title,
  description,
  endpoint,
  previewSrc,
  fallbackSrc,
  previewBox,
  maxMB,
  successText,
}: {
  title: string;
  description: string;
  endpoint: string;
  previewSrc: string;
  fallbackSrc?: string;
  previewBox: { width: number; height: number };
  maxMB: number;
  successText: string;
}) {
  const [version, setVersion] = useState(() => Date.now());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    if (file.size > maxMB * 1024 * 1024) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setError(`ইমেজ সাইজ অনেক বড় (${sizeMB}MB)। সর্বোচ্চ ${maxMB}MB পর্যন্ত আপলোড করা যাবে।`);
      return;
    }
    setUploading(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(endpoint, { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Upload failed');
      setUseFallback(false);
      setVersion(Date.now());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const src = useFallback && fallbackSrc ? fallbackSrc : `${previewSrc}?v=${version}`;

  return (
    <div className="section-card" style={{ margin: 0 }}>
      <p className="form-label" style={{ fontSize: 14, marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 14 }}>{description}</p>

      <div
        style={{ width: previewBox.width, height: previewBox.height, maxWidth: '100%', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, cursor: 'pointer' }}
        onClick={() => inputRef.current?.click()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        onDragOver={e => e.preventDefault()}
        title="Click or drop an image"
      >
        <img
          key={src}
          src={src}
          alt={title}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          onError={e => {
            if (fallbackSrc && !useFallback) setUseFallback(true);
            else (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
      {useFallback && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>আলাদা আইকন আপলোড করা হয়নি — এখন লোগোটাই আইকন হিসেবে ব্যবহার হচ্ছে।</p>}

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          className="btn-primary-admin"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{ background: saved ? '#3ecf8e' : undefined, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? 'Uploading…' : saved ? '✓ Updated!' : 'Upload New'}
        </button>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>PNG, SVG, WEBP · max {maxMB} MB</span>
      </div>
      {error && <p style={{ fontSize: 12, color: '#ff6b6b', marginTop: 8 }}>{error}</p>}
      {saved && <p style={{ fontSize: 12, color: '#3ecf8e', marginTop: 8 }}>{successText}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}
