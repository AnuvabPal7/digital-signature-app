import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useDarkMode, getTheme, DarkModeToggle } from "./theme";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const SIGNATURE_COLORS = [
  { label: "Black", hex: "#1a1a1a", rgb: [26, 26, 26] },
  { label: "Blue", hex: "#185fa5", rgb: [24, 95, 165] },
  { label: "Red", hex: "#c62828", rgb: [198, 40, 40] },
  { label: "Green", hex: "#2e7d32", rgb: [46, 125, 50] },
  { label: "Purple", hex: "#6a1b9a", rgb: [106, 27, 154] },
];

export default function PublicSign({ token }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionDone, setActionDone] = useState(null); // null | "accepted" | "rejected"
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [pdfNativeSize, setPdfNativeSize] = useState({ width: 612, height: 792 });
  const [renderWidth, setRenderWidth] = useState(560);

  // SIGNER-only state: recipient creates their own signature here.
  const [signerTab, setSignerTab] = useState("type"); // "type" | "draw"
  const [typedName, setTypedName] = useState("");
  const [typedFont, setTypedFont] = useState("Allura");
  const [signColor, setSignColor] = useState(SIGNATURE_COLORS[1]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const canvasRef = useRef(null);
  const [isDark, setIsDark] = useDarkMode();
  const theme = getTheme(isDark);

  useEffect(() => {
    axios
      .get(`${API_URL}/api/public/sign/${token}`)
      .then((res) => setInfo(res.data))
      .catch((err) => {
        console.error(err);
        setError("This signing link is invalid or has expired.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/public/sign/${token}/accept`);
      setActionDone("accepted");
    } catch (err) {
      console.error(err);
      alert("Failed to sign the document. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/public/sign/${token}/reject`, {
        reason: rejectionReason || "No reason provided",
      });
      setActionDone("rejected");
    } catch (err) {
      console.error(err);
      alert("Failed to reject the document. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // --- SIGNER: canvas drawing handlers (same pattern as the dashboard's own signing flow) ---
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
    ctx.strokeStyle = signColor.hex;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };
  const stopDrawing = () => setIsDrawing(false);
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  };
  const getDrawnBase64 = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawing) return null;
    return canvas.toDataURL("image/png").split(",")[1];
  };

  const handleSubmitSignature = async () => {
    if (signerTab === "type" && !typedName.trim()) {
      alert("Type your name, or switch to Draw and draw your signature.");
      return;
    }
    if (signerTab === "draw" && !hasDrawing) {
      alert("Draw your signature, or switch to Type and type your name.");
      return;
    }
    setActionLoading(true);
    try {
      const payload = {
        signerName: signerTab === "type" ? typedName.trim() : "",
        fontName: signerTab === "type" ? typedFont : null,
        signatureColor: signColor.rgb.join(","),
      };
      if (signerTab === "draw") {
        payload.signatureImageBase64 = getDrawnBase64();
      }
      await axios.post(`${API_URL}/api/public/sign/${token}/submit-signature`, payload);
      setActionDone("accepted");
    } catch (err) {
      console.error(err);
      alert("Failed to submit your signature. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={containerStyle(theme)}>
        <div style={cardStyle(theme)}>
          <p style={{ textAlign: "center", color: theme.textMuted }}>Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle(theme)}>
        <div style={cardStyle(theme)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Brand theme={theme} />
            <DarkModeToggle isDark={isDark} setIsDark={setIsDark} />
          </div>
          <p style={{ color: "#c62828", marginTop: 16 }}>{error}</p>
        </div>
      </div>
    );
  }

  const isSigner = info.role === "SIGNER";

  return (
    <div style={containerStyle(theme)}>
      <div style={cardStyle(theme)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Brand theme={theme} />
          <DarkModeToggle isDark={isDark} setIsDark={setIsDark} />
        </div>

        <h2 style={{ margin: "16px 0 4px", fontSize: 20, fontWeight: 600, color: theme.text }}>
          {info.fileName}
        </h2>

        <p style={{ fontSize: 13, color: theme.textMuted, margin: "0 0 16px" }}>
          {isSigner
            ? "You've been asked to add your signature to this document."
            : "You've been asked to review and sign this document."}
        </p>

        <div style={{ ...pdfWrapperStyle(theme), position: "relative", display: "inline-block" }}>
          <Document file={`${API_URL}${info.viewUrl}`}>
            <Page
              pageNumber={info.pageNumber || 1}
              width={renderWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onLoadSuccess={(page) => {
                setPdfNativeSize({ width: page.originalWidth, height: page.originalHeight });
                setRenderWidth(Math.min(560, window.innerWidth - 60));
              }}
            />
          </Document>

          {info.status === "PENDING" && !isSigner && (
            <div
              style={{
                position: "absolute",
                left: (info.x / pdfNativeSize.width) * renderWidth,
                top: (info.y / pdfNativeSize.width) * renderWidth,
                minWidth: 140,
                padding: "2px 10px",
                border: "none",
                borderRadius: 6,
                color: info.signatureColor ? `rgb(${info.signatureColor})` : "#185fa5",
                fontFamily: info.fontName === "Allura" ? "Allura, cursive" : "Arial, sans-serif",
                fontSize: info.fontName === "Allura" ? 26 : 16,
                fontWeight: info.fontName === "Allura" ? 400 : 600,
                background: "transparent",
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}
            >
              {info.hasDrawnImage ? "✍️ Drawn signature" : (info.signerName || "Signature here")}
            </div>
          )}

          {info.status === "PENDING" && isSigner && (
            <div
              style={{
                position: "absolute",
                left: (info.x / pdfNativeSize.width) * renderWidth,
                top: (info.y / pdfNativeSize.width) * renderWidth,
                minWidth: 140,
                padding: "6px 10px",
                border: "2px dashed #0f6e56",
                borderRadius: 6,
                color: "#0f6e56",
                fontSize: 12,
                fontWeight: 600,
                background: "rgba(255,255,255,0.9)",
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}
            >
              Sign here
            </div>
          )}
        </div>

        {actionDone === "accepted" && (
          <div style={successBoxStyle}>
            <p style={{ margin: "0 0 10px" }}>
              {isSigner
                ? "✓ Your signature has been added to the document."
                : "✓ You've approved this signature — thank you!"}
            </p>
            <a
              href={`${API_URL}/api/public/sign/${token}/download`}
              style={downloadButtonStyle}
            >
              ⬇ Download signed document
            </a>
          </div>
        )}

        {actionDone === "rejected" && (
          <div style={rejectedBoxStyle}>
            You've declined to sign this document.
          </div>
        )}

        {/* VALIDATOR flow: unchanged approve/decline */}
        {!actionDone && info.status === "PENDING" && !isSigner && (
          <>
            {!showRejectInput ? (
              <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                <button onClick={handleAccept} disabled={actionLoading} style={acceptButtonStyle(actionLoading)}>
                  {actionLoading ? "Signing..." : "Accept & Sign"}
                </button>
                <button onClick={() => setShowRejectInput(true)} disabled={actionLoading} style={rejectButtonStyle(theme)}>
                  Decline
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <label style={{ display: "block", fontSize: 13, color: theme.textMuted, marginBottom: 4 }}>
                  Reason (optional)
                </label>
                <input
                  type="text"
                  placeholder="Let them know why you're declining"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={inputStyle(theme)}
                />
                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                  <button onClick={handleReject} disabled={actionLoading} style={rejectButtonStyle(theme)}>
                    {actionLoading ? "Submitting..." : "Confirm decline"}
                  </button>
                  <button onClick={() => setShowRejectInput(false)} disabled={actionLoading} style={cancelButtonStyle(theme)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* SIGNER flow: recipient creates their own signature */}
        {!actionDone && info.status === "PENDING" && isSigner && !showRejectInput && (
          <div style={{ marginTop: 16 }}>
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16, marginBottom: 12, background: theme.surfaceAlt }}>
              <div style={{ display: "flex", borderBottom: `1px solid ${theme.border}`, marginBottom: 12 }}>
                <button onClick={() => setSignerTab("type")}
                  style={signerTabStyle(signerTab === "type", theme)}>Type</button>
                <button onClick={() => setSignerTab("draw")}
                  style={signerTabStyle(signerTab === "draw", theme)}>Draw</button>
              </div>

              {signerTab === "type" && (
                <>
                  <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Your name</label>
                  <input type="text" placeholder="Type your name" value={typedName}
                    onChange={(e) => setTypedName(e.target.value)} style={inputStyle(theme)} />
                  <div style={{ marginTop: 10, fontFamily: typedFont === "Allura" ? "Allura, cursive" : "Arial, sans-serif", fontSize: typedFont === "Allura" ? 24 : 16, color: signColor.hex }}>
                    {typedName || "Preview"}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => setTypedFont("Allura")}
                      style={{ ...miniButtonStyle, border: typedFont === "Allura" ? "2px solid #1a73e8" : "1px solid #d1d5db" }}>Elegant</button>
                    <button onClick={() => setTypedFont("Plain")}
                      style={{ ...miniButtonStyle, border: typedFont === "Plain" ? "2px solid #1a73e8" : "1px solid #d1d5db" }}>Plain</button>
                  </div>
                </>
              )}

              {signerTab === "draw" && (
                <div>
                  <p style={{ fontSize: 12, color: theme.textMuted, margin: "0 0 8px" }}>Draw your signature below:</p>
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
                    style={{ border: "1px solid #d1d5db", borderRadius: 6, cursor: "crosshair", background: "#fff", display: "block", touchAction: "none", width: "100%", maxWidth: 400 }}
                  />
                  <button onClick={clearCanvas} style={{ marginTop: 8, padding: "5px 14px", fontSize: 12, color: "#c62828", background: "#fff", border: "1px solid #c62828", borderRadius: 6, cursor: "pointer" }}>
                    Clear
                  </button>
                </div>
              )}

              <label style={{ display: "block", fontSize: 12, color: theme.textMuted, margin: "12px 0 6px" }}>Choose a color</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {SIGNATURE_COLORS.map((c) => (
                  <div key={c.label} onClick={() => { setSignColor(c); if (signerTab === "draw") clearCanvas(); }} title={c.label}
                    style={{ width: 26, height: 26, borderRadius: "50%", background: c.hex, cursor: "pointer", border: signColor.label === c.label ? "3px solid #1a73e8" : "2px solid #fff", boxShadow: signColor.label === c.label ? "0 0 0 2px #1a73e8" : "0 0 0 1px #d1d5db" }} />
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={handleSubmitSignature} disabled={actionLoading} style={acceptButtonStyle(actionLoading)}>
                {actionLoading ? "Submitting..." : "Submit signature"}
              </button>
              <button onClick={() => setShowRejectInput(true)} disabled={actionLoading} style={rejectButtonStyle(theme)}>
                Decline
              </button>
            </div>
          </div>
        )}

        {!actionDone && info.status === "PENDING" && isSigner && showRejectInput && (
          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", fontSize: 13, color: theme.textMuted, marginBottom: 4 }}>Reason (optional)</label>
            <input type="text" placeholder="Let them know why you're declining" value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)} style={inputStyle(theme)} />
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button onClick={handleReject} disabled={actionLoading} style={rejectButtonStyle(theme)}>
                {actionLoading ? "Submitting..." : "Confirm decline"}
              </button>
              <button onClick={() => setShowRejectInput(false)} disabled={actionLoading} style={cancelButtonStyle(theme)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {!actionDone && info.status === "SIGNED" && (
          <div style={successBoxStyle}>
            <p style={{ margin: "0 0 10px" }}>✓ This document has already been signed.</p>
            <a href={`${API_URL}/api/public/sign/${token}/download`} style={downloadButtonStyle}>
              ⬇ Download signed document
            </a>
          </div>
        )}

        {!actionDone && info.status === "REJECTED" && (
          <div style={rejectedBoxStyle}>This document was declined.</div>
        )}
      </div>
    </div>
  );
}

function signerTabStyle(active, theme) {
  return {
    padding: "6px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    borderBottom: active ? "2px solid #1a73e8" : "2px solid transparent",
    background: "none",
    color: active ? "#1a73e8" : theme.textMuted,
  };
}

const miniButtonStyle = {
  padding: "6px 12px",
  fontSize: 12,
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
};

function Brand({ theme }) {
  return (
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
      <span style={{ fontSize: 17, fontWeight: 600, color: theme.text }}>SecureSign</span>
    </div>
  );
}

const containerStyle = (theme) => ({
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: theme.pageBg,
  fontFamily: "Segoe UI, Arial, sans-serif",
  padding: 20,
});

const cardStyle = (theme) => ({
  width: "100%",
  maxWidth: 640,
  background: theme.surface,
  borderRadius: 12,
  border: `1px solid ${theme.border}`,
  padding: "24px 28px",
  boxShadow: theme.shadow,
});

const pdfWrapperStyle = (theme) => ({
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  overflow: "hidden",
  display: "flex",
  justifyContent: "center",
  background: theme.surfaceAlt,
});

const inputStyle = (theme) => ({
  width: "100%",
  padding: "9px 12px",
  fontSize: 14,
  border: `1px solid ${theme.inputBorder}`,
  borderRadius: 6,
  outline: "none",
  boxSizing: "border-box",
  background: theme.inputBg,
  color: theme.text,
});

const acceptButtonStyle = (loading) => ({
  flex: 1,
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  color: "#fff",
  background: loading ? "#9ca3af" : "#185fa5",
  border: "none",
  borderRadius: 6,
  cursor: loading ? "not-allowed" : "pointer",
});

const rejectButtonStyle = (theme) => ({
  flex: 1,
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  color: "#c62828",
  background: theme.surface,
  border: "1px solid #c62828",
  borderRadius: 6,
  cursor: "pointer",
});

const cancelButtonStyle = (theme) => ({
  flex: 1,
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  color: theme.textMuted,
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  cursor: "pointer",
});

const successBoxStyle = {
  marginTop: 16,
  padding: "12px 16px",
  borderRadius: 8,
  background: "rgba(46,125,50,0.15)",
  color: "#2e7d32",
  fontWeight: 600,
  fontSize: 14,
};

const downloadButtonStyle = {
  display: "inline-block",
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 700,
  color: "#fff",
  background: "#2e7d32",
  borderRadius: 6,
  textDecoration: "none",
};

const rejectedBoxStyle = {
  marginTop: 16,
  padding: "12px 16px",
  borderRadius: 8,
  background: "rgba(198,40,40,0.15)",
  color: "#c62828",
  fontWeight: 600,
  fontSize: 14,
};
