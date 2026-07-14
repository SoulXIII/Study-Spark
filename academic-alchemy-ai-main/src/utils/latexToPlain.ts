/**
 * Converts LaTeX math notation to readable plain-text / Unicode math.
 * Handles both inline ($...$) and display ($$...$$) math blocks.
 */

// ─── Unicode superscript map ──────────────────────────────────────────────────
const SUPER: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  'a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','f':'ᶠ','g':'ᵍ','h':'ʰ','i':'ⁱ',
  'j':'ʲ','k':'ᵏ','l':'ˡ','m':'ᵐ','n':'ⁿ','o':'ᵒ','p':'ᵖ','r':'ʳ','s':'ˢ',
  't':'ᵗ','u':'ᵘ','v':'ᵛ','w':'ʷ','x':'ˣ','y':'ʸ','z':'ᶻ',
  '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾',
};

// ─── Unicode subscript map ────────────────────────────────────────────────────
const SUB: Record<string, string> = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  'a':'ₐ','e':'ₑ','i':'ᵢ','n':'ₙ','o':'ₒ','r':'ᵣ','s':'ₛ','t':'ₜ','u':'ᵤ',
  'v':'ᵥ','x':'ₓ','+':'+','-':'₋',
};

// ─── Greek letter map ─────────────────────────────────────────────────────────
const GREEK: Record<string, string> = {
  'alpha':'α','beta':'β','gamma':'γ','delta':'δ','epsilon':'ε','zeta':'ζ',
  'eta':'η','theta':'θ','iota':'ι','kappa':'κ','lambda':'λ','mu':'μ',
  'nu':'ν','xi':'ξ','pi':'π','rho':'ρ','sigma':'σ','tau':'τ','upsilon':'υ',
  'phi':'φ','chi':'χ','psi':'ψ','omega':'ω',
  // uppercase
  'Alpha':'Α','Beta':'Β','Gamma':'Γ','Delta':'Δ','Epsilon':'Ε','Zeta':'Ζ',
  'Eta':'Η','Theta':'Θ','Iota':'Ι','Kappa':'Κ','Lambda':'Λ','Mu':'Μ',
  'Nu':'Ν','Xi':'Ξ','Pi':'Π','Rho':'Ρ','Sigma':'Σ','Tau':'Τ','Upsilon':'Υ',
  'Phi':'Φ','Chi':'Χ','Psi':'Ψ','Omega':'Ω',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Find the index of the matching closing brace for an opening brace at `start`. */
function matchingBrace(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return s.length - 1;
}

/** Convert a string of simple chars to Unicode superscripts where possible. */
function toSuper(s: string): string {
  // If every character maps, use Unicode superscripts; otherwise fall back to ^(s)
  const mapped = [...s].map(c => SUPER[c] ?? null);
  if (mapped.every(Boolean)) return mapped.join('');
  return `^(${s})`;
}

/** Convert a string of simple chars to Unicode subscripts where possible. */
function toSub(s: string): string {
  const mapped = [...s].map(c => SUB[c] ?? null);
  if (mapped.every(Boolean)) return mapped.join('');
  return `_(${s})`;
}

// ─── Core math expression converter ──────────────────────────────────────────

/**
 * Recursively converts a raw LaTeX math expression (no delimiters) to plain text.
 */
export function convertMathExpr(expr: string): string {
  let r = expr.trim();

  // 1. Remove spacing commands
  r = r.replace(/\\(?:,|;|:|!|quad|qquad|enspace|thinspace)\s*/g, ' ');

  // 2. \text{...} → content as-is
  r = r.replace(/\\text\{([^}]*)\}/g, '$1');
  r = r.replace(/\\mathrm\{([^}]*)\}/g, '$1');
  r = r.replace(/\\mathbf\{([^}]*)\}/g, '$1');
  r = r.replace(/\\mathit\{([^}]*)\}/g, '$1');
  r = r.replace(/\\boldsymbol\{([^}]*)\}/g, '$1');

  // 3. \frac{a}{b} → a/b  (iterate to handle nesting)
  let prev = '';
  while (prev !== r) {
    prev = r;
    r = r.replace(/\\frac(?:\s*)\{/g, (match, offset) => {
      // Find content of first brace
      const fullStr = r;
      const braceStart = fullStr.indexOf('{', offset + match.length - 1);
      if (braceStart === -1) return match;
      const braceEnd = matchingBrace(fullStr, braceStart);
      const num = fullStr.slice(braceStart + 1, braceEnd);

      const secondBraceStart = braceEnd + 1;
      if (fullStr[secondBraceStart] !== '{') return match;
      const secondBraceEnd = matchingBrace(fullStr, secondBraceStart);
      const den = fullStr.slice(secondBraceStart + 1, secondBraceEnd);

      // Replace in r
      const fullMatch = fullStr.slice(offset, secondBraceEnd + 1);
      r = r.replace(fullMatch, `(${convertMathExpr(num)})/(${convertMathExpr(den)})`);
      return ''; // won't be used; r is reassigned
    });
    // Simpler pass using regex (catches most practical cases after above)
    r = r.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, n, d) => {
      const ns = convertMathExpr(n);
      const ds = convertMathExpr(d);
      // Skip parens if numerator/denominator are already simple tokens
      const simple = (s: string) => /^[\w\d.+\-*/^()]+$/.test(s);
      return simple(ns) && simple(ds) ? `${ns}/${ds}` : `(${ns})/(${ds})`;
    });
  }

  // 4. \sqrt{x} → √(x) , \sqrt[n]{x} → ⁿ√(x)
  r = r.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, (_, n, x) => `${toSuper(n)}√(${convertMathExpr(x)})`);
  r = r.replace(/\\sqrt\{([^}]+)\}/g, (_, x) => `√(${convertMathExpr(x)})`);
  r = r.replace(/\\sqrt\s+(\S+)/g, (_, x) => `√(${x})`);

  // 5. Integrals: \int_{a}^{b} , \int_a^b
  r = r.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, (_, a, b) =>
    `∫(${convertMathExpr(a)} to ${convertMathExpr(b)})`);
  r = r.replace(/\\int_([^{^\s\\]+)\^\{([^}]+)\}/g, (_, a, b) =>
    `∫(${a} to ${convertMathExpr(b)})`);
  r = r.replace(/\\int_\{([^}]+)\}\^([^{^\s\\]+)/g, (_, a, b) =>
    `∫(${convertMathExpr(a)} to ${b})`);
  r = r.replace(/\\int_([^{^\s\\,]+)\^([^{^\s\\,]+)/g, (_, a, b) =>
    `∫${toSub(a)}${toSuper(b)}`);
  r = r.replace(/\\int_\{([^}]+)\}/g, (_, a) => `∫(from ${convertMathExpr(a)})`);
  r = r.replace(/\\int/g, '∫');

  // 6. Sums / products: \sum_{i=0}^{n} , \prod
  r = r.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, (_, a, b) =>
    `Σ(${convertMathExpr(a)} to ${convertMathExpr(b)})`);
  r = r.replace(/\\sum_([^{^\s\\]+)\^([^{^\s\\]+)/g, (_, a, b) =>
    `Σ${toSub(a)}${toSuper(b)}`);
  r = r.replace(/\\sum_\{([^}]+)\}/g, (_, a) => `Σ(${convertMathExpr(a)})`);
  r = r.replace(/\\sum/g, 'Σ');
  r = r.replace(/\\prod_\{([^}]+)\}\^\{([^}]+)\}/g, (_, a, b) =>
    `Π(${convertMathExpr(a)} to ${convertMathExpr(b)})`);
  r = r.replace(/\\prod/g, 'Π');

  // 7. Limits
  r = r.replace(/\\lim_\{([^}]+)\}/g, (_, a) => `lim(${convertMathExpr(a)})`);
  r = r.replace(/\\lim/g, 'lim');

  // 8. Superscripts  ^{...} or ^single
  r = r.replace(/\^\{([^}]+)\}/g, (_, s) => toSuper(convertMathExpr(s)));
  r = r.replace(/\^([0-9a-zA-Z])/g, (_, c) => toSuper(c));

  // 9. Subscripts  _{...} or _single
  r = r.replace(/_\{([^}]+)\}/g, (_, s) => toSub(convertMathExpr(s)));
  r = r.replace(/_([0-9a-zA-Z])/g, (_, c) => toSub(c));

  // 10. Greek letters
  for (const [name, sym] of Object.entries(GREEK)) {
    r = r.replace(new RegExp(`\\\\${name}(?![a-zA-Z])`, 'g'), sym);
  }

  // 11. Common symbols
  r = r.replace(/\\infty/g, '∞');
  r = r.replace(/\\partial/g, '∂');
  r = r.replace(/\\nabla/g, '∇');
  r = r.replace(/\\pm/g, '±');
  r = r.replace(/\\mp/g, '∓');
  r = r.replace(/\\times/g, '×');
  r = r.replace(/\\div/g, '÷');
  r = r.replace(/\\cdot/g, '·');
  r = r.replace(/\\circ/g, '∘');
  r = r.replace(/\\bullet/g, '•');
  r = r.replace(/\\leq|\\le(?![a-z])/g, '≤');
  r = r.replace(/\\geq|\\ge(?![a-z])/g, '≥');
  r = r.replace(/\\neq|\\ne(?![a-z])/g, '≠');
  r = r.replace(/\\approx/g, '≈');
  r = r.replace(/\\equiv/g, '≡');
  r = r.replace(/\\sim/g, '~');
  r = r.replace(/\\propto/g, '∝');
  r = r.replace(/\\in(?![a-z])/g, '∈');
  r = r.replace(/\\notin/g, '∉');
  r = r.replace(/\\subset/g, '⊂');
  r = r.replace(/\\subseteq/g, '⊆');
  r = r.replace(/\\cup/g, '∪');
  r = r.replace(/\\cap/g, '∩');
  r = r.replace(/\\forall/g, '∀');
  r = r.replace(/\\exists/g, '∃');
  r = r.replace(/\\neg/g, '¬');
  r = r.replace(/\\to(?![a-z])/g, '→');
  r = r.replace(/\\rightarrow/g, '→');
  r = r.replace(/\\leftarrow/g, '←');
  r = r.replace(/\\Rightarrow/g, '⇒');
  r = r.replace(/\\Leftarrow/g, '⇐');
  r = r.replace(/\\leftrightarrow/g, '↔');
  r = r.replace(/\\Leftrightarrow/g, '⟺');
  r = r.replace(/\\ldots|\\cdots|\\dots/g, '…');
  r = r.replace(/\\ln(?![a-z])/g, 'ln');
  r = r.replace(/\\log(?![a-z])/g, 'log');
  r = r.replace(/\\exp(?![a-z])/g, 'exp');
  r = r.replace(/\\sin(?![a-z])/g, 'sin');
  r = r.replace(/\\cos(?![a-z])/g, 'cos');
  r = r.replace(/\\tan(?![a-z])/g, 'tan');
  r = r.replace(/\\arcsin/g, 'arcsin');
  r = r.replace(/\\arccos/g, 'arccos');
  r = r.replace(/\\arctan/g, 'arctan');
  r = r.replace(/\\max(?![a-z])/g, 'max');
  r = r.replace(/\\min(?![a-z])/g, 'min');
  r = r.replace(/\\sup(?![a-z])/g, 'sup');
  r = r.replace(/\\inf(?![a-z])/g, 'inf');
  r = r.replace(/\\det(?![a-z])/g, 'det');
  r = r.replace(/\\dim(?![a-z])/g, 'dim');
  r = r.replace(/\\ker(?![a-z])/g, 'ker');
  r = r.replace(/\\Re(?![a-z])/g, 'Re');
  r = r.replace(/\\Im(?![a-z])/g, 'Im');

  // 12. Remove sizing/bracket decorators: \left \right \big \Big etc.
  r = r.replace(/\\(?:left|right|[bB]ig[gr]?)\s*/g, '');

  // 13. Remove environment wrappers (align, equation, matrix, etc.)
  r = r.replace(/\\begin\{[^}]+\}|\\end\{[^}]+\}/g, '');
  r = r.replace(/\\\\/g, '\n');   // line breaks inside environments
  r = r.replace(/&/g, '  ');      // alignment tabs → spaces

  // 14. Remove remaining backslash commands we don't recognise
  r = r.replace(/\\[a-zA-Z]+/g, '');

  // 15. Strip bare braces
  r = r.replace(/\{([^{}]*)\}/g, '$1');
  r = r.replace(/[{}]/g, '');

  // 16. Tidy whitespace
  r = r.replace(/[ \t]{2,}/g, ' ').trim();

  return r;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scans the full text for LaTeX math regions and replaces each with
 * its plain-text equivalent. Markdown outside math blocks is untouched.
 */
export function latexToPlain(text: string): string {
  if (!text) return text;
  let result = text;

  // Display math: $$...$$ (multi-line ok)
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    const converted = convertMathExpr(math);
    // Preserve as its own line for readability
    return `\n${converted}\n`;
  });

  // Display math: \[...\]
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
    return `\n${convertMathExpr(math)}\n`;
  });

  // Inline math: $...$
  result = result.replace(/\$([^$\n]+?)\$/g, (_, math) => convertMathExpr(math));

  // Inline math: \(...\)
  result = result.replace(/\\\(([^)]*?)\\\)/g, (_, math) => convertMathExpr(math));

  // Also convert any stray LaTeX that leaked outside delimiters
  // (e.g. AI sometimes writes \frac without delimiters)
  result = result.replace(/\\frac\{[^}]+\}\{[^}]+\}/g, m => convertMathExpr(m));
  result = result.replace(/\\(?:Lambda|lambda|mu|sigma|alpha|beta|gamma|delta|theta|omega|Omega|phi|Phi|pi|Pi|epsilon|eta|rho|tau|nu|xi|zeta|psi|Psi|kappa|chi)(?![a-zA-Z])/g,
    m => convertMathExpr(m));

  return result;
}
