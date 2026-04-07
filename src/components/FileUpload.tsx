"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X } from "lucide-react";

interface FileUploadProps {
  onUpload: (text: string, fileName: string, docxBase64: string) => void;
  isLoading?: boolean;
}

export function FileUpload({ onUpload, isLoading }: FileUploadProps) {
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setError(null);
      setUploading(true);

      const formData = new FormData();
      formData.append("resume", file);

      try {
        const res = await fetch("/api/parse-resume", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Upload failed");
        }
        const { text, fileName, docxBase64 } = await res.json();
        setUploadedFile({ name: fileName, size: file.size });
        onUpload(text, fileName, docxBase64 ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    disabled: isLoading || uploading,
  });

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (uploadedFile) {
    return (
      <div className="border-2 border-green-300 bg-green-50 rounded-lg p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-green-600" />
          <div>
            <p className="font-medium text-green-800">{uploadedFile.name}</p>
            <p className="text-sm text-green-600">{formatBytes(uploadedFile.size)}</p>
          </div>
        </div>
        <button
          onClick={() => setUploadedFile(null)}
          className="p-1.5 rounded-lg text-green-600 hover:bg-green-100 hover:text-green-800 transition-all duration-150 active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
        } ${isLoading || uploading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        {uploading ? (
          <p className="text-gray-600">Uploading...</p>
        ) : isDragActive ? (
          <p className="text-blue-600 font-medium">Drop your resume here</p>
        ) : (
          <>
            <p className="text-gray-700 font-medium">Drag & drop your resume here</p>
            <p className="text-sm text-gray-500 mt-1">or click to browse files</p>
            <p className="text-xs text-gray-400 mt-2">DOCX or PDF files (.docx, .pdf)</p>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
