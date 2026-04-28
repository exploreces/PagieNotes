const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for",
  "from", "had", "has", "have", "he", "her", "his", "i", "if", "in", "into",
  "is", "it", "its", "me", "my", "not", "of", "on", "or", "our", "she", "so",
  "that", "the", "their", "them", "there", "they", "this", "to", "too", "us",
  "was", "we", "were", "what", "when", "where", "which", "who", "why", "will",
  "with", "you", "your"
]);

const IMPORTANT_CUES = [
  "key",
  "important",
  "must",
  "should",
  "critical",
  "main",
  "conclusion",
  "result",
  "finding",
  "summary",
  "recommend",
  "therefore"
];

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

function buildWordFrequency(text) {
  const tokens = tokenize(text);
  const frequency = new Map();

  for (const token of tokens) {
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

  const normalizedScore = score / words.length;
  const cueBoost = IMPORTANT_CUES.some((cue) =>
    sentence.toLowerCase().includes(cue)
  )
    ? 1.2
    : 1;

  return normalizedScore * cueBoost;
}

function normalizeBullet(sentence) {
  return sentence
    .replace(/^\s*[-*•]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function analyzePageContent(content) {
  const sourceText = (content || "").trim();
  if (!sourceText) {
    return {
      summary: "No usable page content was detected.",
      importantPoints: [],
      miscPoints: []
    };
  }

  const sentences = splitIntoSentences(sourceText).slice(0, 160);
  const frequency = buildWordFrequency(sourceText);
  const scoredSentences = sentences.map((sentence, index) => ({
    sentence,
    index,
    score: scoreSentence(sentence, frequency)
  }));

  scoredSentences.sort((a, b) => b.score - a.score);

  const summaryCount = Math.min(3, scoredSentences.length);
  const summarySentences = scoredSentences
    .slice(0, summaryCount)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);

  const importantCount = Math.min(6, scoredSentences.length);
  const importantPoints = scoredSentences
    .slice(0, importantCount)
    .sort((a, b) => a.index - b.index)
    .map((item) => normalizeBullet(item.sentence));

  const lowerHalfStart = Math.floor(scoredSentences.length / 2);
  const miscPoints = scoredSentences
    .slice(lowerHalfStart, lowerHalfStart + 8)
    .sort((a, b) => a.index - b.index)
    .map((item) => normalizeBullet(item.sentence))
    .filter((sentence) => !importantPoints.includes(sentence))
    .slice(0, 6);

  return {
    summary:
      summarySentences.join(" ") ||
      "The page was read, but a concise summary could not be generated.",
    importantPoints,
    miscPoints
  };
}
