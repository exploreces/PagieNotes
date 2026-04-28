const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for",
  "from", "had", "has", "have", "he", "her", "his", "i", "if", "in", "into",
  "is", "it", "its", "me", "my", "not", "of", "on", "or", "our", "she", "so",
  "that", "the", "their", "them", "there", "they", "this", "to", "too", "us",
  "was", "we", "were", "what", "when", "where", "which", "who", "why", "will",
  "with", "you", "your"
]);

const IMPORTANT_CUES = [
  "key", "important", "must", "should", "critical", "main", "conclusion", "result",
  "finding", "summary", "recommend", "therefore", "impact", "benefit", "risk",
  "problem", "solution", "introduces", "announced"
];

const INTENT_CUES = {
  tutorial: ["how to", "step", "guide", "tutorial", "walkthrough"],
  opinion: ["i think", "in my view", "opinion", "argue", "perspective"],
  news: ["announced", "today", "reported", "breaking", "update"],
  docs: ["api", "reference", "specification", "parameters", "usage"],
  marketing: ["buy", "pricing", "trial", "subscribe", "features"]
};

function toPlainText(input) {
  if (typeof input === "string") {
    return input;
  }
  if (input && typeof input === "object") {
    return `${input.title || ""} ${input.description || ""} ${(input.textBlocks || []).join(" ")}`.trim();
  }
  return "";
}

function splitIntoSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]?/g)
    ?.map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 35) || [];
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word) && word.length > 2);
}

function normalizeBullet(sentence) {
  return sentence.replace(/^\s*[-*•]\s*/, "").replace(/\s+/g, " ").trim();
}

function buildWordFrequency(text) {
  const frequency = new Map();
  for (const token of tokenize(text)) {
    frequency.set(token, (frequency.get(token) || 0) + 1);
  }
  return frequency;
}

function scoreSentence(sentence, frequency) {
  const words = tokenize(sentence);
  if (!words.length) {
    return 0;
  }
  let score = 0;
  for (const word of words) {
    score += frequency.get(word) || 0;
  }
  const cueBoost = IMPORTANT_CUES.some((cue) => sentence.toLowerCase().includes(cue)) ? 1.2 : 1;
  return (score / words.length) * cueBoost;
}

function inferIntent(text) {
  const lower = text.toLowerCase();
  let best = { label: "informational article", score: 0 };
  for (const [label, cues] of Object.entries(INTENT_CUES)) {
    const score = cues.reduce((acc, cue) => acc + (lower.includes(cue) ? 1 : 0), 0);
    if (score > best.score) {
      best = { label, score };
    }
  }
  return best.label;
}

function inferContext(pageData) {
  const parts = [];
  if (pageData.siteName) {
    parts.push(`Source: ${pageData.siteName}`);
  }
  if (pageData.title) {
    parts.push(`Page: ${pageData.title}`);
  }
  if (pageData.headings?.length) {
    parts.push(`Sections detected: ${Math.min(pageData.headings.length, 8)}`);
  }
  return parts.join(" | ");
}

function getTopicKeywords(topics) {
  return topics
    .map((topic) => (topic || "").toLowerCase().trim())
    .filter((topic) => topic.length >= 2)
    .flatMap((topic) => topic.split(/\s+/))
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

export function analyzeTopicInsights(content, topics) {
  const sourceText = toPlainText(content).trim();
  const cleanTopics = (topics || []).map((topic) => (topic || "").trim()).filter(Boolean);

  if (!sourceText) {
    return { validTopics: cleanTopics, insights: [], message: "No readable page content found for topic matching." };
  }
  if (!cleanTopics.length) {
    return { validTopics: [], insights: [], message: "Add one or more topics to get focused insights." };
  }

  const topicKeywords = getTopicKeywords(cleanTopics);
  if (!topicKeywords.length) {
    return {
      validTopics: [],
      insights: [],
      message: "Topics look invalid. Use real words like pricing, roadmap, or policy."
    };
  }

  const sentences = splitIntoSentences(sourceText).slice(0, 280);
  const matched = [];
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const hits = topicKeywords.filter((keyword) => lower.includes(keyword));
    if (hits.length) {
      matched.push({ sentence: normalizeBullet(sentence), score: hits.length });
    }
  }

  matched.sort((a, b) => b.score - a.score || a.sentence.length - b.sentence.length);
  const seen = new Set();
  const insights = [];
  for (const item of matched) {
    if (!seen.has(item.sentence)) {
      seen.add(item.sentence);
      insights.push(item.sentence);
    }
    if (insights.length >= 8) {
      break;
    }
  }

  if (!insights.length) {
    return {
      validTopics: cleanTopics,
      insights: [],
      message: "No strong match found for your topics on this page. Try simpler or more relevant terms."
    };
  }
  return { validTopics: cleanTopics, insights, message: `Showing matches for: ${cleanTopics.join(", ")}` };
}

export function analyzePageContent(content) {
  const sourceText = toPlainText(content).trim();
  const pageData = typeof content === "object" && content ? content : {};
  if (!sourceText) {
    return {
      summary: "No usable page content was detected.",
      intent: "unknown",
      context: "",
      importantPoints: [],
      miscPoints: [],
      deepDigest: []
    };
  }

  const sentences = splitIntoSentences(sourceText).slice(0, 280);
  const frequency = buildWordFrequency(sourceText);
  const scored = sentences.map((sentence, index) => ({
    sentence,
    index,
    score: scoreSentence(sentence, frequency)
  }));
  scored.sort((a, b) => b.score - a.score);

  const summary = scored
    .slice(0, Math.min(4, scored.length))
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence)
    .join(" ");

  const importantPoints = scored
    .slice(0, Math.min(7, scored.length))
    .sort((a, b) => a.index - b.index)
    .map((item) => normalizeBullet(item.sentence));

  const miscPoints = scored
    .slice(Math.floor(scored.length / 2))
    .sort((a, b) => a.index - b.index)
    .map((item) => normalizeBullet(item.sentence))
    .filter((line) => !importantPoints.includes(line))
    .slice(0, 7);

  const deepDigest = [];
  if (pageData.headings?.length) {
    deepDigest.push(`Primary sections: ${pageData.headings.slice(0, 6).join(" | ")}`);
  }
  if (pageData.description) {
    deepDigest.push(`Meta context: ${pageData.description}`);
  }
  if (importantPoints.length) {
    deepDigest.push(`Core takeaway: ${importantPoints[0]}`);
  }
  if (importantPoints.length > 1) {
    deepDigest.push(`Secondary takeaway: ${importantPoints[1]}`);
  }

  return {
    summary: summary || "The page was read, but a concise summary could not be generated.",
    intent: inferIntent(sourceText),
    context: inferContext(pageData),
    importantPoints,
    miscPoints,
    deepDigest: deepDigest.slice(0, 5)
  };
}
