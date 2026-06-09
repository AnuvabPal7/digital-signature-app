import { useEffect, useState } from "react";
import axios from "axios";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./App.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState(null);

  useEffect(() => {
    axios
      .get("http://localhost:8080/api/docs/user/1")
      .then((response) => {
        setDocuments(response.data);
      })
      .catch((error) => {
        console.error("Error fetching documents:", error);
      });
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Digital Signature App</h1>

      <h2>My Documents</h2>

      <p>Documents found: {documents.length}</p>

      {documents.length === 0 ? (
        <p>No documents found.</p>
      ) : (
        <ul>
          {documents.map((doc) => (
            <li key={doc.id}>
              <button
                onClick={() =>
                  setSelectedPdf(
                    `http://localhost:8080/api/docs/view/${doc.id}`
                  )
                }
              >
                {doc.fileName}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedPdf && (
        <div style={{ marginTop: "20px" }}>
          <h2>PDF Preview</h2>

          <div
            style={{
              position: "relative",
              display: "inline-block",
            }}
          >
            <Document file={selectedPdf}>
              <Page pageNumber={1} />
            </Document>

            <div
              style={{
                position: "absolute",
                top: "100px",
                left: "100px",
                width: "120px",
                height: "40px",
                backgroundColor: "#4CAF50",
                color: "white",
                textAlign: "center",
                lineHeight: "40px",
                borderRadius: "5px",
                fontWeight: "bold",
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

export default App;