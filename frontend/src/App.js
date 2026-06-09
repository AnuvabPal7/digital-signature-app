import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./App.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [pos, setPos] = useState({ x: 100, y: 100 });

  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    axios
      .get("http://localhost:8080/api/docs/user/1")
      .then((res) => setDocuments(res.data))
      .catch(console.error);
  }, []);

  const onMove = (e) => {
    if (!dragging.current) return;
    const rect = document.getElementById("pdf-wrapper").getBoundingClientRect();
    setPos({
      x: e.clientX - rect.left - offset.current.x,
      y: e.clientY - rect.top - offset.current.y,
    });
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

  return (
    <div style={{ padding: 20 }}>
      <h1>Digital Signature App</h1>

      <h2>My Documents</h2>

      <ul>
        {documents.map((doc) => (
          <li key={doc.id}>
            <button
              onClick={() =>
                setSelectedPdf(`http://localhost:8080/api/docs/view/${doc.id}`)
              }
            >
              {doc.fileName}
            </button>
          </li>
        ))}
      </ul>

      {selectedPdf && (
        <div>
          <h2>PDF Preview</h2>

          <p>
            X: {Math.round(pos.x)} | Y: {Math.round(pos.y)}
          </p>

          <div
            id="pdf-wrapper"
            style={{
              position: "relative",
              display: "inline-block",
              userSelect: "none",
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
                background: "green",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 6,
                cursor: "grab",
                fontWeight: "bold",
                userSelect: "none",
                zIndex: 999,
              }}
            >
              Signature
            </div>
          </div>
        </div>
      )}
    </div>
  );
}