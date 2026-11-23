'use client';

import { useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { SizeOption } from '@/lib/size-price';

const muted = 'rgba(255,255,255,0.45)';

/**
 * Collapsible "Add Size & Price" editor for the product form.
 * Each size can carry its own price; an empty price means the product's main price applies.
 */
export default function SizePriceEditor({
  sizes,
  basePrice,
  onChange,
}: {
  sizes: SizeOption[];
  basePrice: string;
  onChange: (sizes: SizeOption[]) => void;
}) {
  const [open, setOpen] = useState(sizes.length > 0);
  const [quickInput, setQuickInput] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');

  const update = (i: number, patch: Partial<SizeOption>) => {
    const next = [...sizes];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const remove = (i: number) => onChange(sizes.filter((_, idx) => idx !== i));

  const addRow = () => onChange([...sizes, { size: '', available: true, price: '' }]);

  const quickAdd = () => {
    const existing = new Set(sizes.map(s => s.size.trim().toLowerCase()));
    const fresh = quickInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s && !existing.has(s.toLowerCase()));
    if (fresh.length) onChange([...sizes, ...fresh.map(size => ({ size, available: true, price: '' }))]);
    setQuickInput('');
  };

  const applyBulkPrice = () => onChange(sizes.map(s => ({ ...s, price: bulkPrice.trim() })));

  const pricedCount = sizes.filter(s => s.price && s.price.trim()).length;

  return (
    <div className="form-group" style={{ marginTop: 16, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: 'none', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'left' }}
      >
        <span>
          Add Size &amp; Price
          <span style={{ color: muted, fontWeight: 400, fontSize: 11, marginLeft: 8 }}>
            {sizes.length > 0
              ? `${sizes.length} সাইজ${pricedCount ? ` · ${pricedCount}টির আলাদা দাম` : ''}`
              : '(ঐচ্ছিক)'}
          </span>
        </span>
        <ChevronDown size={16} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 11, color: muted, margin: 0 }}>
            দাম খালি রাখলে মেইন প্রাইস ({basePrice ? basePrice : 'উপরের Price'}) প্রযোজ্য হবে। একাধিক সাইজে একই দাম রাখতে পারবেন।
          </p>

          {/* Quick add */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="form-input"
              placeholder="দ্রুত যোগ করুন: S, M, L, XL"
              value={quickInput}
              onChange={e => setQuickInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); quickAdd(); } }}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="button" className="btn-ghost" onClick={quickAdd} style={{ padding: '4px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>
              Add
            </button>
          </div>

          {/* Rows */}
          {sizes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto auto', gap: 6, fontSize: 11, color: muted }}>
                <span>সাইজ</span>
                <span>দাম (ঐচ্ছিক)</span>
                <span>স্টক</span>
                <span />
              </div>
              {sizes.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto auto', gap: 6, alignItems: 'center' }}>
                  <input
                    className="form-input"
                    placeholder="যেমন: M / 10 inch"
                    value={s.size}
                    onChange={e => update(i, { size: e.target.value })}
                  />
                  <input
                    className="form-input"
                    inputMode="decimal"
                    placeholder={basePrice || 'মেইন প্রাইস'}
                    value={s.price ?? ''}
                    onChange={e => update(i, { price: e.target.value })}
                  />
                  <button
                    type="button"
                    title={s.available ? 'Stock Out করুন' : 'Available করুন'}
                    onClick={() => update(i, { available: !s.available })}
                    style={{ background: s.available ? 'rgba(74,158,255,0.1)' : 'rgba(255,74,74,0.1)', border: `1px solid ${s.available ? 'rgba(74,158,255,0.5)' : 'rgba(255,74,74,0.4)'}`, borderRadius: 4, cursor: 'pointer', color: s.available ? '#4a9eff' : '#ff4a4a', fontSize: 10, padding: '6px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}
                  >
                    {s.available ? '✓ Available' : '✗ Stock Out'}
                  </button>
                  <button
                    type="button"
                    title="সাইজ মুছুন"
                    onClick={() => remove(i)}
                    style={{ background: 'none', border: 'none', color: '#ff4a4a', cursor: 'pointer', padding: 6 }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <button type="button" className="btn-ghost" onClick={addRow} style={{ padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={12} /> Add Size
            </button>

            {sizes.length > 1 && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  className="form-input"
                  inputMode="decimal"
                  placeholder="সব সাইজের দাম"
                  value={bulkPrice}
                  onChange={e => setBulkPrice(e.target.value)}
                  style={{ width: 130 }}
                />
                <button type="button" className="btn-ghost" onClick={applyBulkPrice} style={{ padding: '4px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>
                  সবগুলোতে বসান
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
