import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { MathJaxContext } from "better-react-mathjax";

// MathJax config — must be defined before the context renders.
// Supports $...$ inline, $$...$$ display, \(...\) and \[...\]
const mathJaxConfig = {
  tex: {
    inlineMath:    [["$", "$"], ["\\(", "\\)"]],
    displayMath:   [["$$", "$$"], ["\\[", "\\]"]],
    processEscapes: true,
    tags: "ams",
    packages: { "[+]": ["ams", "boldsymbol"] },
  },
  options: {
    skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
  },
  startup: {
    typeset: false, // We call typesetPromise manually so nothing fires too early
  },
};

createRoot(document.getElementById("root")!).render(
  <MathJaxContext version={3} config={mathJaxConfig}>
    <App />
  </MathJaxContext>
);
