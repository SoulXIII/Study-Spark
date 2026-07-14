import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, School, Building2, Briefcase, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/context/AuthContext";

const educationLevels = [
  { value: "middle_school", label: "Middle School", icon: School },
  { value: "high_school", label: "High School", icon: GraduationCap },
  { value: "university", label: "University", icon: Building2 },
  { value: "professional", label: "Professional", icon: Briefcase },
];

const subjects = ["Math", "Science", "History", "Languages", "Computer Science", "Business", "Medicine", "Law", "Art", "Music", "Engineering", "Psychology"];

const Onboarding = () => {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [step, setStep] = useState(0);
  const [education, setEducation] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [dailyGoal, setDailyGoal] = useState([30]);

  const toggleSubject = (s: string) => {
    setSelectedSubjects((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const next = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      // Save user preferences and navigate
      updateUser({
        educationLevel: education,
        subjects: selectedSubjects,
        dailyGoalMinutes: dailyGoal[0],
      });
      navigate("/");
    }
  };

  const canProceed = step === 0 ? education !== "" : step === 1 ? selectedSubjects.length > 0 : true;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 gradient-mesh-bg">
      <div className="w-full max-w-lg">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/50" : "w-4 bg-muted"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
            {step === 0 && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">What's your education level?</h2>
                  <p className="text-muted-foreground">We'll personalize your experience</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {educationLevels.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setEducation(value)}
                      className={`glass-card p-5 flex flex-col items-center gap-3 transition-all ${education === value ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/30"}`}
                    >
                      <Icon size={28} className={education === value ? "text-primary" : "text-muted-foreground"} />
                      <span className="font-medium text-sm">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">What do you study?</h2>
                  <p className="text-muted-foreground">Select all that apply</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {subjects.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSubject(s)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedSubjects.includes(s) ? "gradient-primary text-primary-foreground" : "glass-card text-muted-foreground hover:text-foreground"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">Set your daily study goal</h2>
                  <p className="text-muted-foreground">You can change this anytime</p>
                </div>
                <div className="glass-card p-8 space-y-6">
                  <div className="text-center">
                    <span className="text-5xl font-bold text-primary">{dailyGoal[0]}</span>
                    <span className="text-lg text-muted-foreground ml-2">min/day</span>
                  </div>
                  <Slider value={dailyGoal} onValueChange={setDailyGoal} min={10} max={120} step={5} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10 min</span>
                    <span>120 min</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="flex-1 h-12 rounded-xl bg-muted/30 border-white/5"
            >
              Back
            </Button>
          )}
          <Button
            onClick={next}
            disabled={!canProceed}
            className="flex-1 h-12 rounded-xl gradient-primary text-primary-foreground font-semibold border-0"
          >
            {step === 2 ? "Complete" : "Next"}
            <ChevronRight size={18} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
