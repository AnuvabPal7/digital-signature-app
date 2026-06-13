import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const STATUS_COLORS = {
  PENDING: { bg: "#fff8e1", text: "#a17c00", border: "#ffe082" },
  SIGNED: { bg: "#e8f5e9", text: "#2e7d32", border: "#a5d6a7" },
  REJECTED: { bg: "#fdecea", text: "#c62828", border: "#f5b7b1" },
  NONE: { bg: "#f1f1f1", text: "#666", border: "#ddd" },
};

function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.NONE;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.5,
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        textTransform: "uppercase",
      }}
    >
      {status === "NONE" ? "No Signature" : status}
    </span>
  );
}

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [docStatuses, setDocStatuses] = useState({});
  const [filter, setFilter] = useState("ALL");

  const [selectedPdf, setSelectedPdf] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [pos, setPos] = useState({ x: 100, y: 100 });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const fetchDocuments = useCallback(() => {
    axios
      .get(`${API_URL}/api/docs/user/1`)
      .then((res) => {
        setDocuments(res.data);
        res.data.forEach((doc) => {
          axios
            .get(`${API_URL}/api/signature/document/${doc.id}`)
            .then((r) => {
              const sigs = r.data;
              let status = "NONE";
              if (sigs.length > 0) {
                status = sigs[sigs.length - 1].status || "PENDING";
              }
              setDocStatuses((prev) => ({ ...prev, [doc.id]: status }));
            })
            .catch(() => {
              setDocStatuses((prev) => ({ ...prev, [doc.id]: "NONE" }));
            });
        });
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const onMove = (e) => {
    if (!dragging.current) return;
    const rect = document.getElementById("pdf-wrapper").getBoundingClientRect();
    setPos({
      x: e.clientX - rect.left - offset.current.x,
      y: e.clientY - rect.top - offset.current.y,
    });
    setSaved(false);
  };

  const stopDrag = () => {
    dragging.current = false;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", stopDrag);
  };

  const startDrag = (e) => {
    e.preventDefault();
    dragging.current = true;
    const rect = document.getElementById("pdf-wrapper").getBoundingClientRect();
    offset.current = {
      x: e.clientX - rect.left - pos.x,
      y: e.clientY - rect.top - pos.y,
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stopDrag);
  };

  const saveSignature = async () => {
    if (!selectedDocId) return;
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/signature/save`, {
        documentId: selectedDocId,
        userId: 1,
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        pageNumber: 1,
      });
      setSaved(true);
      fetchDocuments();
    } catch (err) {
      console.error("Failed to save signature", err);
      alert("Failed to save. Check console.");
    } finally {
      setSaving(false);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    if (filter === "ALL") return true;
    return (docStatuses[doc.id] || "NONE") === filter;
  });

  const filterOptions = [
    { key: "ALL", label: "All" },
    { key: "PENDING", label: "Pending" },
    { key: "SIGNED", label: "Signed" },
    { key: "REJECTED", label: "Rejected" },
  ];

  return (
    <div style={{ padding: 24, fontFamily: "Segoe UI, Arial, sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 4 }}>📄 Digital Signature App</h1>
      <p style={{ color: "#666", marginTop: 0, marginBottom: 24 }}>
        Manage, sign, and track the status of your documents.
      </p>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div
            style={{
              background: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: 10,
              padding: 16,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 18 }}>My Documents</h2>

            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {filterOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFilter(opt.key)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 16,
                    border: filter === opt.key ? "1px solid #1a73e8" : "1px solid #ddd",
                    background: filter === opt.key ? "#e8f0fe" : "#fff",
                    color: filter === opt.key ? "#1a73e8" : "#444",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {filteredDocs.length === 0 && (
              <p style={{ color: "#999", fontSize: 13 }}>No documents match this filter.</p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredDocs.map((doc) => {
                const status = docStatuses[doc.id] || "NONE";
                const isActive = selectedDocId === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      setSelectedPdf(`${API_URL}/api/docs/view/${doc.id}`);
                      setSelectedDocId(doc.id);
                      setSaved(false);
                      setPos({ x: 100, y: 100 });
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: isActive ? "1px solid #1a73e8" : "1px solid #eee",
                      background: isActive ? "#f5f9ff" : "#fafafa",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>
                      {doc.fileName}
                    </span>
                    <StatusBadge status={status} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ flex: "2 1 500px", minWidth: 320 }}>
          {!selectedPdf && (
            <div
              style={{
                background: "#fff",
                border: "1px dashed #ddd",
                borderRadius: 10,
                padding: 40,
                textAlign: "center",
                color: "#999",
              }}
            >
              Select a document from the left to preview and place your signature.
            </div>
          )}

          {selectedPdf && (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e0e0e0",
                borderRadius: 10,
                padding: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>PDF Preview</h2>
                <StatusBadge status={docStatuses[selectedDocId] || "NONE"} />
              </div>

              <p style={{ color: "#666", fontSize: 13, marginTop: 0 }}>
                Position: X {Math.round(pos.x)} | Y {Math.round(pos.y)}
              </p>

              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  onClick={saveSignature}
                  disabled={saving}
                  style={{
                    padding: "8px 20px",
                    background: saving ? "#999" : "#1a73e8",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: saving ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                    fontSize: 14,
                  }}
                >
                  {saving ? "Saving..." : "Place Signature"}
                </button>

                {saved && (
                  <span style={{ color: "green", fontWeight: "bold", fontSize: 13 }}>
                    ✓ Signature saved at ({Math.round(pos.x)}, {Math.round(pos.y)})
                  </span>
                )}
              </div>

              <div
                id="pdf-wrapper"
                style={{
                  position: "relative",
                  display: "inline-block",
                  userSelect: "none",
                  border: "1px solid #eee",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                <Document file={selectedPdf}>
                  <Page
                    pageNumber={1}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>

                <div
                  onMouseDown={startDrag}
                  style={{
                    position: "absolute",
                    left: pos.x,
                    top: pos.y,
                    width: 120,
                    height: 40,
                    background: saved ? "#2e7d32" : "green",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 6,
                    cursor: "grab",
                    fontWeight: "bold",
                    userSelect: "none",
                    zIndex: 999,
                    border: saved ? "2px solid #81c784" : "none",
                  }}
                >
                  {saved ? "✓ Placed" : "Signature"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}