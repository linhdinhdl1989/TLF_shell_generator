import { useState, useRef } from "react";
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
  ChevronDown,
  MessageSquare,
  Send,
  Eye,
  Edit2,
  X,
  AlertCircle,
  Loader2,
  Table,
  Bot,
  GripVertical,
} from "lucide-react";

// ─── Mock Data ────────────────────────────────────────────────────────────────

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

const INITIAL_SHELLS = [
  {
    id: 1,
    number: "14.1.1",
    title: "Demographics and Baseline Characteristics",
    status: "generated",
    population: "Safety Analysis Set",
    columns: [
      { id: 1, label: "Characteristic", width: 200 },
      { id: 2, label: "Placebo (N=xx)", width: 140 },
      { id: 3, label: "Treatment (N=xx)", width: 140 },
      { id: 4, label: "Total (N=xx)", width: 120 },
    ],
    rows: [
      { id: 1, indent: 0, label: "Age (years)", isHeader: false },
      { id: 2, indent: 1, label: "n", isHeader: false },
      { id: 3, indent: 1, label: "Mean (SD)", isHeader: false },
      { id: 4, indent: 1, label: "Median", isHeader: false },
      { id: 5, indent: 1, label: "Min, Max", isHeader: false },
      { id: 6, indent: 0, label: "Sex, n (%)", isHeader: false },
      { id: 7, indent: 1, label: "Male", isHeader: false },
      { id: 8, indent: 1, label: "Female", isHeader: false },
      { id: 9, indent: 0, label: "Race, n (%)", isHeader: false },
      { id: 10, indent: 1, label: "White", isHeader: false },
      { id: 11, indent: 1, label: "Black or African American", isHeader: false },
      { id: 12, indent: 1, label: "Asian", isHeader: false },
      { id: 13, indent: 1, label: "Other", isHeader: false },
    ],
    footnotes: [
      "Note: All summaries are based on the Safety Analysis Set (or specify analysis set as appropriate).",
      "Note: Continuous variables are summarized using n, mean (SD), median, minimum, and maximum.",
      "Note: Categorical variables are summarized using counts (n) and percentages (%).",
      "Note: Percentages are based on the number of subjects in the respective treatment group.",
    ],
  },
  {
    id: 2,
    number: "14.3.1.1",
    title: "Adverse Events – Overview",
    status: "pending",
    population: "Safety Analysis Set",
    columns: [
      { id: 1, label: "Parameter", width: 220 },
      { id: 2, label: "Placebo (N=xx)", width: 140 },
      { id: 3, label: "Treatment (N=xx)", width: 140 },
    ],
    rows: [
      { id: 1, indent: 0, label: "Subjects with any AE, n (%)", isHeader: false },
      { id: 2, indent: 0, label: "Subjects with any SAE, n (%)", isHeader: false },
      { id: 3, indent: 0, label: "Subjects who discontinued due to AE, n (%)", isHeader: false },
      { id: 4, indent: 0, label: "Subjects with any TEAE, n (%)", isHeader: false },
      { id: 5, indent: 0, label: "Deaths, n (%)", isHeader: false },
    ],
    footnotes: ["TEAE = Treatment-Emergent Adverse Event; SAE = Serious Adverse Event."],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  generated: "bg-indigo-100 text-indigo-700",
  pending: "bg-gray-100 text-gray-500",
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
      // Simulate status progression
      setTimeout(
        () =>
          setDocs((prev) =>
            prev.map((d) => (d.id === newDoc.id ? { ...d, status: "processing" } : d))
          ),
        800
      );
      setTimeout(
        () =>
          setDocs((prev) =>
            prev.map((d) => (d.id === newDoc.id ? { ...d, status: "ready" } : d))
          ),
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
      () =>
        setDocs((prev) =>
          prev.map((d) => (d.id === id ? { ...d, status: "ready" } : d))
        ),
      1500
    );
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
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
                <option key={t} value={t}>
                  {t.replace(/_/g, " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition"
          >
            <Upload size={14} /> Choose File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer ${
            dragOver
              ? "border-indigo-400 bg-indigo-50"
              : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={32} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500 text-sm">
            Drag & drop files here, or{" "}
            <span className="text-indigo-600 font-medium">browse</span>
          </p>
          <p className="text-gray-400 text-xs mt-1">PDF, Word, Excel supported</p>
        </div>
      </div>

      {/* Document List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
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
                {/* Type dropdown */}
                <select
                  value={doc.type}
                  onChange={(e) =>
                    setDocs((prev) =>
                      prev.map((d) => (d.id === doc.id ? { ...d, type: e.target.value } : d))
                    )
                  }
                  className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
                {/* Status */}
                <div className="flex items-center gap-1.5">
                  <StatusIcon status={doc.status} />
                  <Badge
                    label={doc.status}
                    colorClass={STATUS_COLORS[doc.status] || "bg-gray-100 text-gray-600"}
                  />
                </div>
                {/* Actions */}
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

function TLFTab() {
  const [tlfs, setTlfs] = useState(INITIAL_TLFS);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", text: "I can help you refine the TLF list. Try: 'Add AE by SOC table' or 'Remove listing 14.3.2.1'." },
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatEndRef = useRef(null);

  const addRow = () => {
    setTlfs((prev) => [
      ...prev,
      {
        id: Date.now(),
        number: "",
        title: "",
        section: "demographics",
        status: "proposed",
      },
    ]);
  };

  const updateTlf = (id, field, value) => {
    setTlfs((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const removeRow = (id) => setTlfs((prev) => prev.filter((t) => t.id !== id));

  const approveAll = () => {
    setTlfs((prev) => prev.map((t) => ({ ...t, status: "approved" })));
    console.log("TLF List approved:", tlfs);
  };

  const extractFromSAP = () => {
    setIsAiLoading(true);
    setTimeout(() => {
      setTlfs((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          number: "14.3.3.1",
          title: "Adverse Events by System Organ Class (AI Extracted)",
          section: "safety",
          status: "proposed",
        },
        {
          id: Date.now() + 2,
          number: "14.5.1",
          title: "Prior and Concomitant Medications (AI Extracted)",
          section: "safety",
          status: "proposed",
        },
      ]);
      setIsAiLoading(false);
    }, 1500);
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: "user", text: chatInput };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsAiLoading(true);

    setTimeout(() => {
      let reply = "I've noted your request. Please review the updated TLF list above.";
      const lower = chatInput.toLowerCase();
      if (lower.includes("ae by soc") || lower.includes("adverse event")) {
        setTlfs((prev) => [
          ...prev,
          {
            id: Date.now(),
            number: "14.3.1.3",
            title: "Adverse Events by System Organ Class and Preferred Term",
            section: "safety",
            status: "proposed",
          },
        ]);
        reply = "Added: 'Adverse Events by System Organ Class and Preferred Term' as Table 14.3.1.3.";
      } else if (lower.includes("remove") || lower.includes("delete")) {
        reply = "To remove a row, use the trash icon in the table. I can only add rows via chat.";
      }
      setChatMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      setIsAiLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={extractFromSAP}
          disabled={isAiLoading}
          className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-60"
        >
          {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
          AI Extract from SAP
        </button>
        <button
          onClick={addRow}
          className="flex items-center gap-2 border border-gray-300 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition"
        >
          <Plus size={14} /> Add Row
        </button>
        <button
          onClick={approveAll}
          className="flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition ml-auto"
        >
          <Check size={14} /> Approve List
        </button>
      </div>

      {/* Table */}
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
                    className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* AI Chatbox */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <MessageSquare size={16} className="text-indigo-500" />
          <span className="font-semibold text-gray-700 text-sm">AI TLF Assistant</span>
        </div>
        <div className="h-40 overflow-y-auto px-4 py-3 space-y-2">
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
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
          {isAiLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-400 text-sm px-3 py-2 rounded-xl rounded-bl-none flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Thinking...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
            placeholder="e.g. Add AE by SOC table, remove listing 14.5.1..."
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={sendChat}
            disabled={!chatInput.trim() || isAiLoading}
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

function GlobalRequirementsTab() {
  const [sections, setSections] = useState(INITIAL_GLOBAL_REQS);
  const [newSectionName, setNewSectionName] = useState("");

  const updateSection = (id, field, value) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const addColumn = (id) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, columns: [...s.columns, "New Column"] } : s
      )
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
        id: Date.now(),
        name: newSectionName.trim(),
        numberPattern: "14.x",
        titleTemplate: "Table {number}: {title}",
        columns: ["Parameter", "Value"],
      },
    ]);
    setNewSectionName("");
  };

  const saveAll = () => {
    console.log("Global Requirements saved:", sections);
    alert("Global Requirements saved (see console).");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          Define shell structure templates per section. These apply to all shells in that section.
        </p>
        <button
          onClick={saveAll}
          className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <Check size={14} /> Save Requirements
        </button>
      </div>

      {sections.map((section) => (
        <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-indigo-500" />
              <span className="font-semibold text-gray-800">{section.name}</span>
            </div>
            <button
              onClick={() => removeSection(section.id)}
              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
            >
              <X size={14} />
            </button>
          </div>
          <div className="px-6 py-5 space-y-5">
            {/* Pattern & Template */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Number Pattern
                </label>
                <input
                  value={section.numberPattern}
                  onChange={(e) => updateSection(section.id, "numberPattern", e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                  placeholder="14.x.x"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Title Template
                </label>
                <input
                  value={section.titleTemplate}
                  onChange={(e) => updateSection(section.id, "titleTemplate", e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Table {number}: {title}"
                />
              </div>
            </div>

            {/* Columns */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Column Headers
              </label>
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

            {/* Preview Table */}
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
                          <td key={ci} className="px-3 py-1.5 text-gray-400 text-center">—</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-1 italic">
                Title preview:{" "}
                {section.titleTemplate
                  .replace("{number}", section.numberPattern)
                  .replace("{title}", `[${section.name} Table Title]`)
                  .replace("{population}", "Safety Analysis Set")}
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* Add Section */}
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

// ─── Tab 4: AI Shells ─────────────────────────────────────────────────────────

function AIShellsTab() {
  const [shells, setShells] = useState(INITIAL_SHELLS);
  const [selectedId, setSelectedId] = useState(INITIAL_SHELLS[0].id);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      text: "Shell editor ready. Ask me to add rows, change columns, adjust footnotes, or update the population.",
    },
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // {type, id, field}
  const chatEndRef = useRef(null);

  const selected = shells.find((s) => s.id === selectedId);

  const updateShell = (field, value) => {
    setShells((prev) =>
      prev.map((s) => (s.id === selectedId ? { ...s, [field]: value } : s))
    );
  };

  const addRow = () => {
    const newRow = { id: Date.now(), indent: 0, label: "New Row", isHeader: false };
    updateShell("rows", [...selected.rows, newRow]);
  };

  const updateRow = (rowId, field, value) => {
    updateShell(
      "rows",
      selected.rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r))
    );
  };

  const removeRow = (rowId) => {
    updateShell("rows", selected.rows.filter((r) => r.id !== rowId));
  };

  const addColumn = () => {
    const newCol = { id: Date.now(), label: "New Column", width: 120 };
    updateShell("columns", [...selected.columns, newCol]);
  };

  const updateColumn = (colId, field, value) => {
    updateShell(
      "columns",
      selected.columns.map((c) => (c.id === colId ? { ...c, [field]: value } : c))
    );
  };

  const removeColumn = (colId) => {
    updateShell("columns", selected.columns.filter((c) => c.id !== colId));
  };

  const approveShell = () => {
    updateShell("status", "approved");
    console.log("Shell approved:", selected);
  };

  const sendChat = () => {
    if (!chatInput.trim() || !selected) return;
    const userMsg = { role: "user", text: chatInput };
    setChatMessages((prev) => [...prev, userMsg]);
    const input = chatInput;
    setChatInput("");
    setIsAiLoading(true);

    setTimeout(() => {
      let reply = "I've noted your request and updated the shell accordingly.";
      const lower = input.toLowerCase();

      if (lower.includes("add row") || lower.includes("add variable")) {
        const match = input.match(/[""']?([A-Za-z\s]+)[""']?(?:\s+variable|\s+row)?$/i);
        const label = match?.[1]?.trim() || "New Variable";
        updateShell("rows", [
          ...selected.rows,
          { id: Date.now(), indent: 0, label, isHeader: false },
        ]);
        reply = `Added row: "${label}"`;
      } else if (lower.includes("footnote") || lower.includes("note:")) {
        const note = input.replace(/^(add\s+)?(footnote|note)[:\s]*/i, "").trim();
        updateShell("footnotes", [...(selected.footnotes || []), note || "New footnote"]);
        reply = "Footnote added.";
      } else if (lower.includes("population")) {
        const pop = input.replace(/^(set|change)\s+(the\s+)?population\s+(to\s+)?/i, "").trim();
        if (pop) {
          updateShell("population", pop);
          reply = `Population updated to: "${pop}"`;
        }
      } else if (lower.includes("add column")) {
        addColumn();
        reply = "New column added. Click the column header to rename it.";
      }

      setChatMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      setIsAiLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }, 1000);
  };

  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* Sidebar – Shell List */}
      <div className="w-64 flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-700 text-sm">Shells ({shells.length})</span>
          <button
            onClick={() => {
              const newShell = {
                id: Date.now(),
                number: "xx.x.x",
                title: "New Shell",
                status: "pending",
                population: "Analysis Set",
                columns: [
                  { id: 1, label: "Parameter", width: 200 },
                  { id: 2, label: "Value", width: 140 },
                ],
                rows: [{ id: 1, indent: 0, label: "Row 1", isHeader: false }],
                footnotes: [],
              };
              setShells((prev) => [...prev, newShell]);
              setSelectedId(newShell.id);
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {shells.map((shell) => (
            <button
              key={shell.id}
              onClick={() => setSelectedId(shell.id)}
              className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition ${
                shell.id === selectedId ? "bg-indigo-50 border-l-2 border-indigo-500" : ""
              }`}
            >
              <p className="text-xs font-mono font-semibold text-indigo-600">{shell.number}</p>
              <p className="text-xs text-gray-700 mt-0.5 line-clamp-2">{shell.title}</p>
              <div className="mt-1.5">
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    SHELL_STATUS_COLORS[shell.status] || "bg-gray-100 text-gray-500"
                  }`}
                >
                  {shell.status === "generated" ? "✓ GENERATED" : shell.status.toUpperCase()}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Editor */}
      {selected ? (
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Shell Header */}
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-4 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {selected.number}
                </span>
                <Badge
                  label={selected.status === "generated" ? "✓ GENERATED" : selected.status.toUpperCase()}
                  colorClass={SHELL_STATUS_COLORS[selected.status] || "bg-gray-100 text-gray-500"}
                />
              </div>
              <input
                value={selected.title}
                onChange={(e) => updateShell("title", e.target.value)}
                className="text-base font-semibold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-400 outline-none w-full py-0.5"
              />
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">Population:</span>
                <input
                  value={selected.population}
                  onChange={(e) => updateShell("population", e.target.value)}
                  className="text-xs text-gray-600 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-400 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={approveShell}
                className="flex items-center gap-1.5 bg-green-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-green-700 transition"
              >
                <Check size={13} /> Approve
              </button>
            </div>
          </div>

          {/* Rendered Preview Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table size={15} className="text-indigo-500" />
                <span className="font-semibold text-gray-700 text-sm">Shell Preview</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addRow}
                  className="flex items-center gap-1 border border-gray-300 text-xs px-2.5 py-1 rounded-md hover:bg-gray-50 transition"
                >
                  <Plus size={11} /> Row
                </button>
                <button
                  onClick={addColumn}
                  className="flex items-center gap-1 border border-gray-300 text-xs px-2.5 py-1 rounded-md hover:bg-gray-50 transition"
                >
                  <Plus size={11} /> Column
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    {selected.columns.map((col) => (
                      <th key={col.id} className="px-4 py-2.5 text-left group">
                        <div className="flex items-center gap-1">
                          <input
                            value={col.label}
                            onChange={(e) => updateColumn(col.id, "label", e.target.value)}
                            className="font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-400 focus:border-indigo-400 outline-none text-sm min-w-0 flex-1"
                          />
                          {selected.columns.length > 1 && (
                            <button
                              onClick={() => removeColumn(col.id)}
                              className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                            >
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {selected.rows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 group">
                      <td className="px-4 py-1.5">
                        <div
                          className="flex items-center gap-1"
                          style={{ paddingLeft: `${row.indent * 16}px` }}
                        >
                          <GripVertical size={12} className="text-gray-300 flex-shrink-0 cursor-grab" />
                          <input
                            value={row.label}
                            onChange={(e) => updateRow(row.id, "label", e.target.value)}
                            className={`bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-400 outline-none text-sm flex-1 min-w-0 ${
                              row.isHeader ? "font-semibold" : ""
                            }`}
                          />
                        </div>
                      </td>
                      {selected.columns.slice(1).map((col) => (
                        <td key={col.id} className="px-4 py-1.5 text-gray-400 text-center text-xs italic">
                          xx
                        </td>
                      ))}
                      <td className="py-1.5 px-1">
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                          <button
                            onClick={() => updateRow(row.id, "indent", Math.max(0, row.indent - 1))}
                            title="Decrease indent"
                            className="p-0.5 rounded hover:bg-gray-200 text-gray-400 text-xs"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => updateRow(row.id, "indent", Math.min(3, row.indent + 1))}
                            title="Increase indent"
                            className="p-0.5 rounded hover:bg-gray-200 text-gray-400 text-xs"
                          >
                            →
                          </button>
                          <button
                            onClick={() => removeRow(row.id)}
                            className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footnotes */}
            {selected.footnotes?.length > 0 && (
              <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-1">
                {selected.footnotes.map((fn, i) => (
                  <div key={i} className="flex items-start gap-2 group">
                    <p className="text-xs text-gray-500 italic flex-1">{fn}</p>
                    <button
                      onClick={() =>
                        updateShell(
                          "footnotes",
                          selected.footnotes.filter((_, idx) => idx !== i)
                        )
                      }
                      className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Chatbox */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Bot size={15} className="text-indigo-500" />
              <span className="font-semibold text-gray-700 text-sm">AI Shell Assistant</span>
            </div>
            <div className="h-36 overflow-y-auto px-4 py-3 space-y-2">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-sm text-xs px-3 py-2 rounded-xl ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-none"
                        : "bg-gray-100 text-gray-700 rounded-bl-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isAiLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-400 text-xs px-3 py-2 rounded-xl rounded-bl-none flex items-center gap-1.5">
                    <Loader2 size={11} className="animate-spin" /> Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="e.g. Add BMI row, change population to FAS, add footnote..."
                className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={sendChat}
                disabled={!chatInput.trim() || isAiLoading}
                className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Select a shell from the sidebar to edit.
        </div>
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

export default function StudyPage({ studyId = "XYZ-101" }) {
  const [activeTab, setActiveTab] = useState("documents");
  const [description, setDescription] = useState(
    "Phase 3 clinical trial for a new hypertension medication."
  );
  const [showGlobalReqPanel, setShowGlobalReqPanel] = useState(false);
  const [globalReqText, setGlobalReqText] = useState("");

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
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Layers size={16} className="text-indigo-600" />
            </div>
            <span className="font-bold text-gray-900">
              <span className="text-indigo-600">TLF</span>Gen
            </span>
          </div>
          {/* Nav */}
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
          {/* Avatar */}
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
          <span className="text-gray-700 font-medium">Study {studyId}</span>
        </div>

        {/* ── Study Header + Global Requirements Panel ── */}
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          {/* Left: Study title + description */}
          <div className="flex-1">
            <h1 className="text-3xl font-black text-gray-900 mb-2">Study {studyId}</h1>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full text-gray-500 text-sm bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-400 rounded-lg px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="Study description..."
            />
          </div>

          {/* Right: Global Requirements card */}
          {showGlobalReqPanel ? (
            <div className="md:w-96 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Settings size={16} className="text-indigo-500" />
                  <span className="font-semibold text-gray-800">Global Requirements</span>
                </div>
                <button
                  onClick={() => setShowGlobalReqPanel(false)}
                  className="text-sm text-gray-400 hover:text-gray-600 transition"
                >
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
              <button
                onClick={saveRequirements}
                className="w-full bg-indigo-600 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-indigo-700 transition"
              >
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
          {activeTab === "tlf" && <TLFTab />}
          {activeTab === "global" && <GlobalRequirementsTab />}
          {activeTab === "shells" && <AIShellsTab />}
        </div>
      </main>
    </div>
  );
}
