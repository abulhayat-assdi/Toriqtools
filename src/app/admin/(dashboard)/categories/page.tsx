'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import ImageUpload from '@/components/admin/ImageUpload';
import { useConfirm } from '@/contexts/ConfirmContext';

type Category = {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  is_active: boolean;
  show_in_header: boolean;
  show_in_footer: boolean;
  display_order: number;
  parent_id: string | null;
};

const empty = { name: '', slug: '', image_url: '', is_active: true, show_in_header: false, show_in_footer: false, display_order: 1, parent_id: '' };

export default function CategoriesPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ ...empty });

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setLoading(true);
    const res = await fetch('/api/admin/categories');
    const data = await res.json();
    if (data.data) setItems(data.data);
    setLoading(false);
  }

  // Top-level categories, each followed by its subcategories.
  const topLevel = items.filter(c => !c.parent_id || !items.some(p => p.id === c.parent_id));
  const rows = topLevel.flatMap(c => [c, ...items.filter(s => s.parent_id === c.id)]);
  const nameOf = (id: string | null) => items.find(c => c.id === id)?.name;

  const openNew = (parentId = '') => {
    setEditing(null);
    const siblings = items.filter(c => (c.parent_id || '') === parentId);
    setForm({ ...empty, parent_id: parentId, display_order: siblings.length + 1 });
    setOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, slug: c.slug, image_url: c.image_url, is_active: c.is_active, show_in_header: c.show_in_header ?? false, show_in_footer: c.show_in_footer ?? false, display_order: c.display_order, parent_id: c.parent_id || '' });
    setOpen(true);
  };

  // A category can be moved under another top-level category only if it has
  // no subcategories of its own (one level deep).
  const editingHasChildren = !!editing && items.some(c => c.parent_id === editing.id);
  const parentOptions = topLevel.filter(c => c.id !== editing?.id);

  const save = async () => {
    const payload = { ...form, parent_id: form.parent_id || null };
    const res = await fetch('/api/admin/categories', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Save failed');
      return;
    }
    setOpen(false);
    fetchCategories();
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: "ক্যাটাগরি ডিলিট করুন",
      message: "এই ক্যাটাগরিটি স্থায়ীভাবে ডিলিট হয়ে যাবে। আপনি কি নিশ্চিত?",
      confirmText: "হ্যাঁ, ডিলিট করুন",
      cancelText: "না",
    });
    if (!ok) return;
    const res = await fetch('/api/admin/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) alert(data.error);
    fetchCategories();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-brand-gold" size={32} />
      </div>
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">Manage shop categories and their subcategories.</p>
        </div>
        <button className="btn-primary-admin" onClick={() => openNew()}><Plus size={15} /> Add Category</button>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>Order</th><th>Image</th><th>Name</th><th>Slug</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="empty-state">No categories found.</td></tr>
            ) : rows.map(c => (
              <tr key={c.id} style={c.parent_id ? { background: 'rgba(255,255,255,0.02)' } : undefined}>
                <td data-label="Order" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, paddingLeft: c.parent_id ? 28 : undefined }}>#{c.display_order}</td>
                <td data-label="Image">{c.image_url ? <img src={c.image_url} alt="" className="thumb" /> : null}</td>
                <td data-label="Name" style={{ fontWeight: c.parent_id ? 500 : 600 }}>
                  {c.parent_id ? (
                    <span style={{ paddingLeft: 16 }}>
                      <span style={{ color: 'rgba(255,255,255,0.35)', marginRight: 6 }}>↳</span>{c.name}
                      <span style={{ display: 'block', paddingLeft: 22, fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>Sub of {nameOf(c.parent_id)}</span>
                    </span>
                  ) : c.name}
                </td>
                <td data-label="Slug"><code style={{ background: 'rgba(255,255,255,0.07)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{c.slug}</code></td>
                <td data-label="Status">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className={`badge ${c.is_active ? 'badge-active' : 'badge-inactive'}`}>{c.is_active ? 'Active' : 'Inactive'}</span>
                    {c.show_in_header && <span className="badge" style={{ background: 'rgba(26,60,46,0.4)', color: '#4ade80', fontSize: 10 }}>Header Nav</span>}
                    {c.show_in_footer && <span className="badge" style={{ background: 'rgba(201,162,39,0.15)', color: '#eb1c24', fontSize: 10 }}>Footer</span>}
                  </div>
                </td>
                <td data-label="Actions">
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!c.parent_id && (
                      <button className="btn-edit" onClick={() => openNew(c.id)} title="Add subcategory"><Plus size={13} /> Sub</button>
                    )}
                    <button className="btn-edit" onClick={() => openEdit(c)}><Pencil size={13} /> Edit</button>
                    <button className="btn-danger" onClick={() => remove(c.id)}><Trash2 size={13} /></button>
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
              {editing ? (form.parent_id ? 'Edit Subcategory' : 'Edit Category') : (form.parent_id ? 'Add Subcategory' : 'Add Category')}
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Slug</label><input className="form-input" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="flower-tea" /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Parent Category</label>
              <select
                className="form-select"
                value={form.parent_id}
                onChange={e => setForm({ ...form, parent_id: e.target.value })}
                disabled={editingHasChildren}
              >
                <option value="">— None (main category) —</option>
                {parentOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {editingHasChildren && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
                  এই ক্যাটাগরির সাব-ক্যাটাগরি আছে, তাই এটাকে অন্য ক্যাটাগরির আন্ডারে নেওয়া যাবে না।
                </p>
              )}
            </div>
            <ImageUpload
              label="Category Image"
              value={form.image_url}
              onChange={url => setForm({ ...form, image_url: url })}
              bucket="images"
              folder="categories"
            />
            <div className="form-row">
              <div className="form-group"><label className="form-label">Display Order</label><input type="number" className="form-input" value={form.display_order} onChange={e => setForm({ ...form, display_order: Number(e.target.value) })} min={1} /></div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 2 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#4a9eff' }} />
                  Active
                </label>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.show_in_header} onChange={e => setForm({ ...form, show_in_header: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#4ade80' }} />
                  <span>Header Navigation-এ দেখাও</span>
                </label>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.show_in_footer} onChange={e => setForm({ ...form, show_in_footer: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#eb1c24' }} />
                  <span>Footer Shop-এ দেখাও</span>
                </label>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-primary-admin" onClick={save}>Save Category</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
