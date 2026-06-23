import { useState, useEffect, useRef } from "react";

export interface FormDraftData {
  clientId: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo: string;
  startDate: string;
  endDate: string;
  notes: string;
  previewImages: string[];
  serviceLocation: string;
  editingOrderId: string | null; // null for "new"
  timestamp: number;
}

const LOCAL_STORAGE_KEY_PREFIX = "requisicaopro_draft_";

export function useFormDraft(
  isFormOpen: boolean,
  editingOrderId: string | null,
  currentValues: Omit<FormDraftData, "editingOrderId" | "timestamp">,
  onRestore: (draft: FormDraftData) => void
) {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<number | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const getStorageKey = () => {
    return `${LOCAL_STORAGE_KEY_PREFIX}${editingOrderId || "new"}`;
  };

  // Ref to hold current values to avoid re-running intervals/effects on every keystroke
  const valuesRef = useRef(currentValues);
  useEffect(() => {
    valuesRef.current = currentValues;
  }, [currentValues]);

  // Check if a draft exists in localStorage when form opens or editing ID changes
  useEffect(() => {
    if (!isFormOpen) {
      setHasDraft(false);
      return;
    }

    const key = getStorageKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as FormDraftData;
        // Verify it matches the current edit state
        if (parsed.editingOrderId === editingOrderId) {
          // Check if it actually contains changed/non-empty data to prevent prompting on clean state
          const isNotEmpty = 
            parsed.title || 
            parsed.description || 
            parsed.notes || 
            parsed.previewImages.length > 0 || 
            parsed.serviceLocation;
            
          if (isNotEmpty) {
            setHasDraft(true);
            setDraftTimestamp(parsed.timestamp);
          } else {
            setHasDraft(false);
          }
        }
      } catch (e) {
        console.error("Erro ao ler rascunho do localStorage", e);
        setHasDraft(false);
      }
    } else {
      setHasDraft(false);
    }
  }, [isFormOpen, editingOrderId]);

  // Periodically save the draft state every 4 seconds if form is open
  useEffect(() => {
    if (!isFormOpen) return;

    const intervalId = setInterval(() => {
      const key = getStorageKey();
      const draftData: FormDraftData = {
        ...valuesRef.current,
        editingOrderId,
        timestamp: Date.now(),
      };
      
      // Only save if there's actual content to save
      const hasContent = 
        draftData.title.trim() !== "" || 
        draftData.description.trim() !== "" || 
        draftData.notes.trim() !== "" || 
        draftData.previewImages.length > 0 || 
        draftData.serviceLocation.trim() !== "";

      if (hasContent) {
        localStorage.setItem(key, JSON.stringify(draftData));
        setLastSaved(new Date());
      }
    }, 4000); // 4 seconds interval

    return () => clearInterval(intervalId);
  }, [isFormOpen, editingOrderId]);

  // Function to manually trigger restore
  const restoreDraft = () => {
    const key = getStorageKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as FormDraftData;
        onRestore(parsed);
        setHasDraft(false);
      } catch (e) {
        console.error("Erro ao restaurar rascunho", e);
      }
    }
  };

  // Function to discard/clear the draft
  const discardDraft = () => {
    const key = getStorageKey();
    localStorage.removeItem(key);
    setHasDraft(false);
    setDraftTimestamp(null);
  };

  // Function to clear draft after successful submission
  const clearDraftOnSubmit = () => {
    const key = getStorageKey();
    localStorage.removeItem(key);
    setHasDraft(false);
    setDraftTimestamp(null);
  };

  return {
    hasDraft,
    draftTimestamp,
    lastSaved,
    restoreDraft,
    discardDraft,
    clearDraftOnSubmit,
  };
}
