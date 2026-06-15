import { useEffect, useState } from "react";
import axios from "axios";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PublicSign({ token }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionDone, setActionDone] = useState(null); // null | "accepted" | "rejected"
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

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

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p style={{ textAlign: "center", color: "#6b7280" }}>Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <Brand />
          <p style={{ color: "#c62828", marginTop: 16 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <Brand />

        <h2 style={{ margin: "16px 0 4px", fontSize: 20, fontWeight: 600 }}>
          {info.fileName}
        </h2>

        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
          You've been asked to review and sign this document.
        </p>

        <div style={pdfWrapperStyle}>
          <Document file={`${API_URL}${info.viewUrl}`}>
            <Page pageNumber={1} width={Math.min(560, window.innerWidth - 60)} renderTextLayer={false} renderAnnotationLayer={false} />
          </Document>
        </div>

        {actionDone === "accepted" && (
          <div style={successBoxStyle}>
            ✓ You've signed this document. Thank you!
          </div>
        )}

        {actionDone === "rejected" && (
          <div style={rejectedBoxStyle}>
            You've declined to sign this document.
          </div>
        )}

        {!actionDone && info.status === "PENDING" && (
          <>
            {!showRejectInput ? (
              <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                <button
                  onClick={handleAccept}
                  disabled={actionLoading}
                  style={acceptButtonStyle(actionLoading)}
                >
                  {actionLoading ? "Signing..." : "Accept & Sign"}
                </button>
                <button
                  onClick={() => setShowRejectInput(true)}
                  disabled={actionLoading}
                  style={rejectButtonStyle}
                >
                  Decline
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <label style={{ display: "block", fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                  Reason (optional)
                </label>
                <input
                  type="text"
                  placeholder="Let them know why you're declining"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    style={rejectButtonStyle}
                  >
                    {actionLoading ? "Submitting..." : "Confirm decline"}
                  </button>
                  <button
                    onClick={() => setShowRejectInput(false)}
                    disabled={actionLoading}
                    style={cancelButtonStyle}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {!actionDone && info.status === "SIGNED" && (
          <div style={successBoxStyle}>✓ This document has already been signed.</div>
        )}

        {!actionDone && info.status === "REJECTED" && (
          <div style={rejectedBoxStyle}>This document was declined.</div>
        )}
      </div>
    </div>
  );
}

function Brand() {
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
      <span style={{ fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>SecureSign</span>
    </div>
  );
}

const containerStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f7f8fa",
  fontFamily: "Segoe UI, Arial, sans-serif",
  padding: 20,
};

const cardStyle = {
  width: "100%",
  maxWidth: 640,
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  padding: "24px 28px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const pdfWrapperStyle = {
  border: "1px solid #eee",
  borderRadius: 6,
  overflow: "hidden",
  display: "flex",
  justifyContent: "center",
  background: "#fafafa",
};

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 14,
  border: "1px solid #d1d5db",
  borderRadius: 6,
  outline: "none",
  boxSizing: "border-box",
};

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

const rejectButtonStyle = {
  flex: 1,
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  color: "#c62828",
  background: "#fff",
  border: "1px solid #c62828",
  borderRadius: 6,
  cursor: "pointer",
};

const cancelButtonStyle = {
  flex: 1,
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  color: "#6b7280",
  background: "#fff",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  cursor: "pointer",
};

const successBoxStyle = {
  marginTop: 16,
  padding: "12px 16px",
  borderRadius: 8,
  background: "#e8f5e9",
  color: "#2e7d32",
  fontWeight: 600,
  fontSize: 14,
};

const rejectedBoxStyle = {
  marginTop: 16,
  padding: "12px 16px",
  borderRadius: 8,
  background: "#fdecea",
  color: "#c62828",
  fontWeight: 600,
  fontSize: 14,
};