import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Type, Link as LinkIcon, Lightbulb, Upload,
  Brain, ArrowLeft, Camera, Image as ImageIcon, X, RotateCcw,
  Layers, CheckSquare, Tag, FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PageTransition from "@/components/PageTransition";
import { reportQuestProgress } from "@/lib/questProgress";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const TAB_GROUPS = [
  {
    label: "Generate from",
    tabs: [
      { id: "topic",   label: "Topic",   icon: Lightbulb },
      { id: "text",    label: "Text",    icon: Type      },
      { id: "article", label: "Article", icon: LinkIcon  },
    ],
  },
  {
    label: "Upload",
    tabs: [
      { id: "pdf",   label: "PDF",   icon: FileText  },
      { id: "image", label: "Image", icon: ImageIcon },
      { id: "scan",  label: "Scan",  icon: Camera    },
    ],
  },
];

const processingSteps = [
  "Reading your material…",
  "Identifying key concepts…",
  "Detecting subject area…",
  "Generating flashcards with AI…",
  "Building quiz questions…",
  "Saving to your study set…",
];

interface GenerateResult {
  studySetId: string;
  studySetTitle: string;
  topic: string;
  subject: string;
  folderId: string;
  flashcardCount: number;
  quizCount: number;
}

const CreateStudySet = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab]   = useState("topic");
  const [input, setInput]           = useState("");
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone]             = useState(false);
  const [result, setResult]         = useState<GenerateResult | null>(null);
  const [error, setError]           = useState<string | null>(null);

  // File upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview]   = useState<string | null>(null);
  const pdfInputRef   = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Camera / scan
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive,    setCameraActive]    = useState(false);
  const [capturedBlob,    setCapturedBlob]    = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  useEffect(() => () => stopCamera(), []);

  // ── Camera helpers ──────────────────────────────────────────────────────────
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
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
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedBlob(blob);
      setCapturedPreview(URL.createObjectURL(blob));
      stopCamera();
    }, "image/jpeg", 0.92);
  };

  const retake = () => { setCapturedBlob(null); setCapturedPreview(null); startCamera(); };

  // ── Tab change ──────────────────────────────────────────────────────────────
  const handleTabChange = (tabId: string) => {
    if (activeTab === "scan") stopCamera();
    setActiveTab(tabId);
    setSelectedFile(null);
    setFilePreview(null);
    setCapturedBlob(null);
    setCapturedPreview(null);
    setInput("");
    setError(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "pdf" | "image") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setError(null);
    if (type === "image") setFilePreview(URL.createObjectURL(file));
  };

  // ── API helpers ─────────────────────────────────────────────────────────────
  const getToken = () => localStorage.getItem("token");

  const uploadFile = async (file: File | Blob, filename = "file") => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file, filename);
    const res = await fetch(`${API_URL}/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Upload failed"); }
    return res.json() as Promise<{ id: string }>;
  };

  // ── Generate ────────────────────────────────────────────────────────────────
  const generate = async () => {
    setError(null);
    setProcessing(true);
    setCurrentStep(0);

    // Cosmetic progress — steps advance every ~2 s while AI works
    const interval = setInterval(() => {
      setCurrentStep((p) => (p < processingSteps.length - 2 ? p + 1 : p));
    }, 2200);

    try {
      const token = getToken();
      const body: Record<string, string> = { type: activeTab };

      if (activeTab === "image" && selectedFile) {
        const { id } = await uploadFile(selectedFile, selectedFile.name);
        body.uploadId = id;
      } else if (activeTab === "scan" && capturedBlob) {
        const { id } = await uploadFile(capturedBlob, "scan.jpg");
        body.type    = "image";   // backend treats scan as image
        body.uploadId = id;
      } else if (activeTab === "pdf" && selectedFile) {
        const { id } = await uploadFile(selectedFile, selectedFile.name);
        body.uploadId = id;
      } else {
        body.content = input.trim();
      }

      const res = await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Generation failed");
      }

      const data: GenerateResult = await res.json();
      setResult(data);
      reportQuestProgress("create_set", 1);

      clearInterval(interval);
      setCurrentStep(processingSteps.length - 1);
      setTimeout(() => { setProcessing(false); setDone(true); }, 600);
    } catch (err) {
      clearInterval(interval);
      setProcessing(false);
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const canProceed = (() => {
    if (activeTab === "pdf")   return selectedFile !== null;
    if (activeTab === "image") return selectedFile !== null;
    if (activeTab === "scan")  return capturedBlob !== null;
    return input.trim() !== "";
  })();

  // ── Done screen ─────────────────────────────────────────────────────────────
  if (done && result) {
    return (
      <PageTransition>
        <div className="py-8 space-y-6 max-w-lg mx-auto text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto">
              <Brain size={36} className="text-primary-foreground" />
            </div>
          </motion.div>

          <div>
            <h2 className="text-2xl font-bold">Study Set Ready!</h2>
            <p className="text-muted-foreground mt-1">
              Saved to your <span className="text-primary font-medium">{result.subject}</span> folder
            </p>
          </div>

          {/* Topic + subject badges */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Tag size={12} /> {result.topic}
            </span>
            <Link to={`/folders/${result.folderId}`}>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground hover:text-foreground text-xs font-medium cursor-pointer transition-colors">
                <FolderOpen size={12} /> {result.subject}
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-4 flex flex-col items-center gap-1">
              <Layers size={22} className="text-primary" />
              <p className="text-2xl font-bold text-primary">{result.flashcardCount}</p>
              <p className="text-xs text-muted-foreground">Flashcards</p>
            </div>
            <div className="glass-card p-4 flex flex-col items-center gap-1">
              <CheckSquare size={22} className="text-primary" />
              <p className="text-2xl font-bold text-primary">{result.quizCount}</p>
              <p className="text-xs text-muted-foreground">Quiz Questions</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => { setDone(false); setResult(null); setInput(""); setSelectedFile(null); setFilePreview(null); setCapturedBlob(null); setCapturedPreview(null); }}
              className="flex-1 h-12 rounded-xl bg-muted/30 border-white/5"
            >
              Add More
            </Button>
            <Button
              onClick={() => navigate(`/study-set/${result.studySetId}`)}
              className="flex-1 h-12 rounded-xl gradient-primary text-primary-foreground font-semibold border-0"
            >
              Start Studying
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  // ── Processing screen ───────────────────────────────────────────────────────
  if (processing) {
    return (
      <PageTransition>
        <div className="py-20 flex flex-col items-center justify-center space-y-8">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}>
            <Brain size={48} className="text-primary" />
          </motion.div>
          <div className="space-y-3 text-center max-w-xs">
            {processingSteps.map((step, i) => (
              <motion.p
                key={step}
                initial={{ opacity: 0.25 }}
                animate={{ opacity: i <= currentStep ? 1 : 0.25 }}
                className={`text-sm transition-colors ${
                  i === currentStep ? "text-primary font-medium" : i < currentStep ? "text-muted-foreground" : "text-muted-foreground/30"
                }`}
              >
                {i < currentStep ? "✓ " : i === currentStep ? "⟳ " : ""}
                {step}
              </motion.p>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/60">This may take 10–20 seconds…</p>
        </div>
      </PageTransition>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <PageTransition>
      <div className="py-4 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Create Study Set</h1>
        </div>

        {/* Input type selector */}
        <div className="space-y-3">
          {TAB_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider px-0.5">
                {group.label}
              </p>
              <div className={`grid gap-2 ${group.label === "Generate from" ? "grid-cols-3" : "grid-cols-3"}`}>
                {group.tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleTabChange(id)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-medium transition-all ${
                      activeTab === id
                        ? "gradient-primary text-primary-foreground shadow-sm"
                        : "glass-card text-muted-foreground hover:text-foreground hover:border-white/20"
                    }`}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Input area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-card p-4"
          >
            {/* Topic */}
            {activeTab === "topic" && (
              <Input
                placeholder="e.g., Photosynthesis, French Revolution, Linear Algebra"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="bg-transparent border-0 h-12 text-base focus-visible:ring-0 placeholder:text-muted-foreground/50"
              />
            )}

            {/* Text */}
            {activeTab === "text" && (
              <Textarea
                placeholder="Paste your notes, textbook excerpt, or any study material…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="bg-transparent border-0 min-h-[200px] text-sm resize-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
              />
            )}

            {/* PDF */}
            {activeTab === "pdf" && (
              <>
                <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => handleFileSelect(e, "pdf")} />
                <div
                  onClick={() => pdfInputRef.current?.click()}
                  className="border-2 border-dashed border-white/10 rounded-xl p-12 text-center space-y-3 cursor-pointer hover:border-primary/40 transition-colors"
                >
                  {selectedFile ? (
                    <>
                      <FileText size={32} className="mx-auto text-primary" />
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB — click to change</p>
                    </>
                  ) : (
                    <>
                      <Upload size={32} className="mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Drag & drop your PDF here</p>
                      <p className="text-xs text-muted-foreground/60">or click to browse</p>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Image */}
            {activeTab === "image" && (
              <>
                <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => handleFileSelect(e, "image")} />
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center space-y-3 cursor-pointer hover:border-primary/40 transition-colors"
                >
                  {filePreview ? (
                    <div className="space-y-3">
                      <img src={filePreview} alt="Selected" className="max-h-48 mx-auto rounded-lg object-contain" />
                      <p className="text-xs text-muted-foreground">{selectedFile?.name} — click to change</p>
                    </div>
                  ) : (
                    <>
                      <ImageIcon size={32} className="mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Upload a photo of your notes or textbook</p>
                      <p className="text-xs text-muted-foreground/60">JPG, PNG, WEBP — click to browse</p>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Scan */}
            {activeTab === "scan" && (
              <div className="space-y-4">
                <canvas ref={canvasRef} className="hidden" />
                {capturedPreview ? (
                  <div className="space-y-3">
                    <img src={capturedPreview} alt="Captured" className="w-full rounded-xl object-contain max-h-64" />
                    <Button variant="outline" onClick={retake} className="w-full gap-2">
                      <RotateCcw size={16} /> Retake
                    </Button>
                  </div>
                ) : cameraActive ? (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden bg-black">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-64 object-cover" />
                      <button onClick={stopCamera} className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white hover:bg-black/70">
                        <X size={16} />
                      </button>
                    </div>
                    <Button onClick={capture} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold border-0">
                      <Camera size={18} className="mr-2" /> Capture
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-white/10 rounded-xl p-12 text-center space-y-3">
                    <Camera size={32} className="mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Scan notes or a textbook page with your camera</p>
                    <Button onClick={startCamera} className="gradient-primary text-primary-foreground border-0">
                      Start Camera
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Article */}
            {activeTab === "article" && (
              <Input
                placeholder="https://en.wikipedia.org/wiki/…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="bg-transparent border-0 h-12 text-base focus-visible:ring-0 placeholder:text-muted-foreground/50"
              />
            )}
          </motion.div>
        </AnimatePresence>

        {error && <p className="text-sm text-red-400 text-center px-2">{error}</p>}

        <Button
          onClick={generate}
          disabled={!canProceed}
          className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-base border-0"
        >
          Generate Study Set ✨
        </Button>

        <p className="text-xs text-center text-muted-foreground/50">
          AI will detect the subject and group it with your existing study sets
        </p>
      </div>
    </PageTransition>
  );
};

export default CreateStudySet;
