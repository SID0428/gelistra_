// ─── Gelistra PDF Generator ───────────────────────────────────────────────────
// Generates branded A4 PDFs from form data using jsPDF (loaded via CDN).
// Usage:
//   const doc = generateInquiryPDF(data);       → returns jsPDF instance
//   const doc = generateRequirementsPDF(data);  → returns jsPDF instance
//   doc.save('filename.pdf');                   → triggers browser download
//   doc.output('datauristring');                → base64 data URI
// ──────────────────────────────────────────────────────────────────────────────

// Brand tokens matching styles.css CSS variables
const B = {
  accent:  [239, 91,  55],
  accent2: [27,  159, 149],
  ink:     [31,  39,  55],
  muted:   [94,  101, 117],
  line:    [231, 219, 199],
  bg:      [246, 241, 232],
  surface: [255, 250, 242],
  white:   [255, 255, 255],
};

const PAGE_W  = 595.28;  // A4 pt
const PAGE_H  = 841.89;
const MARGIN  = 44;
const COL_W   = PAGE_W - MARGIN * 2;

// ── Internal helpers ──────────────────────────────────────────────────────────

function makeDoc() {
  return new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
}

// Returns updated y after drawing; auto-adds new page if needed
function ensureSpace(doc, y, needed = 30) {
  if (y + needed > PAGE_H - 50) {
    doc.addPage();
    drawHeader(doc);
    return 110;
  }
  return y;
}

function drawHeader(doc) {
  // Top accent stripe
  doc.setFillColor(...B.accent);
  doc.rect(0, 0, PAGE_W, 6, 'F');

  // Header background
  doc.setFillColor(...B.surface);
  doc.rect(0, 6, PAGE_W, 66, 'F');

  // Brand wordmark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...B.ink);
  doc.text('Gelistra', MARGIN, 46);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...B.muted);
  doc.text('Built for growth-focused brands', MARGIN, 60);

  // Right — website
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...B.accent);
  doc.text('gelistra.com', PAGE_W - MARGIN, 46, { align: 'right' });

  // Right — date
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...B.muted);
  doc.text(
    new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    PAGE_W - MARGIN, 60, { align: 'right' }
  );

  // Divider
  doc.setDrawColor(...B.line);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 72, PAGE_W - MARGIN, 72);
}

function drawFooter(doc, pageNum, totalPages) {
  const y = PAGE_H - 28;
  doc.setDrawColor(...B.line);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y - 8, PAGE_W - MARGIN, y - 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...B.muted);
  doc.text('Gelistra — Confidential Client Document', MARGIN, y);
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN, y, { align: 'right' });
}

function drawSectionHeading(doc, label, y) {
  // Colored left bar
  doc.setFillColor(...B.accent);
  doc.rect(MARGIN, y, 3, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...B.ink);
  doc.text(label.toUpperCase(), MARGIN + 10, y + 11);

  // Underline
  doc.setDrawColor(...B.line);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y + 17, PAGE_W - MARGIN, y + 17);

  return y + 26;
}

// Draw a single label + value row
function drawField(doc, label, value, y, fullWidth = false) {
  if (!value || String(value).trim() === '') return y;

  y = ensureSpace(doc, y, 28);

  const labelW = fullWidth ? COL_W : COL_W * 0.38;
  const valueX = fullWidth ? MARGIN : MARGIN + labelW + 6;
  const valueW = fullWidth ? COL_W : COL_W - labelW - 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...B.muted);
  doc.text(label, MARGIN, y);

  const lines = doc.splitTextToSize(String(value), valueW);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...B.ink);

  lines.forEach((line, i) => {
    y = ensureSpace(doc, y, 14);
    doc.text(line, valueX, y);
    if (i < lines.length - 1) y += 13;
  });

  return y + 16;
}

// Draw two fields side by side
function drawFieldPair(doc, left, right, y) {
  const halfW = COL_W / 2 - 8;

  y = ensureSpace(doc, y, 28);

  // Left label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...B.muted);
  doc.text(left.label, MARGIN, y);

  // Right label
  if (right) doc.text(right.label, MARGIN + COL_W / 2 + 4, y);

  y += 12;

  // Left value
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...B.ink);
  if (left.value) {
    const lLines = doc.splitTextToSize(String(left.value), halfW);
    lLines.forEach(l => { doc.text(l, MARGIN, y); y += 13; });
  }

  // Right value (reset y to pair top + 12)
  if (right && right.value) {
    const rY = y - (left.value ? doc.splitTextToSize(String(left.value), halfW).length * 13 : 0);
    const rLines = doc.splitTextToSize(String(right.value), halfW);
    rLines.forEach((l, i) => doc.text(l, MARGIN + COL_W / 2 + 4, rY + i * 13));
  }

  return y + 6;
}

// Draw a pill/tag list (for goals, features)
function drawTags(doc, items, y) {
  if (!items || items.length === 0) return y;

  y = ensureSpace(doc, y, 24);

  let x = MARGIN;
  const tagH = 16;
  const padX = 8;
  const gap  = 6;

  items.forEach(item => {
    const label = String(item);
    doc.setFontSize(8);
    const w = doc.getTextWidth(label) + padX * 2;

    if (x + w > PAGE_W - MARGIN) {
      x = MARGIN;
      y += tagH + 5;
      y = ensureSpace(doc, y, tagH + 5);
    }

    // Tag background
    doc.setFillColor(...B.accent2);
    doc.roundedRect(x, y - tagH + 3, w, tagH, 4, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...B.white);
    doc.text(label, x + padX, y - 1);

    x += w + gap;
  });

  return y + tagH;
}

// Draw the document title block
function drawDocTitle(doc, title, subtitle, refId, y) {
  y = ensureSpace(doc, y, 60);

  // Title background pill
  doc.setFillColor(...B.accent);
  doc.roundedRect(MARGIN, y, COL_W, 46, 8, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...B.white);
  doc.text(title, MARGIN + 16, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(subtitle, MARGIN + 16, y + 36);

  // Ref ID on right
  doc.setFontSize(8.5);
  doc.setTextColor('rgba(255,255,255,0.75)');
  doc.text(`Ref: ${refId}`, PAGE_W - MARGIN - 16, y + 20, { align: 'right' });

  return y + 62;
}

// Simple unique ref generator
function makeRef(prefix) {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

// Finalise all pages with footer
function finaliseDoc(doc) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i, total);
  }
}

// ── Public: Inquiry PDF ───────────────────────────────────────────────────────

export function generateInquiryPDF(data) {
  const doc = makeDoc();
  const ref = makeRef('INQ');

  drawHeader(doc);

  let y = 90;

  y = drawDocTitle(
    doc,
    'Project Inquiry',
    `Submitted by ${data.name || 'Client'} · ${data.company || ''}`,
    ref,
    y
  );

  y += 10;

  // Section 1 — Contact
  y = drawSectionHeading(doc, '1. Contact Details', y);
  y = drawFieldPair(doc, { label: 'Full Name', value: data.name }, { label: 'Email', value: data.email }, y);
  y = drawFieldPair(doc, { label: 'Company / Brand', value: data.company }, { label: 'Current Website', value: data.website }, y);

  y += 4;

  // Section 2 — Project
  y = drawSectionHeading(doc, '2. Project Details', y);
  y = drawFieldPair(doc, { label: 'Required Service', value: data.service }, { label: 'Budget Range', value: data.budget }, y);
  y = drawField(doc, 'Preferred Timeline', data.timeline, y);
  y = drawField(doc, 'Project Brief', data.details, y, true);

  y += 4;

  // Section 3 — Status
  y = drawSectionHeading(doc, '3. Submission Info', y);
  y = drawFieldPair(
    doc,
    { label: 'Submitted On', value: new Date().toLocaleString('en-IN') },
    { label: 'Reference ID', value: ref },
    y
  );
  y = drawField(doc, 'Status', 'New — Awaiting Review', y);

  // Notice box
  y = ensureSpace(doc, y, 50);
  y += 10;
  doc.setFillColor(255, 249, 245);
  doc.setDrawColor(...B.accent);
  doc.setLineWidth(0.6);
  doc.roundedRect(MARGIN, y, COL_W, 44, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...B.accent);
  doc.text('What Happens Next?', MARGIN + 12, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...B.ink);
  doc.text(
    'Our team will review your inquiry and respond within one business day with a proposal and recommended package.',
    MARGIN + 12, y + 30,
    { maxWidth: COL_W - 24 }
  );

  finaliseDoc(doc);
  return doc;
}

// ── Public: Requirements PDF ──────────────────────────────────────────────────

export function generateRequirementsPDF(data) {
  const doc = makeDoc();
  const ref = makeRef('REQ');

  drawHeader(doc);

  let y = 90;

  y = drawDocTitle(
    doc,
    'Website Project Requirements',
    `${data.package ? data.package.charAt(0).toUpperCase() + data.package.slice(1) : 'Growth'} Package · ${data.company || 'Client'}`,
    ref,
    y
  );

  y += 10;

  // Section 1 — Contact & Ownership
  y = drawSectionHeading(doc, '1. Contact & Project Ownership', y);
  y = drawFieldPair(doc, { label: 'Full Name', value: data.name }, { label: 'Work Email', value: data.email }, y);
  y = drawFieldPair(doc, { label: 'Phone / WhatsApp', value: data.phone }, { label: 'Company / Brand', value: data.company }, y);
  y = drawFieldPair(doc, { label: 'Your Role', value: data.role }, { label: 'Decision Maker', value: data.decisionMaker }, y);

  y += 4;

  // Section 2 — Business Context
  y = drawSectionHeading(doc, '2. Business Context & Goals', y);
  y = drawFieldPair(doc, { label: 'Selected Package', value: data.package }, { label: 'Business Type', value: data.industry }, y);
  y = drawField(doc, 'Target Audience', data.audience, y, true);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...B.muted);
  doc.text('Primary Goals', MARGIN, y);
  y += 12;
  y = drawTags(doc, data.goals, y);

  y += 12;

  // Section 3 — Scope & Content
  y = drawSectionHeading(doc, '3. Website Scope & Content', y);
  y = drawFieldPair(doc, { label: 'Current Website', value: data.currentSite || '—' }, { label: 'Expected Pages', value: data.pageCount }, y);
  y = drawField(doc, 'Page List', data.pageList, y, true);
  y = drawFieldPair(doc, { label: 'Content Status', value: data.contentStatus }, { label: 'Brand Assets', value: data.brandAssets }, y);
  y = drawField(doc, 'Design References / Competitors', data.references, y, true);

  y += 4;

  // Section 4 — Features
  y = drawSectionHeading(doc, '4. Required Features & Integrations', y);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...B.muted);
  doc.text('Selected Features', MARGIN, y);
  y += 12;
  y = drawTags(doc, data.features, y);
  y += 12;

  if (data.productCount || data.paymentGateway) {
    y = drawFieldPair(doc,
      { label: 'Product Count', value: data.productCount },
      { label: 'Payment Gateway', value: data.paymentGateway },
      y
    );
  }
  y = drawField(doc, 'Third-Party Integrations', data.integrations, y, true);

  y += 4;

  // Section 5 — Timeline & Budget
  y = drawSectionHeading(doc, '5. Timeline, Budget & Operations', y);
  y = drawFieldPair(doc, { label: 'Domain & Hosting', value: data.domainHosting }, { label: 'Preferred Launch Date', value: data.launchDate }, y);
  y = drawFieldPair(doc, { label: 'Budget Range', value: data.budget }, { label: 'Post-Launch Support', value: data.support }, y);
  y = drawField(doc, 'Asset Sharing Link', data.assetsLink, y);
  y = drawField(doc, 'Additional Notes', data.notes, y, true);

  y += 4;

  // Section 6 — Submission Info
  y = drawSectionHeading(doc, '6. Submission Info', y);
  y = drawFieldPair(
    doc,
    { label: 'Submitted On', value: new Date().toLocaleString('en-IN') },
    { label: 'Reference ID', value: ref },
    y
  );
  y = drawField(doc, 'Status', 'New — Awaiting Review', y);

  // Footer notice
  y = ensureSpace(doc, y, 52);
  y += 10;
  doc.setFillColor(245, 255, 253);
  doc.setDrawColor(...B.accent2);
  doc.setLineWidth(0.6);
  doc.roundedRect(MARGIN, y, COL_W, 44, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...B.accent2);
  doc.text('What Happens Next?', MARGIN + 12, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...B.ink);
  doc.text(
    'Our team will review your complete requirements and schedule a kick-off call to confirm scope, timeline, and first milestone.',
    MARGIN + 12, y + 30,
    { maxWidth: COL_W - 24 }
  );

  finaliseDoc(doc);
  return doc;
}
