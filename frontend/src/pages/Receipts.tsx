import { useEffect, useState, useRef } from 'react'
import {
  Upload, Receipt as ReceiptIcon,
  CheckCircle, AlertCircle, Trash2, ChevronLeft, Loader, X, Package
} from 'lucide-react'
import { api } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReceiptSummary {
  id: number
  store_name: string | null
  purchase_date: string | null
  total_amount: number | null
  uploaded_at: string
  item_count: number
}

interface ExtractionItem {
  raw_name: string
  quantity: number | null
  unit_price: number | null
  total_price: number | null
  matched_product_id: number | null
  matched_product_name: string | null
}

interface ExtractionResult {
  receipt_id: number
  store_name: string | null
  purchase_date: string | null
  total_amount: number | null
  items: ExtractionItem[]
}

interface ReviewItem extends ExtractionItem {
  product_id: number | null
  create_product: boolean
  skip: boolean
}

type View = 'list' | 'uploading' | 'review' | 'detail'

const NZ_STORES = ['Woolworths', 'New World', "Pak'n'Save", 'Other']

// ── Main component ────────────────────────────────────────────────────────────

export default function Receipts() {
  const [view, setView] = useState<View>('list')
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([])
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null)
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [reviewMeta, setReviewMeta] = useState({ store_name: '', purchase_date: '', total_amount: '' })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (view === 'list') loadReceipts()
  }, [view])

  async function loadReceipts() {
    try {
      const data = await api.receipts.list() as ReceiptSummary[]
      setReceipts(data)
    } catch (err) {
      console.error(err)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    setView('uploading')
    try {
      const result = await api.receipts.upload(file) as ExtractionResult
      setExtraction(result)
      setReviewMeta({
        store_name: result.store_name ?? '',
        purchase_date: result.purchase_date ?? '',
        total_amount: result.total_amount?.toString() ?? '',
      })
      setReviewItems(result.items.map(item => ({
        ...item,
        product_id: item.matched_product_id,
        create_product: false,
        skip: false,
      })))
      setView('review')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setView('list')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleConfirm() {
    if (!extraction) return
    setConfirming(true)
    try {
      await api.receipts.confirm(extraction.receipt_id, {
        store_name: reviewMeta.store_name || null,
        purchase_date: reviewMeta.purchase_date || null,
        total_amount: reviewMeta.total_amount ? parseFloat(reviewMeta.total_amount) : null,
        items: reviewItems.map(item => ({
          raw_name: item.raw_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          product_id: item.product_id,
          create_product: item.create_product,
          skip: item.skip,
        })),
      })
      setView('list')
    } finally {
      setConfirming(false)
    }
  }

  async function handleDelete(id: number) {
    await api.receipts.delete(id)
    setReceipts(prev => prev.filter(r => r.id !== id))
  }

  function updateItem(idx: number, patch: Partial<ReviewItem>) {
    setReviewItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item))
  }

  // ── Upload / list view ───────────────────────────────────────────────────────
  if (view === 'list' || view === 'uploading') {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Receipts</h1>

        {/* Upload zone */}
        <label className={`card border-2 border-dashed flex flex-col items-center justify-center py-12 gap-3 text-center cursor-pointer transition-colors ${
          uploading ? 'border-brand-300 bg-brand-50' : 'border-stone-200 hover:border-brand-300 hover:bg-stone-50'
        }`}>
          {uploading ? (
            <>
              <Loader className="w-8 h-8 text-brand-400 animate-spin" />
              <p className="text-sm font-medium text-brand-600">Extracting receipt with AI…</p>
              <p className="text-xs text-stone-400">This takes a few seconds</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center">
                <Upload className="w-5 h-5 text-stone-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-600">Upload a receipt</p>
                <p className="text-xs text-stone-400 mt-0.5">Woolworths, New World, Pak'n'Save — JPEG, PNG or PDF</p>
              </div>
              <span className="btn-primary text-sm">Choose file</span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>

        {uploadError && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{uploadError}</p>
          </div>
        )}

        {/* Receipt history */}
        {receipts.length > 0 && (
          <div>
            <h2 className="label mb-3">Receipt history</h2>
            <div className="card divide-y divide-stone-100">
              {receipts.map(r => (
                <ReceiptRow key={r.id} receipt={r} onDelete={() => handleDelete(r.id)} />
              ))}
            </div>
          </div>
        )}

        {receipts.length === 0 && !uploading && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <ReceiptIcon className="w-8 h-8 text-stone-300 mb-2" />
            <p className="text-stone-400 text-sm">No receipts uploaded yet.</p>
            <p className="text-stone-300 text-xs mt-1">Upload one above to start tracking your spend.</p>
          </div>
        )}
      </div>
    )
  }

  // ── Review view ───────────────────────────────────────────────────────────────
  if (view === 'review' && extraction) {
    const included = reviewItems.filter(i => !i.skip)
    const skipped = reviewItems.filter(i => i.skip)
    const matched = included.filter(i => i.product_id)
    const newItems = included.filter(i => !i.product_id && i.create_product)

    return (
      <div className="space-y-5 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="p-2 rounded-lg hover:bg-stone-100">
            <ChevronLeft className="w-4 h-4 text-stone-600" />
          </button>
          <div className="flex-1">
            <h1 className="page-header">Review extraction</h1>
            <p className="text-xs text-stone-400 mt-0.5">
              AI extracted {extraction.items.length} items. Review and confirm before saving.
            </p>
          </div>
          <button
            onClick={handleConfirm}
            disabled={confirming || included.length === 0}
            className="btn-primary flex items-center gap-2"
          >
            {confirming ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {confirming ? 'Saving…' : `Save ${included.length} items`}
          </button>
        </div>

        {/* Receipt meta */}
        <div className="card p-4 grid grid-cols-3 gap-3">
          <div>
            <label className="label block mb-1">Store</label>
            <select className="input" value={reviewMeta.store_name} onChange={e => setReviewMeta(m => ({ ...m, store_name: e.target.value }))}>
              <option value="">Unknown</option>
              {NZ_STORES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label block mb-1">Date</label>
            <input type="date" className="input" value={reviewMeta.purchase_date} onChange={e => setReviewMeta(m => ({ ...m, purchase_date: e.target.value }))} />
          </div>
          <div>
            <label className="label block mb-1">Total ($)</label>
            <input type="number" step="0.01" className="input" value={reviewMeta.total_amount} onChange={e => setReviewMeta(m => ({ ...m, total_amount: e.target.value }))} placeholder="0.00" />
          </div>
        </div>

        {/* Summary pills */}
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-medium">
            {matched.length} matched to catalogue
          </span>
          {newItems.length > 0 && (
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
              {newItems.length} new catalogue entries
            </span>
          )}
          {skipped.length > 0 && (
            <span className="px-3 py-1 rounded-full bg-stone-100 text-stone-500 text-xs font-medium">
              {skipped.length} skipped
            </span>
          )}
        </div>

        {/* Items list */}
        {extraction.items.length === 0 ? (
          <div className="card p-6 text-center">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-stone-600 font-medium">No items were extracted</p>
            <p className="text-xs text-stone-400 mt-1">
              The AI may not have been configured, or couldn't read the receipt.
              You can still save the receipt with metadata above.
            </p>
          </div>
        ) : (
          <div className="card divide-y divide-stone-100">
            {reviewItems.map((item, idx) => (
              <ReviewItemRow
                key={idx}
                item={item}
                onChange={patch => updateItem(idx, patch)}
              />
            ))}
          </div>
        )}

        {/* Bottom confirm */}
        <div className="flex gap-3">
          <button onClick={() => setView('list')} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={confirming || included.length === 0}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {confirming ? <Loader className="w-4 h-4 animate-spin" /> : null}
            {confirming ? 'Saving…' : `Save ${included.length} items`}
          </button>
        </div>
      </div>
    )
  }

  return null
}

// ── Receipt row (history) ─────────────────────────────────────────────────────

function ReceiptRow({ receipt, onDelete }: { receipt: ReceiptSummary; onDelete: () => void }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const date = receipt.purchase_date
    ? new Date(receipt.purchase_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date(receipt.uploaded_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="flex items-center gap-3 px-4 py-3 group">
      <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
        <ReceiptIcon className="w-4 h-4 text-stone-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 truncate">
          {receipt.store_name ?? 'Unknown store'}
        </p>
        <p className="text-xs text-stone-400">
          {date} · {receipt.item_count} item{receipt.item_count !== 1 ? 's' : ''}
        </p>
      </div>
      {receipt.total_amount && (
        <span className="text-sm font-medium text-stone-700">
          ${receipt.total_amount.toFixed(2)}
        </span>
      )}
      {confirmDel ? (
        <div className="flex items-center gap-1">
          <button onClick={onDelete} className="text-xs text-red-500 font-medium px-2 py-1 rounded hover:bg-red-50">Delete</button>
          <button onClick={() => setConfirmDel(false)} className="text-xs text-stone-400 px-2 py-1 rounded hover:bg-stone-100">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDel(true)}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
        </button>
      )}
    </div>
  )
}

// ── Review item row ───────────────────────────────────────────────────────────

function ReviewItemRow({ item, onChange }: { item: ReviewItem; onChange: (p: Partial<ReviewItem>) => void }) {
  return (
    <div className={`px-4 py-3 transition-colors ${item.skip ? 'bg-stone-50 opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Skip toggle */}
        <button
          onClick={() => onChange({ skip: !item.skip })}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            item.skip
              ? 'bg-stone-200 border-stone-300'
              : 'border-brand-400 bg-white hover:bg-brand-50'
          }`}
          title={item.skip ? 'Include this item' : 'Skip this item'}
        >
          {!item.skip && <div className="w-2 h-2 rounded-full bg-brand-500" />}
          {item.skip && <X className="w-2.5 h-2.5 text-stone-400" />}
        </button>

        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Raw name + price */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-stone-800 truncate">{item.raw_name}</p>
            <div className="flex items-center gap-2 shrink-0 text-xs text-stone-500">
              {item.quantity && item.quantity !== 1 && (
                <span>×{item.quantity}</span>
              )}
              {item.unit_price && (
                <span>${item.unit_price.toFixed(2)}</span>
              )}
              {item.total_price && item.total_price !== item.unit_price && (
                <span className="font-medium text-stone-700">${item.total_price.toFixed(2)}</span>
              )}
            </div>
          </div>

          {/* Catalogue match */}
          {!item.skip && (
            <div className="flex items-center gap-2">
              {item.matched_product_id ? (
                <div className="flex items-center gap-1.5 text-xs text-brand-600 bg-brand-50 px-2 py-1 rounded-md">
                  <CheckCircle className="w-3 h-3" />
                  <span>Matched: <span className="font-medium">{item.matched_product_name}</span></span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-stone-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.create_product}
                      onChange={e => onChange({ create_product: e.target.checked })}
                      className="rounded text-brand-500"
                    />
                    <Package className="w-3 h-3" />
                    Add to catalogue
                  </label>
                  <span className="text-xs text-stone-300">·</span>
                  <span className="text-xs text-stone-400 italic">No match found</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
