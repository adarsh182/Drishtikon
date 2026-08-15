import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadComments, getDemoDownloadUrl } from '../services/api';
import { useConsultation } from '../context/ConsultationContext';
import { Upload as UploadIcon, FileText, CheckCircle, Download, ArrowRight } from 'lucide-react';
import type { UploadResult } from '../types';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [replace, setReplace] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { refreshConsultations, setSelectedConsultationId } = useConsultation();

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

    try {
      const res = await uploadComments(file, undefined, replace, title.trim() || undefined);
      setResult(res);
      await refreshConsultations();
      if (res.consultation_id) {
        setSelectedConsultationId(res.consultation_id);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          'Failed to upload and analyze consultation CSV. Please verify file format.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    navigate('/');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-3">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          Upload Consultation Dataset
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Process stakeholder feedback through NLP sentiment classification and policy issue taxonomy
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded p-3">
          {error}
        </div>
      )}

      {result ? (
        /* Analysis Results Summary */
        <div className="bg-white border border-slate-200 rounded p-5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle size={16} />
            <h3 className="text-sm font-semibold text-slate-900">Analysis Complete & Dataset Stored</h3>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded p-3.5 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Consultation Dataset</span>
              <strong className="text-slate-800">#{result.consultation_id}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Total Comments Analyzed</span>
              <strong className="text-slate-800">{result.rows_stored} comments stored</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Sentiment Distribution</span>
              <span className="space-x-2 text-slate-700 font-medium">
                <span className="text-emerald-700">{result.sentiments?.Positive ?? 0} Positive</span>
                <span>·</span>
                <span className="text-slate-600">{result.sentiments?.Neutral ?? 0} Neutral</span>
                <span>·</span>
                <span className="text-rose-700">{result.sentiments?.Negative ?? 0} Negative</span>
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Issues Detected</span>
              <span className="text-slate-700">
                {result.issues_detected?.join(', ') || 'None'}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setResult(null);
                setFile(null);
                setTitle('');
              }}
              className="px-3 py-1.5 border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Upload Another CSV
            </button>
            <button
              onClick={handleGoToDashboard}
              className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-1.5 rounded transition-colors"
            >
              Open Dashboard <ArrowRight size={13} />
            </button>
          </div>
        </div>
      ) : (
        /* Upload Form */
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded p-6 text-center cursor-pointer transition-colors ${
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
              <div className="flex items-center justify-center gap-2 text-slate-800">
                <FileText size={18} className="text-slate-600" />
                <span className="text-xs font-semibold">{file.name}</span>
                <span className="text-[11px] text-slate-500">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <UploadIcon size={20} className="mx-auto text-slate-400" />
                <p className="text-xs font-medium text-slate-700">
                  Click to select or drag and drop a consultation CSV
                </p>
                <p className="text-[11px] text-slate-400">
                  Supported columns: <code>comment</code>, <code>section</code>, <code>stakeholder</code>, <code>version</code>, <code>subsection</code>
                </p>
              </div>
            )}
          </div>

          {/* Consultation Title Input */}
          <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
            <div>
              <label htmlFor="title" className="block text-xs font-medium text-slate-700 mb-1">
                Dataset Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Companies Act (Amendment) Draft Review 2026"
                className="w-full border border-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            {/* Upload Mode Selector */}
            <div>
              <span className="block text-xs font-medium text-slate-700 mb-1">
                Upload Mode
              </span>
              <div className="space-y-1.5 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={!replace}
                    onChange={() => setReplace(false)}
                    className="text-slate-900 focus:ring-slate-400"
                  />
                  <span>Create as a distinct new consultation dataset</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={replace}
                    onChange={() => setReplace(true)}
                    className="text-slate-900 focus:ring-slate-400"
                  />
                  <span>Replace existing dataset comments</span>
                </label>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-1">
            <a
              href={getDemoDownloadUrl()}
              download="mca_econsultation_demo.csv"
              className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1"
            >
              <Download size={13} /> Download Sample Demo CSV
            </a>

            <button
              type="submit"
              disabled={loading || !file}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Analyzing and storing...' : 'Analyze and Store Dataset'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
