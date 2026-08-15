import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getConsultations } from '../services/api';
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

      if (selectId) {
        setSelectedConsultationId(selectId);
      } else if (list.length > 0) {
        // If current selection is invalid or not set, select the first one
        setSelectedConsultationIdState((prev) => {
          if (prev && list.some((c) => c.id === prev)) {
            return prev;
          }
          const defaultId = list[0].id;
          localStorage.setItem(STORAGE_KEY, String(defaultId));
          return defaultId;
        });
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

  useEffect(() => {
    refreshConsultations();
  }, [refreshConsultations]);

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
