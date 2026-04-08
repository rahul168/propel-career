"use client";

import { useReducer, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DocxEditor } from "@eigenpal/docx-js-editor";
import type { DocxEditorRef } from "@eigenpal/docx-js-editor";
import { FileUpload } from "./FileUpload";
import { StepIndicator } from "./StepIndicator";
import { MatchScore } from "./MatchScore";
import { MatchCategoryBadge } from "./MatchCategoryBadge";
import { SuggestionCard } from "./SuggestionCard";
import { FreeTierOverlay } from "./FreeTierOverlay";
import { Button } from "./ui/button";
import type { MatchAnalysis, Suggestion } from "@/types";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

type ResumeVersionMeta = {
  id: string;
  runNumber: number;
  label: string;
  source: string;
  originalFileName: string;
  createdAt: string;
};

interface AnalysisState {
  currentStep: Step;
  resumeText: string;
  fileName: string;
  docxBase64: string;
  projectId: string;
  versions: ResumeVersionMeta[];
  isFetchingVersions: boolean;
  jobDescription: string;
  matchAnalysis: MatchAnalysis | null;
  suggestions: Suggestion[];
  isLoading: boolean;
  error: string | null;
  /** Pre-fetched modified DOCX (suggestions applied) used in step 5 */
  modifiedDocxBase64: string;
  /** Whether we are currently fetching the modified DOCX for step 5 */
  isFetchingPreview: boolean;
  /** Finalized DOCX saved when user clicks "Finalize resume" — used for step 6 downloads */
  finalizedDocxBase64: string;
  /** True while fetching suggestions after returning from credit purchase */
  isFetchingSuggestions: boolean;
}

type Action =
  | { type: "SET_RESUME"; text: string; fileName: string; docxBase64: string }
  | { type: "RESET_FLOW" }
  | { type: "SET_BASELINE"; text: string; docxBase64: string }
  | { type: "SET_PROJECT"; projectId: string }
  | { type: "SET_VERSIONS"; versions: ResumeVersionMeta[] }
  | { type: "FETCH_VERSIONS_START" }
  | { type: "FETCH_VERSIONS_DONE"; versions: ResumeVersionMeta[] }
  | { type: "SET_JD"; jobDescription: string }
  | { type: "START_ANALYSIS" }
  | { type: "ANALYSIS_COMPLETE"; matchAnalysis: MatchAnalysis; suggestions: Suggestion[] }
  | { type: "ANALYSIS_ERROR"; error: string }
  | { type: "TOGGLE_SUGGESTION"; id: string }
  | { type: "EDIT_SUGGESTION"; id: string; suggested: string }
  | { type: "NEXT_STEP" }
  | { type: "SET_STEP"; step: Step }
  | { type: "FETCH_PREVIEW_START" }
  | { type: "FETCH_PREVIEW_DONE"; modifiedDocxBase64: string }
  | { type: "FETCH_PREVIEW_ERROR" }
  | { type: "SET_FINALIZED"; finalizedDocxBase64: string }
  | { type: "RESTORE_FROM_SESSION"; resumeText: string; fileName: string; docxBase64: string; projectId: string; jobDescription: string; matchAnalysis: MatchAnalysis }
  | { type: "FETCH_SUGGESTIONS_START" }
  | { type: "FETCH_SUGGESTIONS_DONE"; suggestions: Suggestion[] }
  | { type: "FETCH_SUGGESTIONS_ERROR" };

const initialState: AnalysisState = {
  currentStep: 1,
  resumeText: "",
  fileName: "",
  docxBase64: "",
  projectId: "",
  versions: [],
  isFetchingVersions: false,
  jobDescription: "",
  matchAnalysis: null,
  suggestions: [],
  isLoading: false,
  error: null,
  modifiedDocxBase64: "",
  isFetchingPreview: false,
  finalizedDocxBase64: "",
  isFetchingSuggestions: false,
};

function reducer(state: AnalysisState, action: Action): AnalysisState {
  switch (action.type) {
    case "SET_RESUME":
      return {
        ...state,
        resumeText: action.text,
        fileName: action.fileName,
        docxBase64: action.docxBase64,
        projectId: "",
        versions: [],
        isFetchingVersions: false,
        // Clear stale analysis from the previous resume; keep jobDescription
        matchAnalysis: null,
        suggestions: [],
        modifiedDocxBase64: "",
        finalizedDocxBase64: "",
        isFetchingSuggestions: false,
        error: null,
        currentStep: 2,
      };
    case "SET_BASELINE":
      return {
        ...state,
        resumeText: action.text,
        docxBase64: action.docxBase64,
        matchAnalysis: null,
        suggestions: [],
        modifiedDocxBase64: "",
        isFetchingPreview: false,
        isLoading: false,
        error: null,
        currentStep: 2,
      };
    case "SET_PROJECT":
      return { ...state, projectId: action.projectId };
    case "SET_VERSIONS":
      return { ...state, versions: action.versions };
    case "FETCH_VERSIONS_START":
      return { ...state, isFetchingVersions: true };
    case "FETCH_VERSIONS_DONE":
      return { ...state, isFetchingVersions: false, versions: action.versions };
    case "SET_JD":
      return { ...state, jobDescription: action.jobDescription };
    case "START_ANALYSIS":
      return { ...state, isLoading: true, error: null, currentStep: 3 };
    case "ANALYSIS_COMPLETE":
      return { ...state, isLoading: false, matchAnalysis: action.matchAnalysis, suggestions: action.suggestions, currentStep: 4 };
    case "ANALYSIS_ERROR":
      return { ...state, isLoading: false, error: action.error, currentStep: 2 };
    case "TOGGLE_SUGGESTION":
      return {
        ...state,
        suggestions: state.suggestions.map((s) => s.id === action.id ? { ...s, accepted: !s.accepted } : s),
        modifiedDocxBase64: "",
      };
    case "EDIT_SUGGESTION":
      return {
        ...state,
        suggestions: state.suggestions.map((s) =>
          s.id === action.id ? { ...s, suggested: action.suggested } : s
        ),
        modifiedDocxBase64: "",
      };
    case "NEXT_STEP":
      return { ...state, currentStep: (state.currentStep + 1) as Step };
    case "SET_STEP":
      return {
        ...state,
        currentStep: action.step,
        isLoading: false,
        ...(action.step < 5 ? { modifiedDocxBase64: "", finalizedDocxBase64: "" } : {}),
        // Returning to step 1 clears the resume and analysis but keeps jobDescription
        // so the user doesn't have to retype it after swapping their resume file
        ...(action.step === 1
          ? {
              resumeText: "",
              fileName: "",
              docxBase64: "",
              projectId: "",
              versions: [],
              isFetchingVersions: false,
              matchAnalysis: null,
              suggestions: [],
              finalizedDocxBase64: "",
              isFetchingSuggestions: false,
            }
          : {}),
      };
    case "SET_FINALIZED":
      return { ...state, finalizedDocxBase64: action.finalizedDocxBase64, currentStep: 6 };
    case "FETCH_PREVIEW_START":
      return { ...state, isFetchingPreview: true };
    case "FETCH_PREVIEW_DONE":
      return { ...state, isFetchingPreview: false, modifiedDocxBase64: action.modifiedDocxBase64 };
    case "FETCH_PREVIEW_ERROR":
      return { ...state, isFetchingPreview: false };
    case "RESTORE_FROM_SESSION":
      return {
        ...state,
        resumeText: action.resumeText,
        fileName: action.fileName,
        docxBase64: action.docxBase64,
        projectId: action.projectId,
        jobDescription: action.jobDescription,
        matchAnalysis: action.matchAnalysis,
        suggestions: [],
        currentStep: 4,
        isLoading: false,
        isFetchingSuggestions: false,
      };
    case "FETCH_SUGGESTIONS_START":
      return { ...state, isFetchingSuggestions: true };
    case "FETCH_SUGGESTIONS_DONE":
      return { ...state, isFetchingSuggestions: false, suggestions: action.suggestions };
    case "FETCH_SUGGESTIONS_ERROR":
      return { ...state, isFetchingSuggestions: false };
    case "RESET_FLOW":
      return initialState;
    default:
      return state;
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Chunked to avoid stack overflow on large DOCX files */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function toDocxDownloadName(originalName: string) {
  const trimmed = (originalName ?? "").trim();
  if (!trimmed) return "uploaded-resume.docx";
  const base = trimmed.replace(/\.(pdf|docx)$/i, "");
  return `${base || "uploaded-resume"}.docx`;
}

function BackButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors duration-150"
    >
      ← {children}
    </button>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

interface AnalyzeFlowProps {
  hasPaid: boolean;
}

export function AnalyzeFlow({ hasPaid }: AnalyzeFlowProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const router = useRouter();
  const rightEditorRef = useRef<DocxEditorRef>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);
  const [isDownloadVersionsOpen, setIsDownloadVersionsOpen] = useState(false);
  const [versionPreview, setVersionPreview] = useState<{
    open: boolean;
    title: string;
    fileName: string;
    buffer: ArrayBuffer | null;
  }>({ open: false, title: "", fileName: "", buffer: null });

  const modifiedBuffer = useMemo(
    () => (state.modifiedDocxBase64 ? base64ToArrayBuffer(state.modifiedDocxBase64) : null),
    [state.modifiedDocxBase64]
  );

  // Step 5 editor buffer — prefer the finalized (user-edited) version when navigating back
  // from step 6; fall back to the suggestion-applied preview when entering step 5 fresh
  const activeEditorBuffer = useMemo(
    () => {
      const b64 = state.finalizedDocxBase64 || state.modifiedDocxBase64;
      return b64 ? base64ToArrayBuffer(b64) : null;
    },
    [state.finalizedDocxBase64, state.modifiedDocxBase64]
  );

  const versionPreviewBuffer = useMemo(
    () => (versionPreview.buffer ? versionPreview.buffer : null),
    [versionPreview.buffer]
  );

  const refreshVersions = useCallback(async (projectId: string) => {
    dispatch({ type: "FETCH_VERSIONS_START" });
    try {
      const res = await fetch(`/api/resume-projects/${projectId}/versions`);
      if (!res.ok) throw new Error("Failed to load versions");
      const data = (await res.json()) as { versions: ResumeVersionMeta[] };
      dispatch({ type: "FETCH_VERSIONS_DONE", versions: data.versions ?? [] });
    } catch {
      dispatch({ type: "FETCH_VERSIONS_DONE", versions: [] });
      toast.error("Failed to load resume versions");
    }
  }, []);

  const createProjectAndVersion0 = useCallback(
    async ({ fileName, docxBase64 }: { fileName: string; docxBase64: string }) => {
      const projectRes = await fetch("/api/resume-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: fileName }),
      });
      if (!projectRes.ok) throw new Error("Failed to create project");
      const projectData = (await projectRes.json()) as { projectId: string };
      const projectId = projectData.projectId;
      if (!projectId) throw new Error("No projectId returned");

      dispatch({ type: "SET_PROJECT", projectId });

      const v0Res = await fetch("/api/resume-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          runNumber: 0,
          label: "Original",
          source: "upload",
          originalFileName: fileName,
          docxBase64,
        }),
      });
      if (!v0Res.ok) throw new Error("Failed to save version 0");

      await refreshVersions(projectId);
      return projectId;
    },
    [refreshVersions]
  );

  const saveDocxBase64AsNewVersion = useCallback(
    async ({
      projectId,
      originalFileName,
      docxBase64,
      source,
    }: {
      projectId: string;
      originalFileName: string;
      docxBase64: string;
      source: string;
    }) => {
      const res = await fetch("/api/resume-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          source,
          originalFileName,
          docxBase64,
        }),
      });
      if (!res.ok) throw new Error("Failed to save version");
      await refreshVersions(projectId);
    },
    [refreshVersions]
  );

  // Pre-fetch the modified DOCX (suggestions applied) when entering step 5
  useEffect(() => {
    if (state.currentStep !== 5 || !hasPaid || !state.docxBase64) return;
    if (state.modifiedDocxBase64 || state.isFetchingPreview) return;

    dispatch({ type: "FETCH_PREVIEW_START" });

    fetch("/api/generate-resume/docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText: state.resumeText,
        acceptedSuggestions: state.suggestions.filter((s) => s.accepted),
        docxBase64: state.docxBase64,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("generation failed");
        return r.arrayBuffer();
      })
      .then((ab) => dispatch({ type: "FETCH_PREVIEW_DONE", modifiedDocxBase64: arrayBufferToBase64(ab) }))
      .catch(() => {
        dispatch({ type: "FETCH_PREVIEW_ERROR" });
        toast.error("Failed to prepare preview");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentStep, state.modifiedDocxBase64, state.isFetchingPreview]);

  const SESSION_KEY = "propel_resume_flow";

  // Restore in-progress analysis from sessionStorage (set before the user left to buy credits)
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as {
        resumeText: string;
        fileName: string;
        docxBase64: string;
        projectId: string;
        jobDescription: string;
        matchAnalysis: MatchAnalysis;
      };
      dispatch({ type: "RESTORE_FROM_SESSION", ...data });
      if (hasPaid) {
        sessionStorage.removeItem(SESSION_KEY);
        // Refresh server components (Navbar credits) to show the newly purchased balance
        router.refresh();
        dispatch({ type: "FETCH_SUGGESTIONS_START" });
        fetch("/api/suggest-improvements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeText: data.resumeText, jobDescription: data.jobDescription }),
        })
          .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
          .then((json) =>
            dispatch({
              type: "FETCH_SUGGESTIONS_DONE",
              suggestions: (json as { suggestions: Suggestion[] }).suggestions ?? [],
            })
          )
          .catch(() => {
            dispatch({ type: "FETCH_SUGGESTIONS_ERROR" });
            toast.error("Failed to load suggestions — please refresh.");
          });
        if (data.projectId) void refreshVersions(data.projectId);
      }
      // If still free tier: keep session in storage for the next purchase attempt
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  // hasPaid is a stable server-determined prop at mount time
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveFlowForResume = useCallback(() => {
    if (!state.matchAnalysis) return;
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          resumeText: state.resumeText,
          fileName: state.fileName,
          docxBase64: state.docxBase64,
          projectId: state.projectId,
          jobDescription: state.jobDescription,
          matchAnalysis: state.matchAnalysis,
        })
      );
    } catch {
      // sessionStorage unavailable or full — user will restart normally
    }
  }, [state.resumeText, state.fileName, state.docxBase64, state.projectId, state.jobDescription, state.matchAnalysis]);

  const handleUpload = useCallback(
    (text: string, fileName: string, docxBase64: string) => {
      dispatch({ type: "SET_RESUME", text, fileName, docxBase64 });
      void createProjectAndVersion0({ fileName, docxBase64 }).catch(() => {
        toast.error("Failed to save resume version history");
      });
    },
    [createProjectAndVersion0]
  );

  const handleAnalyze = useCallback(async () => {
    if (state.jobDescription.length < 50) {
      toast.error("Job description must be at least 50 characters");
      return;
    }
    analysisAbortRef.current = new AbortController();
    const { signal } = analysisAbortRef.current;
    dispatch({ type: "START_ANALYSIS" });
    try {
      const requests: Promise<Response>[] = [
        fetch("/api/analyze-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeText: state.resumeText, jobDescription: state.jobDescription }),
          signal,
        }),
      ];
      if (hasPaid) {
        requests.push(
          fetch("/api/suggest-improvements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resumeText: state.resumeText, jobDescription: state.jobDescription }),
            signal,
          })
        );
      }
      const [matchRes, suggestRes] = await Promise.all(requests);
      if (!matchRes.ok) throw new Error("Analysis failed");
      const matchAnalysis: MatchAnalysis = await matchRes.json();
      const suggestions: Suggestion[] = suggestRes?.ok ? (await suggestRes.json()).suggestions : [];
      dispatch({ type: "ANALYSIS_COMPLETE", matchAnalysis, suggestions });
      // analyze-match deducts 1 credit for paid users — refresh Navbar to show updated count
      if (hasPaid) router.refresh();
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Analysis failed";
      dispatch({ type: "ANALYSIS_ERROR", error: msg });
      toast.error(msg);
    }
  }, [state.resumeText, state.jobDescription, hasPaid]);

  const handleOptimizeAgain = useCallback(async () => {
    if (!state.projectId) {
      toast.error("Version history not ready yet");
      return;
    }
    const buffer = await rightEditorRef.current?.save();
    if (!buffer) {
      toast.error("Editor not ready");
      return;
    }

    const docxBase64 = arrayBufferToBase64(buffer);

    try {
      // Save the current editor state as a new version before looping
      await saveDocxBase64AsNewVersion({
        projectId: state.projectId,
        originalFileName: state.fileName,
        docxBase64,
        source: "flywheel",
      });

      const parseRes = await fetch("/api/parse-docx-base64", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docxBase64 }),
      });
      if (!parseRes.ok) throw new Error("Failed to parse DOCX");
      const data = (await parseRes.json()) as { text: string };

      dispatch({ type: "SET_BASELINE", text: data.text, docxBase64 });
      toast.success("Ready for another optimization run");
    } catch {
      toast.error("Failed to start another run");
    }
  }, [saveDocxBase64AsNewVersion, state.fileName, state.projectId]);

  const handleFinalizeResume = useCallback(async () => {
    if (!state.projectId) {
      toast.error("Version history not ready yet");
      return;
    }
    const buffer = await rightEditorRef.current?.save();
    if (!buffer) {
      toast.error("Editor not ready");
      return;
    }
    const docxBase64 = arrayBufferToBase64(buffer);
    try {
      await saveDocxBase64AsNewVersion({
        projectId: state.projectId,
        originalFileName: state.fileName,
        docxBase64,
        source: "finalize",
      });
      dispatch({ type: "SET_FINALIZED", finalizedDocxBase64: docxBase64 });
    } catch {
      toast.error("Failed to finalize resume");
    }
  }, [saveDocxBase64AsNewVersion, state.fileName, state.projectId]);

  const handleDownloadFinalized = useCallback(
    async (format: "docx" | "pdf") => {
      if (!state.finalizedDocxBase64) {
        toast.error("Finalized resume not ready");
        return;
      }
      if (format === "docx") {
        const buffer = base64ToArrayBuffer(state.finalizedDocxBase64);
        triggerBlobDownload(
          new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
          "optimized-resume.docx"
        );
        toast.success("Resume downloaded!");
        return;
      }
      try {
        const res = await fetch("/api/generate-resume/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resumeText: state.resumeText,
            acceptedSuggestions: [],
            docxBase64: state.finalizedDocxBase64,
          }),
        });
        if (!res.ok) throw new Error("PDF generation failed");
        triggerBlobDownload(await res.blob(), "optimized-resume.pdf");
        toast.success("Resume downloaded!");
        // PDF conversion may deduct a credit — refresh Navbar
        router.refresh();
      } catch {
        toast.error("Failed to generate PDF");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.finalizedDocxBase64, state.resumeText]
  );

  const acceptedCount = state.suggestions.filter((s) => s.accepted).length;

  return (
    <div className="px-4 py-8">
      <StepIndicator currentStep={state.currentStep} />

      {/* Step 1 — Upload */}
      {state.currentStep === 1 && (
        <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Upload Your Resume</h2>
          <p className="text-slate-500 mb-6">Upload your DOCX or PDF resume to get started.</p>
          <FileUpload onUpload={handleUpload} />
        </div>
      )}

      {/* Step 2 — Job Description */}
      {state.currentStep === 2 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">Paste the Job Description</h2>
            <BackButton onClick={() => dispatch({ type: "SET_STEP", step: 1 })}>
              Change resume
            </BackButton>
          </div>
          <p className="text-gray-500 mb-4">
            Copy and paste the full job description you&apos;re applying to.
          </p>
          <div className="mb-4">
            <p className="text-sm text-green-600">✓ Resume uploaded: {state.fileName}</p>
          </div>

          {/* Versions panel (server-side history) */}
          {state.projectId && (
            <div className="border border-slate-200 rounded-xl p-4 mb-4 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <button
                    type="button"
                    onClick={() => setIsVersionsOpen((v) => !v)}
                    className="flex items-center gap-2 text-left"
                  >
                    <span className="text-sm font-semibold">Resume versions</span>
                    <span className="text-xs text-gray-400">
                      ({state.versions.length})
                    </span>
                    <span className="text-xs text-gray-500">
                      {isVersionsOpen ? "Hide" : "Show"}
                    </span>
                  </button>
                  <p className="text-xs text-gray-500">
                    Download or preview any version you’ve generated.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void refreshVersions(state.projectId)}
                  disabled={state.isFetchingVersions}
                >
                  {state.isFetchingVersions ? "Refreshing…" : "Refresh"}
                </Button>
              </div>

              {isVersionsOpen && (
                <>
                  {state.versions.length === 0 ? (
                    <p className="text-sm text-gray-500">No versions yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {state.versions.map((v) => (
                        <div
                          key={v.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {v.label} <span className="text-xs text-gray-400">• run {v.runNumber}</span>
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {new Date(v.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={async () => {
                                const res = await fetch(`/api/resume-versions/${v.id}/docx`);
                                if (!res.ok) {
                                  toast.error("Failed to download DOCX");
                                  return;
                                }
                                const ab = await res.arrayBuffer();
                                triggerBlobDownload(
                                  new Blob([ab], {
                                    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                  }),
                                  toDocxDownloadName(v.originalFileName)
                                );
                              }}
                            >
                              DOCX
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={async () => {
                                const res = await fetch(`/api/resume-versions/${v.id}/pdf`);
                                if (!res.ok) {
                                  const msg = res.status === 402 ? "Insufficient credits for PDF" : "Failed to download PDF";
                                  toast.error(msg);
                                  return;
                                }
                                const blob = await res.blob();
                                const name = toDocxDownloadName(v.originalFileName).replace(/\.docx$/i, ".pdf");
                                triggerBlobDownload(blob, name);
                                router.refresh();
                              }}
                            >
                              PDF
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={async () => {
                                const res = await fetch(`/api/resume-versions/${v.id}/docx`);
                                if (!res.ok) {
                                  toast.error("Failed to load preview");
                                  return;
                                }
                                const ab = await res.arrayBuffer();
                                setVersionPreview({
                                  open: true,
                                  title: v.label,
                                  fileName: toDocxDownloadName(v.originalFileName),
                                  buffer: ab,
                                });
                              }}
                            >
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <textarea
            className="w-full h-64 border border-slate-300 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-shadow"
            placeholder="Paste the job description here... (minimum 50 characters)"
            value={state.jobDescription}
            onChange={(e) => dispatch({ type: "SET_JD", jobDescription: e.target.value })}
          />
          <p className="text-xs text-slate-400 mt-1">{state.jobDescription.length} characters</p>
          {state.error && <p className="text-sm text-red-600 mt-2">{state.error}</p>}
          <Button
            onClick={handleAnalyze}
            disabled={state.jobDescription.length < 50}
            className="mt-4 w-full"
          >
            Analyze Match →
          </Button>

          {versionPreview.open && versionPreviewBuffer && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setVersionPreview({ open: false, title: "", fileName: "", buffer: null });
              }}
            >
              <div className="w-full max-w-5xl rounded-xl bg-white shadow-lg border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{versionPreview.title} preview</p>
                    <p className="text-xs text-gray-500 truncate">{versionPreview.fileName}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setVersionPreview({ open: false, title: "", fileName: "", buffer: null })}
                  >
                    Close
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <div style={{ minWidth: "816px" }}>
                    <DocxEditor
                      documentBuffer={versionPreviewBuffer}
                      mode="viewing"
                      readOnly
                      showToolbar={false}
                      documentNameEditable={false}
                      style={{ height: "70vh" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Loading */}
      {state.currentStep === 3 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-2">Analyzing Your Resume</h2>
          <div className="space-y-2 text-gray-500 text-sm">
            <p>✓ Resume extracted</p>
            <p>✓ Job description parsed</p>
            <p className="animate-pulse">⋯ AI analysis running</p>
          </div>
          <div className="mt-8">
            <BackButton onClick={() => {
              analysisAbortRef.current?.abort();
              dispatch({ type: "SET_STEP", step: 2 });
            }}>
              Cancel
            </BackButton>
          </div>
        </div>
      )}

      {/* Step 4 — Results */}
      {state.currentStep === 4 && state.matchAnalysis && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Your Results</h2>
            <BackButton onClick={() => dispatch({ type: "SET_STEP", step: 2 })}>
              Change job description
            </BackButton>
          </div>
          {hasPaid ? (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
                <MatchScore analysis={state.matchAnalysis} />
              </div>
              {state.isFetchingSuggestions ? (
                <div className="flex items-center gap-3 py-8 text-slate-400 text-sm">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  Loading your personalized suggestions…
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Improvement Suggestions
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      ({acceptedCount} of {state.suggestions.length} accepted)
                    </span>
                  </h3>
                  <div className="space-y-4 mb-6">
                    {state.suggestions.map((suggestion) => (
                      <SuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        onToggle={(id) => dispatch({ type: "TOGGLE_SUGGESTION", id })}
                        onEdit={(id, suggested) => dispatch({ type: "EDIT_SUGGESTION", id, suggested })}
                      />
                    ))}
                  </div>
                </>
              )}
              <Button
                onClick={() => dispatch({ type: "NEXT_STEP" })}
                className="w-full"
                disabled={state.isFetchingSuggestions}
              >
                Generate Optimized Resume →
              </Button>
            </>
          ) : (
            <>
              <MatchCategoryBadge score={state.matchAnalysis.score} />
              <div className="mt-6">
                <FreeTierOverlay onBuyCredits={handleSaveFlowForResume} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 5 — Review (paid only) */}
      {state.currentStep === 5 && hasPaid && (
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Review Optimized Resume</h2>
              <p className="text-sm text-gray-500 mt-1">
                {acceptedCount} improvement{acceptedCount === 1 ? "" : "s"} applied.
                Edit the optimized document directly, then optimize again or finalize.
              </p>
            </div>
            <BackButton onClick={() => dispatch({ type: "SET_STEP", step: 4 })}>
              Back to suggestions
            </BackButton>
          </div>

          {/* Editor */}
          {state.isFetchingPreview ? (
            <div className="flex items-center justify-center h-[75vh] border rounded-xl bg-white">
              <div className="text-center text-gray-400">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm">Applying suggestions…</p>
              </div>
            </div>
          ) : activeEditorBuffer ? (
            <div className="overflow-x-auto">
              <div style={{ minWidth: "816px" }}>
                <DocxEditor
                  ref={rightEditorRef}
                  documentBuffer={activeEditorBuffer}
                  showToolbar={false}
                  style={{ height: "75vh" }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[75vh] border rounded-xl bg-white text-sm text-gray-400">
              Preparing optimized document…
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleOptimizeAgain()}
              disabled={!activeEditorBuffer || !state.projectId}
            >
              Optimize again →
            </Button>
            <Button
              onClick={() => void handleFinalizeResume()}
              disabled={!activeEditorBuffer || !state.projectId}
            >
              Finalize resume →
            </Button>
          </div>
        </div>
      )}

      {/* Step 6 — Download (paid only) */}
      {state.currentStep === 6 && hasPaid && (
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Download Your Resume</h2>
              <p className="text-sm text-gray-500 mt-1">
                Your finalized resume is ready. Download it in your preferred format.
              </p>
            </div>
            <BackButton onClick={() => dispatch({ type: "SET_STEP", step: 5 })}>
              Back to review
            </BackButton>
          </div>

          {/* Previous versions panel */}
          {state.projectId && (
            <div className="border border-gray-200 rounded-xl p-4 bg-white">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <button
                    type="button"
                    onClick={() => setIsDownloadVersionsOpen((v) => !v)}
                    className="flex items-center gap-2 text-left"
                  >
                    <span className="text-sm font-semibold">Previous versions</span>
                    <span className="text-xs text-gray-400">({state.versions.length})</span>
                    <span className="text-xs text-gray-500">
                      {isDownloadVersionsOpen ? "Hide" : "Show"}
                    </span>
                  </button>
                  <p className="text-xs text-gray-500">Download or preview any version you've generated.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void refreshVersions(state.projectId)}
                  disabled={state.isFetchingVersions}
                >
                  {state.isFetchingVersions ? "Refreshing…" : "Refresh"}
                </Button>
              </div>

              {isDownloadVersionsOpen && (
                <>
                  {state.versions.length === 0 ? (
                    <p className="text-sm text-gray-500">No versions yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {state.versions.map((v) => (
                        <div
                          key={v.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {v.label} <span className="text-xs text-gray-400">• run {v.runNumber}</span>
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {new Date(v.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={async () => {
                                const res = await fetch(`/api/resume-versions/${v.id}/docx`);
                                if (!res.ok) { toast.error("Failed to download DOCX"); return; }
                                const ab = await res.arrayBuffer();
                                triggerBlobDownload(
                                  new Blob([ab], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
                                  toDocxDownloadName(v.originalFileName)
                                );
                              }}
                            >
                              DOCX
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={async () => {
                                const res = await fetch(`/api/resume-versions/${v.id}/pdf`);
                                if (!res.ok) {
                                  toast.error(res.status === 402 ? "Insufficient credits for PDF" : "Failed to download PDF");
                                  return;
                                }
                                const blob = await res.blob();
                                triggerBlobDownload(blob, toDocxDownloadName(v.originalFileName).replace(/\.docx$/i, ".pdf"));
                                router.refresh();
                              }}
                            >
                              PDF
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={async () => {
                                const res = await fetch(`/api/resume-versions/${v.id}/docx`);
                                if (!res.ok) { toast.error("Failed to load preview"); return; }
                                const ab = await res.arrayBuffer();
                                setVersionPreview({ open: true, title: v.label, fileName: toDocxDownloadName(v.originalFileName), buffer: ab });
                              }}
                            >
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Final download buttons */}
          <div className="border border-gray-200 rounded-xl p-6 bg-white">
            <h3 className="text-lg font-semibold mb-1">Download Final Version</h3>
            <p className="text-sm text-gray-500 mb-4">Download your finalized resume.</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void handleDownloadFinalized("docx")} disabled={!state.finalizedDocxBase64}>
                Download DOCX
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleDownloadFinalized("pdf")}
                disabled={!state.finalizedDocxBase64}
              >
                Download PDF
              </Button>
            </div>
          </div>

          {/* Start over */}
          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: "RESET_FLOW" })}
            >
              Optimize another resume →
            </Button>
          </div>

          {versionPreview.open && versionPreviewBuffer && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setVersionPreview({ open: false, title: "", fileName: "", buffer: null });
              }}
            >
              <div className="w-full max-w-5xl rounded-xl bg-white shadow-lg border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{versionPreview.title} preview</p>
                    <p className="text-xs text-gray-500 truncate">{versionPreview.fileName}</p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setVersionPreview({ open: false, title: "", fileName: "", buffer: null })}>
                    Close
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <div style={{ minWidth: "816px" }}>
                    <DocxEditor
                      documentBuffer={versionPreviewBuffer}
                      mode="viewing"
                      readOnly
                      showToolbar={false}
                      documentNameEditable={false}
                      style={{ height: "70vh" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
