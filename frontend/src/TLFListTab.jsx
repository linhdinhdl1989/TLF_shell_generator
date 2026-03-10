import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus,
  Upload,
  Sparkles,
  Check,
  CheckCheck,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronDown,
  X,
  Edit3,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTION_COLORS = {
  demographics: "bg-blue-100 text-blue-700",
  efficacy: "bg-purple-100 text-purple-700",
  safety: "bg-red-100 text-red-700",
  pharmacokinetics: "bg-yellow-100 text-yellow-700",
  other: "bg-gray-100 text-gray-600",
};

const TYPE_COLORS = {
  table: "bg-slate-100 text-slate-600",
  listing: "bg-teal-100 text-teal-700",
  figure: "bg-orange-100 text-orange-700",
};

const CONFIDENCE_STYLES = {
  high: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-red-100 text-red-700",
};

const SOURCE_LABELS = {
  explicit_sap: "SAP",
  uploaded_tlf_list: "Upload",
  parsed_from_raw_title: "Parsed",
  inferred_from_sap_context: "Inferred",
  user_edit: "User",
};

const SOURCE_COLORS = {
  explicit_sap: "bg-blue-100 text-blue-700",
  uploaded_tlf_list: "bg-teal-100 text-teal-700",
  parsed_from_raw_title: "bg-purple-100 text-purple-600",
  inferred_from_sap_context: "bg-yellow-100 text-yellow-700",
  user_edit: "bg-green-100 text-green-700",
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function Badge({ label, colorClass, title }) {
  return (
    <span
      title={title}
      className={`text-xs font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${colorClass}`}
    >
      {label}
    </span>
  );
}

function SourceBadge({ source }) {
  if (!source) return null;
  return (
    <Badge
      label={SOURCE_LABELS[source] || source}
      colorClass={SOURCE_COLORS[source] || "bg-gray-100 text-gray-600"}
      title={source}
    />
  );
}

// Inline-editable cell
function InlineEdit({ value, onSave, placeholder = "—", className = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    if (draft !== (value || "")) onSave(draft || null);
  }, [draft, value, onSave]);

  const handleKey = (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") {
      setDraft(value || "");
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`w-full border border-blue-400 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
      />
    );
  }

  return (
    <span
      className={`cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 group flex items-center gap-1 ${className}`}
      onClick={() => {
        setDraft(value || "");
        setEditing(true);
      }}
      title="Click to edit"
    >
      <span className={value ? "" : "text-gray-400 italic"}>{value || placeholder}</span>
      <Edit3 size={11} className="opacity-0 group-hover:opacity-40 flex-shrink-0" />
    </span>
  );
}

// Add Item Modal
function AddItemModal({ studyId, onClose, onAdded }) {
  const [form, setForm] = useState({
    number: "",
    title: "",
    subtitle: "",
    analysis_set: "",
    section: "other",
    output_type: "table",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/studies/${studyId}/tlf-list/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: form.number,
          title: form.title,
          subtitle: form.subtitle || null,
          analysis_set: form.analysis_set || null,
          section: form.section,
          output_type: form.output_type,
          source: "user",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const item = await res.json();
      onAdded(item);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Add TLF Entry</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Number *</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="14.1.1" value={form.number}
                onChange={e => setForm(f => ({ ...f, number: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.output_type}
                onChange={e => setForm(f => ({ ...f, output_type: e.target.value }))}>
                <option value="table">Table</option>
                <option value="listing">Listing</option>
                <option value="figure">Figure</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Core Title *</label>
            <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="Demographics Summary" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subtitle</label>
            <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="By Treatment Group" value={form.subtitle}
              onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Analysis Set</label>
            <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="Safety Population" value={form.analysis_set}
              onChange={e => setForm(f => ({ ...f, analysis_set: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.section}
              onChange={e => setForm(f => ({ ...f, section: e.target.value }))}>
              <option value="demographics">Demographics</option>
              <option value="efficacy">Efficacy</option>
              <option value="safety">Safety</option>
              <option value="pharmacokinetics">PK</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
              {saving && <Loader2 size={13} className="animate-spin" />}
              Add Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Bulk Analysis Set Modal
function BulkAnalysisSetModal({ studyId, selectedIds, onClose, onUpdated }) {
  const [analysisSet, setAnalysisSet] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/studies/${studyId}/tlf-list/bulk-update-analysis-set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_ids: selectedIds, analysis_set: analysisSet }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onUpdated(data.items);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Bulk Set Analysis Set</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4">Updating {selectedIds.length} item{selectedIds.length !== 1 ? "s" : ""}.</p>
        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full border rounded px-2 py-1.5 text-sm"
            placeholder="e.g. Safety Population"
            value={analysisSet}
            onChange={e => setAnalysisSet(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
              {saving && <Loader2 size={13} className="animate-spin" />}
              Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TLFListTab({ studyId }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState(null);

  // UI state
  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const uploadRef = useRef(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    if (!studyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/studies/${studyId}/tlf-list/items`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setApprovedCount(data.approved_count || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [studyId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── Extract ───────────────────────────────────────────────────────────────
  const handleExtract = async () => {
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/studies/${studyId}/tlf-list/extract-items`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setApprovedCount(data.approved_count || 0);
      setSelected(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setExtracting(false);
    }
  };

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/studies/${studyId}/tlf-list/upload-items`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setApprovedCount(data.approved_count || 0);
      setSelected(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  // ── Update item field ─────────────────────────────────────────────────────
  const updateItem = async (itemId, patch) => {
    try {
      const res = await fetch(`${API_BASE}/studies/${studyId}/tlf-list/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setItems(prev => prev.map(i => i.id === itemId ? updated : i));
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Approve single ────────────────────────────────────────────────────────
  const approveItem = async (itemId) => {
    try {
      const res = await fetch(`${API_BASE}/studies/${studyId}/tlf-list/items/${itemId}/approve`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setItems(prev => prev.map(i => i.id === itemId ? updated : i));
      setApprovedCount(prev => prev + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Approve all ───────────────────────────────────────────────────────────
  const approveAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/studies/${studyId}/tlf-list/approve-all-items`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setApprovedCount(data.approved_count || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteItem = async (itemId) => {
    try {
      const res = await fetch(`${API_BASE}/studies/${studyId}/tlf-list/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setItems(prev => {
        const next = prev.filter(i => i.id !== itemId);
        setTotal(next.length);
        setApprovedCount(next.filter(i => i.approved).length);
        return next;
      });
      setSelected(prev => { const s = new Set(prev); s.delete(itemId); return s; });
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Bulk update callback ──────────────────────────────────────────────────
  const handleBulkUpdated = (updatedItems) => {
    setItems(prev => {
      const map = Object.fromEntries(updatedItems.map(i => [i.id, i]));
      return prev.map(i => map[i.id] || i);
    });
    setSelected(new Set());
  };

  // ── Add item callback ─────────────────────────────────────────────────────
  const handleAdded = (item) => {
    setItems(prev => [...prev, item]);
    setTotal(prev => prev + 1);
  };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredItems = items.filter(item => {
    const searchLow = search.toLowerCase();
    if (search && !(
      item.number?.toLowerCase().includes(searchLow) ||
      item.title?.toLowerCase().includes(searchLow) ||
      item.subtitle?.toLowerCase().includes(searchLow) ||
      item.composed_title?.toLowerCase().includes(searchLow)
    )) return false;
    if (filterSection !== "all" && item.section !== filterSection) return false;
    if (filterStatus === "approved" && !item.approved) return false;
    if (filterStatus === "pending" && item.approved) return false;
    return true;
  });

  // ── Selection ─────────────────────────────────────────────────────────────
  const allSelectedOnPage = filteredItems.length > 0 && filteredItems.every(i => selected.has(i.id));
  const toggleSelectAll = () => {
    if (allSelectedOnPage) {
      setSelected(prev => { const s = new Set(prev); filteredItems.forEach(i => s.delete(i.id)); return s; });
    } else {
      setSelected(prev => { const s = new Set(prev); filteredItems.forEach(i => s.add(i.id)); return s; });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 gap-2">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Loading TLF list…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleExtract}
          disabled={extracting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {extracting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Extract from SAP
        </button>

        <button
          onClick={() => uploadRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Upload size={14} />
          Upload CSV/Excel
        </button>
        <input ref={uploadRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleUpload} />

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Plus size={14} />
          Add Manually
        </button>

        {total > 0 && (
          <button
            onClick={approveAll}
            disabled={loading || approvedCount === total}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCheck size={14} />
            Approve All
          </button>
        )}

        {selected.size > 0 && (
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600"
          >
            <Edit3 size={14} />
            Bulk Set Analysis Set ({selected.size})
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Filters */}
        <select
          className="text-sm border rounded px-2 py-1.5"
          value={filterSection}
          onChange={e => setFilterSection(e.target.value)}
        >
          <option value="all">All Sections</option>
          <option value="demographics">Demographics</option>
          <option value="efficacy">Efficacy</option>
          <option value="safety">Safety</option>
          <option value="pharmacokinetics">PK</option>
          <option value="other">Other</option>
        </select>

        <select
          className="text-sm border rounded px-2 py-1.5"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
        </select>

        <input
          type="text"
          placeholder="Search…"
          className="text-sm border rounded px-2 py-1.5 w-40"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <button onClick={fetchItems} className="p-1.5 border rounded hover:bg-gray-50" title="Refresh">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Stats strip ───────────────────────────────────────────────────── */}
      {total > 0 && (
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span><span className="font-medium text-gray-900">{total}</span> entries</span>
          <span><span className="font-medium text-green-700">{approvedCount}</span> approved</span>
          <span><span className="font-medium text-yellow-700">{total - approvedCount}</span> pending</span>
          {selected.size > 0 && <span><span className="font-medium text-blue-700">{selected.size}</span> selected</span>}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && items.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <Sparkles size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700 mb-1">No TLF list yet</p>
          <p className="text-sm text-gray-500 mb-4">
            Extract from SAP, upload a CSV/Excel file, or add entries manually.
          </p>
          <button onClick={handleExtract} disabled={extracting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {extracting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Extract from SAP
          </button>
        </div>
      )}

      {/* ── All approved state ─────────────────────────────────────────────── */}
      {items.length > 0 && approvedCount === total && total > 0 && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">
          <CheckCheck size={16} />
          All {total} entries approved — ready for shell generation.
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {filteredItems.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-2 w-8">
                  <input type="checkbox" checked={allSelectedOnPage} onChange={toggleSelectAll}
                    className="rounded" />
                </th>
                <th className="p-2 text-left font-medium text-gray-600 w-20">#</th>
                <th className="p-2 text-left font-medium text-gray-600 min-w-[160px]">Core Title</th>
                <th className="p-2 text-left font-medium text-gray-600 min-w-[120px]">Subtitle</th>
                <th className="p-2 text-left font-medium text-gray-600 min-w-[120px]">Analysis Set</th>
                <th className="p-2 text-left font-medium text-gray-600 min-w-[200px]">Composed Title</th>
                <th className="p-2 text-left font-medium text-gray-600 w-24">Section</th>
                <th className="p-2 text-left font-medium text-gray-600 w-20">Type</th>
                <th className="p-2 text-left font-medium text-gray-600 w-20">Conf.</th>
                <th className="p-2 text-left font-medium text-gray-600 w-28">Sources</th>
                <th className="p-2 text-left font-medium text-gray-600 w-20">Status</th>
                <th className="p-2 text-left font-medium text-gray-600 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <TLFListRow
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  onSelect={(id) => setSelected(prev => {
                    const s = new Set(prev);
                    s.has(id) ? s.delete(id) : s.add(id);
                    return s;
                  })}
                  onUpdate={updateItem}
                  onApprove={approveItem}
                  onDelete={deleteItem}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── No results for filter ─────────────────────────────────────────── */}
      {items.length > 0 && filteredItems.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No entries match current filters.
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <AddItemModal studyId={studyId} onClose={() => setShowAddModal(false)} onAdded={handleAdded} />
      )}
      {showBulkModal && (
        <BulkAnalysisSetModal
          studyId={studyId}
          selectedIds={Array.from(selected)}
          onClose={() => setShowBulkModal(false)}
          onUpdated={handleBulkUpdated}
        />
      )}
    </div>
  );
}

// ─── Row Component ────────────────────────────────────────────────────────────

function TLFListRow({ item, selected, onSelect, onUpdate, onApprove, onDelete }) {
  const missingAnalysisSet = !item.analysis_set;

  return (
    <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${item.approved ? "bg-green-50/40" : ""}`}>
      {/* Checkbox */}
      <td className="p-2">
        <input type="checkbox" checked={selected} onChange={() => onSelect(item.id)} className="rounded" />
      </td>

      {/* Number */}
      <td className="p-2 font-mono text-xs font-medium text-gray-700">
        <InlineEdit
          value={item.number}
          onSave={(v) => onUpdate(item.id, { number: v })}
          placeholder="14.x.x"
        />
      </td>

      {/* Core Title */}
      <td className="p-2">
        <InlineEdit
          value={item.title}
          onSave={(v) => v && onUpdate(item.id, { title: v })}
          placeholder="Title"
        />
      </td>

      {/* Subtitle */}
      <td className="p-2">
        <InlineEdit
          value={item.subtitle}
          onSave={(v) => onUpdate(item.id, { subtitle: v || null })}
          placeholder="—"
        />
      </td>

      {/* Analysis Set */}
      <td className={`p-2 ${missingAnalysisSet ? "bg-amber-50" : ""}`}>
        <InlineEdit
          value={item.analysis_set}
          onSave={(v) => onUpdate(item.id, { analysis_set: v || null })}
          placeholder={missingAnalysisSet ? "⚠ Missing" : "—"}
          className={missingAnalysisSet ? "text-amber-700" : ""}
        />
      </td>

      {/* Composed Title */}
      <td className="p-2 text-xs text-gray-600 max-w-xs">
        <span className="line-clamp-2" title={item.composed_title}>{item.composed_title}</span>
      </td>

      {/* Section */}
      <td className="p-2">
        <Badge
          label={item.section || "other"}
          colorClass={SECTION_COLORS[item.section] || SECTION_COLORS.other}
        />
      </td>

      {/* Type */}
      <td className="p-2">
        <Badge
          label={item.output_type || "table"}
          colorClass={TYPE_COLORS[item.output_type] || TYPE_COLORS.table}
        />
      </td>

      {/* Confidence */}
      <td className="p-2">
        <Badge
          label={item.parsing_confidence || "medium"}
          colorClass={CONFIDENCE_STYLES[item.parsing_confidence] || CONFIDENCE_STYLES.medium}
        />
      </td>

      {/* Sources */}
      <td className="p-2">
        <div className="flex flex-col gap-1">
          {item.title_source && <SourceBadge source={item.title_source} />}
          {item.subtitle_source && item.subtitle_source !== item.title_source && (
            <SourceBadge source={item.subtitle_source} />
          )}
          {item.analysis_set_source && item.analysis_set_source !== item.title_source && (
            <SourceBadge source={item.analysis_set_source} />
          )}
        </div>
      </td>

      {/* Status */}
      <td className="p-2">
        {item.approved ? (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700">
            <Check size={12} /> Approved
          </span>
        ) : (
          <span className="text-xs text-gray-500">Pending</span>
        )}
      </td>

      {/* Actions */}
      <td className="p-2">
        <div className="flex items-center gap-1">
          {!item.approved && (
            <button
              onClick={() => onApprove(item.id)}
              title="Approve"
              className="p-1 rounded hover:bg-green-100 text-green-600"
            >
              <Check size={14} />
            </button>
          )}
          <button
            onClick={() => { if (window.confirm("Delete this TLF entry?")) onDelete(item.id); }}
            title="Delete"
            className="p-1 rounded hover:bg-red-100 text-red-500"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
