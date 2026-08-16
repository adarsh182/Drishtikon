import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getConsultations, healthCheck } from '../services/api';
import type { Consultation } from '../types';

interface ConsultationContextType {
  consultations: Consultation[];
  selectedConsultationId: number | null;
  selectedConsultation: Consultation | null;
  loading: boolean;
  error: string | null;
  setSelectedConsultationId: (id: number) => void;
  refreshConsultations: (selectId?: number) => Promise<void>;
}

const ConsultationContext = createContext<ConsultationContextType | undefined>(undefined);

const STORAGE_KEY = 'mca_selected_consultation_id';

export const ConsultationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedConsultationId, setSelectedConsultationIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setSelectedConsultationId = useCallback((id: number) => {
    setSelectedConsultationIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  const refreshConsultations = useCallback(async (selectId?: number) => {
    try {
      setLoading(true);
      setError(null);
      const list = await getConsultations();
      setConsultations(list);

      if (selectId && list.some((c) => c.id === selectId)) {
        setSelectedConsultationId(selectId);
      } else if (list.length > 0) {
        const currentSaved = localStorage.getItem(STORAGE_KEY);
        const validId = currentSaved && list.some((c) => c.id === Number(currentSaved))
          ? Number(currentSaved)
          : list[0].id;
        setSelectedConsultationIdState(validId);
        localStorage.setItem(STORAGE_KEY, String(validId));
      } else {
        setSelectedConsultationIdState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load consultations');
    } finally {
      setLoading(false);
    }
  }, [setSelectedConsultationId]);

  // Initial load
  useEffect(() => {
    refreshConsultations();
  }, [refreshConsultations]);

  // Background keep-alive ping: keeps the backend awake and active while browser is open
  useEffect(() => {
    // Immediate ping to wake backend from cold start
    healthCheck().catch(() => {});

    // Periodic ping every 4 minutes (Render sleeps after 15 mins)
    const interval = setInterval(() => {
      healthCheck().catch(() => {});
    }, 4 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const selectedConsultation = consultations.find((c) => c.id === selectedConsultationId) || null;

  return (
    <ConsultationContext.Provider
      value={{
        consultations,
        selectedConsultationId,
        selectedConsultation,
        loading,
        error,
        setSelectedConsultationId,
        refreshConsultations,
      }}
    >
      {children}
    </ConsultationContext.Provider>
  );
};

export function useConsultation() {
  const context = useContext(ConsultationContext);
  if (!context) {
    throw new Error('useConsultation must be used within a ConsultationProvider');
  }
  return context;
}
