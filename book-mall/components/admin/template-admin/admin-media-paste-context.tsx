"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type AdminMediaPasteContextValue = {
  activeFieldId: string | null;
  setActiveFieldId: (id: string | null) => void;
};

const AdminMediaPasteContext = createContext<AdminMediaPasteContextValue | null>(
  null,
);

export function AdminMediaPasteProvider({ children }: { children: ReactNode }) {
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const value = useMemo(
    () => ({ activeFieldId, setActiveFieldId }),
    [activeFieldId],
  );
  return (
    <AdminMediaPasteContext.Provider value={value}>
      {children}
    </AdminMediaPasteContext.Provider>
  );
}

export function useAdminMediaPasteTarget(fieldId: string) {
  const ctx = useContext(AdminMediaPasteContext);
  const isActive = ctx?.activeFieldId === fieldId;

  function activate() {
    ctx?.setActiveFieldId(fieldId);
  }

  return { isActive, activate };
}
