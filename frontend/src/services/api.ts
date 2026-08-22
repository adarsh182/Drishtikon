import axios from 'axios';
import type {
  Comment,
  ComparisonData,
  Consultation,
  DashboardData,
  DuplicateGroup,
  Issue,
  IssueDetail,
  LanguageStat,
  SimilarComment,
  SystemInfo,
  UploadResult,
  Version,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const DEFAULT_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '60000', 10);
const UPLOAD_TIMEOUT = parseInt(import.meta.env.VITE_UPLOAD_TIMEOUT_MS || '180000', 10);

const api = axios.create({
  baseURL: API_URL,
  timeout: DEFAULT_TIMEOUT,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    
    // Initialize retry count
    if (!config._retryCount) {
      config._retryCount = 0;
    }

    const isTransientError = 
      error.code === 'ECONNABORTED' || 
      error.message === 'Network Error' ||
      (error.response && [502, 503, 504].includes(error.response.status));

    if (isTransientError && config._retryCount < 2) {
      config._retryCount += 1;
      const backoffDelay = 1000 * Math.pow(2, config._retryCount); // 2s, 4s...
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return api(config);
    }

    // Rewrite transient/timeout errors for clear UX instead of generic Axios errors
    if (isTransientError) {
      error.isTransient = true;
      error.friendlyMessage = 'Unable to connect to the analysis server. The server may be starting up or temporarily unavailable.';
    }

    return Promise.reject(error);
  }
);

export async function healthCheck() {
  const { data } = await api.get('/health');
  return data;
}

export async function getConsultations(): Promise<Consultation[]> {
  const { data } = await api.get('/consultations');
  return data;
}

export async function getConsultation(id: number): Promise<Consultation> {
  const { data } = await api.get(`/consultations/${id}`);
  return data;
}

export async function getVersions(id: number): Promise<Version[]> {
  const { data } = await api.get(`/consultations/${id}/versions`);
  return data;
}

export async function getDashboard(id: number): Promise<DashboardData> {
  const { data } = await api.get(`/dashboard/${id}`);
  return data;
}

export async function getComments(params: Record<string, string | number>): Promise<{ total: number; items: Comment[]; page: number; page_size: number }> {
  const { data } = await api.get('/comments', { params });
  return data;
}

export async function getComment(id: number): Promise<Comment> {
  const { data } = await api.get(`/comments/${id}`);
  return data;
}

export async function getIssues(consultationId: number): Promise<Issue[]> {
  const { data } = await api.get(`/issues/${consultationId}`);
  return data;
}

export async function getIssueDetail(consultationId: number, issueName: string): Promise<IssueDetail> {
  const { data } = await api.get(`/issues/${consultationId}/${encodeURIComponent(issueName)}`);
  return data;
}

export async function getIssueEvidence(consultationId: number, issueName: string, page = 1): Promise<{ total: number; items: Comment[]; issue: string }> {
  const { data } = await api.get(`/issues/${consultationId}/${encodeURIComponent(issueName)}/evidence`, { params: { page } });
  return data;
}

export async function getComparison(consultationId: number): Promise<ComparisonData> {
  const { data } = await api.get(`/comparison/${consultationId}`);
  return data;
}

export async function uploadComments(file: File, consultationId?: number, replace = false, title?: string): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const params: Record<string, string | number | boolean> = { replace };
  if (consultationId) params.consultation_id = consultationId;
  if (title) params.title = title;
  const { data } = await api.post('/comments/upload', form, {
    params,
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: UPLOAD_TIMEOUT,
  });
  return data;
}

export async function getSimilarComments(commentId: number, threshold?: number): Promise<SimilarComment[]> {
  const params: Record<string, any> = {};
  if (threshold !== undefined) params.threshold = threshold;
  const { data } = await api.get(`/comments/${commentId}/similar`, { params });
  return data;
}

export async function getDuplicates(consultationId: number, threshold?: number): Promise<DuplicateGroup[]> {
  const params: Record<string, any> = { consultation_id: consultationId };
  if (threshold !== undefined) params.threshold = threshold;
  const { data } = await api.get('/comments/duplicates', { params });
  return data;
}

export async function getLanguageStats(consultationId: number): Promise<LanguageStat[]> {
  const { data } = await api.get(`/dashboard/${consultationId}/languages`);
  return data;
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const { data } = await api.get('/system/info');
  return data;
}

export function getDemoDownloadUrl() {
  return `${API_URL}/demo/download`;
}

export default api;

