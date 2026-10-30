import { useState, ChangeEvent } from 'react';
import './UploadDoc.css';
import { backendFetch } from '../services/api';

// Per-file outcome of POST /uploadMongo
interface UploadResult {
  fileName: string;
  ok: boolean;
  message: string;
}

type UploadStatus = "idle" | "uploading" | "done";

interface UploadDocProps {
  onUploaded?: () => void;  // called once a batch with at least one saved record finishes
}

function UploadDoc({ onUploaded }: UploadDocProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [results, setResults] = useState<UploadResult[]>([]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
      setResults([]);
      setStatus("idle");
    }
  };

  // Send each PDF to the backend, which extracts it and stores it as the ground-truth record
  const uploadOne = async (file: File): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file_upload", file);
    try {
      const response = await backendFetch("/uploadMongo", { method: "POST", body: formData });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { fileName: file.name, ok: false, message: body.detail ?? `Server error ${response.status}` };
      }
      return { fileName: file.name, ok: true, message: `Saved Roll No ${body.roll_no}, Semester ${body.semester}` };
    } catch (e) {
      const message = e instanceof Error && e.message.includes("sign in") ? e.message : "Could not reach the verification server.";
      return { fileName: file.name, ok: false, message };
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert("Please select files first!");
      return;
    }
    setStatus("uploading");
    const uploaded: UploadResult[] = [];
    for (const file of selectedFiles) {
      uploaded.push(await uploadOne(file));
      setResults([...uploaded]);
    }
    setStatus("done");
    if (uploaded.some(r => r.ok)) onUploaded?.();
  };

  return (
    <div className="app-container">
      <div className="upload-card" style={{ width: '450px' }}>
        <h2>Upload pdf file</h2>

        <div className="file-input-wrapper">
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={handleFileChange}
          />
        </div>

        {selectedFiles.length > 0 && (
          <div className="file-info">
            <p><strong>Selected Files ({selectedFiles.length}):</strong></p>
            <ul style={{textAlign:'left', paddingLeft:'20px'}}>
              {selectedFiles.map((file, index) => (
                <li key={index}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={status === "uploading"}
          className="upload-btn"
        >
          {status === "uploading" ? `Uploading ${results.length + 1}/${selectedFiles.length}...` : "Upload"}
        </button>

        {results.length > 0 && (
          <ul style={{textAlign:'left', marginTop: '10px'}}>
            {results.map((r, index) => (
              <li key={index} className={r.ok ? "success-msg" : "error-msg"}>
                {r.ok ? "✅" : "❌"} {r.fileName}: {r.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default UploadDoc;
