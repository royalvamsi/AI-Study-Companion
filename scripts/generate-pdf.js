const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

async function convertMarkdownToPdf(browser, options) {
  const {
    inputMarkdownPath,
    outputPdfPath,
    secondaryPdfPath,
    documentTitle,
    headerLeft,
    headerRight,
  } = options;

  console.log(`\n========================================`);
  console.log(`Processing: ${documentTitle}`);
  console.log(`Source: ${inputMarkdownPath}`);

  if (!fs.existsSync(inputMarkdownPath)) {
    throw new Error(`File not found: ${inputMarkdownPath}`);
  }

  const markdownContent = fs.readFileSync(inputMarkdownPath, 'utf8');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${documentTitle}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    @page {
      size: A4;
      margin: 18mm 14mm 18mm 14mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.55;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }

    h1, h2, h3, h4, h5, h6 {
      color: #0f172a;
      font-weight: 700;
      line-height: 1.25;
      margin-top: 1.3em;
      margin-bottom: 0.4em;
      page-break-after: avoid;
      break-after: avoid;
    }

    h1 {
      font-size: 20pt;
      border-bottom: 2.5px solid #2563eb;
      padding-bottom: 8px;
      margin-top: 0;
      color: #1e3a8a;
    }

    h2 {
      font-size: 13.5pt;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 5px;
      margin-top: 1.5em;
      color: #1e40af;
    }

    h3 {
      font-size: 11pt;
      color: #334155;
    }

    h4 {
      font-size: 9.5pt;
      color: #475569;
    }

    p {
      margin: 0.5em 0;
    }

    ul, ol {
      margin: 0.4em 0;
      padding-left: 20px;
    }

    li {
      margin-bottom: 0.25em;
    }

    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 1.4em 0;
    }

    blockquote {
      margin: 0.8em 0;
      padding: 6px 14px;
      background-color: #f8fafc;
      border-left: 4px solid #3b82f6;
      color: #334155;
      border-radius: 0 4px 4px 0;
    }

    code {
      font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
      font-size: 8.5pt;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    pre {
      background-color: #0f172a;
      color: #f8fafc;
      padding: 10px 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 8pt;
      line-height: 1.4;
      margin: 0.8em 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
      border: none;
      font-size: 8pt;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.9em 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 5px 9px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 600;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    /* Mermaid diagram container */
    .mermaid-wrapper {
      margin: 1.2em 0;
      padding: 10px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .mermaid-wrapper svg {
      max-width: 100% !important;
      height: auto !important;
    }

    .katex-display {
      margin: 0.6em 0 !important;
    }
  </style>
</head>
<body>
  <div id="content"></div>

  <script>
    const md = ${JSON.stringify(markdownContent)};

    marked.setOptions({
      gfm: true,
      breaks: false,
    });

    const renderer = new marked.Renderer();
    const originalCode = renderer.code.bind(renderer);

    renderer.code = function(code, language, isEscaped) {
      if (language === 'mermaid') {
        return '<div class="mermaid-wrapper"><pre class="mermaid">' + code + '</pre></div>';
      }
      return originalCode(code, language, isEscaped);
    };

    const container = document.getElementById('content');
    container.innerHTML = marked.parse(md, { renderer });

    // Render Math with KaTeX
    if (window.renderMathInElement) {
      renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }

    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      fontFamily: 'Inter, sans-serif',
      fontSize: 12,
      flowchart: { curve: 'basis', htmlLabels: true },
      er: { useMaxWidth: true },
      sequence: { useMaxWidth: true }
    });

    window.__MERMAID_READY__ = false;
    const mermaidNodes = document.querySelectorAll('.mermaid');
    if (mermaidNodes.length > 0) {
      mermaid.run({ nodes: mermaidNodes })
        .then(() => { window.__MERMAID_READY__ = true; })
        .catch(err => {
          console.error('Mermaid render error:', err);
          window.__MERMAID_READY__ = true;
        });
    } else {
      window.__MERMAID_READY__ = true;
    }
  </script>
</body>
</html>`;

  const scratchDir = path.resolve(__dirname, '..', 'scratch');
  fs.mkdirSync(scratchDir, { recursive: true });
  const previewHtmlPath = path.resolve(scratchDir, `preview_${path.basename(inputMarkdownPath, '.md')}.html`);
  fs.writeFileSync(previewHtmlPath, htmlContent, 'utf8');

  const page = await browser.newPage();
  await page.goto('file:///' + previewHtmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });

  // Wait for mermaid rendering to finish
  await page.waitForFunction(() => window.__MERMAID_READY__ === true, { timeout: 30000 });
  await page.waitForTimeout(800); // 800ms stabilization

  console.log(`Rendering PDF: ${outputPdfPath}`);

  await page.pdf({
    path: outputPdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '18mm',
      bottom: '18mm',
      left: '14mm',
      right: '14mm'
    },
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-family: 'Inter', sans-serif; font-size: 8pt; width: 100%; display: flex; justify-content: space-between; padding: 0 14mm; color: #64748b; border-bottom: 0.5px solid #cbd5e1; padding-bottom: 4px;">
        <span>${headerLeft}</span>
        <span>${headerRight}</span>
      </div>
    `,
    footerTemplate: `
      <div style="font-family: 'Inter', sans-serif; font-size: 8pt; width: 100%; display: flex; justify-content: space-between; padding: 0 14mm; color: #64748b; border-top: 0.5px solid #cbd5e1; padding-top: 4px;">
        <span>Confidential & Proprietary — Engineering Candidate Challenge</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `
  });

  if (secondaryPdfPath) {
    fs.copyFileSync(outputPdfPath, secondaryPdfPath);
  }

  console.log(`Successfully generated: ${outputPdfPath}`);
  if (secondaryPdfPath) {
    console.log(`Copied to: ${secondaryPdfPath}`);
  }

  await page.close();
}

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // 1. Architecture Document
    await convertMarkdownToPdf(browser, {
      inputMarkdownPath: path.resolve(__dirname, '..', 'ARCHITECTURE.md'),
      outputPdfPath: path.resolve(__dirname, '..', 'ARCHITECTURE.pdf'),
      secondaryPdfPath: path.resolve(__dirname, '..', '..', 'ARCHITECTURE.pdf'),
      documentTitle: 'AI Study Companion — System Architecture Document',
      headerLeft: 'AI Study Companion — System Architecture Document v3.0',
      headerRight: 'Google Gemini & Supabase pgvector Architecture',
    });

    // 2. Section 5: AI Tools & Usage Documentation
    await convertMarkdownToPdf(browser, {
      inputMarkdownPath: path.resolve(__dirname, '..', 'AI_TOOLS_AND_USAGE.md'),
      outputPdfPath: path.resolve(__dirname, '..', 'AI_TOOLS_AND_USAGE.pdf'),
      secondaryPdfPath: path.resolve(__dirname, '..', '..', 'AI_TOOLS_AND_USAGE.pdf'),
      documentTitle: 'AI Tools & Usage Documentation — Section 5',
      headerLeft: 'AI Study Companion — AI Tools & Usage Documentation (Section 5)',
      headerRight: 'Claude, ChatGPT, Perplexity & Vibe Coding Workflow',
    });

    // 3. Section 6: AI Prompts Used During Development
    await convertMarkdownToPdf(browser, {
      inputMarkdownPath: path.resolve(__dirname, '..', 'AI_PROMPTS_USED.md'),
      outputPdfPath: path.resolve(__dirname, '..', 'AI_PROMPTS_USED.pdf'),
      secondaryPdfPath: path.resolve(__dirname, '..', '..', 'AI_PROMPTS_USED.pdf'),
      documentTitle: 'AI Prompts Used During Development — Section 6',
      headerLeft: 'AI Study Companion — AI Prompts Used During Development (Section 6)',
      headerRight: 'Architecture, UI/UX, RAG, Adaptive Quiz & Debugging Prompts',
    });

    console.log('\n========================================');
    console.log('ALL PDF DOCUMENTS GENERATED SUCCESSFULLY!');
    console.log('========================================\n');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Fatal error during PDF generation:', err);
  process.exit(1);
});
