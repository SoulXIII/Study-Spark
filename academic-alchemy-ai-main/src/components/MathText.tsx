import { MathJax } from "better-react-mathjax";

/**
 * Renders a string that may contain LaTeX math ($...$ or $$...$$).
 * MathJaxContext is provided globally in main.tsx.
 * `dynamic` ensures re-typesetting whenever the content changes (e.g. next flashcard).
 */
const MathText = ({ children, className }: { children: string; className?: string }) => (
  <MathJax dynamic className={className}>
    {children}
  </MathJax>
);

export default MathText;
