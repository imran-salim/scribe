import { useState } from "react";
import type { HistoryItem } from "../types";

type Props = {
  history: HistoryItem[];
};

export default function HistorySidebar({ history }: Props) {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  function handleCopy(item: HistoryItem) {
    navigator.clipboard.writeText(item.text).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div className="w-full md:w-80 bg-white shadow-xl rounded-2xl p-6 h-fit max-h-[80vh] overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-4">History</h2>
      {history.length === 0 ? (
        <p className="text-gray-400 text-sm italic">No past transcriptions found.</p>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <div key={item.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs text-gray-400">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
                <button
                  onClick={() => handleCopy(item)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedId === item.id ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-sm text-gray-700 line-clamp-3">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
