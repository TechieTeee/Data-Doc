"use client";
import { useState } from "react";
import axios from "axios";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFile(e.target.files[0]);
  };

  const uploadDataset = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("dataset", file);
    const res = await axios.post("http://localhost:3001/upload", formData);
    setResult(res.data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="p-8 bg-gray-800 rounded-lg">
        <h1 className="text-3xl text-cyan-400">Data Doc</h1>
        <input type="file" onChange={handleFileChange} className="my-4" />
        <button onClick={uploadDataset} disabled={!file} className="bg-cyan-500 p-2 rounded">
          Upload
        </button>
        {result && (
          <div className="mt-4">
            <p>IPFS CID: {result.ipfsCid}</p>
            <p>EigenDA ID: {result.eigenDAId}</p>
            <p>Dataset ID: {result.datasetId}</p>
          </div>
        )}
      </div>
    </div>
  );
}