import { createContext, useContext, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import type { Proposal, Material, ProposalImage, Incentive, WarrantyDocument, Document as DocType } from "@shared/schema";

interface ProposalContextValue {
  token: string;
  proposal: Proposal | null;
  materials: Material[];
  images: ProposalImage[];
  incentives: Incentive[];
  warrantyDocs: WarrantyDocument[];
  documents: DocType[];
  isLoading: boolean;
  trackEvent: (eventType: string, eventData?: any) => void;
}

const ProposalContext = createContext<ProposalContextValue | null>(null);

export function ProposalProvider({ token, children }: { token: string; children: React.ReactNode }) {
  const { data: proposal, isLoading: pLoading } = useQuery<Proposal>({
    queryKey: ["/api/proposal", token],
    queryFn: () => apiRequest("GET", `/api/proposal/${token}`).then(r => r.json()),
    retry: 2,
  });

  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ["/api/proposal", token, "materials"],
    queryFn: () => apiRequest("GET", `/api/proposal/${token}/materials`).then(r => r.json()),
    enabled: !!proposal,
  });

  const { data: images = [] } = useQuery<ProposalImage[]>({
    queryKey: ["/api/proposal", token, "images"],
    queryFn: () => apiRequest("GET", `/api/proposal/${token}/images`).then(r => r.json()),
    enabled: !!proposal,
  });

  const { data: incentives = [] } = useQuery<Incentive[]>({
    queryKey: ["/api/proposal", token, "incentives"],
    queryFn: () => apiRequest("GET", `/api/proposal/${token}/incentives`).then(r => r.json()),
    enabled: !!proposal,
  });

  const { data: warrantyDocs = [] } = useQuery<WarrantyDocument[]>({
    queryKey: ["/api/proposal", token, "warranty-docs"],
    queryFn: () => apiRequest("GET", `/api/proposal/${token}/warranty-docs`).then(r => r.json()),
    enabled: !!proposal,
  });

  const { data: documents = [] } = useQuery<DocType[]>({
    queryKey: ["/api/proposal", token, "documents"],
    queryFn: () => apiRequest("GET", `/api/proposal/${token}/documents`).then(r => r.json()),
    enabled: !!proposal,
  });

  const trackEvent = useCallback((eventType: string, eventData?: any) => {
    apiRequest("POST", `/api/proposal/${token}/track`, { eventType, eventData }).catch(() => {});
  }, [token]);

  return (
    <ProposalContext.Provider value={{
      token,
      proposal: proposal || null,
      materials,
      images,
      incentives,
      warrantyDocs,
      documents,
      isLoading: pLoading,
      trackEvent,
    }}>
      {children}
    </ProposalContext.Provider>
  );
}

export function useProposal() {
  const ctx = useContext(ProposalContext);
  if (!ctx) throw new Error("useProposal must be used within ProposalProvider");
  return ctx;
}
