'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, ShoppingBag, X, Plus, Minus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export type CatalogProduct = {
  id: string;
  name: string;
  price: string;
  media_urls: string[];
  sizes: Array<{ size: string; available: boolean }>;
  colors: string[];
  is_available: boolean;
};

/** One line of an order being created or edited. `id` is set only for lines already saved. */
export type EditLine = {
  key: string;
  id?: string;
  product_id: string;
  product_name: string;
  image_url: string;
  size: string;
  color: string;
  price: number;
  quantity: number;
};

export const parsePrice = (raw: unknown) => parseFloat(String(raw ?? '').replace(/[^0-9.]/g, '')) || 0;
export const fmtTk = (n: number) => `৳${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

let lineSeq = 0;
export const newLineKey = () => `line-${Date.now()}-${lineSeq++}`;

export function lineFromProduct(p: CatalogProduct): EditLine {
  const firstSize = p.sizes.find(s => s.available)?.size || '';
  return {
    key: newLineKey(),
    product_id: p.id,
    product_name: p.name,
    image_url: p.media_urls[0] || '',
    size: firstSize,
    color: '',
    price: parsePrice(p.price),
    quantity: 1,
  };
}

// The product list is shared across every picker/line on the page and loaded once.
let catalogCache: CatalogProduct[] | null = null;
let catalogRequest: Promise<CatalogProduct[]> | null = null;

function loadCatalog(): Promise<CatalogProduct[]> {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (!catalogRequest) {
    catalogRequest = fetch('/api/admin/products')
      .then(r => r.json())
      .then(d => {
        const list: CatalogProduct[] = (d.data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          media_urls: Array.isArray(p.media_urls) ? p.media_urls : [],
          sizes: (Array.isArray(p.sizes) ? p.sizes : []).map((s: any) =>
            typeof s === 'string' ? { size: s, available: true } : { size: String(s.size), available: s.available !== false }),
          colors: Array.isArray(p.colors) ? p.colors : [],
          is_available: p.is_available !== false,
        }));
        catalogCache = list;
        return list;
      })
      .finally(() => { catalogRequest = null; });
  }
  return catalogRequest;
}

export function useCatalog() {
  const [products, setProducts] = useState<CatalogProduct[]>(catalogCache || []);
  const [loading, setLoading] = useState(!catalogCache);
  useEffect(() => {
    if (catalogCache) return;
    loadCatalog()
      .then(setProducts)
      .catch(() => toast.error('প্রোডাক্ট লিস্ট লোড করা যায়নি'))
      .finally(() => setLoading(false));
  }, []);
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  return { products, byId, loading };
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  padding: '7px 9px', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none',
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 };

/** Searchable product list. Calls onPick with the chosen product. */
export function ProductPicker({ onPick, onClose }: { onPick: (p: CatalogProduct) => void; onClose: () => void }) {
  const { products, loading } = useCatalog();
  const [q, setQ] = useState('');
  const shown = products.filter(p => p.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div style={{ border: '1px solid rgba(74,158,255,0.35)', borderRadius: 10, background: 'rgba(0,0,0,0.25)', padding: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="প্রোডাক্ট খুঁজুন..." style={{ ...inputStyle, paddingLeft: 30 }} />
        </div>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4 }} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {loading ? (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', padding: 8 }}>লোড হচ্ছে...</p>
        ) : shown.length === 0 ? (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', padding: 8 }}>কোনো প্রোডাক্ট পাওয়া যায়নি</p>
        ) : shown.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'left', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,158,255,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
          >
            <Thumb src={p.media_urls[0]} size={36} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
              {p.name}
              {!p.is_available && <span style={{ marginLeft: 6, fontSize: 10, color: '#ff4a4a', fontWeight: 700 }}>স্টক আউট</span>}
            </span>
            <span style={{ fontSize: 12, color: '#4a9eff', fontWeight: 700 }}>{fmtTk(parsePrice(p.price))}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Thumb({ src, size }: { src?: string; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 6, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ShoppingBag size={size / 2.5} color="rgba(255,255,255,0.3)" />}
    </div>
  );
}

/** Editable order line: size, colour, price, quantity stepper, remove. */
export function LineEditor({ line, product, onChange, onRemove, canRemove }: {
  line: EditLine;
  product?: CatalogProduct;
  onChange: (patch: Partial<EditLine>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const sizes = product?.sizes || [];
  const colors = product?.colors || [];
  // Keep a size that is no longer in the product's list selectable.
  const sizeInList = !line.size || sizes.some(s => s.size === line.size);

  return (
    <div style={{ background: line.id ? 'rgba(255,255,255,0.03)' : 'rgba(74,158,255,0.06)', borderRadius: 10, border: `1px solid ${line.id ? 'rgba(255,255,255,0.07)' : 'rgba(74,158,255,0.3)'}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Thumb src={line.image_url} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: '#fff', margin: 0 }}>{line.product_name}</p>
          {!line.id && <span style={{ fontSize: 10, color: '#4a9eff', fontWeight: 700 }}>নতুন যোগ করা</span>}
        </div>
        <p style={{ fontWeight: 700, fontSize: 14, color: '#fff', margin: 0 }}>{fmtTk(line.price * line.quantity)}</p>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          title={canRemove ? 'প্রোডাক্টটি বাদ দিন' : 'অর্ডারে অন্তত একটি প্রোডাক্ট থাকতে হবে'}
          style={{ background: 'rgba(255,74,74,0.1)', border: '1px solid rgba(255,74,74,0.3)', color: '#ff4a4a', borderRadius: 6, padding: 6, cursor: canRemove ? 'pointer' : 'not-allowed', opacity: canRemove ? 1 : 0.4, display: 'flex' }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
        <div>
          <label style={labelStyle}>Size</label>
          {sizes.length > 0 ? (
            <select value={line.size} onChange={e => onChange({ size: e.target.value })} style={{ ...inputStyle, appearance: 'auto' }}>
              <option value="" style={{ background: '#1a1a2e' }}>—</option>
              {!sizeInList && <option value={line.size} style={{ background: '#1a1a2e' }}>{line.size}</option>}
              {sizes.map(s => (
                <option key={s.size} value={s.size} style={{ background: '#1a1a2e' }}>
                  {s.size}{s.available ? '' : ' (স্টক আউট)'}
                </option>
              ))}
            </select>
          ) : (
            <input value={line.size} onChange={e => onChange({ size: e.target.value })} placeholder="e.g. M, XL" style={inputStyle} />
          )}
        </div>
        <div>
          <label style={labelStyle}>Price (৳)</label>
          <input type="number" min="0" value={line.price} onChange={e => onChange({ price: parseFloat(e.target.value) || 0 })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Quantity</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button type="button" onClick={() => onChange({ quantity: Math.max(1, line.quantity - 1) })} style={stepBtn} aria-label="Decrease"><Minus size={13} /></button>
            <input
              type="number"
              min="1"
              value={line.quantity}
              onChange={e => onChange({ quantity: Math.max(1, parseInt(e.target.value) || 1) })}
              style={{ ...inputStyle, textAlign: 'center', padding: '7px 4px' }}
            />
            <button type="button" onClick={() => onChange({ quantity: line.quantity + 1 })} style={stepBtn} aria-label="Increase"><Plus size={13} /></button>
          </div>
        </div>
      </div>

      {colors.length > 0 && (
        <div>
          <label style={labelStyle}>Color</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {colors.map(c => {
              const active = line.color === c;
              const isImg = c.startsWith('http') || c.startsWith('/');
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ color: active ? '' : c })}
                  title={isImg ? 'Color' : c}
                  style={{ width: 34, height: 34, borderRadius: 6, padding: 0, cursor: 'pointer', overflow: 'hidden', border: active ? '2px solid #4a9eff' : '2px solid rgba(255,255,255,0.15)', background: isImg ? 'transparent' : c, boxShadow: active ? '0 0 0 2px rgba(74,158,255,0.35)' : 'none' }}
                >
                  {isImg && <img src={c} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const stepBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
  borderRadius: 6, width: 30, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
};

/** Lines + "add product" button, used by both the new-order and edit-order forms. */
export function LinesEditor({ lines, setLines, onRemoveSaved }: {
  lines: EditLine[];
  setLines: (updater: (prev: EditLine[]) => EditLine[]) => void;
  onRemoveSaved?: (id: string) => void;
}) {
  const { byId } = useCatalog();
  const [picking, setPicking] = useState(false);

  const addProduct = (p: CatalogProduct) => {
    if (!p.is_available) toast('এই প্রোডাক্টটি স্টক আউট হিসেবে মার্ক করা আছে', { icon: '⚠️' });
    setLines(prev => [...prev, lineFromProduct(p)]);
    setPicking(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {lines.map(line => (
        <LineEditor
          key={line.key}
          line={line}
          product={byId.get(line.product_id)}
          canRemove={lines.length > 1}
          onChange={patch => setLines(prev => prev.map(l => (l.key === line.key ? { ...l, ...patch } : l)))}
          onRemove={() => {
            if (line.id) onRemoveSaved?.(line.id);
            setLines(prev => prev.filter(l => l.key !== line.key));
          }}
        />
      ))}
      {picking ? (
        <ProductPicker onPick={addProduct} onClose={() => setPicking(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 8, border: '1px dashed rgba(74,158,255,0.5)', background: 'rgba(74,158,255,0.06)', color: '#4a9eff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          <Plus size={15} /> প্রোডাক্ট যোগ করুন
        </button>
      )}
    </div>
  );
}

export const linesSubtotal = (lines: EditLine[]) => lines.reduce((acc, l) => acc + Number(l.price) * Number(l.quantity), 0);

/** Modal for entering an order received over Messenger / WhatsApp / phone. */
export function ManualOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: (order: any) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [zone, setZone] = useState<'inside' | 'outside'>('outside');
  const [shipping, setShipping] = useState(120);
  const [discount, setDiscount] = useState(0);
  const [lines, setLinesState] = useState<EditLine[]>([]);
  const [saving, setSaving] = useState(false);
  const setLines = (u: (prev: EditLine[]) => EditLine[]) => setLinesState(u);

  const subtotal = linesSubtotal(lines);
  const total = subtotal + shipping - discount;

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !address.trim()) { toast.error('নাম, ফোন নম্বর ও ঠিকানা দিন'); return; }
    if (lines.length === 0) { toast.error('অন্তত একটি প্রোডাক্ট যোগ করুন'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name,
          phone,
          address,
          shipping,
          discount,
          items: lines.map(l => ({ product_id: l.product_id, quantity: l.quantity, size: l.size || null, color: l.color || null, price: l.price })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || 'অর্ডার তৈরি করা যায়নি'); return; }
      toast.success('অর্ডার তৈরি হয়েছে — New Orders-এ যোগ হয়েছে');
      onCreated(data.data);
    } catch (err) {
      toast.error('System error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box manual-order-box" style={{ maxWidth: 760, padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: 0 }}>নতুন ম্যানুয়াল অর্ডার</h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>Messenger / WhatsApp / ফোনে পাওয়া অর্ডার এন্ট্রি দিন</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="manual-order-grid" style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 260px', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <section>
              <h3 style={sectionTitle}>কাস্টমার</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={labelStyle}>নাম *</label>
                  <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Customer Name" />
                </div>
                <div>
                  <label style={labelStyle}>ফোন নম্বর *</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="01XXXXXXXXX" inputMode="tel" />
                </div>
                <div>
                  <label style={labelStyle}>সম্পূর্ণ ঠিকানা *</label>
                  <textarea value={address} onChange={e => setAddress(e.target.value)} style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }} placeholder="Full Delivery Address" />
                </div>
              </div>
            </section>

            <section>
              <h3 style={sectionTitle}>প্রোডাক্ট</h3>
              <LinesEditor lines={lines} setLines={setLines} />
            </section>
          </div>

          <div>
            <h3 style={sectionTitle}>অর্ডার সামারি</h3>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>ডেলিভারি এরিয়া</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([['inside', 'ঢাকার ভিতরে', 70], ['outside', 'ঢাকার বাইরে', 120]] as const).map(([z, label, fee]) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => { setZone(z); setShipping(fee); }}
                      style={{ flex: 1, padding: '7px 4px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', background: zone === z ? '#4a9eff' : 'rgba(255,255,255,0.05)', color: zone === z ? '#fff' : 'rgba(255,255,255,0.6)', borderColor: zone === z ? '#4a9eff' : 'rgba(255,255,255,0.1)' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                <span>Subtotal</span><span>{fmtTk(subtotal)}</span>
              </div>
              <div>
                <label style={labelStyle}>Shipping (৳)</label>
                <input type="number" min="0" value={shipping} onChange={e => setShipping(parseFloat(e.target.value) || 0)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Discount (৳)</label>
                <input type="number" min="0" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                <span>Total</span><span style={{ color: '#4a9eff' }}>{fmtTk(total)}</span>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>পেমেন্ট: Cash on Delivery</p>
            </div>

            <button
              onClick={submit}
              disabled={saving}
              style={{ marginTop: 16, width: '100%', background: 'linear-gradient(135deg, #4a9eff 0%, #2563eb 100%)', color: '#fff', border: 'none', padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'সেভ হচ্ছে...' : 'অর্ডার তৈরি করুন'}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 720px) {
          .manual-order-grid { grid-template-columns: 1fr !important; padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}

const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' };
