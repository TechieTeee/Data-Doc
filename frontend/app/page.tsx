"use client";
import { useState } from "react";
import axios from "axios";
import { RainbowKitProvider, ConnectButton, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";

const config = getDefaultConfig({
  appName: "Data Doc",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "placeholder_id",
  chains: [sepolia],
  ssr: false,
});

const queryClient = new QueryClient();

type UploadResult = {
  ipfsCid: string;
  storachaCid: string;
  eigenDAId: string;
  datasetId: string;
  transactionHash: string;
  metadataCid: string;
  zkpProof: string;
};

type ErrorResult = {
  error: string;
  details: string;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | ErrorResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const uploadDataset = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("dataset", file);

    try {
      const response = await axios.post("http://localhost:3001/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      console.log("Upload response:", response.data);
      setResult(response.data as UploadResult);
    } catch (error: any) {
      console.error("Upload error:", error);
      setResult({
        error: "Upload failed",
        details: error.response?.data?.details || error.message || "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="p-6 bg-gray-800 rounded-lg max-w-md w-full">
              <h1 className="text-2xl text-cyan-400 mb-4 font-bold">Data Doc</h1>

              <div className="mb-6 flex justify-end">
                <ConnectButton />
              </div>

              <div className="mb-4">
                <label className="block text-gray-300 mb-2">Select CSV Dataset</label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".csv"
                  className="w-full p-2 text-gray-300 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                onClick={uploadDataset}
                disabled={!file || loading}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-2 px-4 rounded disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Uploading..." : "Upload Dataset"}
              </button>

              {loading && (
                <div className="mt-4 text-center">
                  <p className="text-cyan-300">Uploading dataset...</p>
                  <p className="text-gray-400 text-sm mt-1">This may take a moment</p>
                </div>
              )}

              {result && (
                <div className="mt-6 p-4 bg-gray-700 rounded-lg">
                  <h2 className="text-xl text-cyan-400 mb-3">
                    {"error" in result ? "Error" : "Upload Successful"}
                  </h2>

                  {"error" in result ? (
                    <div className="text-red-400">
                      <p className="font-medium">{result.error}</p>
                      <p className="text-sm mt-1">{result.details}</p>
                    </div>
                  ) : (
                    <div className="text-gray-200 space-y-2">
                      <p>
                        <span className="text-cyan-300">IPFS CID:</span> {result.ipfsCid}
                      </p>
                      <p>
                        <span className="text-cyan-300">Storacha CID:</span>{" "}
                        {result.storachaCid}
                      </p>
                      <p>
                        <span className="text-cyan-300">EigenDA ID:</span>{" "}
                        {result.eigenDAId}
                      </p>
                      <p>
                        <span className="text-cyan-300">Dataset ID:</span>{" "}
                        {result.datasetId}
                      </p>
                      <p>
                        <span className="text-cyan-300">Metadata CID:</span>{" "}
                        {result.metadataCid}
                      </p>
                      <p>
                        <span className="text-cyan-300">ZKP Proof:</span> {result.zkpProof}
                      </p>
                      <div>
                        <span className="text-cyan-300">Transaction:</span>{" "}
                        <span className="text-gray-400">{result.transactionHash}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}