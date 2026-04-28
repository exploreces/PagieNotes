import { analyzePageContent, analyzeTopicInsights } from "./analyzer.js";

const analyzeBtn = document.getElementById("analyzeBtn");
const topicInputEl = document.getElementById("topicInput");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const summaryTextEl = document.getElementById("summaryText");
const importantListEl = document.getElementById("importantList");
const miscListEl = document.getElementById("miscList");
const topicMetaEl = document.getElementById("topicMeta");
const topicListEl = document.getElementById("topicList");

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

function extractPageText() {
  const blockedSchemes = ["chrome:", "edge:", "about:", "moz-extension:"];
  if (blockedSchemes.some((scheme) => window.location.protocol.startsWith(scheme))) {
    return "";
  }

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

  const clone = document.body.cloneNode(true);
  for (const selector of selectorsToRemove) {
    clone.querySelectorAll(selector).forEach((node) => node.remove());
  }

  const chunkCandidates = Array.from(clone.querySelectorAll("h1, h2, h3, p, li, article"))
    .map((el) => el.textContent?.trim() || "")
    .filter((text) => text.length > 30);

  const joinedChunks = chunkCandidates.join(". ");
  const bodyText = clone.innerText || clone.textContent || "";
  const preferredText = joinedChunks.length > bodyText.length * 0.35 ? joinedChunks : bodyText;

  return preferredText.replace(/\s+/g, " ").trim().slice(0, 40000);
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

async function analyzeCurrentPage() {
  try {
    analyzeBtn.disabled = true;
    setStatus("Reading page content...");
    resultEl.classList.add("hidden");

    const tabId = await getActiveTabId();
    if (!tabId) {
      throw new Error("No active tab found.");
    }

    const [{ result: pageText }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageText
    });

    if (!pageText || pageText.length < 60) {
      throw new Error("Not enough readable content on this page.");
    }

    setStatus("Summarizing and organizing notes...");
    const analysis = analyzePageContent(pageText);
    const topics = parseTopics(topicInputEl.value);
    const topicAnalysis = analyzeTopicInsights(pageText, topics);

    summaryTextEl.textContent = analysis.summary;
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
