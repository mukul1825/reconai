import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Landmark, Receipt, Check, Loader2 } from "lucide-react";
import { api } from "../api/client";
import { setCurrentBatch } from "../api/useCurrentBatch";
import { ErrorBanner } from "../components/States";

const SOURCES = [
  {
    key: "ledger",
    label: "Ledger",
    description: "Internal order records",
    icon: FileText,
  },
  {
    key: "settlement",
    label: "Settlement report",
    description: "Razorpay settlement export",
    icon: Receipt,
  },
  {
    key: "bank",
    label: "Bank statement",
    description: "NEFT credits from your bank",
    icon: Landmark,
  },
];

function FileSlot({ source, file, onSelect }) {
  const inputRef = useRef(null);
  const Icon = source.icon;

  return (
    <div
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
        file ? "border-success/30 bg-success-soft" : "border-line hover:border-accent/40 bg-surface"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => onSelect(source.key, e.target.files[0])}
      />
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
            file ? "bg-success text-white" : "bg-paper text-subtle"
          }`}
        >
          {file ? <Check size={15} /> : <Icon size={15} strokeWidth={2} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{source.label}</p>
          <p className="text-xs text-subtle mt-0.5">{source.description}</p>
          {file && (
            <p className="text-xs font-mono text-success mt-1.5 truncate">{file.name}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UploadBatchPage() {
  const [files, setFiles] = useState({});
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const allSelected = SOURCES.every((s) => files[s.key]);

  function handleSelect(key, file) {
    setFiles((prev) => ({ ...prev, [key]: file }));
  }

  async function handleRun() {
    setError(null);
    setProcessing(true);
    try {
      const result = await api.uploadBatch(files);
      setCurrentBatch(result.batchId);
      navigate(`/dashboard?batch=${result.batchId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">New reconciliation batch</h1>
        <p className="text-sm text-subtle mt-1">
          Upload your ledger, settlement report, and bank statement to run reconciliation.
        </p>
      </div>

      {error && (
        <div className="mb-5">
          <ErrorBanner message={error} onRetry={() => setError(null)} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {SOURCES.map((source) => (
          <FileSlot key={source.key} source={source} file={files[source.key]} onSelect={handleSelect} />
        ))}
      </div>

      <button
        onClick={handleRun}
        disabled={!allSelected || processing}
        className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:bg-line disabled:text-subtle text-white text-sm font-medium px-4 py-2 rounded transition-colors"
      >
        {processing && <Loader2 size={15} className="animate-spin" />}
        {processing ? "Reconciling…" : "Run reconciliation"}
      </button>

      {processing && (
        <p className="text-xs text-subtle mt-2">
          Matching against your bank statement and settlement report — this takes a few seconds.
        </p>
      )}
    </div>
  );
}
