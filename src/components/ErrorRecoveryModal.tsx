import React, { useState } from 'react';
import { X, RefreshCw, FileText, Trash2, Download, HelpCircle } from 'lucide-react';

interface ErrorRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  error?: Error;
  onClearAndRestart: () => void;
  onLoadLastGoodState: () => void;
  onExportErrorReport: () => void;
  onContactSupport: () => void;
}

const ErrorRecoveryModal: React.FC<ErrorRecoveryModalProps> = ({
  isOpen,
  onClose,
  error,
  onClearAndRestart,
  onLoadLastGoodState,
  onExportErrorReport,
  onContactSupport,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        {/* Center modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              type="button"
              className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
              <RefreshCw className="h-6 w-6 text-red-600" />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Error Recovery Options
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  Choose how you'd like to recover from this error. Your workshop progress may be recoverable.
                </p>
              </div>

              {/* Recovery Options */}
              <div className="mt-4 space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Page
                </button>

                <button
                  onClick={onLoadLastGoodState}
                  className="w-full flex items-center justify-center px-4 py-2 border border-blue-300 shadow-sm text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Load Last Good State
                </button>

                <button
                  onClick={onClearAndRestart}
                  className="w-full flex items-center justify-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear & Restart
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={onExportErrorReport}
                    className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Export
                  </button>

                  <button
                    onClick={onContactSupport}
                    className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <HelpCircle className="w-3 h-3 mr-1" />
                    Support
                  </button>
                </div>
              </div>

              {/* Error Details */}
              {error && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showDetails ? 'Hide' : 'Show'} technical details
                  </button>
                  {showDetails && (
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                      {error.toString()}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorRecoveryModal;