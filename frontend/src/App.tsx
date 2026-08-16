import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { ConsultationProvider } from './context/ConsultationContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Consultations from './pages/Consultations';
import ConsultationDetail from './pages/ConsultationDetail';
import PolicyEvolution from './pages/PolicyEvolution';
import Issues from './pages/Issues';
import IssueDetail from './pages/IssueDetail';
import Comments from './pages/Comments';
import CommentDetail from './pages/CommentDetail';
import Upload from './pages/Upload';

export default function App() {
  return (
    <ConsultationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="consultations" element={<Consultations />} />
            <Route path="consultations/:id" element={<ConsultationDetail />} />
            <Route path="evolution" element={<PolicyEvolution />} />
            <Route path="issues" element={<Issues />} />
            <Route path="issues/:id/:issueName" element={<IssueDetail />} />
            <Route path="issues/:issueName" element={<IssueDetail />} />
            <Route path="comments" element={<Comments />} />
            <Route path="comments/:id" element={<CommentDetail />} />
            <Route path="upload" element={<Upload />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Analytics />
    </ConsultationProvider>
  );
}

