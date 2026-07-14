/**
 * Algorithmic study set generator — no AI API required.
 * Uses NLP (compromise + natural TF-IDF) to extract flashcards and quiz from raw text.
 */

import nlp from 'compromise';
import natural from 'natural';

const { TfIdf, WordTokenizer, SentenceTokenizer } = natural;
const wordTokenizer = new WordTokenizer();
const sentenceTokenizer = new SentenceTokenizer();

// ── Stop words ────────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','are','was','were','be','been','being','have','has',
  'had','do','does','did','will','would','could','should','may','might',
  'can','this','that','these','those','it','its','we','us','they','them',
  'he','she','him','her','i','you','me','my','your','his','her','our',
  'their','what','which','who','when','where','how','why','so','just',
  'also','more','very','all','any','each','every','some','such','no',
  'not','only','same','as','than','then','there','here','about','up',
  'out','into','through','during','before','after','above','below',
  'between','if','because','while','although','however','therefore',
  'thus','hence','like','get','got','go','going','come','coming','know',
  'think','say','said','says','make','made','take','taken','see','seen',
  'use','used','need','now','new','one','two','three','first','second',
  'called','called','let','even','back','well','way','want','much',
  'many','good','great','really','actually','basically','essentially',
  'simply','pretty','quite','around','whether','without','within',
  'another','other','certain','called','per','since','once','given',
  'both','own','still','yet','ever','never','always','often','usually',
  'part','time','year','day','thing','something','anything','nothing',
]);

// ── Subject detection ────────────────────────────────────────────────────────
const SUBJECT_VOCAB = {
  'Mathematics':     ['equation','theorem','calculus','algebra','geometry','matrix','derivative','integral','polynomial','vector','function','variable','graph','proof','axiom','trigonometry','logarithm','coefficient','probability','statistics'],
  'Biology':         ['cell','organism','dna','rna','protein','evolution','genetics','photosynthesis','mitosis','chromosome','enzyme','metabolism','bacteria','virus','ecosystem','nucleus','membrane','tissue','mutation','species'],
  'Chemistry':       ['atom','molecule','bond','reaction','element','compound','acid','base','electron','oxidation','reduction','catalyst','solution','concentration','periodic','valence','isotope','chemical','orbital','mole'],
  'Physics':         ['force','energy','velocity','acceleration','momentum','wave','quantum','gravity','thermodynamics','electromagnetic','mass','charge','field','current','voltage','resistance','frequency','amplitude','photon','entropy'],
  'History':         ['war','revolution','empire','century','civilization','dynasty','colonization','democracy','independence','ancient','medieval','renaissance','treaty','monarchy','republic','occupation','rebellion','trade','conquest','parliament'],
  'Geography':       ['continent','ocean','climate','population','country','region','latitude','longitude','erosion','biome','terrain','precipitation','migration','urbanization','river','mountain','desert','plateau','tectonic','rainfall'],
  'Computer Science':['algorithm','function','variable','loop','array','database','programming','software','network','binary','recursion','class','object','compiler','runtime','cpu','memory','cache','protocol','encryption'],
  'Economics':       ['market','supply','demand','inflation','gdp','trade','currency','investment','price','economy','fiscal','monetary','recession','growth','scarcity','opportunity','cost','equilibrium','marginal','utility'],
  'Psychology':      ['behavior','cognition','emotion','memory','personality','mental','therapy','brain','anxiety','perception','motivation','stimulus','response','reinforcement','conditioning','attachment','development','disorder','consciousness','subconscious'],
  'Literature':      ['novel','poem','metaphor','character','narrative','theme','symbolism','author','prose','fiction','protagonist','antagonist','plot','setting','irony','allegory','genre','stanza','imagery','dialogue'],
  'Philosophy':      ['ethics','morality','truth','existence','consciousness','perception','logic','reason','justice','freedom','virtue','knowledge','belief','reality','mind','argument','premise','conclusion','empiricism','rationalism'],
  'Medicine':        ['diagnosis','symptom','treatment','disease','patient','therapy','surgery','medication','organ','tissue','infection','immune','prescription','clinical','pathology','anatomy','physiology','chronic','acute','prognosis'],
  'Nutrition':       ['protein','carbohydrate','fat','vitamin','mineral','calorie','nutrient','diet','metabolism','fiber','antioxidant','glucose','insulin','cholesterol','omega','sodium','potassium','calcium','iron','supplement'],
  'Astronomy':       ['planet','star','galaxy','orbit','solar','lunar','comet','asteroid','nebula','universe','telescope','gravity','light','black hole','supernova','constellation','atmosphere','radiation','spectrum','mass'],
};

export const detectSubject = (text) => {
  const lower = text.toLowerCase();
  let best = 'Other', bestScore = 0;
  for (const [subject, keywords] of Object.entries(SUBJECT_VOCAB)) {
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) { bestScore = score; best = subject; }
  }
  return best;
};

// ── Top keywords via TF-IDF ───────────────────────────────────────────────────
const getTopKeywords = (sentences, topN = 25) => {
  const tfidf = new TfIdf();
  sentences.forEach(s => tfidf.addDocument(s.toLowerCase()));

  const scores = {};
  sentences.forEach((_, docIdx) => {
    tfidf.listTerms(docIdx).forEach(({ term, tfidf: score }) => {
      if (term.length < 3) return;
      if (STOP_WORDS.has(term)) return;
      if (/^\d+$/.test(term)) return;
      scores[term] = (scores[term] || 0) + score;
    });
  });

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term]) => term);
};

// ── Clean and split text into good sentences ─────────────────────────────────
const getSentences = (text) => {
  // Clean transcript noise
  const cleaned = text
    .replace(/\[.*?\]/g, '')          // remove [Music], [Applause] etc.
    .replace(/\(.*?\)/g, '')          // remove (inaudible) etc.
    .replace(/\s+/g, ' ')
    .trim();

  const raw = sentenceTokenizer.tokenize(cleaned);
  return raw
    .map(s => s.trim())
    .filter(s => s.length > 35 && s.split(' ').length >= 6)
    .filter(s => !/^(so|well|okay|now|alright|um|uh|like|you know)/i.test(s))
    // Filter out Wikipedia/article boilerplate
    .filter(s => !/^(from wikipedia|this article|this page|jump to|retrieved from|see also|external link|categor|references|edit source|wikimedia|wikipedia is|the free encyclopedia|main page|contents|current events|random article|about wikipedia|contact us|donate|help|what links here|related changes|upload file|special pages|permanent link|page information|cite this page|wikidata item|print\/export|in other projects|in other languages|this wiki|navigation menu|personal tools|namespaces|views|more|search|toolbox|in wikipedia|coordinate|coordinates|isbn|issn|doi|pmid|citation needed|further reading|bibliography|notes and references)/i.test(s))
    .filter(s => !/\|\s*edit\s*\]|\[\s*edit\s*\]|\[\d+\]$/.test(s));
};

// ── Extract title from top keywords ──────────────────────────────────────────
const extractTitle = (text, keywords) => {
  // Use compromise to find a dominant noun phrase
  const doc = nlp(text.slice(0, 2000));
  const topics = doc.topics().out('array');
  if (topics.length > 0) {
    return topics[0].length > 60 ? topics[0].slice(0, 60) : topics[0];
  }
  // Fall back to top 2-3 keywords
  const titleKeywords = keywords.slice(0, 3);
  return titleKeywords.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(', ');
};

// ── Flashcard generation ──────────────────────────────────────────────────────
const DEF_PATTERNS = [
  { re: /^(.+?)\s+(?:is|are)\s+(?:a|an|the)?\s*(.{10,})$/i,       q: (m) => `What is ${m[1].trim()}?`,           a: (m) => m[2].trim() },
  { re: /^(.+?)\s+(?:means|refers to|describes)\s+(.{10,})$/i,     q: (m) => `What does "${m[1].trim()}" mean?`,  a: (m) => m[2].trim() },
  { re: /^(.+?)\s+(?:is defined as|is known as)\s+(.{10,})$/i,     q: (m) => `How is ${m[1].trim()} defined?`,    a: (m) => m[2].trim() },
  { re: /^(.+?)\s+(?:was|were)\s+(?:invented|discovered|created)\s+(?:by|in)\s+(.{5,})$/i, q: (m) => `Who or when was ${m[1].trim()} invented/discovered?`, a: (m) => m[2].trim() },
  { re: /^(.+?)\s+(?:consists? of|is made (?:up )?of|contains?)\s+(.{10,})$/i,  q: (m) => `What does ${m[1].trim()} consist of?`, a: (m) => m[2].trim() },
  { re: /^(.+?)\s+(?:works? by|functions? by|operates? by)\s+(.{10,})$/i,       q: (m) => `How does ${m[1].trim()} work?`,        a: (m) => m[2].trim() },
  { re: /^(.+?)\s+(?:causes?|leads? to|results? in)\s+(.{10,})$/i,              q: (m) => `What does ${m[1].trim()} cause?`,      a: (m) => m[2].trim() },
];

const generateFlashcards = (sentences, keywords, target = 10) => {
  const cards = [];
  const used = new Set();

  // Pass 1: definition patterns
  for (const sent of sentences) {
    if (cards.length >= target) break;
    for (const { re, q, a } of DEF_PATTERNS) {
      const m = sent.match(re);
      if (m && m[1].trim().split(' ').length <= 6 && !used.has(sent)) {
        cards.push({ question: q(m), answer: a(m) });
        used.add(sent);
        break;
      }
    }
  }

  // Pass 2: sentences mentioning top keywords → "What does the text say about X?"
  for (const kw of keywords) {
    if (cards.length >= target) break;
    const relevant = sentences.find(s =>
      s.toLowerCase().includes(kw) && !used.has(s) && s.length > 50
    );
    if (relevant) {
      cards.push({
        question: `What is mentioned about "${kw}" in the video?`,
        answer: relevant.trim(),
      });
      used.add(relevant);
    }
  }

  // Pass 3: fill remaining with NLP noun-phrase Q&A using compromise
  for (const sent of sentences) {
    if (cards.length >= target) break;
    if (used.has(sent)) continue;
    const doc = nlp(sent);
    const nouns = doc.nouns().out('array');
    if (nouns.length >= 2) {
      const subject = nouns[0];
      const rest = sent.replace(new RegExp(subject.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i'), '').trim();
      if (rest.length > 20) {
        cards.push({
          question: `What does the video explain about "${subject}"?`,
          answer: sent.trim(),
        });
        used.add(sent);
      }
    }
  }

  return cards.slice(0, target);
};

// ── Quiz generation ───────────────────────────────────────────────────────────
const generateQuiz = (sentences, keywords, target = 6) => {
  const quiz = [];
  const usedSents = new Set();
  const shuffled = [...keywords].sort(() => Math.random() - 0.5);

  for (const kw of shuffled) {
    if (quiz.length >= target) break;

    // Find a sentence that mentions this keyword
    const sent = sentences.find(s =>
      s.toLowerCase().includes(kw) && !usedSents.has(s) && s.length > 50
    );
    if (!sent) continue;

    // Find the exact occurrence (proper casing) of the keyword in the sentence
    const wordTokens = wordTokenizer.tokenize(sent);
    const targetToken = wordTokens.find(w => w.toLowerCase() === kw);
    if (!targetToken || targetToken.length < 4) continue;

    // Build blanked question
    const blanked = sent.replace(new RegExp(`\\b${targetToken}\\b`, 'i'), '_____');

    // Distractors: other top keywords that are similar length but different
    const distractors = shuffled
      .filter(k => k !== kw && k.length > 3)
      .slice(0, 3)
      .map(k => k.charAt(0).toUpperCase() + k.slice(1));

    while (distractors.length < 3) {
      distractors.push(['concept', 'process', 'element'][distractors.length]);
    }

    const correct = targetToken.charAt(0).toUpperCase() + targetToken.slice(1);
    const options = [correct, ...distractors].sort(() => Math.random() - 0.5);
    const correctIdx = options.indexOf(correct);

    quiz.push({
      question: `Complete the sentence: "${blanked}"`,
      options,
      correct_option_index: correctIdx,
      explanation: `The correct word is "${correct}". Full sentence: "${sent.trim()}"`,
    });
    usedSents.add(sent);
  }

  // If not enough fill-in-blank, add true/false style MCQ
  if (quiz.length < target) {
    const remaining = sentences.filter(s => !usedSents.has(s) && s.length > 60);
    for (const sent of remaining) {
      if (quiz.length >= target) break;
      const doc = nlp(sent);
      const nouns = doc.nouns().out('array');
      if (nouns.length < 2) continue;

      const [n1, n2] = nouns;
      const wrong = shuffled.filter(k => k !== n1.toLowerCase() && k !== n2.toLowerCase()).slice(0, 2);

      quiz.push({
        question: `Which statement best describes the relationship between "${n1}" and "${n2}"?`,
        options: [
          sent.trim(),
          `${n2} is unrelated to ${n1}`,
          wrong[0] ? `${n1} is a type of ${wrong[0]}` : `${n1} replaces ${n2}`,
          wrong[1] ? `${n2} causes ${wrong[1]}` : `${n2} contradicts ${n1}`,
        ].sort(() => Math.random() - 0.5),
        correct_option_index: 0,
        explanation: `This was directly stated in the video.`,
      });
      // Re-find correct index after shuffle
      quiz[quiz.length - 1].correct_option_index =
        quiz[quiz.length - 1].options.indexOf(sent.trim());
      usedSents.add(sent);
    }
  }

  return quiz.slice(0, target);
};

// ── Main export ───────────────────────────────────────────────────────────────
export const textToStudySet = (text) => {
  if (!text || text.trim().length < 100) {
    throw new Error('Text is too short to generate a study set from');
  }

  const sentences = getSentences(text);
  if (sentences.length < 3) {
    throw new Error('Not enough sentence structure found in this content');
  }

  const keywords  = getTopKeywords(sentences);
  const subject   = detectSubject(text);
  const title     = extractTitle(text, keywords);
  const flashcards = generateFlashcards(sentences, keywords, 10);
  const quiz       = generateQuiz(sentences, keywords, 6);

  if (flashcards.length < 3) {
    throw new Error('Could not extract enough information to create flashcards. Try a video with clearer spoken content.');
  }

  return { title, subject, flashcards, quiz };
};
