import { useEffect, useState, useRef } from 'react'
import {
  Upload, Receipt as ReceiptIcon, CheckCircle, AlertCircle,
  Trash2, ChevronLeft, Loader, X, Package, Eye, ChevronDown, ChevronUp
} from 'lucide-react'
import { api } from '../lib/api'
import type { Category } from '../lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReceiptSummary {
  id: number
  store_name: string | null
  purchase_date: string | null
  total_amount: number | null
  uploaded_at: string
  item_count: number
}

interface ReceiptDetail {
  id: number
  store_name: string | null
  purchase_date: string | null
  total_amount: number | null
  file_path: string | null
  uploaded_at: string
  items: {
    id: number
    raw_name: string
    quantity: number | null
    unit_price: number | null
    total_price: number | null
    product_id: number | null
    product_name: string | null
  }[]
}

interface ExtractionItem {
  raw_name: string
  quantity: number | null
  unit_price: number | null
  total_price: number | null
  matched_product_id: number | null
  matched_product_name: string | null
  matched_product_unit: string | null
  matched_category_name: string | null
  matched_category_icon: string | null
  suggested_base_name: string | null
  suggested_variant_name: string | null
  suggested_full_name: string | null
  suggested_category: string | null
  suggested_unit: string | null
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
  // Editable catalogue fields (pre-filled from AI suggestions, user can override)
  new_base_name: string
  new_variant_name: string
  new_full_name: string
  new_category_id: number | null
  new_unit: string
  // UI state
  overriding_match: boolean  // user is overriding a match to create new
}

type View = 'list' | 'uploading' | 'review' | 'detail'

const NZ_STORES = ['Woolworths', 'New World', "Pak'n'Save", 'Other']
const UNITS = ['each', 'kg', 'g', 'L', 'mL', 'dozen', 'bunch', 'bag', 'box', 'pack']

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
  const [categories, setCategories] = useState<Category[]>([])
  const [detailReceipt, setDetailReceipt] = useState<ReceiptDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.catalogue.categories().then(d => setCategories(d as Category[])).catch(() => {})
  }, [])

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
      setReviewItems(result.items.map(item => makeReviewItem(item)))
      setView('review')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setView('list')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function makeReviewItem(item: ExtractionItem): ReviewItem {
    return {
      ...item,
      product_id: item.matched_product_id,
      create_product: !item.matched_product_id,
      skip: false,
      new_base_name: item.suggested_base_name ?? item.raw_name,
      new_variant_name: item.suggested_variant_name ?? '',
      new_full_name: item.suggested_full_name ?? '',
      new_category_id: resolveCategoryId(item.suggested_category),
      new_unit: item.suggested_unit ?? 'each',
      overriding_match: false,
    }
  }

  function resolveCategoryId(suggested: string | null): number | null {
    if (!suggested) return null
    const match = categories.find(c => c.name.toLowerCase() === suggested.toLowerCase())
    return match?.id ?? null
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
          product_id: item.overriding_match ? null : item.product_id,
          create_product: item.create_product || item.overriding_match,
          skip: item.skip,
          new_base_name: item.new_base_name,
          new_variant_name: item.new_variant_name || null,
          new_full_name: item.new_full_name || null,
          new_category_id: item.new_category_id,
          new_unit: item.new_unit,
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

  async function openDetail(id: number) {
    setLoadingDetail(true)
    setView('detail')
    try {
      const data = await api.receipts.get(id) as ReceiptDetail
      setDetailReceipt(data)
    } finally {
      setLoadingDetail(false)
    }
  }

  function updateItem(idx: number, patch: Partial<ReviewItem>) {
    setReviewItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item))
  }

  function selectAll() {
    setReviewItems(prev => prev.map(item => ({ ...item, skip: false })))
  }

  function deselectAll() {
    setReviewItems(prev => prev.map(item => ({ ...item, skip: true })))
  }

  // ── List / upload view ────────────────────────────────────────────────────────
  if (view === 'list' || view === 'uploading') {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Receipts</h1>

        <label className={`card border-2 border-dashed flex flex-col items-center justify-center py-12 gap-3 text-center cursor-pointer transition-colors ${
          uploading ? 'border-brand-300 bg-brand-50' : 'border-stone-200 dark:border-stone-700 hover:border-brand-300 hover:bg-stone-50 dark:hover:bg-stone-800'
        }`}>
          {uploading ? (
            <>
              <Loader className="w-8 h-8 text-brand-400 animate-spin" />
              <p className="text-sm font-medium text-brand-600">Extracting receipt with AI…</p>
              <p className="text-xs text-stone-400">This takes a few seconds</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 bg-stone-100 dark:bg-stone-700 rounded-xl flex items-center justify-center">
                <Upload className="w-5 h-5 text-stone-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-600 dark:text-stone-400">Upload a receipt</p>
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

        {receipts.length > 0 && (
          <div>
            <h2 className="label mb-3">Receipt history</h2>
            <div className="card divide-y divide-stone-100">
              {receipts.map(r => (
                <ReceiptRow
                  key={r.id}
                  receipt={r}
                  onView={() => openDetail(r.id)}
                  onDelete={() => handleDelete(r.id)}
                />
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

  // ── Detail view ───────────────────────────────────────────────────────────────
  if (view === 'detail') {
    return (
      <div className="space-y-5 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700">
            <ChevronLeft className="w-4 h-4 text-stone-600" />
          </button>
          <h1 className="page-header flex-1">Receipt detail</h1>
        </div>

        {loadingDetail ? (
          <div className="flex justify-center py-16">
            <Loader className="w-6 h-6 text-brand-400 animate-spin" />
          </div>
        ) : detailReceipt ? (
          <>
            {/* Meta */}
            <div className="card p-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="label mb-0.5">Store</p>
                <p className="font-medium text-stone-800 dark:text-stone-100">{detailReceipt.store_name ?? '—'}</p>
              </div>
              <div>
                <p className="label mb-0.5">Date</p>
                <p className="font-medium text-stone-800 dark:text-stone-100">
                  {detailReceipt.purchase_date
                    ? new Date(detailReceipt.purchase_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="label mb-0.5">Total</p>
                <p className="font-medium text-stone-800 dark:text-stone-100">
                  {detailReceipt.total_amount ? `$${detailReceipt.total_amount.toFixed(2)}` : '—'}
                </p>
              </div>
            </div>

            {/* Image link */}
            {detailReceipt.file_path && (
              <a
                href={detailReceipt.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex items-center gap-2 text-sm"
              >
                <Eye className="w-4 h-4" /> View original receipt
              </a>
            )}

            {/* Items */}
            <div>
              <h2 className="label mb-2">Items ({detailReceipt.items.length})</h2>
              {detailReceipt.items.length === 0 ? (
                <div className="card p-6 text-center text-stone-400 text-sm">No items recorded.</div>
              ) : (
                <div className="card divide-y divide-stone-100 dark:divide-stone-800">
                  {detailReceipt.items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">
                          {item.product_name ?? item.raw_name}
                        </p>
                        {item.product_name && item.product_name !== item.raw_name && (
                          <p className="text-xs text-stone-400 truncate">{item.raw_name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs text-stone-500">
                        {item.quantity && item.quantity !== 1 && <span>×{item.quantity}</span>}
                        {item.unit_price && <span>${item.unit_price.toFixed(2)}</span>}
                        {item.total_price && item.total_price !== item.unit_price && (
                          <span className="font-medium text-stone-700 dark:text-stone-300">${item.total_price.toFixed(2)}</span>
                        )}
                        {item.product_id && (
                          <CheckCircle className="w-3.5 h-3.5 text-brand-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    )
  }

  // ── Review view ───────────────────────────────────────────────────────────────
  if (view === 'review' && extraction) {
    const included = reviewItems.filter(i => !i.skip)
    const skipped = reviewItems.filter(i => i.skip)
    const matched = included.filter(i => i.product_id && !i.overriding_match)
    const creating = included.filter(i => i.create_product || i.overriding_match)

    return (
      <div className="space-y-5 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700">
            <ChevronLeft className="w-4 h-4 text-stone-600" />
          </button>
          <div className="flex-1">
            <h1 className="page-header">Review extraction</h1>
            <p className="text-xs text-stone-400 mt-0.5">
              AI extracted {extraction.items.length} items — review and confirm.
            </p>
          </div>
          <button
            onClick={handleConfirm}
            disabled={confirming || included.length === 0}
            className="btn-primary flex items-center gap-2"
          >
            {confirming ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {confirming ? 'Saving…' : `Save ${included.length}`}
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

        {/* Summary + select controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap flex-1">
            <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-medium">
              {matched.length} matched
            </span>
            {creating.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                {creating.length} new entries
              </span>
            )}
            {skipped.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400 text-xs font-medium">
                {skipped.length} skipped
              </span>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={selectAll} className="text-xs text-brand-600 hover:underline">Select all</button>
            <span className="text-stone-300">·</span>
            <button onClick={deselectAll} className="text-xs text-stone-400 hover:underline">Deselect all</button>
          </div>
        </div>

        {/* Items */}
        {extraction.items.length === 0 ? (
          <div className="card p-6 text-center">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-stone-600 dark:text-stone-400 font-medium">No items were extracted</p>
            <p className="text-xs text-stone-400 mt-1">AI may not be configured or couldn't read the receipt. Save the metadata above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reviewItems.map((item, idx) => (
              <ReviewItemRow
                key={idx}
                item={item}
                categories={categories}
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

function ReceiptRow({
  receipt,
  onView,
  onDelete,
}: {
  receipt: ReceiptSummary
  onView: () => void
  onDelete: () => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const date = receipt.purchase_date
    ? new Date(receipt.purchase_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date(receipt.uploaded_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="flex items-center gap-3 px-4 py-3 group">
      <button
        onClick={onView}
        className="w-9 h-9 rounded-lg bg-stone-100 dark:bg-stone-700 flex items-center justify-center shrink-0 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
        title="View receipt"
      >
        <ReceiptIcon className="w-4 h-4 text-stone-500" />
      </button>
      <button onClick={onView} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">
          {receipt.store_name ?? 'Unknown store'}
        </p>
        <p className="text-xs text-stone-400">
          {date} · {receipt.item_count} item{receipt.item_count !== 1 ? 's' : ''}
        </p>
      </button>
      <div className="flex items-center gap-2 shrink-0">
        {receipt.total_amount && (
          <span className="text-sm font-medium text-stone-700 dark:text-stone-300">${receipt.total_amount.toFixed(2)}</span>
        )}
        <button
          onClick={onView}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-stone-100 dark:hover:bg-stone-700 transition-all"
          title="View"
        >
          <Eye className="w-3.5 h-3.5 text-stone-400" />
        </button>
        {confirmDel ? (
          <div className="flex items-center gap-1">
            <button onClick={onDelete} className="text-xs text-red-500 font-medium px-2 py-1 rounded hover:bg-red-50">Delete</button>
            <button onClick={() => setConfirmDel(false)} className="text-xs text-stone-400 px-2 py-1 rounded hover:bg-stone-100 dark:hover:bg-stone-700">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Review item row ───────────────────────────────────────────────────────────

function ReviewItemRow({
  item,
  categories,
  onChange,
}: {
  item: ReviewItem
  categories: Category[]
  onChange: (p: Partial<ReviewItem>) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const hasMatch = !!item.matched_product_id && !item.overriding_match
  const isCreating = item.create_product || item.overriding_match

  return (
    <div className={`card transition-opacity ${item.skip ? 'opacity-40' : ''}`}>
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Include toggle */}
        <button
          onClick={() => onChange({ skip: !item.skip })}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            item.skip ? 'bg-stone-200 dark:bg-stone-700 border-stone-300 dark:border-stone-600' : 'border-brand-400 bg-white dark:bg-stone-800 hover:bg-brand-50 dark:hover:bg-brand-900/20'
          }`}
          title={item.skip ? 'Include' : 'Skip'}
        >
          {!item.skip && <div className="w-2 h-2 rounded-full bg-brand-500" />}
          {item.skip && <X className="w-2.5 h-2.5 text-stone-400" />}
        </button>

        <div className="flex-1 min-w-0">
          {/* Raw name + price */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">{item.raw_name}</p>
            <div className="flex items-center gap-2 shrink-0 text-xs text-stone-500">
              {item.quantity && item.quantity !== 1 && <span>×{item.quantity}</span>}
              {item.unit_price && <span>${item.unit_price.toFixed(2)}</span>}
              {item.total_price && item.total_price !== item.unit_price && (
                <span className="font-medium text-stone-700 dark:text-stone-300">${item.total_price.toFixed(2)}</span>
              )}
            </div>
          </div>

          {/* Match / create badge */}
          {!item.skip && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              {hasMatch ? (
                <>
                  <div className="flex items-center gap-1.5 text-xs text-brand-700 bg-brand-50 px-2 py-1 rounded-md">
                    <CheckCircle className="w-3 h-3 shrink-0" />
                    <span className="font-medium">{item.matched_product_name}</span>
                    {item.matched_category_icon && <span>{item.matched_category_icon}</span>}
                    {item.matched_category_name && <span className="text-brand-500">{item.matched_category_name}</span>}
                    {item.matched_product_unit && <span className="text-brand-400">· {item.matched_product_unit}</span>}
                  </div>
                  <button
                    onClick={() => { onChange({ overriding_match: true, create_product: true }); setExpanded(true) }}
                    className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 underline"
                  >
                    Override
                  </button>
                </>
              ) : isCreating ? (
                <>
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
                    <Package className="w-3 h-3 shrink-0" />
                    <span>Add to catalogue as <span className="font-medium">{item.new_base_name || '…'}</span>
                      {item.new_variant_name ? ` · ${item.new_variant_name}` : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => setExpanded(v => !v)}
                    className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 flex items-center gap-0.5"
                  >
                    Edit {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {item.overriding_match && (
                    <button
                      onClick={() => onChange({ overriding_match: false, create_product: false, product_id: item.matched_product_id })}
                      className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 underline"
                    >
                      Revert to match
                    </button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-stone-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.create_product}
                      onChange={e => { onChange({ create_product: e.target.checked }); if (e.target.checked) setExpanded(true) }}
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

      {/* Expanded catalogue form */}
      {expanded && !item.skip && (
        <div className="border-t border-stone-100 dark:border-stone-800 px-4 py-3 bg-stone-50 dark:bg-stone-800 space-y-2">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-2">Catalogue entry</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-stone-400 block mb-0.5">Base name</label>
              <input
                className="input text-xs py-1.5"
                value={item.new_base_name}
                onChange={e => onChange({ new_base_name: e.target.value })}
                placeholder="e.g. Chips"
              />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-0.5">Variant</label>
              <input
                className="input text-xs py-1.5"
                value={item.new_variant_name}
                onChange={e => onChange({ new_variant_name: e.target.value })}
                placeholder="e.g. Salt & Vinegar"
              />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-0.5">Full Name</label>
              <input
                className="input text-xs py-1.5"
                value={item.new_full_name}
                onChange={e => onChange({ new_full_name: e.target.value })}
                placeholder="e.g. Bluebird S&V 150g"
              />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-0.5">Unit</label>
              <select className="input text-xs py-1.5" value={item.new_unit} onChange={e => onChange({ new_unit: e.target.value })}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-400 block mb-0.5">Category</label>
            <select
              className="input text-xs py-1.5"
              value={item.new_category_id ?? ''}
              onChange={e => onChange({ new_category_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Uncategorised</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
