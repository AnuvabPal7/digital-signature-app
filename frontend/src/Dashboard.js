import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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

export default function Dashboard({ onLogout }) {
  const [documents, setDocuments] = useState([]);
  const [docStatuses, setDocStatuses] = useState({});
  const [filter, setFilter] = useState("ALL");

  const [selectedPdf, setSelectedPdf] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [pos, setPos] = useState({ x: 100, y: 100 });
  const [pdfNativeSize, setPdfNativeSize] = useState({ width: 612, height: 792 }); // default Letter size in points
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signMode, setSignMode] = useState(null); // null | "only_me" | "several"
  const [signerName, setSignerName] = useState("");
  const [signatureFont, setSignatureFont] = useState("'Dancing Script', cursive");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

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

  const uploadFile = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", "1");
      await axios.post(`${API_URL}/api/docs/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      fetchDocuments();
    } catch (err) {
      console.error("Failed to upload document", err);
      alert("Failed to upload document. Check console.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    uploadFile(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    uploadFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

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
    if (!selectedDocId) return null;
    setSaving(true);
    try {
      const scale = pdfNativeSize.width / 600; // rendered width is fixed at 600px
      const res = await axios.post(`${API_URL}/api/signature/save`, {
        documentId: selectedDocId,
        userId: 1,
        x: Math.round(pos.x * scale),
        y: Math.round(pos.y * scale),
        pageNumber: 1,
        signerName: signerName || "User",
      });
      setSaved(true);
      fetchDocuments();
      return res.data.id;
    } catch (err) {
      console.error("Failed to save signature", err);
      alert("Failed to save. Check console.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSendToSign = async () => {
    if (!recipientEmail) {
      alert("Please enter a recipient email.");
      return;
    }
    setSendingLink(true);
    try {
      const signatureId = await saveSignature();
      if (!signatureId) return;
      await axios.post(`${API_URL}/api/signature/${signatureId}/send-link`, {
        email: recipientEmail,
      });
      setLinkSent(true);
    } catch (err) {
      console.error("Failed to send signing link", err);
      alert("Failed to send signing link. Check console.");
    } finally {
      setSendingLink(false);
    }
  };

  const handleGenerateSignedPdf = async () => {
    const signatureId = await saveSignature();
    if (!signatureId || !selectedDocId) return;
    window.open(`${API_URL}/api/signature/generate/${selectedDocId}`, "_blank");
  };

  const handleDeleteDocument = async (docId, e) => {
    e.stopPropagation(); // don't trigger document selection
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    try {
      await axios.delete(`${API_URL}/api/docs/${docId}`);
      if (selectedDocId === docId) {
        setSelectedPdf(null);
        setSelectedDocId(null);
        setSignMode(null);
      }
      fetchDocuments();
    } catch (err) {
      console.error("Failed to delete document", err);
      alert("Failed to delete document. Check console.");
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#e6f1fb",
              color: "#185fa5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: 16,
            }}
          >
            S
          </div>
          <h1 style={{ margin: 0, fontSize: 22 }}>SecureSign</h1>
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: "#6b7280",
            background: "transparent",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Log out
        </button>
      </div>
      <p style={{ color: "#666", marginTop: 4, marginBottom: 24 }}>
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

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? "#1a73e8" : "#d1d5db"}`,
                borderRadius: 10,
                padding: "20px 16px",
                textAlign: "center",
                marginBottom: 16,
                cursor: "pointer",
                background: dragActive ? "#f5f9ff" : "#fafafa",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileInputChange}
                style={{ display: "none" }}
              />
              {uploading ? (
                <p style={{ margin: 0, fontSize: 13, color: "#1a73e8", fontWeight: 600 }}>
                  Uploading...
                </p>
              ) : (
                <>
                  <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#444" }}>
                    Drag and drop a PDF here
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "#999" }}>
                    or click to browse files
                  </p>
                </>
              )}
            </div>

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
                      setSignMode(null);
                      setRecipientEmail("");
                      setLinkSent(false);
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
                    <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8, flex: 1 }}>
                      {doc.fileName}
                    </span>
                    <StatusBadge status={status} />
                    <button
                      onClick={(e) => handleDeleteDocument(doc.id, e)}
                      title="Delete document"
                      style={{
                        marginLeft: 8,
                        background: "none",
                        border: "none",
                        color: "#c62828",
                        cursor: "pointer",
                        fontSize: 14,
                        padding: "2px 6px",
                        borderRadius: 4,
                        lineHeight: 1,
                      }}
                    >
                      🗑️
                    </button>
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

          {selectedPdf && !signMode && (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e0e0e0",
                borderRadius: 10,
                padding: 24,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Who will sign this document?</h2>
              <p style={{ color: "#666", fontSize: 13, marginTop: 0, marginBottom: 20 }}>
                Choose how you want to proceed
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <div
                  onClick={() => setSignMode("only_me")}
                  style={{
                    border: "1px solid #e0e0e0",
                    borderRadius: 10,
                    padding: 20,
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1a73e8")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e0e0e0")}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: "#e6f1fb",
                      color: "#185fa5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      fontWeight: "bold",
                      marginBottom: 10,
                    }}
                  >
                    1
                  </div>
                  <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Only me</p>
                  <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
                    Sign this document yourself right now
                  </p>
                </div>

                <div
                  onClick={() => setSignMode("several")}
                  style={{
                    border: "1px solid #e0e0e0",
                    borderRadius: 10,
                    padding: 20,
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1a73e8")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e0e0e0")}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: "#e1f5ee",
                      color: "#0f6e56",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      fontWeight: "bold",
                      marginBottom: 10,
                    }}
                  >
                    2+
                  </div>
                  <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Several people</p>
                  <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
                    Invite others to sign via email link
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedPdf && signMode && (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e0e0e0",
                borderRadius: 10,
                padding: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <button
                  onClick={() => setSignMode(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#1a73e8",
                    fontSize: 13,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  ← Back
                </button>
                <StatusBadge status={docStatuses[selectedDocId] || "NONE"} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>
                  {signMode === "only_me" ? "Sign document" : "Send for signature"}
                </h2>
              </div>

              <div
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 16,
                  background: "#fafafa",
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px", color: "#333" }}>
                  Set your signature
                </p>

                <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>
                  Full name
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  style={{
                    width: "100%",
                    maxWidth: 280,
                    padding: "8px 12px",
                    fontSize: 14,
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    outline: "none",
                    marginBottom: 12,
                    boxSizing: "border-box",
                  }}
                />

                <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 6 }}>
                  Choose a style
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { label: "Script", font: "'Dancing Script', cursive" },
                    { label: "Elegant", font: "'Allura', cursive" },
                    { label: "Handwritten", font: "'Caveat', cursive" },
                    { label: "Plain", font: "Arial, sans-serif" },
                  ].map((opt) => (
                    <div
                      key={opt.label}
                      onClick={() => setSignatureFont(opt.font)}
                      style={{
                        flex: "1 1 120px",
                        minWidth: 110,
                        border: signatureFont === opt.font ? "2px solid #1a73e8" : "1px solid #d1d5db",
                        borderRadius: 8,
                        padding: "10px 8px",
                        textAlign: "center",
                        cursor: "pointer",
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: opt.font,
                          fontSize: opt.label === "Plain" ? 16 : 22,
                          color: "#185fa5",
                          marginBottom: 4,
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {signerName || "Your Name"}
                      </div>
                      <div style={{ fontSize: 11, color: "#999" }}>{opt.label}</div>
                    </div>
                  ))}
                </div>
              </div>


              <p style={{ color: "#666", fontSize: 13, marginTop: 0 }}>
                Drag your signature onto the document, then{" "}
                {signMode === "only_me" ? "generate your signed PDF" : "send it for signature"}.
              </p>
              <p style={{ color: "#999", fontSize: 12, marginTop: -8 }}>
                Position: X {Math.round(pos.x)} | Y {Math.round(pos.y)}
              </p>

              {signMode === "only_me" && (
                <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <button
                    onClick={handleGenerateSignedPdf}
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
                    {saving ? "Generating..." : "Generate signed PDF"}
                  </button>

                  {saved && (
                    <span style={{ color: "green", fontWeight: "bold", fontSize: 13 }}>
                      ✓ Signature placed — opening signed PDF
                    </span>
                  )}
                </div>
              )}

              {signMode === "several" && (
                <div style={{ marginBottom: 12 }}>
                  {!linkSent ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <input
                        type="email"
                        placeholder="recipient@example.com"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        style={{
                          flex: "1 1 220px",
                          padding: "8px 12px",
                          fontSize: 14,
                          border: "1px solid #d1d5db",
                          borderRadius: 6,
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={handleSendToSign}
                        disabled={sendingLink}
                        style={{
                          padding: "8px 20px",
                          background: sendingLink ? "#999" : "#1a73e8",
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          cursor: sendingLink ? "not-allowed" : "pointer",
                          fontWeight: "bold",
                          fontSize: 14,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {sendingLink ? "Sending..." : "Send to sign"}
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: "green", fontWeight: "bold", fontSize: 13 }}>
                      ✓ Signing link sent to {recipientEmail}
                    </span>
                  )}
                </div>
              )}

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
                    width={600}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onLoadSuccess={(page) => {
                      setPdfNativeSize({ width: page.originalWidth, height: page.originalHeight });
                    }}
                  />
                </Document>

                <div
                  onMouseDown={startDrag}
                  style={{
                    position: "absolute",
                    left: pos.x,
                    top: pos.y,
                    minWidth: 140,
                    maxWidth: 220,
                    height: 50,
                    background: "transparent",
                    color: "#185fa5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "4px 14px",
                    borderRadius: 6,
                    cursor: "grab",
                    userSelect: "none",
                    zIndex: 999,
                    border: saved ? "2px solid #81c784" : "2px dashed #1a73e8",
                    fontFamily: signatureFont,
                    fontSize: signatureFont.includes("Arial") ? 16 : 26,
                    fontWeight: signatureFont.includes("Arial") ? 600 : 400,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {signerName || "Your Signature"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}