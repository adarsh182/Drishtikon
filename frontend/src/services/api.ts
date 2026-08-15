import axios from 'axios';
import type {
  Comment,
  ComparisonData,
  Consultation,
  DashboardData,
  Issue,
  IssueDetail,
  UploadResult,
  Version,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: API_URL });

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
  const { data } = await api.post('/comments/upload', form, { params, headers: { 'Content-Type': 'multipart/form-data' } });
  return data;
}

export function getDemoDownloadUrl() {
  return `${API_URL}/demo/download`;
}

export default api;
