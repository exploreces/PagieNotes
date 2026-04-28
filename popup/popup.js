import { analyzePageContent, analyzeTopicInsights } from "./analyzer.js";

const analyzeBtn = document.getElementById("analyzeBtn");
const topicInputEl = document.getElementById("topicInput");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const summaryTextEl = document.getElementById("summaryText");
const intentTextEl = document.getElementById("intentText");
const contextTextEl = document.getElementById("contextText");
const importantListEl = document.getElementById("importantList");
const miscListEl = document.getElementById("miscList");
const topicMetaEl = document.getElementById("topicMeta");
const topicListEl = document.getElementById("topicList");
const digestListEl = document.getElementById("digestList");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b3232f" : "#5a6478";
}

function fillList(listElement, items, emptyMessage) {
  listElement.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = emptyMessage;
    listElement.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    listElement.appendChild(li);
  }
}

function parseTopics(inputValue) {
  return (inputValue || "")
    .split(/[,\n]/)
    .map((topic) => topic.trim())
    .filter(Boolean)
    .slice(0, 12);
}

async function extractPagePayload() {
  const blockedSchemes = ["chrome:", "edge:", "about:", "moz-extension:"];
  if (blockedSchemes.some((scheme) => window.location.protocol.startsWith(scheme))) {
    return null;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Attempt to trigger lazy-loaded blocks by controlled scrolling.
  const initialY = window.scrollY;
  const maxScrollSteps = 6;
  for (let i = 0; i < maxScrollSteps; i += 1) {
    const progress = (i + 1) / maxScrollSteps;
    window.scrollTo(0, Math.floor(document.body.scrollHeight * progress));
    await sleep(160);
  }
  window.scrollTo(0, initialY);

  const selectorsToRemove = [
    "script",
    "style",
    "noscript",
    "svg",
    "canvas",
    "nav",
    "footer",
    "aside",
    "form",
    "[aria-hidden='true']"
  ];

  const clone = document.body?.cloneNode(true);
  if (!clone) {
    return null;
  }

  for (const selector of selectorsToRemove) {
    clone.querySelectorAll(selector).forEach((node) => node.remove());
  }

  const textBlocks = Array.from(clone.querySelectorAll("h1, h2, h3, p, li, article, section"))
    .map((el) => el.textContent?.trim() || "")
    .filter((text) => text.length > 35)
    .slice(0, 1200);

  const headings = Array.from(clone.querySelectorAll("h1, h2, h3"))
    .map((el) => el.textContent?.trim() || "")
    .filter((text) => text.length > 2)
    .slice(0, 40);

  const metaDescription = document.querySelector("meta[name='description']")?.content?.trim() || "";
  const siteName = document.querySelector("meta[property='og:site_name']")?.content?.trim() || "";
  const title = document.title?.trim() || "";

  const mergedText = `${title}. ${metaDescription}. ${textBlocks.join(". ")}`.replace(/\s+/g, " ").trim();
  const cleanText = mergedText.slice(0, 120000);

  return {
    url: location.href,
    title,
    siteName,
    description: metaDescription,
    headings,
    textBlocks: textBlocks.slice(0, 350),
    text: cleanText
  };
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

async function analyzeCurrentPage() {
  try {
    analyzeBtn.disabled = true;
    setStatus("Extracting full page content...");
    resultEl.classList.add("hidden");

    const tabId = await getActiveTabId();
    if (!tabId) {
      throw new Error("No active tab found.");
    }

    const [{ result: payload }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPagePayload
    });

    const pageText = payload?.text || "";
    if (!payload || !pageText || pageText.length < 120) {
      throw new Error("Not enough readable content on this page.");
    }

    setStatus("Analyzing semantics, context, and intent...");
    const analysis = analyzePageContent(payload);
    const topics = parseTopics(topicInputEl.value);
    const topicAnalysis = analyzeTopicInsights(payload, topics);

    summaryTextEl.textContent = analysis.summary;
    intentTextEl.textContent = `Detected intent: ${analysis.intent}`;
    contextTextEl.textContent = analysis.context || "Context metadata is limited on this page.";
    fillList(
      importantListEl,
      analysis.importantPoints,
      "No high-priority points were identified."
    );
    fillList(
      miscListEl,
      analysis.miscPoints,
      "No supporting points were identified."
    );
    fillList(
      topicListEl,
      topicAnalysis.insights,
      topicAnalysis.message
    );
    fillList(
      digestListEl,
      analysis.deepDigest || [],
      "Digest details were limited for this page."
    );
    topicMetaEl.textContent = topicAnalysis.message;

    resultEl.classList.remove("hidden");
    const topicStatus = topics.length
      ? "Done. Topic insights included."
      : "Done. Add topics for focused insights.";
    setStatus(topicStatus);
  } catch (error) {
    setStatus(error.message || "Unable to analyze this page.", true);
  } finally {
    analyzeBtn.disabled = false;
  }
}

analyzeBtn.addEventListener("click", analyzeCurrentPage);
