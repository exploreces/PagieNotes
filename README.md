# Page Insight Notes (Browser Extension)

`Page Insight Notes` is a Manifest V3 browser extension that analyzes the currently open webpage and produces:

- A concise summary
- Important points
- Miscellaneous/supporting information
- Topic-specific insights based on user-entered interests

## Features

- Extracts meaningful text from headings, paragraphs, and list items on the active page
- Uses in-browser scoring heuristics to identify high-signal sentences
- Organizes results into clear note categories
- Lets users enter topics and surfaces matching insights from the page
- Handles random/irrelevant topic input with clear fallback guidance
- Presents output in a clean popup UI

## Load the Extension (Chrome / Edge)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder (`PagieNotes`).

## Usage

1. Open any webpage.
2. Click the extension icon.
3. Select **Analyze This Page**.
4. Review the generated summary and categorized notes in the popup.

## Project Structure

- `manifest.json` - Extension manifest and permissions
- `popup/popup.html` - Popup layout
- `popup/popup.css` - Popup styling
- `popup/popup.js` - Page extraction + UI workflow
- `popup/analyzer.js` - Summarization and categorization logic
