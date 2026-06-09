import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    axios
      .get("http://localhost:8080/api/docs/user/1")
      .then((response) => {
        console.log("API Response:", response.data);
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
              <a
                href={`http://localhost:8080/api/docs/view/${doc.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {doc.fileName}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;