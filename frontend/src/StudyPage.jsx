import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  FileText,
  List,
  Settings,
  Layers,
  Upload,
  Download,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  MessageSquare,
  Send,
  Eye,
  X,
  AlertCircle,
  Loader2,
  Table,
  Bot,
  GripVertical,
  Save,
  Sparkles,
} from "lucide-react";

// ─── API base ─────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// ─── Mock Data (Tabs 1-3) ─────────────────────────────────────────────────────

const INITIAL_DOCS = [
  { id: 1, name: "SAP_XYZ101_v2.pdf", type: "sap", status: "ready", size: "2.4 MB" },
  { id: 2, name: "Protocol_XYZ101.pdf", type: "protocol", status: "processing", size: "1.1 MB" },
  { id: 3, name: "TLF_Library_Standard.xlsx", type: "tlf_library", status: "ready", size: "540 KB" },
];

const INITIAL_TLFS = [
  { id: 1, number: "14.1.1", title: "Demographics and Baseline Characteristics", section: "demographics", status: "approved" },
  { id: 2, number: "14.1.2", title: "Medical History Summary", section: "demographics", status: "approved" },
  { id: 3, number: "14.3.1.1", title: "Adverse Events – Overview", section: "safety", status: "proposed" },
  { id: 4, number: "14.3.1.2", title: "Treatment-Emergent Adverse Events by SOC and PT", section: "safety", status: "proposed" },
  { id: 5, number: "14.3.2.1", title: "Serious Adverse Events", section: "safety", status: "proposed" },
  { id: 6, number: "14.2.1", title: "Primary Efficacy Endpoint – Change from Baseline", section: "efficacy", status: "proposed" },
];

const INITIAL_GLOBAL_REQS = [
  {
    id: 1,
    name: "Demographics",
    numberPattern: "14.1.x",
    titleTemplate: "Table {number}: {title} – {population}",
    columns: ["Characteristic", "Placebo (N=xx)", "Treatment (N=xx)", "Total (N=xx)"],
  },
  {
    id: 2,
    name: "Safety",
    numberPattern: "14.3.x.x",
    titleTemplate: "Table {number}: {title} – Safety Analysis Set",
    columns: ["Parameter", "Placebo (N=xx)", "Treatment (N=xx)"],
  },
  {
    id: 3,
    name: "Efficacy",
    numberPattern: "14.2.x",
    titleTemplate: "Table {number}: {title} – Full Analysis Set",
    columns: ["Visit", "Placebo (N=xx)", "Treatment (N=xx)", "Difference (95% CI)"],
  },
];

// ─── Helpers / constants ──────────────────────────────────────────────────────

const STATUS_COLORS = {
  uploading: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  ready: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

const TLF_STATUS_COLORS = {
  proposed: "bg-gray-100 text-gray-600",
  approved: "bg-green-100 text-green-700",
};

const SHELL_STATUS_COLORS = {
  draft: "bg-indigo-100 text-indigo-700",
  in_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
};

const DOC_TYPES = ["sap", "protocol", "tlf_library", "study_tlf_list", "other"];

function Badge({ label, colorClass }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
      {label}
    </span>
  );
}

function StatusIcon({ status }) {
  if (status === "processing" || status === "uploading")
    return <Loader2 size={14} className="animate-spin text-blue-500" />;
  if (status === "ready") return <Check size={14} className="text-green-500" />;
  if (status === "error") return <AlertCircle size={14} className="text-red-500" />;
  return null;
}

// ─── Tab 1: Documents ─────────────────────────────────────────────────────────

function DocumentsTab() {
  const [docs, setDocs] = useState(INITIAL_DOCS);
  const [dragOver, setDragOver] = useState(false);
  const [uploadType, setUploadType] = useState("sap");
  const fileInputRef = useRef(null);

  const handleFiles = (files) => {
    Array.from(files).forEach((file) => {
      const newDoc = {
        id: Date.now() + Math.random(),
        name: file.name,
        type: uploadType,
        status: "uploading",
        size: `${(file.size / 1024).toFixed(0)} KB`,
      };
      setDocs((prev) => [...prev, newDoc]);
      setTimeout(
        () => setDocs((prev) => prev.map((d) => (d.id === newDoc.id ? { ...d, status: "processing" } : d))),
        800
      );
      setTimeout(
        () => setDocs((prev) => prev.map((d) => (d.id === newDoc.id ? { ...d, status: "ready" } : d))),
        2500
      );
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeDoc = (id) => setDocs((prev) => prev.filter((d) => d.id !== id));

  const reParse = (id) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, status: "processing" } : d)));
    setTimeout(
      () => setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, status: "ready" } : d))),
      1500
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Upload size={18} className="text-indigo-500" />
          Upload Document
        </h3>
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Document type:</label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ").toUpperCase()}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition"
          >
            <Upload size={14} /> Choose File
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer ${
            dragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={32} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500 text-sm">
            Drag & drop files here, or <span className="text-indigo-600 font-medium">browse</span>
          </p>
          <p className="text-gray-400 text-xs mt-1">PDF, Word, Excel supported</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Uploaded Documents ({docs.length})</h3>
        </div>
        {docs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No documents uploaded yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {docs.map((doc) => (
              <div key={doc.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50">
                <FileText size={18} className="text-indigo-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                  <p className="text-xs text-gray-400">{doc.size}</p>
                </div>
                <select
                  value={doc.type}
                  onChange={(e) => setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, type: e.target.value } : d)))}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5">
                  <StatusIcon status={doc.status} />
                  <Badge label={doc.status} colorClass={STATUS_COLORS[doc.status] || "bg-gray-100 text-gray-600"} />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => reParse(doc.id)}
                    disabled={doc.status === "processing" || doc.status === "uploading"}
                    title="Re-parse"
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 disabled:opacity-40 transition"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    disabled={doc.status !== "ready"}
                    title="Download parsed"
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 disabled:opacity-40 transition"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => removeDoc(doc.id)}
                    title="Remove"
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 2: TLF List ──────────────────────────────────────────────────────────

function TLFTab({ studyId }) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [tlfs, setTlfs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [isExtracting, setIsExtracting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", text: "I can help refine the TLF list. Try: 'Add AE by SOC table', 'split efficacy section', or describe what you need." },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);

  const chatEndRef = useRef(null);
  const saveTimerRef = useRef(null);
  const tlfsRef = useRef(tlfs);

  // Keep ref current for the debounced save closure
  useEffect(() => { tlfsRef.current = tlfs; }, [tlfs]);

  // ── Adapters ───────────────────────────────────────────────────────────────

  // Backend TLF row → frontend display object
  const fromBackend = (tlf) => ({
    id: tlf.id,
    number: tlf.number || "",
    title: tlf.title || "",
    // section_ref stores the section category ("demographics", "safety", etc.)
    section: tlf.section_ref || "other",
    status: tlf.status || "proposed",
  });

  // Frontend TLF list → backend bulk-replace payload
  const toBackendBulk = (list) => ({
    tlfs: list.map((t, i) => ({
      number: t.number || "",
      title: t.title || "",
      type: "table",
      section_ref: t.section || "other",
      status: t.status || "proposed",
      order_index: i,
    })),
  });

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadTlfs = useCallback(async () => {
    if (!studyId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch(`${API_BASE}/studies/${studyId}/tlf-list`);
      if (!r.ok) throw new Error(`Load failed (${r.status})`);
      const data = await r.json();
      setTlfs((data.tlfs || []).map(fromBackend));
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [studyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (studyId) loadTlfs();
  }, [studyId, loadTlfs]);

  // ── Debounced save (bulk replace) ─────────────────────────────────────────

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    saveTimerRef.current = setTimeout(async () => {
      if (!studyId) return;
      try {
        const r = await fetch(`${API_BASE}/studies/${studyId}/tlf-list`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toBackendBulk(tlfsRef.current)),
        });
        if (!r.ok) throw new Error(`Save failed (${r.status})`);
        const data = await r.json();
        // Update IDs from backend (temp IDs → real UUIDs)
        setTlfs((data.tlfs || []).map(fromBackend));
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      } catch (err) {
        console.error("TLF save error:", err);
        setSaveState("error");
      }
    }, 800);
  }, [studyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Row operations ─────────────────────────────────────────────────────────

  const addRow = () => {
    setTlfs((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, number: "", title: "", section: "demographics", status: "proposed" },
    ]);
    scheduleSave();
  };

  const updateTlf = (id, field, value) => {
    setTlfs((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
    scheduleSave();
  };

  const removeRow = (id) => {
    setTlfs((prev) => prev.filter((t) => t.id !== id));
    scheduleSave();
  };

  // ── AI Extract from SAP ────────────────────────────────────────────────────

  const extractFromSAP = async () => {
    if (!studyId) return;
    setIsExtracting(true);
    setActionError(null);
    try {
      const r = await fetch(`${API_BASE}/studies/${studyId}/tlf-list/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error(`Extraction failed (${r.status})`);
      const data = await r.json();
      setTlfs((data.tlfs || []).map(fromBackend));
      setSaveState("idle"); // backend already persisted; no local save needed
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsExtracting(false);
    }
  };

  // ── Approve List ───────────────────────────────────────────────────────────

  const approveAll = async () => {
    if (!studyId) return;
    setIsApproving(true);
    setActionError(null);
    try {
      const r = await fetch(`${API_BASE}/studies/${studyId}/tlf-list/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error(`Approval failed (${r.status})`);
      const data = await r.json();
      setTlfs((data.tlfs || []).map(fromBackend));
      setSaveState("idle");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsApproving(false);
    }
  };

  // ── Chat ───────────────────────────────────────────────────────────────────

  const sendChat = async () => {
    const prompt = chatInput.trim();
    if (!prompt || isChatLoading || !studyId) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: prompt }]);
    setIsChatLoading(true);
    setChatError(null);
    try {
      const r = await fetch(`${API_BASE}/studies/${studyId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "tlf_list", prompt }),
      });
      if (!r.ok) throw new Error(`Chat failed (${r.status})`);
      const data = await r.json();
      const aiText = data.ai_message?.text || "No response.";
      setChatMessages((prev) => [...prev, { role: "assistant", text: aiText }]);
    } catch (err) {
      setChatError("Could not reach the AI assistant.");
    } finally {
      setIsChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const busy = isExtracting || isApproving;
  const allApproved = tlfs.length > 0 && tlfs.every((t) => t.status === "approved");

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 gap-2">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Loading TLF list…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle size={24} className="text-red-400" />
        <p className="text-sm font-medium text-red-600">Failed to load TLF list</p>
        <p className="text-xs text-red-400">{loadError}</p>
        <button onClick={loadTlfs} className="text-sm text-indigo-600 underline hover:text-indigo-800">
          Retry
        </button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={extractFromSAP}
          disabled={busy}
          className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-60"
        >
          {isExtracting ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
          AI Extract from SAP
        </button>
        <button
          onClick={addRow}
          disabled={busy}
          className="flex items-center gap-2 border border-gray-300 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition disabled:opacity-60"
        >
          <Plus size={14} /> Add Row
        </button>
        <button
          onClick={approveAll}
          disabled={busy || tlfs.length === 0}
          className="flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-60 ml-auto"
        >
          {isApproving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Approve List
        </button>

        {/* Save state indicator */}
        {saveState === "saving" && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Loader2 size={11} className="animate-spin" /> Saving…
          </span>
        )}
        {saveState === "saved" && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <Check size={11} /> Saved
          </span>
        )}
        {saveState === "error" && (
          <span className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle size={11} /> Save failed
          </span>
        )}

        {/* Approved badge */}
        {allApproved && (
          <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check size={10} /> List Approved
          </span>
        )}
      </div>

      {/* Inline error banner */}
      {actionError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Empty state */}
      {tlfs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <List size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium mb-1">No TLF list yet</p>
          <p className="text-gray-400 text-sm mb-4">
            Run AI extraction from the SAP document, or add rows manually.
          </p>
          <button
            onClick={extractFromSAP}
            disabled={isExtracting}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-60"
          >
            {isExtracting ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
            AI Extract from SAP
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-32">Number</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-36">Section</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">Status</th>
                <th className="w-12 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tlfs.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 group">
                  <td className="px-4 py-2">
                    <input
                      value={row.number}
                      onChange={(e) => updateTlf(row.id, "number", e.target.value)}
                      className="w-full text-sm border border-transparent hover:border-gray-300 focus:border-indigo-400 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
                      placeholder="14.x.x"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={row.title}
                      onChange={(e) => updateTlf(row.id, "title", e.target.value)}
                      className="w-full text-sm border border-transparent hover:border-gray-300 focus:border-indigo-400 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={row.section}
                      onChange={(e) => updateTlf(row.id, "section", e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    >
                      <option value="demographics">Demographics</option>
                      <option value="safety">Safety</option>
                      <option value="efficacy">Efficacy</option>
                      <option value="other">Other</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        TLF_STATUS_COLORS[row.status] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => removeRow(row.id)}
                      disabled={busy}
                      className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AI TLF Assistant chat */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <MessageSquare size={16} className="text-indigo-500" />
          <span className="font-semibold text-gray-700 text-sm">AI TLF Assistant</span>
        </div>
        <div className="h-40 overflow-y-auto px-4 py-3 space-y-2">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs text-sm px-3 py-2 rounded-xl ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-none"
                    : "bg-gray-100 text-gray-700 rounded-bl-none"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-400 text-sm px-3 py-2 rounded-xl rounded-bl-none flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Thinking…
              </div>
            </div>
          )}
          {chatError && (
            <div className="flex items-center gap-1.5 text-xs text-red-500 px-1">
              <AlertCircle size={11} /> {chatError}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
            placeholder="e.g. Add AE by SOC table, split efficacy section…"
            disabled={isChatLoading || !studyId}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50"
          />
          <button
            onClick={sendChat}
            disabled={!chatInput.trim() || isChatLoading || !studyId}
            className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Global Requirements ───────────────────────────────────────────────

// Adapters: backend ↔ frontend

function _sectionTypeToName(sectionType) {
  return sectionType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function _nameToSectionType(name) {
  return name.toLowerCase().replace(/\s+/g, "_");
}

function _backendColumnsToStrings(columns) {
  if (!Array.isArray(columns)) return [];
  return columns.map((c) => (typeof c === "string" ? c : c.label || c.key || ""));
}

function _stringsToBackendColumns(strings) {
  return strings.map((label, i) => ({
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `col_${i}`,
    label,
  }));
}

function _fromBackendReq(req) {
  return {
    id: req.id,
    name: _sectionTypeToName(req.section_type),
    numberPattern: req.number_pattern || "",
    titleTemplate: req.title_template || "",
    subtitleTemplate: req.subtitle_template || "",
    columns: _backendColumnsToStrings(req.columns),
  };
}

function _toBackendReq(section) {
  return {
    section_type: _nameToSectionType(section.name),
    number_pattern: section.numberPattern || null,
    title_template: section.titleTemplate || null,
    subtitle_template: section.subtitleTemplate || null,
    columns: _stringsToBackendColumns(section.columns),
  };
}

function GlobalRequirementsTab({ studyId }) {
  const [sections, setSections] = useState([]);
  const [newSectionName, setNewSectionName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [saveError, setSaveError] = useState(null);

  // ── Load from backend ──────────────────────────────────────────────────────

  const loadRequirements = useCallback(async () => {
    if (!studyId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch(`${API_BASE}/studies/${studyId}/global-requirements`);
      if (!r.ok) throw new Error(`Load failed (${r.status})`);
      const data = await r.json();
      setSections((data.requirements || []).map(_fromBackendReq));
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [studyId]);

  useEffect(() => {
    if (studyId) loadRequirements();
  }, [studyId, loadRequirements]);

  // ── Local edit helpers ────────────────────────────────────────────────────

  const updateSection = (id, field, value) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const addColumn = (id) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, columns: [...s.columns, "New Column"] } : s))
    );
  };

  const updateColumn = (sectionId, colIdx, value) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, columns: s.columns.map((c, i) => (i === colIdx ? value : c)) }
          : s
      )
    );
  };

  const removeColumn = (sectionId, colIdx) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, columns: s.columns.filter((_, i) => i !== colIdx) }
          : s
      )
    );
  };

  const removeSection = (id) => setSections((prev) => prev.filter((s) => s.id !== id));

  const addSection = () => {
    if (!newSectionName.trim()) return;
    setSections((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        name: newSectionName.trim(),
        numberPattern: "14.x",
        titleTemplate: "Table {number}: {title}",
        subtitleTemplate: "",
        columns: ["Parameter", "Value"],
      },
    ]);
    setNewSectionName("");
  };

  // ── Save to backend (bulk replace) ────────────────────────────────────────

  const saveAll = async () => {
    if (!studyId) return;
    setSaveState("saving");
    setSaveError(null);
    try {
      const r = await fetch(`${API_BASE}/studies/${studyId}/global-requirements`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirements: sections.map(_toBackendReq) }),
      });
      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        throw new Error(`Save failed (${r.status})${errText ? ": " + errText : ""}`);
      }
      const data = await r.json();
      // Update with real backend IDs
      setSections((data.requirements || []).map(_fromBackendReq));
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      console.error("Global requirements save error:", err);
      setSaveError(err.message);
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 4000);
    }
  };

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 gap-2">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Loading global requirements…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle size={24} className="text-red-400" />
        <p className="text-sm font-medium text-red-600">Failed to load requirements</p>
        <p className="text-xs text-red-400">{loadError}</p>
        <button onClick={loadRequirements} className="text-sm text-indigo-600 underline hover:text-indigo-800">
          Retry
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          Define shell structure templates per section. These apply to all shells in that section.
        </p>
        <div className="flex items-center gap-3">
          {saveState === "saving" && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Loader2 size={11} className="animate-spin" /> Saving…
            </span>
          )}
          {saveState === "saved" && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check size={11} /> Saved
            </span>
          )}
          {saveState === "error" && (
            <span className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={11} /> Save failed
            </span>
          )}
          <button
            onClick={saveAll}
            disabled={saveState === "saving" || !studyId}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-60"
          >
            <Save size={14} /> Save Requirements
          </button>
        </div>
      </div>

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Empty state */}
      {sections.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <Settings size={28} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium mb-1">No section requirements yet</p>
          <p className="text-gray-400 text-sm">Add a section below to define shell structure defaults.</p>
        </div>
      )}

      {/* Section cards */}
      {sections.map((section) => (
        <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-indigo-500" />
              <input
                value={section.name}
                onChange={(e) => updateSection(section.id, "name", e.target.value)}
                className="font-semibold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-400 outline-none px-0.5 py-0.5 text-sm"
                placeholder="Section name"
              />
            </div>
            <button
              onClick={() => removeSection(section.id)}
              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
            >
              <X size={14} />
            </button>
          </div>
          <div className="px-6 py-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Number Pattern</label>
                <input
                  value={section.numberPattern}
                  onChange={(e) => updateSection(section.id, "numberPattern", e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                  placeholder="14.x.x"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title Template</label>
                <input
                  value={section.titleTemplate}
                  onChange={(e) => updateSection(section.id, "titleTemplate", e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Table {number}: {title}"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Column Headers</label>
              <div className="flex flex-wrap gap-2">
                {section.columns.map((col, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                    <input
                      value={col}
                      onChange={(e) => updateColumn(section.id, idx, e.target.value)}
                      className="text-xs bg-transparent border-none outline-none w-28 text-gray-700"
                    />
                    {section.columns.length > 1 && (
                      <button
                        onClick={() => removeColumn(section.id, idx)}
                        className="text-gray-400 hover:text-red-500 transition"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => addColumn(section.id)}
                  className="flex items-center gap-1 border border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 text-xs px-2 py-1 rounded-lg transition"
                >
                  <Plus size={10} /> Add Column
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                <Eye size={12} /> Preview
              </label>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      {section.columns.map((col, i) => (
                        <th
                          key={i}
                          className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {["Sample Row 1", "Sample Row 2", "Sample Row 3"].map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="px-3 py-1.5 text-gray-600 italic">{row}</td>
                        {section.columns.slice(1).map((_, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-gray-400 text-center">
                            —
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-1 italic">
                Title preview:{" "}
                {(section.titleTemplate || "")
                  .replace("{number}", section.numberPattern || "x")
                  .replace("{title}", `[${section.name} Table Title]`)
                  .replace("{population}", "Safety Analysis Set")}
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* Add section */}
      <div className="bg-white rounded-xl border border-dashed border-gray-300 px-6 py-4">
        <div className="flex gap-3 items-center">
          <input
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSection()}
            placeholder="New section name (e.g. Pharmacokinetics)"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={addSection}
            disabled={!newSectionName.trim()}
            className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            <Plus size={14} /> Add Section
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: AI Shells (backend-wired) ────────────────────────────────────────

function AIShellsTab({ studyId, studyName }) {
  // ── State ──
  const [shells, setShells] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loadingShells, setLoadingShells] = useState(true);
  const [shellsError, setShellsError] = useState(null);

  // save-state: "idle" | "saving" | "saved" | "error"
  const [saveState, setSaveState] = useState("idle");

  // per-shell chat history: { [shellId]: [{role, text}] }
  const [chatByShellId, setChatByShellId] = useState({});
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  // null = not yet fetched for this shell, [] = fetched but empty, [...] = loaded
  const [isChatHistoryLoading, setIsChatHistoryLoading] = useState(false);
  const [chatHistoryError, setChatHistoryError] = useState(null);

  const chatEndRef = useRef(null);
  const saveTimerRef = useRef(null);

  // ── Derived ──
  const activeShell = useMemo(() => shells.find((s) => s.id === selectedId) || null, [shells, selectedId]);
  // null means not yet loaded from backend for this shell
  const chatMessages = selectedId != null ? (chatByShellId[selectedId] ?? null) : null;

  // ── Load shells on mount ──
  useEffect(() => {
    let cancelled = false;
    setLoadingShells(true);
    setShellsError(null);

    fetch(`${API_BASE}/studies/${studyId}/shells`)
      .then((r) => {
        if (r.status === 404)
          throw new Error(`Study not found in backend (id: ${studyId}). Check the studyId prop mapping.`);
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        // Backend returns ShellList: {shells: [...], total: N}
        const list = data.shells ? data.shells : Array.isArray(data) ? data : [];
        setShells(list);
        if (list.length > 0) setSelectedId(list[0].id);
        setLoadingShells(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setShellsError(err.message || "Failed to load shells");
        setLoadingShells(false);
      });

    return () => { cancelled = true; };
  }, [studyId]);

  // ── Fetch chat history when selected shell changes ──
  useEffect(() => {
    if (!selectedId) return;
    // Skip fetch if we already have history for this shell in memory
    if (chatByShellId[selectedId] !== undefined) return;

    let cancelled = false;
    setIsChatHistoryLoading(true);
    setChatHistoryError(null);

    fetch(`${API_BASE}/studies/${studyId}/shells/${selectedId}/messages`)
      .then((r) => {
        if (!r.ok) throw new Error(`Messages error ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        // Backend returns MessageList: {messages: [...], total: N}
        const msgs = data.messages ? data.messages : Array.isArray(data) ? data : [];
        setChatByShellId((prev) => ({ ...prev, [selectedId]: msgs }));
        setIsChatHistoryLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setChatHistoryError(err.message || "Failed to load messages");
        // Seed with empty so we still allow the user to chat
        setChatByShellId((prev) => ({ ...prev, [selectedId]: [] }));
        setIsChatHistoryLoading(false);
      });

    return () => { cancelled = true; };
  }, [studyId, selectedId]); // chatByShellId intentionally omitted — skip-if-loaded guard is non-reactive

  // ── Scroll chat to bottom on new messages ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatByShellId, selectedId, isChatLoading]);

  // ── Cleanup debounce timer on unmount ──
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  // ── Persist shell to backend (debounced 600 ms) ──
  const persistShell = useCallback(
    (updatedShell) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveState("saving");
      saveTimerRef.current = setTimeout(() => {
        fetch(`${API_BASE}/studies/${studyId}/shells/${updatedShell.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedShell),
        })
          .then((r) => {
            if (!r.ok) throw new Error(`Save failed (${r.status})`);
            setSaveState("saved");
            setTimeout(() => setSaveState("idle"), 2000);
          })
          .catch(() => {
            setSaveState("error");
            setTimeout(() => setSaveState("idle"), 3000);
          });
      }, 600);
    },
    [studyId]
  );

  // ── Update active shell field(s), optimistic + debounced save ──
  const updateActiveShell = useCallback(
    (patch) => {
      setShells((prev) =>
        prev.map((s) => {
          if (s.id !== selectedId) return s;
          const updated = { ...s, ...patch };
          persistShell(updated);
          return updated;
        })
      );
    },
    [selectedId, persistShell]
  );

  // ── Row helpers ──
  const addRow = () => {
    if (!activeShell) return;
    const newRow = { id: Date.now(), label: "New Row", indent: 0, isHeader: false };
    updateActiveShell({ rows: [...activeShell.rows, newRow] });
  };

  const deleteRow = (rowId) => {
    if (!activeShell) return;
    updateActiveShell({ rows: activeShell.rows.filter((r) => r.id !== rowId) });
  };

  const updateRow = (rowId, patch) => {
    if (!activeShell) return;
    updateActiveShell({ rows: activeShell.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) });
  };

  // ── Column helpers ──
  const addColumn = () => {
    if (!activeShell) return;
    const newCol = { id: Date.now(), label: "New Column", width: 120 };
    updateActiveShell({ columns: [...activeShell.columns, newCol] });
  };

  const deleteColumn = (colId) => {
    if (!activeShell) return;
    updateActiveShell({ columns: activeShell.columns.filter((c) => c.id !== colId) });
  };

  const updateColumn = (colId, patch) => {
    if (!activeShell) return;
    updateActiveShell({ columns: activeShell.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)) });
  };

  // ── Add new shell via POST ──
  const addShell = async () => {
    const payload = {
      type: "table",
      title: "New Shell",
      population: "Analysis Set",
      columns: [
        { id: 1, label: "Parameter", width: 200 },
        { id: 2, label: "Value", width: 140 },
      ],
      rows: [{ id: 1, label: "Row 1", indent: 0, isHeader: false }],
      footnotes: [],
    };
    try {
      const r = await fetch(`${API_BASE}/studies/${studyId}/shells`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`Create failed (${r.status})`);
      const created = await r.json();
      setShells((prev) => [...prev, created]);
      setSelectedId(created.id);
    } catch (err) {
      setShellsError(err.message || "Failed to create shell");
      setTimeout(() => setShellsError(null), 4000);
    }
  };

  // ── Refresh chat history from backend (canonical source of truth) ──
  const refreshChatHistory = useCallback(
    async (shellId) => {
      try {
        const r = await fetch(`${API_BASE}/studies/${studyId}/shells/${shellId}/messages`);
        if (!r.ok) throw new Error(`Messages error ${r.status}`);
        const data = await r.json();
        // Backend returns MessageList: {messages: [...], total: N}
        const msgs = data.messages ? data.messages : Array.isArray(data) ? data : [];
        setChatByShellId((prev) => ({ ...prev, [shellId]: msgs }));
      } catch {
        // Silently keep whatever is already in local state on refresh failure
      }
    },
    [studyId]
  );

  // ── AI actions via backend chat ──
  const handleAiAction = useCallback(
    async (actionType, customPrompt) => {
      if (!activeShell || isChatLoading) return;

      let prompt = customPrompt || "";
      if (actionType === "refine_title") {
        prompt = `Refine this clinical TLF shell title to be concise and regulatory-ready: "${activeShell.title}". Return only the improved title text.`;
      } else if (actionType === "suggest_rows") {
        prompt = `Suggest appropriate row stubs for a clinical ${activeShell.type || "table"} shell titled "${activeShell.title}" with population "${activeShell.population}". Return a numbered list of row labels.`;
      }

      if (!prompt.trim()) return;

      // Optimistic: append user message immediately for responsiveness
      const userText =
        actionType === "refine_title" ? "Refine title"
        : actionType === "suggest_rows" ? "Suggest rows"
        : prompt;
      const userMsg = { role: "user", text: userText };
      setChatByShellId((prev) => ({
        ...prev,
        [selectedId]: [...(prev[selectedId] || []), userMsg],
      }));
      setChatInput("");
      setChatError(null);
      setIsChatLoading(true);

      try {
        const r = await fetch(`${API_BASE}/studies/${studyId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: "shell", target_id: String(activeShell.id), prompt }),
        });
        if (!r.ok) throw new Error(`Chat error (${r.status})`);
        const data = await r.json();

        // If action type was refine_title and response looks like a title, apply it
        const aiText = data.ai_message?.text || data.text || "";
        if (actionType === "refine_title" && aiText && aiText.length < 200) {
          updateActiveShell({ title: aiText.replace(/^["']|["']$/g, "").trim() });
        }

        // Refresh from backend — backend is the source of truth for chat history
        await refreshChatHistory(selectedId);
      } catch (err) {
        setChatError(err.message || "Chat request failed");
        // Append a local error reply so the user sees feedback even without a backend refresh
        setChatByShellId((prev) => ({
          ...prev,
          [selectedId]: [
            ...(prev[selectedId] || []),
            { role: "assistant", text: "Sorry, I couldn't reach the AI assistant. Please try again." },
          ],
        }));
      } finally {
        setIsChatLoading(false);
      }
    },
    [activeShell, isChatLoading, selectedId, studyId, updateActiveShell, refreshChatHistory]
  );

  const sendChat = () => {
    if (!chatInput.trim() || isChatLoading) return;
    handleAiAction("generic", chatInput);
  };

  // ── Export JSON ──
  const exportMock = () => {
    const json = JSON.stringify(shells, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shells_study_${studyName || studyId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Save-state badge ──
  const SaveBadge = () => {
    if (saveState === "saving")
      return (
        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
          <Loader2 size={11} className="animate-spin" /> Saving…
        </span>
      );
    if (saveState === "saved")
      return (
        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
          <Check size={11} /> Saved
        </span>
      );
    if (saveState === "error")
      return (
        <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
          <AlertCircle size={11} /> Save failed
        </span>
      );
    return null;
  };

  // ── Loading / error states ──
  if (loadingShells) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 gap-2">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Loading shells…</span>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="flex gap-0 xl:gap-5 flex-col xl:flex-row min-h-[680px]">
      {/* ── Left sidebar: shell list ── */}
      <div className="xl:w-60 flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col mb-4 xl:mb-0">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-700 text-sm">Shells{shells.length > 0 ? ` (${shells.length})` : ""}</span>
          <div className="flex gap-1">
            <button
              onClick={exportMock}
              title="Export shells as JSON"
              disabled={shells.length === 0}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 disabled:opacity-40 transition"
            >
              <Download size={14} />
            </button>
            <button
              onClick={addShell}
              title="Add shell"
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {shellsError && (
          <div className="mx-3 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-600">{shellsError}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {shells.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-xs">
              No shells yet.
              <button onClick={addShell} className="block mt-2 mx-auto text-indigo-600 hover:underline text-xs font-medium">
                + Add first shell
              </button>
            </div>
          ) : (
            shells.map((shell) => (
              <button
                key={shell.id}
                onClick={() => setSelectedId(shell.id)}
                className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition ${
                  shell.id === selectedId ? "bg-indigo-50 border-l-[3px] border-indigo-500" : "border-l-[3px] border-transparent"
                }`}
              >
                <p className="text-xs font-mono font-semibold text-indigo-600 truncate">{shell.tlf_id || shell.id}</p>
                <p className="text-xs text-gray-700 mt-0.5 line-clamp-2 leading-snug">{shell.title}</p>
                <div className="mt-1.5">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${SHELL_STATUS_COLORS[shell.status] || "bg-gray-100 text-gray-500"}`}>
                    {shell.status === "approved" ? "✓ APPROVED" : (shell.status || "draft").replace("_", " ").toUpperCase()}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Center + Right ── */}
      {activeShell ? (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-w-0">
          {/* ── Center: editor ── */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Top bar */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-mono font-bold text-white bg-indigo-600 px-2 py-0.5 rounded">
                {activeShell.tlf_id || activeShell.id}
              </span>
              <input
                value={activeShell.title}
                onChange={(e) => updateActiveShell({ title: e.target.value })}
                className="flex-1 min-w-0 font-semibold text-gray-800 text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-400 outline-none py-0.5"
                placeholder="Shell title"
              />
              <SaveBadge />
              <button
                onClick={() => updateActiveShell({ status: "approved" })}
                className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-700 transition"
              >
                <Check size={12} /> Approve
              </button>
            </div>

            {/* Header Information */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Header Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Population</label>
                  <input
                    value={activeShell.population || ""}
                    onChange={(e) => updateActiveShell({ population: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="e.g. Safety Analysis Set"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Shell Type</label>
                  <select
                    value={activeShell.type || "table"}
                    onChange={(e) => updateActiveShell({ type: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="table">Table</option>
                    <option value="listing">Listing</option>
                    <option value="figure">Figure</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Column Definition */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Column Definition</h4>
                <button
                  onClick={addColumn}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition"
                >
                  <Plus size={12} /> Add Column
                </button>
              </div>
              <div className="space-y-2">
                {activeShell.columns.map((col, idx) => (
                  <div key={col.id} className="flex items-center gap-3 group">
                    <span className="text-xs text-gray-400 w-4 flex-shrink-0">{idx + 1}</span>
                    <input
                      value={col.label}
                      onChange={(e) => updateColumn(col.id, { label: e.target.value })}
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="Column label"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">w:</span>
                      <input
                        type="number"
                        value={col.width}
                        onChange={(e) => updateColumn(col.id, { width: Number(e.target.value) })}
                        className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        min={60}
                        max={400}
                      />
                    </div>
                    {activeShell.columns.length > 1 && (
                      <button
                        onClick={() => deleteColumn(col.id)}
                        className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Content Rows */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Content Rows</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAiAction("suggest_rows")}
                    disabled={isChatLoading || isChatHistoryLoading}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-2.5 py-1 rounded-lg hover:bg-indigo-50 transition disabled:opacity-50"
                  >
                    <Sparkles size={11} /> AI Suggestions
                  </button>
                  <button
                    onClick={addRow}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition"
                  >
                    <Plus size={12} /> Add Row
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {activeShell.rows.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No rows yet. Add one or ask AI for suggestions.</p>
                ) : (
                  activeShell.rows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-2 group"
                      style={{ paddingLeft: `${row.indent * 20}px` }}
                    >
                      <GripVertical size={12} className="text-gray-300 flex-shrink-0 cursor-grab" />
                      <input
                        type="checkbox"
                        checked={row.isHeader}
                        onChange={(e) => updateRow(row.id, { isHeader: e.target.checked })}
                        title="Mark as header row"
                        className="accent-indigo-600 flex-shrink-0"
                      />
                      <input
                        value={row.label}
                        onChange={(e) => updateRow(row.id, { label: e.target.value })}
                        className={`flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                          row.isHeader ? "font-semibold bg-gray-50" : "bg-white"
                        }`}
                        placeholder="Row label"
                      />
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                        <button
                          onClick={() => updateRow(row.id, { indent: Math.max(0, row.indent - 1) })}
                          title="Decrease indent"
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 text-xs"
                        >
                          ←
                        </button>
                        <button
                          onClick={() => updateRow(row.id, { indent: Math.min(4, row.indent + 1) })}
                          title="Increase indent"
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 text-xs"
                        >
                          →
                        </button>
                        <button
                          onClick={() => deleteRow(row.id)}
                          className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Right panel: preview + chat ── */}
          <div className="lg:w-80 xl:w-96 flex-shrink-0 flex flex-col gap-4">
            {/* Live Mock Output */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-shrink-0">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Table size={14} className="text-indigo-500" />
                <span className="font-semibold text-gray-700 text-sm">Live Mock Output</span>
              </div>
              <div className="overflow-x-auto p-3">
                {/* Title block */}
                <div className="mb-2 pb-2 border-b border-gray-300">
                  <p className="text-xs font-semibold text-gray-800 leading-snug">{activeShell.title || "Untitled Shell"}</p>
                  {activeShell.population && (
                    <p className="text-xs text-gray-500 mt-0.5">{activeShell.population}</p>
                  )}
                </div>
                {/* Table */}
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      {activeShell.columns.map((col, i) => (
                        <th
                          key={col.id}
                          className={`py-1.5 text-xs font-bold text-gray-800 border-b-2 border-gray-700 whitespace-nowrap ${i === 0 ? "text-left pr-3" : "text-center px-2"}`}
                          style={{ minWidth: Math.min(col.width, 140) }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeShell.rows.length === 0 ? (
                      <tr>
                        <td colSpan={activeShell.columns.length} className="py-3 text-center text-gray-400 italic text-xs">
                          No rows defined
                        </td>
                      </tr>
                    ) : (
                      activeShell.rows.map((row) => (
                        <tr key={row.id} className="border-b border-gray-100">
                          <td
                            className={`py-1 text-xs pr-3 ${row.isHeader ? "font-semibold text-gray-800" : "text-gray-600"}`}
                            style={{ paddingLeft: `${row.indent * 12 + 2}px` }}
                          >
                            {row.label || <span className="italic text-gray-400">—</span>}
                          </td>
                          {activeShell.columns.slice(1).map((col) => (
                            <td key={col.id} className="py-1 text-center text-gray-400 px-2">
                              {row.isHeader ? "" : "xx"}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {/* Footnotes */}
                {activeShell.footnotes && activeShell.footnotes.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 space-y-0.5">
                    {activeShell.footnotes.map((fn, i) => (
                      <p key={i} className="text-xs text-gray-500 italic leading-snug">{fn}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Statistical Assistant chat */}
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col flex-1 min-h-0">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Bot size={14} className="text-indigo-500" />
                <span className="font-semibold text-gray-700 text-sm">Statistical Assistant</span>
              </div>

              {/* Quick actions */}
              <div className="px-3 pt-2 pb-1 flex gap-2 flex-wrap border-b border-gray-50">
                <button
                  onClick={() => handleAiAction("refine_title")}
                  disabled={isChatLoading || isChatHistoryLoading}
                  className="text-xs border border-indigo-200 text-indigo-600 px-2.5 py-1 rounded-full hover:bg-indigo-50 transition disabled:opacity-50 font-medium"
                >
                  Refine Title
                </button>
                <button
                  onClick={() => handleAiAction("suggest_rows")}
                  disabled={isChatLoading || isChatHistoryLoading}
                  className="text-xs border border-indigo-200 text-indigo-600 px-2.5 py-1 rounded-full hover:bg-indigo-50 transition disabled:opacity-50 font-medium"
                >
                  Suggest Rows
                </button>
              </div>

              {/* Chat history */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-[160px] max-h-64">
                {isChatHistoryLoading ? (
                  <div className="flex items-center justify-center h-full py-6 gap-2 text-gray-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">Loading history…</span>
                  </div>
                ) : chatHistoryError ? (
                  <div className="flex items-start gap-1.5 text-xs text-red-500 px-1 py-2">
                    <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
                    <span>{chatHistoryError}</span>
                  </div>
                ) : chatMessages !== null && chatMessages.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-4">
                    No messages yet. Ask me something below.
                  </p>
                ) : (
                  (chatMessages || []).map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] text-xs px-3 py-2 rounded-xl leading-relaxed ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white rounded-br-none"
                            : "bg-gray-100 text-gray-700 rounded-bl-none"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-400 text-xs px-3 py-2 rounded-xl rounded-bl-none flex items-center gap-1.5">
                      <Loader2 size={11} className="animate-spin" /> Thinking…
                    </div>
                  </div>
                )}
                {chatError && (
                  <div className="flex items-center gap-1.5 text-xs text-red-500 px-1">
                    <AlertCircle size={11} /> {chatError}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="px-3 pb-3 pt-2 border-t border-gray-100 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                  placeholder="Ask about this shell…"
                  disabled={isChatLoading || isChatHistoryLoading}
                  className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50"
                />
                <button
                  onClick={sendChat}
                  disabled={!chatInput.trim() || isChatLoading || isChatHistoryLoading}
                  className="bg-indigo-600 text-white px-2.5 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex-shrink-0"
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* No shell selected or empty state */
        !loadingShells && shells.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Layers size={32} className="opacity-30" />
            <p className="text-sm">No shells yet for this study.</p>
            <button onClick={addShell} className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
              <Plus size={14} /> Create First Shell
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a shell from the sidebar.
          </div>
        )
      )}
    </div>
  );
}

// ─── Main StudyPage ───────────────────────────────────────────────────────────

const TABS = [
  { id: "documents", label: "Documents", icon: FileText },
  { id: "tlf", label: "TLF List", icon: List },
  { id: "global", label: "Global Requirements", icon: Settings },
  { id: "shells", label: "AI Shells", icon: Layers },
];

export default function StudyPage({ studyId = "XYZ-101", studyName = "XYZ-101" }) {
  const [activeTab, setActiveTab] = useState("documents");
  const [description, setDescription] = useState("Phase 3 clinical trial for a new hypertension medication.");
  const [showGlobalReqPanel, setShowGlobalReqPanel] = useState(false);
  const [globalReqText, setGlobalReqText] = useState("");

  // Resolved backend UUID for API calls (studyId prop may be a display code like "XYZ-101")
  const [backendStudyId, setBackendStudyId] = useState(null);
  const [studyBootstrapping, setStudyBootstrapping] = useState(true);

  useEffect(() => {
    const name = studyName || studyId;
    const bootstrap = async () => {
      try {
        const r = await fetch(`${API_BASE}/studies?limit=200`);
        if (!r.ok) throw new Error(`Studies fetch failed (${r.status})`);
        const data = await r.json();
        const studies = data.studies || [];
        const found = studies.find((s) => s.name === name);
        if (found) {
          setBackendStudyId(found.id);
          return;
        }
        // Study not found — create it
        const cr = await fetch(`${API_BASE}/studies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!cr.ok) throw new Error(`Study create failed (${cr.status})`);
        const created = await cr.json();
        setBackendStudyId(created.id);
      } catch (err) {
        console.error("Study bootstrap error:", err);
        setBackendStudyId(studyId); // last-resort fallback
      } finally {
        setStudyBootstrapping(false);
      }
    };
    bootstrap();
  }, [studyId, studyName]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveRequirements = () => {
    console.log("Study requirements saved:", { studyId, description, globalReqText });
    setShowGlobalReqPanel(false);
    alert("Requirements saved (see console).");
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* ── Top Nav ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Layers size={16} className="text-indigo-600" />
            </div>
            <span className="font-bold text-gray-900">
              <span className="text-indigo-600">TLF</span>Gen
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-500">
            <button className="hover:text-gray-800 transition flex items-center gap-1.5">
              <Table size={14} /> Dashboard
            </button>
            <button className="hover:text-gray-800 transition flex items-center gap-1.5 text-indigo-600 font-medium">
              <FileText size={14} /> Studies
            </button>
            <button className="hover:text-gray-800 transition flex items-center gap-1.5">
              <Settings size={14} /> Settings
            </button>
          </nav>
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            JD
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
          <button className="hover:text-gray-600 transition">Dashboard</button>
          <span>/</span>
          <button className="hover:text-gray-600 transition flex items-center gap-1">
            <ArrowLeft size={13} /> Studies
          </button>
          <span>/</span>
          <span className="text-gray-700 font-medium">Study {studyName}</span>
        </div>

        {/* ── Study Header ── */}
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1">
            <h1 className="text-3xl font-black text-gray-900 mb-2">Study {studyName}</h1>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full text-gray-500 text-sm bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-400 rounded-lg px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="Study description..."
            />
          </div>
          {showGlobalReqPanel ? (
            <div className="md:w-96 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Settings size={16} className="text-indigo-500" />
                  <span className="font-semibold text-gray-800">Global Requirements</span>
                </div>
                <button onClick={() => setShowGlobalReqPanel(false)} className="text-sm text-gray-400 hover:text-gray-600 transition">
                  Cancel
                </button>
              </div>
              <textarea
                value={globalReqText}
                onChange={(e) => setGlobalReqText(e.target.value)}
                rows={4}
                placeholder="Enter global formatting or structural requirements..."
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none mb-3"
              />
              <button onClick={saveRequirements} className="w-full bg-indigo-600 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-indigo-700 transition">
                Save Requirements
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowGlobalReqPanel(true)}
              className="self-start flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition shadow-sm"
            >
              <Settings size={14} /> Save Requirements
            </button>
          )}
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 mb-6 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                activeTab === id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div>
          {activeTab === "documents" && <DocumentsTab />}
          {activeTab === "tlf" && (
            studyBootstrapping ? (
              <div className="flex items-center justify-center h-64 text-gray-400 gap-2">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Connecting to study…</span>
              </div>
            ) : (
              <TLFTab studyId={backendStudyId || studyId} />
            )
          )}
          {activeTab === "global" && (
            studyBootstrapping ? (
              <div className="flex items-center justify-center h-64 text-gray-400 gap-2">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Connecting to study…</span>
              </div>
            ) : (
              <GlobalRequirementsTab studyId={backendStudyId || studyId} />
            )
          )}
          {activeTab === "shells" && (
            studyBootstrapping ? (
              <div className="flex items-center justify-center h-64 text-gray-400 gap-2">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Connecting to study…</span>
              </div>
            ) : (
              <AIShellsTab studyId={backendStudyId || studyId} studyName={studyName} />
            )
          )}
        </div>
      </main>
    </div>
  );
}
