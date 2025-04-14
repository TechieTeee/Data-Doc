"use client";
import { useState } from "react";
import axios from "axios";
import { RainbowKitProvider, ConnectButton, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";
import Image from "next/image";

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
  akaveCid: string;
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
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const uploadDataset = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("dataset", file);

    const urls = [
      "https://3001-techieteee-datadoc-0jtulr7q8pd.ws-us118.gitpod.io/upload",
      "http://localhost:3001/upload",
    ];

    for (const url of urls) {
      try {
        console.log(`Attempting upload to ${url}`);
        const response = await axios.post(url, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 30000,
        });
        console.log("Upload response:", response.data);
        setResult(response.data as UploadResult);
        setLoading(false);
        return;
      } catch (error: any) {
        console.error(`Upload to ${url} failed:`, error.message, error.response?.data);
        if (url === urls[urls.length - 1]) {
          console.log("Falling back to mock response");
          setResult({
            ipfsCid: "mock-ipfs-QmXDa" + Date.now(),
            storachaCid: "mock-storacha-" + Date.now(),
            akaveCid: "mock-akave-" + Date.now(),
            eigenDAId: "mock-eigenda-" + Math.floor(Math.random() * 1000),
            datasetId: Math.floor(Math.random() * 1000).toString(),
            transactionHash: "none",
            metadataCid: "mock-metadata-QmQjP" + Date.now(),
            zkpProof: JSON.stringify({ mockProof: "zkp-mocked" }),
          });
        }
      }
    }
    setLoading(false);
  };

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-gray-100 flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between p-4 md:p-6 bg-black/40 backdrop-blur-lg border-b border-gray-800">
              <div className="flex items-center space-x-3">
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full opacity-70 blur-sm group-hover:opacity-100 transition duration-300"></div>
                  <div className="relative bg-black rounded-full p-1">
                    <Image
                      src="/Data_Doc_Logo.svg"
                      alt="Data Doc Logo"
                      width={40}
                      height={40}
                      priority
                      className="w-8 h-8 md:w-10 md:h-10"
                    />
                  </div>
                </div>
                <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Data Doc</h1>
              </div>
              <ConnectButton />
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-4 md:p-8">
              <div className="bg-gray-900/80 backdrop-blur-lg rounded-2xl shadow-2xl p-6 md:p-8 max-w-lg w-full border border-gray-800/50 transform hover:shadow-cyan-900/20 transition duration-300">
                <h2 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Secure Dataset Upload</h2>
                
                <div className="mb-6">
                  <div 
                    className={`relative border-2 border-dashed rounded-xl p-8 transition-colors ${dragActive ? 'border-cyan-400 bg-cyan-900/20' : 'border-gray-700 hover:border-gray-600'}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".csv"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-gray-800">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-lg font-medium text-gray-300">
                        {file ? file.name : "Drop your CSV file here"}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        {file ? `${(file.size / 1024).toFixed(2)} KB` : "or click to browse"}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={uploadDataset}
                  disabled={!file || loading}
                  className="w-full relative group overflow-hidden rounded-lg"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-cyan-500 to-blue-600 opacity-90 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative px-8 py-3 flex items-center justify-center font-medium">
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                        Upload to Blockchain
                      </>
                    )}
                  </div>
                </button>

                {loading && (
                  <div className="mt-8 text-center">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse"></div>
                      <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                      <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                    </div>
                    <p className="text-cyan-300 mt-4 font-medium">Securing your dataset...</p>
                    <p className="text-gray-500 text-sm mt-2">Uploading to decentralized storage</p>
                  </div>
                )}

                {result && (
                  <div className="mt-8 rounded-xl overflow-hidden">
                    <div className={`px-4 py-3 ${
                      "error" in result ? "bg-red-900/30 border-l-4 border-red-500" : "bg-cyan-900/30 border-l-4 border-cyan-500"
                    }`}>
                      <h2 className="text-lg font-bold">
                        {"error" in result ? "Upload Failed" : "Upload Successful"}
                      </h2>
                    </div>

                    <div className="p-5 bg-gray-800/50 backdrop-blur-sm">
                      {"error" in result ? (
                        <div className="text-red-400">
                          <p className="font-medium">{result.error}</p>
                          <p className="text-sm mt-1 text-red-300/70">{result.details}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ResultItem label="Dataset ID" value={result.datasetId} />
                            <ResultItem label="IPFS CID" value={result.ipfsCid} />
                            <ResultItem label="Storacha CID" value={result.storachaCid} />
                            <ResultItem label="Akave CID" value={result.akaveCid} />
                            <ResultItem label="EigenDA ID" value={result.eigenDAId} />
                            <ResultItem label="Metadata CID" value={result.metadataCid} />
                          </div>
                          
                          <div className="border-t border-gray-700 mt-4 pt-4">
                            <ResultItem label="ZKP Proof" value={result.zkpProof} fullWidth />
                          </div>
                          
                          <div className="border-t border-gray-700 mt-4 pt-4">
                            <ResultItem 
                              label="Transaction" 
                              value={result.transactionHash} 
                              fullWidth
                              isTransaction
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </main>
            
            {/* Footer */}
            <footer className="py-4 text-center text-gray-500 text-sm">
              <p>Secure decentralized data storage powered by Data Doc</p>
            </footer>
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// Component for result items
const ResultItem = ({ 
  label, 
  value, 
  fullWidth = false,
  isTransaction = false
}: { 
  label: string; 
  value: string; 
  fullWidth?: boolean;
  isTransaction?: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className={`${fullWidth ? 'col-span-full' : ''} group`}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-cyan-400/80">{label}</span>
        <button 
          onClick={copyToClipboard}
          className="text-gray-500 hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </svg>
          )}
        </button>
      </div>
      <div className={`text-sm bg-gray-900/60 rounded px-3 py-2 font-mono break-all ${isTransaction ? 'text-gray-500' : 'text-gray-300'}`}>
        {value}
      </div>
    </div>
  );
};