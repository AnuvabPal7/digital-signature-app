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

const SIGNATURE_COLORS = [
  { label: "Black", hex: "#1a1a1a", rgb: [26, 26, 26] },
  { label: "Blue", hex: "#185fa5", rgb: [24, 95, 165] },
  { label: "Red", hex: "#c62828", rgb: [198, 40, 40] },
  { label: "Green", hex: "#2e7d32", rgb: [46, 125, 50] },
  { label: "Purple", hex: "#6a1b9a", rgb: [106, 27, 154] },
];

function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.NONE;
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, textTransform: "uppercase" }}>
      {status === "NONE" ? "No Signature" : status}
    </span>
  );
}

export default function Dashboard({ onLogout, userId }) {
  const [documents, setDocuments] = useState([]);
  const [docStatuses, setDocStatuses] = useState({});
  const [filter, setFilter] = useState("ALL");
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [pos, setPos] = useState(null);
  const [pdfNativeSize, setPdfNativeSize] = useState({ width: 612, height: 792 });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signMode, setSignMode] = useState(null);
  const [signerName, setSignerName] = useState("");
  const [signatureFont, setSignatureFont] = useState("Allura, cursive");
  const [signatureColor, setSignatureColor] = useState(SIGNATURE_COLORS[1]);
  const [signatureTab, setSignatureTab] = useState("type"); // "type" | "draw"
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const lastPoint = useRef(null);

  const fetchDocuments = useCallback(() => {
    axios.get(`${API_URL}/api/docs/user/${userId}`).then((res) => {
      setDocuments(res.data);
      res.data.forEach((doc) => {
        axios.get(`${API_URL}/api/signature/document/${doc.id}`)
          .then((r) => {
            const sigs = r.data;
            const status = sigs.length > 0 ? (sigs[sigs.length - 1].status || "PENDING") : "NONE";
            setDocStatuses((prev) => ({ ...prev, [doc.id]: status }));
          })
          .catch(() => setDocStatuses((prev) => ({ ...prev, [doc.id]: "NONE" })));
      });
    }).catch(console.error);
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const uploadFile = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf") { alert("Please upload a PDF file."); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", String(userId));
      await axios.post(`${API_URL}/api/docs/upload`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      fetchDocuments();
    } catch (err) {
      console.error("Failed to upload document", err);
      alert("Failed to upload document. Check console.");
    } finally { setUploading(false); }
  };

  const handleFileInputChange = (e) => { uploadFile(e.target.files?.[0]); e.target.value = ""; };
  const handleDrop = (e) => { e.preventDefault(); setDragActive(false); uploadFile(e.dataTransfer.files?.[0]); };
  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = () => setDragActive(false);

  // Signature box drag handlers
  const onMove = (e) => {
    if (!dragging.current) return;
    const rect = document.getElementById("pdf-wrapper").getBoundingClientRect();
    setPos({ x: e.clientX - rect.left - offset.current.x, y: e.clientY - rect.top - offset.current.y });
    setSaved(false);
  };
  const stopDrag = () => { dragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", stopDrag); };
  const startDrag = (e) => {
    e.preventDefault();
    dragging.current = true;
    const rect = document.getElementById("pdf-wrapper").getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left - pos.x, y: e.clientY - rect.top - pos.y };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stopDrag);
  };
  const handlePdfClick = (e) => {
    if (pos !== null) return;
    const rect = document.getElementById("pdf-wrapper").getBoundingClientRect();
    setPos({ x: e.clientX - rect.left - 70, y: e.clientY - rect.top - 25 });
  };
  const removeSignatureBox = (e) => { e.stopPropagation(); setPos(null); setSaved(false); };

  // Canvas drawing handlers
  const getCanvasPoint = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0];
    return {
      x: (touch ? touch.clientX : e.clientX) - rect.left,
      y: (touch ? touch.clientY : e.clientY) - rect.top,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const point = getCanvasPoint(e, canvas);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    lastPoint.current = point;
    setIsDrawing(true);
    setHasDrawing(true);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const point = getCanvasPoint(e, canvas);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = signatureColor.hex;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
  };

  const stopDrawing = () => { setIsDrawing(false); lastPoint.current = null; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  };

  const getDrawnSignatureBase64 = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawing) return null;
    return canvas.toDataURL("image/png").split(",")[1]; // return base64 only
  };

  const saveSignature = async () => {
    if (!selectedDocId || !pos) return null;
    setSaving(true);
    try {
      const scale = pdfNativeSize.width / 600;
      const fontNameMap = { "Allura, cursive": "Allura", "Arial, sans-serif": "Plain" };
      const fontName = fontNameMap[signatureFont] || "Allura";

      const payload = {
        documentId: selectedDocId,
        userId: userId,
        x: Math.round(pos.x * scale),
        y: Math.round(pos.y * scale),
        pageNumber: 1,
        signerName: signerName || "User",
        signatureColor: signatureColor.rgb.join(","),
        fontName: fontName,
      };

      // If draw tab is active and has drawing, include base64 image
      if (signatureTab === "draw" && hasDrawing) {
        payload.signatureImageBase64 = getDrawnSignatureBase64();
      }

      const res = await axios.post(`${API_URL}/api/signature/save`, payload);
      setSaved(true);
      fetchDocuments();
      return res.data.id;
    } catch (err) {
      console.error("Failed to save signature", err);
      alert("Failed to save. Check console.");
      return null;
    } finally { setSaving(false); }
  };

  const handleSendToSign = async () => {
    if (!recipientEmail) { alert("Please enter a recipient email."); return; }
    if (!pos) { alert("Please place your signature on the document first."); return; }
    setSendingLink(true);
    try {
      const signatureId = await saveSignature();
      if (!signatureId) return;
      await axios.post(`${API_URL}/api/signature/${signatureId}/send-link`, { email: recipientEmail });
      setLinkSent(true);
    } catch (err) {
      console.error("Failed to send signing link", err);
      alert("Failed to send signing link. Check console.");
    } finally { setSendingLink(false); }
  };

  const handleGenerateSignedPdf = async () => {
    if (!pos) { alert("Please place your signature on the document first."); return; }
    const signatureId = await saveSignature();
    if (!signatureId || !selectedDocId) return;
    window.open(`${API_URL}/api/signature/generate/${selectedDocId}`, "_blank");
  };

  const handleDeleteDocument = async (docId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    try {
      await axios.delete(`${API_URL}/api/docs/${docId}`);
      if (selectedDocId === docId) { setSelectedPdf(null); setSelectedDocId(null); setSignMode(null); setPos(null); }
      fetchDocuments();
    } catch (err) {
      console.error("Failed to delete document", err);
      alert("Failed to delete document. Check console.");
    }
  };

  const filteredDocs = documents.filter((doc) => filter === "ALL" || (docStatuses[doc.id] || "NONE") === filter);
  const filterOptions = [{ key: "ALL", label: "All" }, { key: "PENDING", label: "Pending" }, { key: "SIGNED", label: "Signed" }, { key: "REJECTED", label: "Rejected" }];

  const tabStyle = (active) => ({
    padding: "6px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    borderBottom: active ? "2px solid #1a73e8" : "2px solid transparent",
    background: "none",
    color: active ? "#1a73e8" : "#6b7280",
  });

  return (
    <div style={{ padding: 24, fontFamily: "Segoe UI, Arial, sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#e6f1fb", color: "#185fa5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 16 }}>S</div>
          <h1 style={{ margin: 0, fontSize: 22 }}>SecureSign</h1>
        </div>
        <button onClick={onLogout} style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, color: "#6b7280", background: "transparent", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}>Log out</button>
      </div>
      <p style={{ color: "#666", marginTop: 4, marginBottom: 24 }}>Manage, sign, and track the status of your documents.</p>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {/* Left panel */}
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>My Documents</h2>
            <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${dragActive ? "#1a73e8" : "#d1d5db"}`, borderRadius: 10, padding: "20px 16px", textAlign: "center", marginBottom: 16, cursor: "pointer", background: dragActive ? "#f5f9ff" : "#fafafa", transition: "border-color 0.15s, background 0.15s" }}>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileInputChange} style={{ display: "none" }} />
              {uploading ? <p style={{ margin: 0, fontSize: 13, color: "#1a73e8", fontWeight: 600 }}>Uploading...</p> : (
                <>
                  <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#444" }}>Drag and drop a PDF here</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#999" }}>or click to browse files</p>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {filterOptions.map((opt) => (
                <button key={opt.key} onClick={() => setFilter(opt.key)}
                  style={{ padding: "5px 12px", borderRadius: 16, border: filter === opt.key ? "1px solid #1a73e8" : "1px solid #ddd", background: filter === opt.key ? "#e8f0fe" : "#fff", color: filter === opt.key ? "#1a73e8" : "#444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {filteredDocs.length === 0 && <p style={{ color: "#999", fontSize: 13 }}>No documents match this filter.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredDocs.map((doc) => {
                const status = docStatuses[doc.id] || "NONE";
                const isActive = selectedDocId === doc.id;
                return (
                  <div key={doc.id}
                    onClick={() => { setSelectedPdf(`${API_URL}/api/docs/view/${doc.id}`); setSelectedDocId(doc.id); setSaved(false); setPos(null); setSignMode(null); setRecipientEmail(""); setLinkSent(false); clearCanvas(); }}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, border: isActive ? "1px solid #1a73e8" : "1px solid #eee", background: isActive ? "#f5f9ff" : "#fafafa", cursor: "pointer", transition: "background 0.15s" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8, flex: 1 }}>{doc.fileName}</span>
                    <StatusBadge status={status} />
                    <button onClick={(e) => handleDeleteDocument(doc.id, e)} title="Delete document"
                      style={{ marginLeft: 8, background: "none", border: "none", color: "#c62828", cursor: "pointer", fontSize: 14, padding: "2px 6px", borderRadius: 4, lineHeight: 1 }}>ðŸ—‘ï¸</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: "2 1 500px", minWidth: 320 }}>
          {!selectedPdf && (
            <div style={{ background: "#fff", border: "1px dashed #ddd", borderRadius: 10, padding: 40, textAlign: "center", color: "#999" }}>
              Select a document from the left to preview and place your signature.
            </div>
          )}

          {selectedPdf && !signMode && (
            <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Who will sign this document?</h2>
              <p style={{ color: "#666", fontSize: 13, marginTop: 0, marginBottom: 20 }}>Choose how you want to proceed</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <div onClick={() => setSignMode("only_me")} style={{ border: "1px solid #e0e0e0", borderRadius: 10, padding: 20, cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1a73e8")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e0e0e0")}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "#e6f1fb", color: "#185fa5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>1</div>
                  <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Only me</p>
                  <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Sign this document yourself right now</p>
                </div>
                <div onClick={() => setSignMode("several")} style={{ border: "1px solid #e0e0e0", borderRadius: 10, padding: 20, cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1a73e8")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e0e0e0")}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "#e1f5ee", color: "#0f6e56", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>2+</div>
                  <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Several people</p>
                  <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Invite others to sign via email link</p>
                </div>
              </div>
            </div>
          )}

          {selectedPdf && signMode && (
            <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <button onClick={() => { setSignMode(null); setPos(null); setSaved(false); clearCanvas(); }}
                  style={{ background: "none", border: "none", color: "#1a73e8", fontSize: 13, cursor: "pointer", padding: 0 }}>â† Back</button>
                <StatusBadge status={docStatuses[selectedDocId] || "NONE"} />
              </div>
              <h2 style={{ margin: "8px 0 12px", fontSize: 18 }}>{signMode === "only_me" ? "Sign document" : "Send for signature"}</h2>

              {/* Signature Setup Panel */}
              <div style={{ border: "1px solid #e0e0e0", borderRadius: 10, padding: 16, marginBottom: 16, background: "#fafafa" }}>
                <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px", color: "#333" }}>Set your signature</p>

                {/* Tabs */}
                <div style={{ display: "flex", borderBottom: "1px solid #e0e0e0", marginBottom: 12 }}>
                  <button style={tabStyle(signatureTab === "type")} onClick={() => setSignatureTab("type")}>Type</button>
                  <button style={tabStyle(signatureTab === "draw")} onClick={() => setSignatureTab("draw")}>Draw</button>
                </div>

                {signatureTab === "type" && (
                  <>
                    <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>Full name</label>
                    <input type="text" placeholder="Your name" value={signerName} onChange={(e) => setSignerName(e.target.value)}
                      style={{ width: "100%", maxWidth: 280, padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />

                    <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 6 }}>Choose a style</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      {[{ label: "Elegant", font: "Allura, cursive" }, { label: "Plain", font: "Arial, sans-serif" }].map((opt) => (
                        <div key={opt.label} onClick={() => setSignatureFont(opt.font)}
                          style={{ flex: "1 1 110px", minWidth: 100, border: signatureFont === opt.font ? "2px solid #1a73e8" : "1px solid #d1d5db", borderRadius: 8, padding: "10px 8px", textAlign: "center", cursor: "pointer", background: "#fff" }}>
                          <div style={{ fontFamily: opt.font, fontSize: opt.label === "Plain" ? 16 : 22, color: signatureColor.hex, marginBottom: 4, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                            {signerName || "Your Name"}
                          </div>
                          <div style={{ fontSize: 11, color: "#999" }}>{opt.label}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {signatureTab === "draw" && (
                  <div>
                    <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px" }}>Draw your signature below using your mouse or finger:</p>
                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={120}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      style={{
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        cursor: "crosshair",
                        background: "#fff",
                        display: "block",
                        touchAction: "none",
                        width: "100%",
                        maxWidth: 400,
                      }}
                    />
                    <button onClick={clearCanvas}
                      style={{ marginTop: 8, padding: "5px 14px", fontSize: 12, color: "#c62828", background: "#fff", border: "1px solid #c62828", borderRadius: 6, cursor: "pointer" }}>
                      Clear
                    </button>
                    {!hasDrawing && <p style={{ fontSize: 12, color: "#999", marginTop: 6 }}>Start drawing above to create your signature.</p>}
                    {hasDrawing && <p style={{ fontSize: 12, color: "#2e7d32", marginTop: 6 }}>âœ“ Signature drawn â€” place it on the document below.</p>}
                  </div>
                )}

                {/* Color picker â€” shown in both tabs */}
                <label style={{ display: "block", fontSize: 12, color: "#666", margin: "12px 0 6px" }}>Choose a color</label>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {SIGNATURE_COLORS.map((c) => (
                    <div key={c.label} onClick={() => { setSignatureColor(c); if (signatureTab === "draw") clearCanvas(); }} title={c.label}
                      style={{ width: 28, height: 28, borderRadius: "50%", background: c.hex, cursor: "pointer", border: signatureColor.label === c.label ? "3px solid #1a73e8" : "2px solid #fff", boxShadow: signatureColor.label === c.label ? "0 0 0 2px #1a73e8" : "0 0 0 1px #d1d5db", transition: "box-shadow 0.15s" }} />
                  ))}
                  <span style={{ fontSize: 12, color: "#666", marginLeft: 4 }}>{signatureColor.label}</span>
                </div>
              </div>

              <p style={{ color: "#666", fontSize: 13, margin: "0 0 4px" }}>
                {pos ? "Drag your signature to reposition it, or click âœ• to remove it." : "Click on the document to place your signature."}
              </p>
              {pos && <p style={{ color: "#999", fontSize: 12, margin: "0 0 8px" }}>Position: X {Math.round(pos.x)} | Y {Math.round(pos.y)}</p>}

              {signMode === "only_me" && (
                <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <button onClick={handleGenerateSignedPdf} disabled={saving || !pos || (signatureTab === "draw" && !hasDrawing)}
                    style={{ padding: "8px 20px", background: (saving || !pos || (signatureTab === "draw" && !hasDrawing)) ? "#9ca3af" : "#1a73e8", color: "white", border: "none", borderRadius: 6, cursor: (saving || !pos || (signatureTab === "draw" && !hasDrawing)) ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: 14 }}>
                    {saving ? "Generating..." : "Generate signed PDF"}
                  </button>
                  {saved && <span style={{ color: "green", fontWeight: "bold", fontSize: 13 }}>âœ“ Signature placed â€” opening signed PDF</span>}
                </div>
              )}

              {signMode === "several" && (
                <div style={{ marginBottom: 12 }}>
                  {!linkSent ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <input type="email" placeholder="recipient@example.com" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)}
                        style={{ flex: "1 1 220px", padding: "8px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, outline: "none" }} />
                      <button onClick={handleSendToSign} disabled={sendingLink || !pos}
                        style={{ padding: "8px 20px", background: sendingLink || !pos ? "#9ca3af" : "#1a73e8", color: "white", border: "none", borderRadius: 6, cursor: sendingLink || !pos ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: 14, whiteSpace: "nowrap" }}>
                        {sendingLink ? "Sending..." : "Send to sign"}
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: "green", fontWeight: "bold", fontSize: 13 }}>âœ“ Signing link sent to {recipientEmail}</span>
                  )}
                </div>
              )}

              {/* PDF wrapper */}
              <div id="pdf-wrapper" onClick={handlePdfClick}
                style={{ position: "relative", display: "inline-block", userSelect: "none", border: "1px solid #eee", borderRadius: 6, overflow: "hidden", cursor: pos ? "default" : "crosshair" }}>
                <Document file={selectedPdf}>
                  <Page pageNumber={1} width={600} renderTextLayer={false} renderAnnotationLayer={false}
                    onLoadSuccess={(page) => setPdfNativeSize({ width: page.originalWidth, height: page.originalHeight })} />
                </Document>

                {pos && (
                  <div style={{
                    position: "absolute", left: pos.x, top: pos.y,
                    minWidth: signatureTab === "draw" ? 160 : 140,
                    maxWidth: 220, height: signatureTab === "draw" ? 60 : 50,
                    background: "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 6, userSelect: "none", zIndex: 999,
                    border: saved ? `2px solid ${signatureColor.hex}` : "2px dashed #1a73e8",
                    overflow: "visible",
                  }}>
                    {signatureTab === "draw" && hasDrawing ? (
                      <canvas
                        onMouseDown={startDrag}
                        style={{
                          width: "100%", height: "100%",
                          cursor: "grab",
                          pointerEvents: "all",
                          display: "block",
                          imageRendering: "crisp-edges",
                        }}
                        ref={(miniCanvas) => {
                          if (!miniCanvas || !canvasRef.current) return;
                          const ctx = miniCanvas.getContext("2d");
                          miniCanvas.width = miniCanvas.offsetWidth;
                          miniCanvas.height = miniCanvas.offsetHeight;
                          ctx.drawImage(canvasRef.current, 0, 0, miniCanvas.width, miniCanvas.height);
                        }}
                      />
                    ) : (
                      <span onMouseDown={startDrag}
                        style={{ cursor: "grab", flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", color: signatureColor.hex, fontFamily: signatureFont, fontSize: signatureFont.includes("Arial") ? 16 : 26, fontWeight: signatureFont.includes("Arial") ? 600 : 400, whiteSpace: "nowrap" }}>
                        {signerName || "Your Signature"}
                      </span>
                    )}
                    <span onClick={removeSignatureBox} title="Remove signature"
                      style={{ position: "absolute", top: -10, right: -10, width: 20, height: 20, borderRadius: "50%", background: "#c62828", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, cursor: "pointer", fontWeight: "bold", lineHeight: 1, zIndex: 1000 }}>âœ•</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}