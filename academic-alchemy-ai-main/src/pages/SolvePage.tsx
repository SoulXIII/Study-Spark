import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, Type, X, RotateCcw, Sparkles, Copy, Check, BookmarkPlus, Bookmark, FolderOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PageTransition from "@/components/PageTransition";
import { marked } from "marked";
import { MathJax } from "better-react-mathjax";

marked.use({ breaks: true });

const API_URL = import.meta.env.VITE_API_URL || "/api";

type InputMode = "upload" | "camera" | "text";
interface Folder { id: string; name: string; }

const SolutionRenderer = ({ text }: { text: string }) => {
  const html = useMemo(() => marked(text) as string, [text]);
  return (
    <MathJax dynamic>
      <div
        className="solution-body prose prose-invert prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </MathJax>
  );
};

const SolvePage = () => {
  const [mode, setMode] = useState<InputMode>("upload");
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [solving, setSolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Solution state (component-scoped only — no localStorage)
  const [solution, setSolution] = useState<string | null>(null);
  const [detectedSubject, setDetectedSubject] = useState<string | null>(null);
  const [solutionTitle, setSolutionTitle] = useState("");
  const [saved, setSaved] = useState(false);

  // Save-to-folder state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  // Solution lives only in component state — navigating away naturally clears it.
  // No localStorage: solutions were previously shared across all accounts on the
  // same browser because the key was not user-scoped.

  // ── Load folders once solution is available ───────────────────────────────
  useEffect(() => {
    if (!solution) return;
    fetch(`${API_URL}/folders`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then(r => r.json())
      .then((data: Folder[]) => {
        if (Array.isArray(data)) {
          setFolders(data);
          if (detectedSubject) {
            const match = data.find(f => f.name.toLowerCase() === detectedSubject.toLowerCase());
            if (match) setSelectedFolderId(match.id);
          }
        }
      })
      .catch(() => {});
  }, [solution]);

  useEffect(() => () => stopCamera(), []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setError("Could not access camera. Check browser permissions.");
    }
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      setCapturedBlob(blob);
      setPreview(URL.createObjectURL(blob));
      stopCamera();
    }, "image/jpeg", 0.88);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setError(null);
  };

  // Switch mode without touching the solution
  const switchMode = (m: InputMode) => {
    stopCamera();
    setMode(m);
    setSelectedFile(null);
    setPreview(null);
    setCapturedBlob(null);
    setTextInput("");
    setError(null);
    if (m === "camera") startCamera();
  };

  // Close / dismiss solution — only called by the user's X button
  const dismissSolution = () => {
    setSolution(null);
    setDetectedSubject(null);
    setSolutionTitle("");
    setSaved(false);
  };

  const getToken = () => localStorage.getItem("token");

  const handleSolve = async () => {
    setError(null);
    setSolving(true);
    try {
      const token = getToken();
      let body: Record<string, string> = {};

      const imageFile = capturedBlob
        ? new File([capturedBlob], "capture.jpg", { type: "image/jpeg" })
        : selectedFile;

      if ((mode === "upload" || mode === "camera") && imageFile) {
        const form = new FormData();
        form.append("file", imageFile, imageFile.name);
        const uploadRes = await fetch(`${API_URL}/uploads`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!uploadRes.ok) throw new Error("Image upload failed");
        const { id } = await uploadRes.json();
        body.uploadId = id;
      } else if (mode === "text" && textInput.trim()) {
        body.text = textInput.trim();
      } else {
        setError("Please provide a problem to solve.");
        setSolving(false);
        return;
      }

      const res = await fetch(`${API_URL}/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to solve");

      const title = mode === "text" ? textInput.trim().slice(0, 80) : "Solved Problem";
      const subject = data.subject || null;
      setSolution(data.solution);
      setDetectedSubject(subject);
      setSolutionTitle(title);
      setSaveTitle(title);
      setSaved(false);

      // Auto-save to the database so the solution is never lost,
      // even though it won't persist in the UI after navigation.
      fetch(`${API_URL}/solve/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title,
          problemText: mode === "text" ? textInput.trim() : undefined,
          solution: data.solution,
          subject,
        }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(saved => { if (saved) setSaved(true); })
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSolving(false);
    }
  };

  const openSaveModal = () => {
    setSaveTitle(solutionTitle || "Solved Problem");
    setShowSaveModal(true);
  };

  const handleSave = async () => {
    if (!solution) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/solve/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          folderId: selectedFolderId || undefined,
          title: saveTitle.trim() || "Solved Problem",
          problemText: mode === "text" ? textInput.trim() : undefined,
          solution,
          subject: detectedSubject,
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setShowSaveModal(false);
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (!solution) return;
    navigator.clipboard.writeText(solution);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canSolve =
    (mode === "text" && textInput.trim().length > 3) ||
    (mode === "upload" && selectedFile !== null) ||
    (mode === "camera" && capturedBlob !== null);

  const autoFolder = folders.find(f => f.id === selectedFolderId);

  return (
    <PageTransition>
      <div className="py-4 space-y-5 max-w-lg mx-auto pb-24">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Solve</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Photo, camera, or type — AI solves it instantly</p>
        </div>

        {/* ── Persistent Solution Card ────────────────────────────────────── */}
        <AnimatePresence>
          {solution && (
            <motion.div
              key="solution-card"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="glass-card p-5 space-y-3"
            >
              {/* Card header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles size={12} /> AI Solution
                  </p>
                  {detectedSubject && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                      {detectedSubject}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied ? <><Check size={12} className="text-emerald-400" /> Copied</> : <><Copy size={12} /> Copy</>}
                  </button>
                  {saved ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <Bookmark size={12} className="fill-current" /> Saved
                    </span>
                  ) : (
                    <button
                      onClick={openSaveModal}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <BookmarkPlus size={12} />
                      {autoFolder ? autoFolder.name : "Save"}
                    </button>
                  )}
                  {/* X — only way to dismiss */}
                  <button
                    onClick={dismissSolution}
                    className="p-1 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                    title="Dismiss solution"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Preview thumbnail if image was used */}
              {preview && (
                <img src={preview} alt="Problem" className="max-h-32 rounded-xl object-contain opacity-75" />
              )}

              {/* Scrollable solution body */}
              <div className="overflow-y-auto max-h-[60vh] pr-1">
                <SolutionRenderer text={solution} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Input Form — always visible ─────────────────────────────────── */}
        <div className="space-y-4">
          {/* Mode tabs */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: "upload", label: "Upload", icon: Upload },
              { id: "camera", label: "Camera", icon: Camera },
              { id: "text",   label: "Type",   icon: Type   },
            ] as { id: InputMode; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => switchMode(id)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  mode === id
                    ? "gradient-primary text-primary-foreground shadow-sm"
                    : "glass-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={15} />{label}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div className="glass-card p-4 min-h-[180px] flex flex-col">
            {mode === "upload" && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                {preview && !capturedBlob ? (
                  <div className="relative flex-1 flex flex-col gap-3">
                    <img src={preview} alt="Problem" className="max-h-48 mx-auto rounded-xl object-contain" />
                    <button
                      onClick={() => { setPreview(null); setSelectedFile(null); }}
                      className="absolute top-0 right-0 bg-red-500/80 rounded-full p-0.5 text-white"
                    ><X size={14} /></button>
                    <p className="text-xs text-center text-muted-foreground">{selectedFile?.name}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/10 rounded-xl hover:border-primary/40 transition-colors"
                  >
                    <Upload size={28} className="text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Tap to upload a photo of your problem</p>
                    <p className="text-xs text-muted-foreground/60">JPG, PNG, WEBP</p>
                  </button>
                )}
              </>
            )}

            {mode === "camera" && (
              <div className="flex-1 flex flex-col gap-3">
                <canvas ref={canvasRef} className="hidden" />
                {capturedBlob && preview ? (
                  <>
                    <img src={preview} alt="Captured" className="max-h-48 mx-auto rounded-xl object-contain" />
                    <Button variant="outline" onClick={() => { setPreview(null); setCapturedBlob(null); startCamera(); }} className="gap-2 bg-muted/30 border-white/5">
                      <RotateCcw size={14} /> Retake
                    </Button>
                  </>
                ) : cameraActive ? (
                  <>
                    <div className="relative rounded-xl overflow-hidden bg-black">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-44 object-cover" />
                      <button onClick={stopCamera} className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white"><X size={15} /></button>
                    </div>
                    <Button onClick={capture} className="gradient-primary text-primary-foreground border-0">
                      <Camera size={15} className="mr-2" /> Capture
                    </Button>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <Camera size={28} className="text-muted-foreground" />
                    <p className="text-sm text-muted-foreground text-center">Point your camera at the problem</p>
                    <Button onClick={startCamera} className="gradient-primary text-primary-foreground border-0">Start Camera</Button>
                  </div>
                )}
              </div>
            )}

            {mode === "text" && (
              <Textarea
                placeholder={"Type or paste your problem here…\ne.g. Solve 2x² + 5x - 3 = 0\ne.g. What is the difference between TCP and UDP?"}
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                className="flex-1 bg-transparent border-0 resize-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/50 min-h-[140px]"
              />
            )}
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <Button
            onClick={handleSolve}
            disabled={!canSolve || solving}
            className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-base border-0"
          >
            {solving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                Solving…
              </span>
            ) : (
              <span className="flex items-center gap-2"><Sparkles size={17} /> Solve with AI</span>
            )}
          </Button>
        </div>
      </div>

      {/* Save modal */}
      <Dialog open={showSaveModal} onOpenChange={open => { if (!open) setShowSaveModal(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Solution</DialogTitle>
            <DialogDescription>Save this solution to a folder for later reference.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <input
                value={saveTitle}
                onChange={e => setSaveTitle(e.target.value)}
                placeholder="e.g. Integral of μ(s)"
                className="w-full bg-muted/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FolderOpen size={13} /> Folder
              </label>
              {folders.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No folders yet — solution will be saved without a folder.</p>
              ) : (
                <div className="relative">
                  <select
                    value={selectedFolderId}
                    onChange={e => setSelectedFolderId(e.target.value)}
                    className="w-full appearance-none bg-muted/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 pr-8"
                  >
                    <option value="">No folder (unsorted)</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              )}
            </div>
            {detectedSubject && (
              <p className="text-xs text-muted-foreground">
                Detected: <span className="text-primary font-medium">{detectedSubject}</span>
                {autoFolder && <> · auto-matched to <span className="text-primary">{autoFolder.name}</span></>}
              </p>
            )}
            <Button onClick={handleSave} disabled={saving} className="w-full gradient-primary text-primary-foreground border-0">
              {saving ? "Saving…" : "Save Solution"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
};

export default SolvePage;
