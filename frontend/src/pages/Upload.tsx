import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { uploadComments } from '../services/api';
import { useConsultation } from '../context/ConsultationContext';
import { Upload as UploadIcon, FileText, CheckCircle, Download, ArrowRight, GitCompare, LayoutDashboard, Loader2, AlertTriangle, XCircle, Info } from 'lucide-react';
import type { UploadResult } from '../types';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [replace, setReplace] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [showErrors, setShowErrors] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { refreshConsultations, setSelectedConsultationId } = useConsultation();

  useEffect(() => {
    let interval: any;
    if (loading) {
      setLoadingStep(1); // File Selected
      setTimeout(() => setLoadingStep(2), 800); // Schema detected
      setTimeout(() => setLoadingStep(3), 1600); // Validation
      setTimeout(() => setLoadingStep(4), 2400); // Analysis
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    if (!f.name.endsWith('.csv')) {
      setError('Please upload a valid .csv file.');
      return;
    }
    setError(null);
    setFile(f);
    if (!title) {
      const baseName = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file to upload.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setShowErrors(false);

    try {
      const res = await uploadComments(file, undefined, replace, title.trim() || undefined);
      setResult(res);
      await refreshConsultations();
      if (res.consultation_id) {
        setSelectedConsultationId(res.consultation_id);
      }
    } catch (err: any) {
      setError(
        err.friendlyMessage ||
        err?.response?.data?.detail ||
        'Analysis server did not complete the request. Please verify file format or try again.'
      );
    } finally {
      setLoading(false);
      setLoadingStep(5);
    }
  };

  const renderLoadingSteps = () => (
    <div className="bg-white border border-slate-200 rounded p-6 sm:p-10 space-y-6">
      <div className="text-center space-y-3">
        <Loader2 size={28} className="animate-spin text-slate-700 mx-auto" />
        <h3 className="text-sm font-semibold text-slate-900">
          Analyzing consultation submissions...
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Large datasets may take a few moments to analyze.
        </p>
      </div>
      
      <div className="max-w-xs mx-auto space-y-3 pt-4 border-t border-slate-100">
        {[
          { step: 1, label: 'File selected' },
          { step: 2, label: 'Schema detected' },
          { step: 3, label: 'Validation' },
          { step: 4, label: 'Analysis in progress' },
        ].map((s) => (
          <div key={s.step} className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${
              loadingStep > s.step 
                ? 'bg-emerald-500 border-emerald-500 text-white' 
                : loadingStep === s.step 
                ? 'border-slate-800 border-t-transparent animate-spin' 
                : 'border-slate-200'
            }`}>
              {loadingStep > s.step && <CheckCircle size={10} />}
            </div>
            <span className={`text-xs ${loadingStep >= s.step ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-3">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          Upload Consultation Dataset
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Process stakeholder feedback through NLP sentiment classification and policy issue taxonomy
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded p-4 flex flex-col gap-3">
          <div className="flex items-start gap-2 text-rose-800 text-sm">
            <XCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Upload Failed</p>
              <p className="text-xs mt-1">{error}</p>
            </div>
          </div>
          <button 
            onClick={() => setError(null)}
            className="self-start text-xs font-medium bg-rose-100 hover:bg-rose-200 text-rose-900 px-3 py-1.5 rounded"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        renderLoadingSteps()
      ) : result ? (
        <div className="bg-white border border-slate-200 rounded p-4 sm:p-5 space-y-5">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle size={20} />
            <h3 className="text-base font-semibold text-slate-900">Analysis Complete</h3>
          </div>

          {result.warnings && result.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Processing Warnings</p>
                <ul className="list-disc pl-4 space-y-1">
                  {result.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded p-4 grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="block text-slate-500 text-xs">Dataset ID</span>
              <strong className="text-slate-900 font-mono">#{result.consultation_id}</strong>
            </div>
            <div className="space-y-1">
              <span className="block text-slate-500 text-xs">Total Rows Received</span>
              <strong className="text-slate-900">{result.rows_total?.toLocaleString()}</strong>
            </div>
            
            <div className="space-y-1">
              <span className="block text-emerald-600 text-xs font-medium">Rows Analyzed</span>
              <strong className="text-slate-900">{result.rows_processed?.toLocaleString()}</strong>
            </div>
            <div className="space-y-1">
              <span className="block text-amber-600 text-xs font-medium">Rows Filtered</span>
              <strong className="text-slate-900">{result.rows_filtered?.toLocaleString() || 0}</strong>
            </div>
            
            <div className="space-y-1">
              <span className="block text-rose-600 text-xs font-medium">Rows Failed</span>
              <strong className="text-slate-900">{result.rows_failed?.toLocaleString() || 0}</strong>
            </div>
          </div>

          {((result.rows_failed || 0) > 0 || (result.rows_filtered || 0) > 0) && (
            <div className="border border-rose-100 bg-rose-50/50 rounded p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-rose-800">
                  {(result.rows_failed || 0) + (result.rows_filtered || 0)} rows could not be processed completely.
                </p>
                {result.row_errors && result.row_errors.length > 0 && (
                  <button 
                    onClick={() => setShowErrors(!showErrors)}
                    className="text-xs font-medium text-rose-700 hover:text-rose-900 underline"
                  >
                    {showErrors ? 'Hide Errors' : 'View Errors'}
                  </button>
                )}
              </div>
              
              {showErrors && result.row_errors && (
                <div className="mt-3 max-h-40 overflow-y-auto space-y-2 border-t border-rose-100 pt-2 text-[11px]">
                  {result.row_errors.map((err: any, i: number) => (
                    <div key={i} className="flex gap-2 text-slate-700">
                      <span className="font-mono text-slate-500 w-12 shrink-0">Row {err.row_number}</span>
                      <span className={`font-semibold shrink-0 ${err.status === 'FAILED' ? 'text-rose-600' : 'text-amber-600'}`}>[{err.status}]</span>
                      <span className="truncate">{err.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => {
                setResult(null);
                setFile(null);
                setTitle('');
              }}
              className="w-full sm:w-auto px-4 py-2 border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Upload Another Dataset
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <Link
                to="/evolution"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium px-4 py-2 rounded border border-slate-200 transition-colors"
              >
                <GitCompare size={14} /> View Policy Evolution
              </Link>
              <button
                onClick={() => navigate('/')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-2 rounded transition-colors"
              >
                <LayoutDashboard size={14} /> Open Dashboard <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded p-6 sm:p-10 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-slate-800 bg-slate-100/80'
                : file
                ? 'border-slate-400 bg-slate-50'
                : 'border-slate-300 hover:border-slate-400 bg-white'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
              }}
            />

            {file ? (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-800">
                <FileText size={24} className="text-emerald-600 mb-1" />
                <span className="text-sm font-semibold break-all px-4">{file.name}</span>
                <span className="text-xs text-slate-500">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
                <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                  <CheckCircle size={12} /> Ready for schema detection & analysis
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <UploadIcon size={24} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  Click to select or drag and drop a consultation CSV
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Supported semantic columns: comment, section, stakeholder, version, subsection. Extra columns will be safely ignored.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded p-4 sm:p-5 space-y-4">
            <div>
              <label htmlFor="title" className="block text-xs font-medium text-slate-700 mb-1.5">
                Dataset Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Companies Act (Amendment) Draft Review 2026"
                className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-700 mb-2">
                Upload Mode
              </span>
              <div className="space-y-2.5 text-xs text-slate-700">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={!replace}
                    onChange={() => setReplace(false)}
                    className="text-slate-900 focus:ring-slate-400 mt-0.5"
                  />
                  <div>
                    <span className="font-medium">Create as a distinct new dataset</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">Recommended to preserve historical analysis</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={replace}
                    onChange={() => setReplace(true)}
                    className="text-slate-900 focus:ring-slate-400 mt-0.5"
                  />
                  <div>
                    <span className="font-medium">Replace existing dataset comments</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">Overwrites matching dataset IDs entirely</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-2">
            <a
              href="/mca_consultation_sample.csv"
              download="mca_consultation_sample.csv"
              className="w-full sm:w-auto text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center justify-center gap-1.5"
            >
              <Download size={14} /> Download Sample Template
            </a>

            <button
              type="submit"
              disabled={loading || !file}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-5 py-2.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Analyze and Store Dataset
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
