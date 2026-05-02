// ─── Gelistra Main Script ─────────────────────────────────────────────────────
// Handles: nav, counters, slider, pricing, FAQ, portfolio, estimator,
//          contact inquiry form (+ PDF + DB), requirements form (+ PDF + DB)
// ──────────────────────────────────────────────────────────────────────────────

// ── Year ──────────────────────────────────────────────────────────────────────
const currentYear = document.querySelector('[data-current-year]');
if (currentYear) currentYear.textContent = new Date().getFullYear();

// ── Auth & Global State ───────────────────────────────────────────────────────
const savedUser = localStorage.getItem('gelistra_user');
let currentUser = null;
if (savedUser) {
  try {
    currentUser = JSON.parse(savedUser);
    if (currentUser && !currentUser.token) {
      // Force re-auth for sessions created before token-based auth.
      currentUser = null;
      localStorage.removeItem('gelistra_user');
    }
  } catch (err) {
    console.warn('Invalid saved user session. Clearing localStorage entry.', err);
    localStorage.removeItem('gelistra_user');
  }
}

// Replace Action Button in Nav based on auth
document.querySelectorAll('.site-nav .btn-mini').forEach((btn) => {
  if (currentUser) {
    btn.textContent = 'Account';
    btn.href = 'account.html';
  } else {
    btn.textContent = 'Login';
    btn.href = 'login.html';
  }
});

// ── Active nav link ───────────────────────────────────────────────────────────
const path = window.location.pathname.split('/').pop() || 'index.html';
const navPath = path === 'requirements-form.html' ? 'services.html' : path;
document.querySelectorAll('.site-nav a[data-nav]').forEach((link) => {
  if (link.getAttribute('href') === navPath || (navPath === '' && link.getAttribute('href') === 'index.html')) {
    link.classList.add('active');
  }
});

// ── Mobile nav toggle ─────────────────────────────────────────────────────────
const navToggle = document.querySelector('.nav-toggle');
if (navToggle) {
  navToggle.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!expanded));
    document.body.classList.toggle('menu-open', !expanded);
  });
  document.querySelectorAll('.site-nav a').forEach((link) => {
    link.addEventListener('click', () => {
      document.body.classList.remove('menu-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// ── Reveal on scroll ──────────────────────────────────────────────────────────
const revealElements = [...document.querySelectorAll('.reveal')];
if (revealElements.length) {
  const revealObserver = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } }),
    { threshold: 0.2 }
  );
  revealElements.forEach((el) => revealObserver.observe(el));
}

// ── Counters ──────────────────────────────────────────────────────────────────
const counters = [...document.querySelectorAll('.counter')];
if (counters.length) {
  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const targetRaw = el.dataset.target || '0';
        const target = Number(targetRaw);
        const decimals = (targetRaw.split('.')[1] || '').length;
        const suffix = el.dataset.suffix || '';
        const prefix = el.dataset.prefix || '';
        const duration = 1300;
        const startTime = performance.now();
        const step = (now) => {
          const progress = Math.min((now - startTime) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const displayed = decimals > 0 ? (target * eased).toFixed(decimals) : String(Math.round(target * eased));
          el.textContent = `${prefix}${displayed}${suffix}`;
          if (progress < 1) window.requestAnimationFrame(step);
          else el.textContent = `${prefix}${targetRaw}${suffix}`;
        };
        window.requestAnimationFrame(step);
        counterObserver.unobserve(el);
      });
    },
    { threshold: 0.35 }
  );
  counters.forEach((c) => counterObserver.observe(c));
}

// ── Testimonial slider ────────────────────────────────────────────────────────
const sliderRoot = document.querySelector('[data-slider]');
if (sliderRoot) {
  const slides = [...sliderRoot.querySelectorAll('.testimonial-card')];
  const prevBtn = sliderRoot.querySelector('[data-slide="prev"]');
  const nextBtn = sliderRoot.querySelector('[data-slide="next"]');
  let current = 0;
  let timer = null;
  const renderSlide = (i) => slides.forEach((s, idx) => s.classList.toggle('active', idx === i));
  const goTo = (i) => { current = (i + slides.length) % slides.length; renderSlide(current); };
  const restartTimer = () => { if (timer) clearInterval(timer); timer = setInterval(() => goTo(current + 1), 5500); };
  prevBtn?.addEventListener('click', () => { goTo(current - 1); restartTimer(); });
  nextBtn?.addEventListener('click', () => { goTo(current + 1); restartTimer(); });
  renderSlide(current);
  restartTimer();
}

// ── Pricing toggle ────────────────────────────────────────────────────────────
const billingToggle = document.querySelector('#billing-toggle');
if (billingToggle) {
  const priceNodes = [...document.querySelectorAll('.price-value')];
  const discountPill = document.querySelector('[data-pricing-label]');
  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const updatePrices = () => {
    const yearly = billingToggle.checked;
    priceNodes.forEach((node) => {
      const amount = yearly ? Number(node.dataset.yearly || node.dataset.monthly) : Number(node.dataset.monthly || 0);
      node.textContent = formatter.format(amount);
    });
    if (discountPill) discountPill.textContent = yearly
      ? 'Build + 6 months support (still around 30% below typical agency rates)'
      : 'One-time build price (around 30% below typical market pricing)';
  };
  billingToggle.addEventListener('change', updatePrices);
  updatePrices();
}

// ── FAQ accordion ─────────────────────────────────────────────────────────────
document.querySelectorAll('.faq-item').forEach((item) => {
  const trigger = item.querySelector('.faq-question');
  const answer = item.querySelector('.faq-answer');
  trigger?.addEventListener('click', () => {
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    document.querySelectorAll('.faq-item').forEach((other) => {
      const ot = other.querySelector('.faq-question');
      const oa = other.querySelector('.faq-answer');
      if (!ot || !oa) return;
      ot.setAttribute('aria-expanded', 'false');
      ot.querySelector('span').textContent = '+';
      oa.style.maxHeight = '0px';
    });
    if (!expanded && answer) {
      trigger.setAttribute('aria-expanded', 'true');
      trigger.querySelector('span').textContent = '-';
      answer.style.maxHeight = `${answer.scrollHeight}px`;
    }
  });
});

// ── Portfolio filter ───────────────────────────────────────────────────────────
const filterButtons = [...document.querySelectorAll('.filter-btn')];
const projectCards = [...document.querySelectorAll('.project-card')];
if (filterButtons.length && projectCards.length) {
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      projectCards.forEach((card) => card.classList.toggle('hidden', filter !== 'all' && filter !== card.dataset.category));
    });
  });
}

// ── Portfolio modal ────────────────────────────────────────────────────────────
const modal = document.querySelector('#project-modal');
if (modal) {
  const fields = ['title', 'category', 'summary', 'stack', 'impact'].reduce((o, k) => { o[k] = modal.querySelector(`[data-modal="${k}"]`); return o; }, {});
  const closeModal = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; };
  document.querySelectorAll('.project-open').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.project-card');
      if (!card) return;
      if (fields.title) fields.title.textContent = card.dataset.title || '';
      if (fields.category) fields.category.textContent = card.dataset.categoryLabel || card.dataset.category || '';
      if (fields.summary) fields.summary.textContent = card.dataset.summary || '';
      if (fields.stack) fields.stack.textContent = card.dataset.stack || '';
      if (fields.impact) fields.impact.textContent = card.dataset.impact || '';
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  });
  modal.querySelector('.modal-close')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });
}

// ── Project estimator (v2 — multi-factor) ─────────────────────────────────────
const estSection = document.querySelector('#estimator-section');
if (estSection) {
  const fmtINR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

  // State
  const estState = {
    base: 2100,       // from website type
    typeName: 'Static / Portfolio',
    pages: 5,
    designMult: 1,    // 1, 1.5, 2.2
    designName: 'Standard',
    featureCost: 0,
    rushMult: 1,       // 1, 1.2, 1.5
    timelineName: 'Standard (4-6 weeks)',
    supportCost: 0,
    supportName: 'No support plan',
  };

  // DOM refs
  const totalValue = document.querySelector('#est-total-value');
  const barFill = document.querySelector('#est-bar-fill');
  const bdBase = document.querySelector('#bd-base');
  const bdPageCount = document.querySelector('#bd-page-count');
  const bdPages = document.querySelector('#bd-pages');
  const bdDesign = document.querySelector('#bd-design');
  const bdFeatures = document.querySelector('#bd-features');
  const bdRush = document.querySelector('#bd-rush');
  const bdSupport = document.querySelector('#bd-support');
  const bdSubtotal = document.querySelector('#bd-subtotal');
  const metaType = document.querySelector('#meta-type');
  const metaPages = document.querySelector('#meta-pages');
  const metaDesign = document.querySelector('#meta-design');
  const metaTimeline = document.querySelector('#meta-timeline');
  const metaSupport = document.querySelector('#meta-support');
  const pagesSlider = document.querySelector('#est-pages');
  const pagesDisplay = document.querySelector('#est-pages-display');

  const MAX_BUDGET = 84000; // for progress bar scaling

  const recalc = () => {
    const pageCost = estState.pages * 350;
    const subBeforeDesign = estState.base + pageCost;
    const designedCost = Math.round(subBeforeDesign * estState.designMult);

    // Features
    const featureCheckboxes = [...document.querySelectorAll('.est-feature input')];
    estState.featureCost = featureCheckboxes.reduce((sum, cb) => sum + (cb.checked ? Number(cb.dataset.cost) : 0), 0);

    const beforeRush = designedCost + estState.featureCost + estState.supportCost;
    const subtotal = Math.round(beforeRush * estState.rushMult);

    const low = Math.round(subtotal * 0.9);
    const high = Math.round(subtotal * 1.15);

    // Update display with animation
    if (totalValue) totalValue.textContent = `${fmtINR(low)} – ${fmtINR(high)}`;
    if (barFill) barFill.style.width = `${Math.min((subtotal / MAX_BUDGET) * 100, 100)}%`;

    // Breakdown
    if (bdBase) bdBase.textContent = fmtINR(estState.base);
    if (bdPageCount) bdPageCount.textContent = estState.pages;
    if (bdPages) bdPages.textContent = fmtINR(pageCost);
    if (bdDesign) bdDesign.textContent = `${estState.designMult}×`;
    if (bdFeatures) bdFeatures.textContent = fmtINR(estState.featureCost);
    if (bdRush) bdRush.textContent = estState.rushMult === 1 ? 'None' : `+${Math.round((estState.rushMult - 1) * 100)}%`;
    if (bdSupport) bdSupport.textContent = fmtINR(estState.supportCost);
    if (bdSubtotal) bdSubtotal.textContent = fmtINR(subtotal);

    // Meta
    if (metaType) metaType.textContent = estState.typeName;
    if (metaPages) metaPages.textContent = `${estState.pages} page${estState.pages > 1 ? 's' : ''}`;
    if (metaDesign) metaDesign.textContent = `${estState.designName} design`;
    if (metaTimeline) metaTimeline.textContent = estState.timelineName;
    if (metaSupport) metaSupport.textContent = estState.supportName;
  };

  // 1. Website Type
  document.querySelectorAll('#est-type-grid .est-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#est-type-grid .est-option').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      estState.base = Number(btn.dataset.base);
      estState.typeName = btn.querySelector('.est-option-label').textContent;
      recalc();
    });
  });

  // 2. Pages slider
  if (pagesSlider) {
    pagesSlider.addEventListener('input', () => {
      estState.pages = Number(pagesSlider.value);
      if (pagesDisplay) pagesDisplay.textContent = `${estState.pages} page${estState.pages > 1 ? 's' : ''}`;
      recalc();
    });
  }

  // 3. Design Complexity
  document.querySelectorAll('#est-design-tier .est-tier').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#est-design-tier .est-tier').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      estState.designMult = Number(btn.dataset.mult);
      estState.designName = btn.querySelector('.est-tier-name').textContent;
      recalc();
    });
  });

  // 4. Features – live recalc on toggle
  document.querySelectorAll('.est-feature input').forEach((cb) => {
    cb.addEventListener('change', recalc);
  });

  // 5. Timeline
  document.querySelectorAll('#est-timeline-tier .est-tier').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#est-timeline-tier .est-tier').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      estState.rushMult = Number(btn.dataset.rush);
      const nameMap = { standard: 'Standard (4-6 weeks)', fast: 'Fast Track (2-3 weeks)', urgent: 'Urgent (under 2 weeks)' };
      estState.timelineName = nameMap[btn.dataset.timeline] || 'Standard (4-6 weeks)';
      recalc();
    });
  });

  // 6. Support Plan
  document.querySelectorAll('#est-support-tier .est-tier').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#est-support-tier .est-tier').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      estState.supportCost = Number(btn.dataset.supportcost);
      const supportNameMap = { none: 'No support plan', basic: '3 months support', premium: '6 months support' };
      estState.supportName = supportNameMap[btn.dataset.support] || 'No support plan';
      recalc();
    });
  });

  // Initial calculation
  recalc();
}

// Legacy estimator support (contact page sidebar)
const estimatorFields = {
  pages: document.querySelector('#page-count'),
  cms: document.querySelector('#est-cms'),
  seo: document.querySelector('#est-seo'),
  copy: document.querySelector('#est-copy'),
};
const estimateOutput = document.querySelector('#estimate-value');
const estimateMeta = document.querySelector('#estimate-meta');

if (estimatorFields.pages && estimateOutput && estimateMeta) {
  const fmtINR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
  const updateEstimate = () => {
    const pages = Number(estimatorFields.pages.value);
    const withCms = Boolean(estimatorFields.cms?.checked);
    const withSeo = Boolean(estimatorFields.seo?.checked);
    const withCopy = Boolean(estimatorFields.copy?.checked);
    const subtotal = 1750 + pages * 350 + (withCms ? 3500 : 0) + (withSeo ? 2100 : 0) + (withCopy ? 1400 : 0);
    estimateOutput.textContent = `${fmtINR(Math.round(subtotal * 0.9))} - ${fmtINR(Math.round(subtotal * 1.15))}`;
    estimateMeta.textContent = `${pages} pages | CMS ${withCms ? 'Yes' : 'No'} | SEO ${withSeo ? 'Yes' : 'No'} | Copy ${withCopy ? 'Yes' : 'No'}`;
  };
  [estimatorFields.pages, estimatorFields.cms, estimatorFields.seo, estimatorFields.copy]
    .forEach((f) => { f?.addEventListener('input', updateEstimate); f?.addEventListener('change', updateEstimate); });
  updateEstimate();
}

// ─────────────────────────────────────────────────────────────────────────────
// ── PDF + DB helpers (loaded lazily so non-form pages are not affected) ───────
// ─────────────────────────────────────────────────────────────────────────────

// Dynamically load jsPDF from CDN then resolve
function loadJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Show a download button below the success message
function injectDownloadButton(container, filename, pdfDoc) {
  const existing = container.querySelector('.pdf-download-btn');
  if (existing) existing.remove();

  const btn = document.createElement('a');
  btn.className = 'btn-primary pdf-download-btn';
  btn.textContent = '⬇ Download Your Requirements PDF';
  btn.style.cssText = 'display:inline-flex;margin-top:0.9rem;cursor:pointer;';
  btn.addEventListener('click', () => pdfDoc.save(filename));
  container.appendChild(btn);
}

// Save to DB via db-adapter (module import — works when served over http/https)
async function persistToDb(type, data) {
  const mod = await import('./db-adapter.js');
  if (type === 'inquiry') return mod.saveInquiry(data);
  if (type === 'requirements') return mod.saveRequirements(data);
  throw new Error(`Unsupported persistence type: ${type}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Contact / Inquiry Form ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const leadForm = document.querySelector('#lead-form');
if (leadForm) {
  const feedback = document.querySelector('#form-message');

  leadForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = leadForm.querySelector('#name')?.value.trim() || '';
    const email = leadForm.querySelector('#email')?.value.trim() || '';
    const company = leadForm.querySelector('#company')?.value.trim() || '';
    const website = leadForm.querySelector('#website')?.value.trim() || '';
    const service = leadForm.querySelector('#service')?.value.trim() || '';
    const budget = leadForm.querySelector('#budget')?.value.trim() || '';
    const timeline = leadForm.querySelector('#timeline')?.value.trim() || '';
    const details = leadForm.querySelector('#details')?.value.trim() || '';

    const emailValid = /\S+@\S+\.\S+/.test(email);

    if (!name || !emailValid || !service || !budget || details.length < 12) {
      if (feedback) {
        feedback.className = 'form-message error';
        feedback.textContent = 'Please complete all required fields and add at least a short project brief.';
      }
      return;
    }

    // Disable button while processing
    const submitBtn = leadForm.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

    const formData = { name, email, company, website, service, budget, timeline, details };

    try {
      // 1 — Save to DB
      await persistToDb('inquiry', formData);

      // 2 — Generate PDF
      let pdfDoc = null;
      try {
        await loadJsPDF();
        const { generateInquiryPDF } = await import('./pdf-generator.js');
        pdfDoc = generateInquiryPDF(formData);
        // Auto-download for user
        pdfDoc.save(`Gelistra-Inquiry-${name.replace(/\s+/g, '-')}.pdf`);
      } catch (err) {
        console.warn('PDF generation failed:', err);
      }

      // 3 — Show success + re-download button
      if (feedback) {
        feedback.className = 'form-message success';
        feedback.textContent = '✓ Inquiry submitted! Your PDF has been downloaded. We reply within one business day.';
        if (pdfDoc) injectDownloadButton(feedback.parentElement, `Gelistra-Inquiry-${name.replace(/\s+/g, '-')}.pdf`, pdfDoc);
      }

      leadForm.reset();

      // Reset estimator
      if (estimatorFields.pages) {
        estimatorFields.pages.value = '12';
        if (estimatorFields.cms) estimatorFields.cms.checked = true;
        if (estimatorFields.seo) estimatorFields.seo.checked = true;
        if (estimatorFields.copy) estimatorFields.copy.checked = false;
        estimatorFields.pages.dispatchEvent(new Event('change'));
      }
    } catch (err) {
      console.error('Inquiry submission failed:', err);
      if (feedback) {
        feedback.className = 'form-message error';
        feedback.textContent = 'We could not submit your inquiry right now. Please try again in a moment.';
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Inquiry'; }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Requirements Form ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const requirementForm = document.querySelector('#requirements-form');
if (requirementForm) {
  const packageSelect = requirementForm.querySelector('#req-package');
  const packagePill = document.querySelector('#selected-package-pill');
  const message = document.querySelector('#requirements-message');
  const goalInputs = [...requirementForm.querySelectorAll('input[name="goal"]')];
  const featureInputs = [...requirementForm.querySelectorAll('input[name="feature"]')];
  const ecommerceToggle = requirementForm.querySelector('#feature-ecommerce');
  const ecommerceExtra = requirementForm.querySelector('#ecommerce-extra');
  const launchDateInput = requirementForm.querySelector('#req-launch-date');

  const packageMap = {
    starter: 'Static Website',
    growth: 'Growth',
    scale: 'Scale',
    enterprise: 'Enterprise',
    custom: 'Custom Scope',
  };

  const updatePackagePill = () => {
    if (!packagePill || !packageSelect) return;
    packagePill.textContent = `Package: ${packageMap[packageSelect.value] || 'Growth'}`;
  };

  const presetFromQuery = () => {
    if (!packageSelect) return 'growth';
    const q = new URLSearchParams(window.location.search).get('package') || '';
    const chosen = packageMap[q.toLowerCase()] ? q.toLowerCase() : 'growth';
    packageSelect.value = chosen;
    updatePackagePill();
    return chosen;
  };

  const syncEcommerceFields = () => {
    if (!ecommerceToggle || !ecommerceExtra) return;
    ecommerceExtra.hidden = !ecommerceToggle.checked;
  };

  if (launchDateInput) {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    launchDateInput.min = d.toISOString().split('T')[0];
  }

  const getSelectedValues = (selectEl) => {
    if (!selectEl) return [];
    if (selectEl.multiple) {
      return [...selectEl.selectedOptions]
        .map((opt) => String(opt.value || '').trim())
        .filter(Boolean);
    }
    return selectEl.value ? [String(selectEl.value).trim()] : [];
  };

  const pickedValues = (name) => [...requirementForm.querySelectorAll(`input[name="${name}"]:checked`)]
    .map((i) => i.value);

  const hasOtherSelected = (selectEl) => getSelectedValues(selectEl).includes('other');

  const otherAwareSelects = [...requirementForm.querySelectorAll('select[data-other-input]')];
  const targetVerticalOtherToggle = requirementForm.querySelector('#req-target-vertical-other-toggle');
  const integrationCategoryOtherToggle = requirementForm.querySelector('#req-integration-category-other-toggle');
  const choiceInputs = [...requirementForm.querySelectorAll('.choice-item input[type="checkbox"]')];

  const syncOtherInputState = (selectEl) => {
    if (!selectEl) return;
    const otherId = selectEl.dataset.otherInput;
    if (!otherId) return;

    const wrapper = requirementForm.querySelector(`#${otherId}-wrap`);
    const otherInput = requirementForm.querySelector(`#${otherId}`);
    const active = hasOtherSelected(selectEl);

    if (wrapper) wrapper.hidden = !active;
    if (otherInput) {
      otherInput.required = active;
      if (!active) otherInput.value = '';
    }
  };

  const resolveSelectValue = (selector) => {
    const selectEl = requirementForm.querySelector(selector);
    if (!selectEl) return '';

    const values = getSelectedValues(selectEl);
    if (!values.length) return '';

    const otherId = selectEl.dataset.otherInput;
    const otherInput = otherId ? requirementForm.querySelector(`#${otherId}`) : null;
    const otherText = otherInput?.value.trim() || '';

    const optionLabel = (option) => String(option?.textContent || option?.value || '').trim();

    if (selectEl.multiple) {
      return values.map((value) => {
        if (value === 'other') return otherText ? `Other: ${otherText}` : 'Other';
        const option = [...selectEl.options].find((opt) => opt.value === value);
        return optionLabel(option) || value;
      }).join(', ');
    }

    if (values[0] === 'other') return otherText ? `Other: ${otherText}` : 'Other';
    return optionLabel(selectEl.options[selectEl.selectedIndex]) || values[0];
  };

  const syncCheckboxOtherInputState = (toggleEl, wrapSelector, inputSelector) => {
    const wrapEl = requirementForm.querySelector(wrapSelector);
    const inputEl = requirementForm.querySelector(inputSelector);
    const active = Boolean(toggleEl?.checked);
    if (wrapEl) wrapEl.hidden = !active;
    if (inputEl) {
      inputEl.required = active;
      if (!active) inputEl.value = '';
    }
  };

  const syncTargetVerticalOtherState = () => {
    syncCheckboxOtherInputState(
      targetVerticalOtherToggle,
      '#req-target-verticals-other-wrap',
      '#req-target-verticals-other'
    );
  };

  const syncIntegrationCategoryOtherState = () => {
    syncCheckboxOtherInputState(
      integrationCategoryOtherToggle,
      '#req-integration-categories-other-wrap',
      '#req-integration-categories-other'
    );
  };

  const validateOtherSelections = () => {
    for (const selectEl of otherAwareSelects) {
      if (!hasOtherSelected(selectEl)) continue;
      const otherId = selectEl.dataset.otherInput;
      const otherInput = otherId ? requirementForm.querySelector(`#${otherId}`) : null;
      if (otherInput && !otherInput.value.trim()) {
        const label = requirementForm.querySelector(`label[for="${selectEl.id}"]`)?.textContent
          ?.replace('*', '')
          .trim() || 'selected field';
        return `Please add details for "${label}" after selecting Other.`;
      }
    }

    if (targetVerticalOtherToggle?.checked && !requirementForm.querySelector('#req-target-verticals-other')?.value.trim()) {
      return 'Please add details for "Target vertical focus" after selecting Other.';
    }
    if (integrationCategoryOtherToggle?.checked && !requirementForm.querySelector('#req-integration-categories-other')?.value.trim()) {
      return 'Please add details for "Integration categories" after selecting Other.';
    }

    return '';
  };

  const syncChoiceItemState = (inputEl) => {
    const item = inputEl?.closest('.choice-item');
    if (!item) return;
    item.classList.toggle('checked', Boolean(inputEl.checked));
  };

  packageSelect?.addEventListener('change', updatePackagePill);
  featureInputs.forEach((i) => i.addEventListener('change', syncEcommerceFields));
  otherAwareSelects.forEach((selectEl) => {
    selectEl.addEventListener('change', () => syncOtherInputState(selectEl));
  });
  targetVerticalOtherToggle?.addEventListener('change', syncTargetVerticalOtherState);
  integrationCategoryOtherToggle?.addEventListener('change', syncIntegrationCategoryOtherState);
  choiceInputs.forEach((inputEl) => {
    inputEl.addEventListener('change', () => syncChoiceItemState(inputEl));
    syncChoiceItemState(inputEl);
  });

  const defaultPackage = presetFromQuery();
  syncEcommerceFields();
  otherAwareSelects.forEach(syncOtherInputState);
  syncTargetVerticalOtherState();
  syncIntegrationCategoryOtherState();

  // ── Auto-Estimate Engine ──────────────────────────────────────────────────
  const fmtINR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

  // Pricing config
  const packageBasePrice = { starter: 3500, growth: 10500, scale: 24500, enterprise: 42000, custom: 17500 };

  const pageRangeMap = {
    '1-5 pages': { pages: 3, cost: 350 },
    '6-10 pages': { pages: 8, cost: 350 },
    '11-20 pages': { pages: 15, cost: 315 },
    '21-35 pages': { pages: 28, cost: 280 },
    '36-50 pages': { pages: 43, cost: 265 },
    '51-100 pages': { pages: 75, cost: 240 },
    '100+ pages': { pages: 110, cost: 220 },
    other: { pages: 40, cost: 250 },
  };

  const featureCostMap = {
    cms: 3500,
    blog: 2100,
    ecommerce: 8400,
    payments: 4200,
    booking: 2800,
    whatsapp: 1050,
    chat: 2100,
    multilingual: 3500,
    seo: 2100,
    analytics: 1400,
  };

  const contentCostMap = {
    'Content ready (final copy available)': 0,
    'Content partially ready': 2100,
    'Draft content exists, editing needed': 3500,
    'Need copywriting support': 5600,
    'Need complete content strategy + copy': 8400,
    other: 4200,
  };

  const supportCostMap = {
    'Ongoing monthly support required': 4200,
    'Quarterly maintenance retainer': 2800,
    'Annual support contract': 7000,
    'On-demand support hours': 2100,
    'One-time build only': 0,
    'Undecided': 0,
    other: 2100,
  };

  const brandAssetCostMap = {
    'Full brand system (logo, typography, color palette, guidelines)': 0,
    'Logo and color palette available': 700,
    'Logo only': 1400,
    'Moodboard / references only': 2100,
    'Existing assets need rebrand upgrade': 2800,
    'No brand assets yet (branding support required)': 4200,
    other: 2100,
  };

  const infraCostMap = {
    'Domain and hosting are active': 0,
    'Domain active; managed hosting setup required': 700,
    'Domain available; hosting setup required': 1050,
    'Existing hosting needs migration / optimization': 2100,
    'Support required for both domain and hosting': 2800,
    'Need infrastructure recommendation': 1400,
    'Cloud infrastructure required (AWS / GCP / Azure)': 3500,
    'Headless deployment stack required (Vercel / Netlify + CMS)': 2800,
    other: 1750,
  };

  const performanceCostMap = {
    'Core Web Vitals pass (all key pages)': 700,
    'LCP under 2.5s on mobile': 1050,
    'Lighthouse 85+ overall': 700,
    'Lighthouse 90+ overall': 1400,
    'Lighthouse 95+ on critical templates': 2450,
    other: 1400,
  };

  const accessibilityCostMap = {
    'Standard accessibility best practices': 700,
    'WCAG 2.1 AA alignment required': 2100,
    'WCAG audit and remediation required': 3500,
    'Accessibility statement + legal review support': 2800,
    other: 1750,
  };

  const feedbackCycleCostMap = {
    'Weekly review calls': 700,
    'Bi-weekly review calls': 350,
    'Async review in shared docs/tools': 0,
    'Daily sync during critical milestones': 1400,
    'Single consolidated review each milestone': 350,
    other: 700,
  };

  const supportSlaCostMap = {
    'Business-hours SLA': 1400,
    'Priority response within 24 hours': 2100,
    'Critical issue response within 4-8 hours': 3500,
    '24x7 SLA for critical incidents': 5600,
    'Dedicated account manager + escalation matrix': 4200,
    other: 2100,
  };

  const trainingCostMap = {
    'CMS training session needed': 700,
    'Documentation only': 350,
    'Recorded walkthrough videos': 1050,
    'Admin + editor role-based training': 1400,
    'No training required': 0,
    other: 700,
  };

  const integrationCategoryCostMap = {
    'CRM / Sales Ops': 700,
    'Marketing Automation': 700,
    'Analytics / Tracking': 350,
    'Payments / Finance': 700,
    'Logistics / Fulfilment': 700,
    'Support / Helpdesk': 700,
    'Auth / SSO': 1050,
    'ERP / Inventory': 1400,
    other: 700,
  };

  // DOM refs for estimate display
  const estRangeEl = document.querySelector('#req-est-range');
  const estBaseEl = document.querySelector('#req-est-base');
  const estPagesEl = document.querySelector('#req-est-pages');
  const estFeaturesEl = document.querySelector('#req-est-features');
  const estContentEl = document.querySelector('#req-est-content');
  const estSupportEl = document.querySelector('#req-est-support');
  const estTotalEl = document.querySelector('#req-est-total');

  // Last computed estimate (used when submitting)
  let lastEstimateRange = '';

  function recalcReqEstimate() {
    const pkg = packageSelect?.value || 'growth';
    const baseCost = packageBasePrice[pkg] || 10500;

    // Pages
    const pageCountVal = requirementForm.querySelector('#req-pages')?.value || '';
    const pageInfo = pageRangeMap[pageCountVal] || pageRangeMap.other || { pages: 5, cost: 350 };
    const pageCost = pageInfo.pages * pageInfo.cost;

    // Features
    const selectedFeatures = featureInputs.filter(i => i.checked).map(i => i.value);
    const featureCost = selectedFeatures.reduce((sum, f) => sum + (featureCostMap[f] || 0), 0);

    // Content
    const contentVal = requirementForm.querySelector('#req-content-status')?.value || '';
    const contentCost = contentCostMap[contentVal] || 0;

    // Support
    const supportVal = requirementForm.querySelector('#req-support')?.value || '';
    const supportCost = supportCostMap[supportVal] || 0;

    // Additional dropdown-driven adjustments
    const brandVal = requirementForm.querySelector('#req-brand-assets')?.value || '';
    const domainVal = requirementForm.querySelector('#req-domain-hosting')?.value || '';
    const perfVal = requirementForm.querySelector('#req-performance-target')?.value || '';
    const accessibilityVal = requirementForm.querySelector('#req-accessibility-level')?.value || '';
    const feedbackVal = requirementForm.querySelector('#req-feedback-cycle')?.value || '';
    const supportSlaVal = requirementForm.querySelector('#req-sla')?.value || '';
    const trainingVal = requirementForm.querySelector('#req-training')?.value || '';
    const integrationCategories = pickedValues('integration_category');

    const dropdownAddonCost =
      (brandAssetCostMap[brandVal] || 0) +
      (infraCostMap[domainVal] || 0) +
      (performanceCostMap[perfVal] || 0) +
      (accessibilityCostMap[accessibilityVal] || 0) +
      (feedbackCycleCostMap[feedbackVal] || 0) +
      (supportSlaCostMap[supportSlaVal] || 0) +
      (trainingCostMap[trainingVal] || 0);

    const integrationAddonCost = integrationCategories
      .reduce((sum, item) => sum + (integrationCategoryCostMap[item] || 0), 0);

    // Total
    const subtotal = baseCost + pageCost + featureCost + contentCost + supportCost + dropdownAddonCost + integrationAddonCost;
    const low = Math.round(subtotal * 0.9);
    const high = Math.round(subtotal * 1.15);

    lastEstimateRange = `${fmtINR(low)} – ${fmtINR(high)}`;

    // Update display
    if (estBaseEl) estBaseEl.textContent = fmtINR(baseCost);
    if (estPagesEl) estPagesEl.textContent = pageCountVal ? `${pageInfo.pages} pages × ${fmtINR(pageInfo.cost)} = ${fmtINR(pageCost)}` : '—';
    if (estFeaturesEl) {
      const totalFeatureLike = featureCost + dropdownAddonCost + integrationAddonCost;
      const countLike = selectedFeatures.length + integrationCategories.length;
      estFeaturesEl.textContent = countLike
        ? `${countLike} selected items = ${fmtINR(totalFeatureLike)}`
        : fmtINR(totalFeatureLike);
    }
    if (estContentEl) estContentEl.textContent = contentVal ? fmtINR(contentCost) : '—';
    if (estSupportEl) estSupportEl.textContent = fmtINR(supportCost);
    if (estTotalEl) estTotalEl.textContent = lastEstimateRange;
    if (estRangeEl) {
      estRangeEl.textContent = lastEstimateRange;
      estRangeEl.classList.remove('calculating');
    }
  }

  // Listen for changes on all relevant fields
  const estimateTrackedInputs = [
    packageSelect,
    requirementForm.querySelector('#req-pages'),
    requirementForm.querySelector('#req-content-status'),
    requirementForm.querySelector('#req-support'),
    requirementForm.querySelector('#req-brand-assets'),
    requirementForm.querySelector('#req-domain-hosting'),
    requirementForm.querySelector('#req-performance-target'),
    requirementForm.querySelector('#req-accessibility-level'),
    requirementForm.querySelector('#req-feedback-cycle'),
    requirementForm.querySelector('#req-sla'),
    requirementForm.querySelector('#req-training'),
  ];
  estimateTrackedInputs.forEach(el => {
    el?.addEventListener('change', recalcReqEstimate);
  });
  featureInputs.forEach(cb => {
    cb.addEventListener('change', recalcReqEstimate);
  });
  requirementForm.querySelectorAll('input[name="integration_category"]').forEach((cb) => {
    cb.addEventListener('change', recalcReqEstimate);
  });

  // Initial calc
  recalcReqEstimate();

  // ── Form Submit ───────────────────────────────────────────────────────────

  requirementForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Collect all field values
    const g = (id) => requirementForm.querySelector(id)?.value.trim() || '';
    const picked = (name) => [...requirementForm.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);

    const name = g('#req-name');
    const email = g('#req-email');
    const phone = g('#req-phone');
    const company = g('#req-company');
    const role = g('#req-role');
    const decisionMaker = g('#req-decision-maker');
    const pkg = g('#req-package');
    const industry = resolveSelectValue('#req-industry');
    const audience = g('#req-audience');
    const currentSite = g('#req-current-site');
    const pageCount = resolveSelectValue('#req-pages');
    const pageList = g('#req-page-list');
    const contentStatus = resolveSelectValue('#req-content-status');
    const brandAssets = resolveSelectValue('#req-brand-assets');
    const references = g('#req-references');
    const productCount = g('#req-product-count');
    const paymentGw = g('#req-payment-gateway');
    const integrations = g('#req-integrations');
    const domainHosting = resolveSelectValue('#req-domain-hosting');
    const launchDate = g('#req-launch-date');
    const budget = resolveSelectValue('#req-budget');
    const support = resolveSelectValue('#req-support');
    const assetsLink = g('#req-assets-link');
    const notes = g('#req-notes');

    // Extended intake fields
    const businessModel = resolveSelectValue('#req-business-model');
    const targetVerticalValues = picked('target_vertical');
    const targetVerticalOther = g('#req-target-verticals-other');
    const targetVerticals = targetVerticalValues
      .map((value) => (value === 'other' ? (targetVerticalOther ? `Other: ${targetVerticalOther}` : 'Other') : value))
      .join(', ');
    const secondaryAudience = g('#req-secondary-audience');
    const usp = g('#req-usp');
    const competitors = g('#req-competitors');
    const kpis = g('#req-kpis');
    const templateNeeds = g('#req-template-needs');
    const v1Scope = g('#req-v1-scope');
    const futureScope = g('#req-future-phases');
    const coreCta = g('#req-core-cta');
    const contentOwner = resolveSelectValue('#req-content-owner');
    const contentMigration = resolveSelectValue('#req-content-migration');
    const contentDeadline = g('#req-content-deadline');
    const brandTone = resolveSelectValue('#req-brand-tone');
    const designSystem = resolveSelectValue('#req-design-system');
    const v1FeaturePriority = g('#req-v1-features');
    const budgetBuild = g('#req-budget-build');
    const budgetOps = g('#req-budget-ops');
    const paymentTerms = resolveSelectValue('#req-payment-terms');
    const cmsPreference = g('#req-cms-preference');
    const techStack = g('#req-tech-stack');
    const hostingPreference = g('#req-hosting-preference');
    const browserSupport = g('#req-browser-support');
    const seoKeywords = g('#req-seo-keywords');
    const seoRegions = g('#req-seo-regions');
    const redirectPlan = resolveSelectValue('#req-redirect-plan');
    const performanceTarget = resolveSelectValue('#req-performance-target');
    const accessibilityLevel = resolveSelectValue('#req-accessibility-level');
    const privacyNotes = g('#req-privacy-preferences');
    const languages = g('#req-languages');
    const currencies = g('#req-currencies');
    const regions = g('#req-regions');
    const workflowStakeholders = g('#req-workflow-stakeholders');
    const feedbackCycle = resolveSelectValue('#req-feedback-cycle');
    const approvalSla = g('#req-approval-sla');
    const milestones = g('#req-milestones');
    const dependencies = g('#req-dependencies');
    const supportSla = resolveSelectValue('#req-sla');
    const trainingRequirement = resolveSelectValue('#req-training');
    const maintenanceWindow = g('#req-maintenance-window');
    const handoverExpectations = g('#req-handover');
    const integrationCategoryValues = picked('integration_category');
    const integrationCategoryOther = g('#req-integration-categories-other');
    const integrationCategories = integrationCategoryValues
      .map((value) => (value === 'other' ? (integrationCategoryOther ? `Other: ${integrationCategoryOther}` : 'Other') : value))
      .join(', ');
    const securityReqs = picked('security_req');
    const complianceReqs = picked('compliance_req');

    const consent = Boolean(requirementForm.querySelector('#req-consent')?.checked);

    const goals = goalInputs.filter((i) => i.checked).map((i) => i.value);
    const features = featureInputs.filter((i) => i.checked).map((i) => i.value);

    const emailValid = /\S+@\S+\.\S+/.test(email);

    let errorMsg = '';
    if (!name || !emailValid || !phone || !company || !decisionMaker || !industry || !pageCount || !contentStatus || !brandAssets || !domainHosting || !launchDate || !budget) {
      errorMsg = 'Please complete all required fields with valid information.';
    } else if (audience.length < 20) {
      errorMsg = 'Target audience description must be at least 20 characters.';
    } else if (pageList.length < 8) {
      errorMsg = 'Page list must be at least 8 characters.';
    } else if (goals.length === 0) {
      errorMsg = 'Please select at least one goal.';
    } else if (features.length === 0) {
      errorMsg = 'Please select at least one feature.';
    } else if (!consent) {
      errorMsg = 'Please accept the confirmation checkbox.';
    } else {
      const otherValidationError = validateOtherSelections();
      if (otherValidationError) errorMsg = otherValidationError;
    }

    if (errorMsg) {
      if (message) {
        message.className = 'form-message error';
        message.textContent = errorMsg;
      }
      return;
    }

    // Disable submit while processing
    const submitBtn = requirementForm.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

    // Recalculate to capture latest estimate
    recalcReqEstimate();

    const combinedAudience = [audience, secondaryAudience ? `Secondary Audience Segments: ${secondaryAudience}` : '']
      .filter(Boolean)
      .join('\n');
    const combinedReferences = [references, competitors ? `Competitor / Benchmark Sites:\n${competitors}` : '']
      .filter(Boolean)
      .join('\n\n');
    const combinedIntegrations = [
      integrations,
      integrationCategories ? `Integration Categories: ${integrationCategories}` : '',
      cmsPreference ? `CMS / Platform Preference: ${cmsPreference}` : '',
      techStack ? `Tech Stack Preference: ${techStack}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const extendedDetailRows = [
      ['Target Verticals', targetVerticals],
      ['Business Model', businessModel],
      ['USP', usp],
      ['Success KPIs', kpis],
      ['Template Requirements', templateNeeds],
      ['V1 Must-Have Scope', v1Scope],
      ['Future Phase Scope', futureScope],
      ['Primary CTA Focus', coreCta],
      ['Content Ownership', contentOwner],
      ['Content Migration', contentMigration],
      ['Content Handover Deadline', contentDeadline],
      ['Brand Tone', brandTone],
      ['Design System Requirement', designSystem],
      ['V1 Feature Priority', v1FeaturePriority],
      ['Budget Split (Build)', budgetBuild],
      ['Budget Split (Ops)', budgetOps],
      ['Payment Terms Preference', paymentTerms],
      ['Hosting Preference', hostingPreference],
      ['Browser / Device Support', browserSupport],
      ['SEO Priorities', seoKeywords],
      ['SEO Target Regions', seoRegions],
      ['URL Redirect Plan', redirectPlan],
      ['Performance Target', performanceTarget],
      ['Accessibility Requirement', accessibilityLevel],
      ['Integration Categories', integrationCategories],
      ['Security Requirements', securityReqs.join(', ')],
      ['Compliance Requirements', complianceReqs.join(', ')],
      ['Privacy / Legal Notes', privacyNotes],
      ['Languages Required', languages],
      ['Currencies Required', currencies],
      ['Target Regions', regions],
      ['Review Stakeholders', workflowStakeholders],
      ['Feedback Cycle', feedbackCycle],
      ['Internal Approval SLA', approvalSla],
      ['Milestones / Campaign Dates', milestones],
      ['Dependencies / Blockers', dependencies],
      ['Support SLA', supportSla],
      ['Training Requirement', trainingRequirement],
      ['Maintenance Window', maintenanceWindow],
      ['Handover Expectations', handoverExpectations],
    ].filter(([, v]) => v && String(v).trim() !== '');

    const extendedDetailsText = extendedDetailRows.length
      ? `Extended Intake Details:\n${extendedDetailRows.map(([k, v]) => `${k}: ${v}`).join('\n')}`
      : '';
    const combinedNotes = [notes, extendedDetailsText].filter(Boolean).join('\n\n');

    const formData = {
      name, email, phone, company, role, decisionMaker,
      package: pkg, industry, audience: combinedAudience, goals,
      currentSite, pageCount, pageList, contentStatus, brandAssets, references: combinedReferences,
      features, productCount, paymentGateway: paymentGw, integrations: combinedIntegrations,
      domainHosting, launchDate, budget, support, assetsLink, notes: combinedNotes,
      estimateRange: lastEstimateRange,
    };

    if (currentUser) {
      formData.customerId = currentUser.customerId;
    }

    try {
      // 1 — Save to DB
      await persistToDb('requirements', formData);

      // 2 — Generate + auto-download PDF
      let pdfDoc = null;
      try {
        await loadJsPDF();
        const { generateRequirementsPDF } = await import('./pdf-generator.js');
        pdfDoc = generateRequirementsPDF(formData);
        pdfDoc.save(`Gelistra-Requirements-${name.replace(/\s+/g, '-')}.pdf`);
      } catch (err) {
        console.warn('PDF generation failed:', err);
      }

      // 3 — Show success + re-download button
      if (message) {
        message.className = 'form-message success';
        message.textContent = '✓ Requirements submitted! Your PDF has been downloaded. We will contact you with next steps.';
        if (pdfDoc) injectDownloadButton(message.parentElement, `Gelistra-Requirements-${name.replace(/\s+/g, '-')}.pdf`, pdfDoc);
      }

      requirementForm.reset();
      if (packageSelect) packageSelect.value = defaultPackage;
      updatePackagePill();
      syncEcommerceFields();
      otherAwareSelects.forEach(syncOtherInputState);
      syncTargetVerticalOtherState();
      syncIntegrationCategoryOtherState();
      choiceInputs.forEach(syncChoiceItemState);
      recalcReqEstimate();
    } catch (err) {
      console.error('Requirements submission failed:', err);
      if (message) {
        message.className = 'form-message error';
        message.textContent = 'We could not submit your requirements right now. Please try again.';
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Requirements Brief'; }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Auth Pages (Login / Sign Up) ──────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const authForm = document.querySelector('#auth-form');
if (authForm) {
  let isLogin = true;
  const nameWrap = document.querySelector('#name-field-wrap');
  const authTitle = document.querySelector('#auth-title');
  const authSubtitle = document.querySelector('#auth-subtitle');
  const authSubmitBtn = document.querySelector('#auth-submit-btn');
  const authSwitchBtn = document.querySelector('#auth-switch-btn');
  const authSwitchText = document.querySelector('#auth-switch-text');
  const authMessage = document.querySelector('#auth-message');

  const nameInput = document.querySelector('#auth-name');
  const emailInput = document.querySelector('#auth-email');
  const passwordInput = document.querySelector('#auth-password');

  authSwitchBtn?.addEventListener('click', () => {
    isLogin = !isLogin;
    if (isLogin) {
      nameWrap.style.display = 'none';
      nameInput.removeAttribute('required');
      authTitle.textContent = 'Sign In';
      authSubtitle.textContent = 'Welcome back. Please enter your details.';
      authSubmitBtn.textContent = 'Sign In';
      authSwitchText.textContent = "Don't have an account?";
      authSwitchBtn.textContent = 'Sign Up';
    } else {
      nameWrap.style.display = 'block';
      nameInput.setAttribute('required', 'true');
      authTitle.textContent = 'Sign Up';
      authSubtitle.textContent = 'Create an account to manage your projects.';
      authSubmitBtn.textContent = 'Sign Up';
      authSwitchText.textContent = 'Already have an account?';
      authSwitchBtn.textContent = 'Sign In';
    }
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const pw = passwordInput.value.trim();
    const name = nameInput.value.trim();

    if (!email || !pw || (!isLogin && !name)) {
      authMessage.className = 'form-message error';
      authMessage.textContent = 'Please fill all required fields.';
      return;
    }

    try {
      const dbMod = await import('./db-adapter.js');
      let user;

      authSubmitBtn.disabled = true;
      authSubmitBtn.textContent = isLogin ? 'Signing In...' : 'Signing Up...';

      if (isLogin) {
        user = await dbMod.login(email, pw);
      } else {
        user = await dbMod.signup(name, email, pw);
      }

      localStorage.setItem('gelistra_user', JSON.stringify({
        email: user.email,
        name: user.name,
        customerId: user.customerId,
        token: user.token || null,
      }));

      const qs = new URLSearchParams(window.location.search);
      const redirect = qs.get('redirect') || 'account.html';
      window.location.href = redirect;

    } catch (err) {
      authMessage.className = 'form-message error';
      authMessage.textContent = err.message || 'An error occurred. Please try again.';
      console.error(err);
    } finally {
      authSubmitBtn.disabled = false;
      authSubmitBtn.textContent = isLogin ? 'Sign In' : 'Sign Up';
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Account Dashboard ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const accountLogoutBtn = document.querySelector('#logout-btn');
if (accountLogoutBtn) {
  accountLogoutBtn.addEventListener('click', () => {
    localStorage.removeItem('gelistra_user');
    window.location.href = 'login.html';
  });

  if (currentUser) {
    const accName = document.querySelector('#account-name');
    const accId = document.querySelector('#account-customer-id');
    if (accName) accName.textContent = currentUser.name;
    if (accId) accId.textContent = currentUser.customerId;

    // Load user's submissions (requirements + inquiries)
    const checkDbAndLoad = async () => {
      try {
        const mod = await import('./db-adapter.js');
        const reqList = document.querySelector('#requirements-list');
        const submissions = await mod.getSubmissions({ customerId: currentUser.customerId });

        reqList.innerHTML = '';
        if (!submissions || submissions.length === 0) {
          reqList.innerHTML = '<div class="empty-state">You have not submitted any projects yet.</div>';
          return;
        }

        const fmtStageDate = (raw) => {
          if (!raw) return '';
          const d = new Date(raw);
          if (Number.isNaN(d.getTime())) return '';
          return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        };

        const renderLinearTimeline = (title, steps, activeIndex) => {
          return `
            <div class="client-stage-block">
              <p class="client-stage-title">${title}</p>
              <div class="client-stage-line" style="grid-template-columns: repeat(${steps.length}, minmax(0, 1fr));">
                ${steps.map((step, idx) => `
                  <div class="client-stage-step ${idx < activeIndex ? 'done' : ''} ${idx === activeIndex ? 'active' : ''}">
                    <span class="client-stage-dot"></span>
                    <span class="client-stage-label">${step.label}</span>
                    <span class="client-stage-date">${step.date || '—'}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        };

        submissions.forEach(sub => {
          const div = document.createElement('div');
          div.className = 'req-item';
          const d = sub.createdAt
            ? new Date(sub.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'N/A';
          const isReq = sub.type === 'requirements';
          const title = isReq
            ? (sub.package ? `${String(sub.package).toUpperCase()} PACKAGE` : 'Requirements')
            : (sub.service ? `${String(sub.service).toUpperCase()} INQUIRY` : 'Project Inquiry');
          const descriptor = isReq
            ? `Company: ${sub.company || 'N/A'} • Goal: ${(sub.goals || []).join(', ') || 'N/A'}`
            : `Company: ${sub.company || 'N/A'} • Timeline: ${sub.timeline || 'N/A'}`;
          const statusRaw = String(sub.status || 'new').toLowerCase();
          const badgeClass = (statusRaw === 'proposal' || statusRaw === 'closed')
            ? 'completed'
            : (statusRaw === 'in-review' ? 'in-progress' : 'new');
          const statusLabel = statusRaw === 'proposal'
            ? 'Quote Received'
            : statusRaw.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          const officialQuote = sub.final_quote || '';
          const stageStatusOrder = ['new', 'in-review', 'proposal', 'closed'];
          const stageStatusIndex = Math.max(0, stageStatusOrder.indexOf(statusRaw));
          const stageTimelineSteps = [
            { label: 'New', date: fmtStageDate(sub.new_stage_at || sub.newStageAt || sub.createdAt) },
            { label: 'In Review', date: fmtStageDate(sub.in_review_at || sub.inReviewAt || ((stageStatusIndex >= 1) ? sub.updatedAt : '')) },
            { label: 'Proposal Sent', date: fmtStageDate(sub.proposal_sent_at || sub.proposalSentAt || ((stageStatusIndex >= 2) ? sub.updatedAt : '')) },
            { label: 'Closed', date: fmtStageDate(sub.closed_at || sub.closedAt || (sub.quote_response === 'accepted' ? sub.quote_response_at : '') || ((stageStatusIndex >= 3) ? sub.updatedAt : '')) },
          ];
          const statusTimelineHtml = renderLinearTimeline('Requirement Status', stageTimelineSteps, stageStatusIndex);

          const quoteAccepted = String(sub.quote_response || '').toLowerCase() === 'accepted';
          const workStatusRaw = String(sub.work_status || sub.workStatus || (quoteAccepted ? 'queued' : '')).toLowerCase();
          const workStatusOrder = ['queued', 'ongoing', 'testing', 'revision', 'on-hold', 'completed'];
          const workStatusIndex = Math.max(0, workStatusOrder.indexOf(workStatusRaw || 'queued'));
          const workTimelineSteps = [
            { label: 'Queued', date: fmtStageDate(sub.work_queued_at || sub.workQueuedAt || (quoteAccepted ? sub.quote_response_at : '')) },
            { label: 'Ongoing', date: fmtStageDate(sub.work_ongoing_at || sub.workOngoingAt) },
            { label: 'Testing', date: fmtStageDate(sub.work_testing_at || sub.workTestingAt) },
            { label: 'Revision', date: fmtStageDate(sub.work_revision_at || sub.workRevisionAt) },
            { label: 'On Hold', date: fmtStageDate(sub.work_on_hold_at || sub.workOnHoldAt) },
            { label: 'Completed', date: fmtStageDate(sub.work_completed_at || sub.workCompletedAt) },
          ];
          const workTimelineHtml = quoteAccepted
            ? renderLinearTimeline('Website Work Status', workTimelineSteps, workStatusIndex)
            : '';
          const clientResponseLabel = sub.quote_response
            ? String(sub.quote_response).charAt(0).toUpperCase() + String(sub.quote_response).slice(1)
            : '';
          const responseAt = sub.quote_response_at
            ? new Date(sub.quote_response_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : '';
          const quoteActionHtml = statusRaw === 'proposal'
            ? `
              <div class="quote-action-card" style="margin-top:0.85rem;padding:0.75rem;background:rgba(255,255,255,0.8);border:1px solid var(--border);border-radius:8px;">
                <p style="font-size:0.84rem;color:var(--text-2);margin:0 0 0.45rem;">Send a message with your decision (optional)</p>
                <textarea class="quote-message-input" rows="3" placeholder="Example: Please proceed with milestone-based billing." style="width:100%;padding:0.55rem 0.6rem;border:1px solid var(--border);border-radius:6px;background:#fff;color:var(--text);font-family:inherit;resize:vertical;"></textarea>
                <div style="display:flex;gap:0.5rem;margin-top:0.55rem;flex-wrap:wrap;">
                  <button class="btn-primary quote-accept-btn" style="padding:0.45rem 0.8rem;font-size:0.82rem;">Accept Quote</button>
                  <button class="btn-ghost quote-reject-btn" style="padding:0.45rem 0.8rem;font-size:0.82rem;border:1px solid var(--border);">Reject Quote</button>
                </div>
              </div>`
            : '';
          const responseSummaryHtml = sub.quote_response
            ? `<div style="margin-top:0.8rem;padding:0.65rem;background:rgba(15,23,42,0.03);border-left:3px solid var(--accent);border-radius:4px;">
                <p style="font-size:0.82rem;color:var(--text-2);margin:0 0 0.2rem;">Your quote response: <strong style="color:var(--text);">${clientResponseLabel}</strong>${responseAt ? ` on ${responseAt}` : ''}</p>
                ${sub.quote_message ? `<p style="font-size:0.83rem;color:var(--text);margin:0;">"${sub.quote_message}"</p>` : ''}
              </div>`
            : '';

          div.innerHTML = `
            <div class="req-item-left">
              <h3>${title}</h3>
              <p>Submitted on: ${d}</p>
              <p>${descriptor}</p>
              <p style="text-transform: capitalize;">Type: ${sub.type || 'project'}</p>
              ${sub.status === 'proposal' ? `<div style="margin-top: 0.8rem; padding: 0.7rem; background: var(--surface-2); border-left: 3px solid var(--accent); border-radius: 4px;">
                <p style="font-size: 0.85rem; color: var(--text-2); margin-bottom: 0.2rem;">Official Quote</p>
                <div style="font-size: 1.25rem; font-weight: bold; color: var(--text);">${officialQuote || 'Quote shared by Gelistra'}</div>
              </div>` : ''}
              ${statusTimelineHtml}
              ${workTimelineHtml}
              ${responseSummaryHtml}
              ${quoteActionHtml}
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.6rem;">
              <span class="req-status ${badgeClass}">${statusLabel}</span>
              <button class="btn-ghost download-pdf-btn" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border: 1px solid var(--border);">Download PDF</button>
            </div>
          `;

          const dlBtn = div.querySelector('.download-pdf-btn');
          dlBtn.addEventListener('click', async () => {
            const oldText = dlBtn.textContent;
            dlBtn.textContent = 'Generating...';
            dlBtn.disabled = true;
            try {
              if (typeof loadJsPDF === 'function') await loadJsPDF();
              const { generateInquiryPDF, generateRequirementsPDF } = await import('./pdf-generator.js');
              const pdfDoc = isReq ? generateRequirementsPDF(sub) : generateInquiryPDF(sub);
              const safeName = (sub.name || 'Account').replace(/\s+/g, '-');
              const typeLabel = isReq ? 'Requirements' : 'Inquiry';
              pdfDoc.save(`Gelistra-${typeLabel}-${safeName}.pdf`);
            } catch (err) {
              console.warn('PDF generation failed:', err);
              alert('Failed to generate PDF. Please try again.');
            }
            dlBtn.textContent = oldText;
            dlBtn.disabled = false;
          });

          const wireQuoteDecision = (decision, btnEl) => {
            btnEl?.addEventListener('click', async () => {
              const messageEl = div.querySelector('.quote-message-input');
              const acceptBtn = div.querySelector('.quote-accept-btn');
              const rejectBtn = div.querySelector('.quote-reject-btn');
              const oldAccept = acceptBtn?.textContent || 'Accept Quote';
              const oldReject = rejectBtn?.textContent || 'Reject Quote';
              const actionBtn = decision === 'accepted' ? acceptBtn : rejectBtn;

              if (!actionBtn) return;
              if (acceptBtn) acceptBtn.disabled = true;
              if (rejectBtn) rejectBtn.disabled = true;
              actionBtn.textContent = decision === 'accepted' ? 'Accepting...' : 'Rejecting...';

              try {
                await mod.respondToQuote(sub.id, sub.type, decision, messageEl?.value?.trim() || '');
                await checkDbAndLoad();
              } catch (err) {
                console.error('Quote response failed:', err);
                alert(err?.message || 'Failed to send your quote response. Please try again.');
                if (acceptBtn) { acceptBtn.disabled = false; acceptBtn.textContent = oldAccept; }
                if (rejectBtn) { rejectBtn.disabled = false; rejectBtn.textContent = oldReject; }
              }
            });
          };

          wireQuoteDecision('accepted', div.querySelector('.quote-accept-btn'));
          wireQuoteDecision('rejected', div.querySelector('.quote-reject-btn'));

          reqList.appendChild(div);
        });
      } catch (err) {
        console.error('Failed to load submissions', err);
        const reqList = document.querySelector('#requirements-list');
        if (reqList) reqList.innerHTML = '<div class="empty-state">Could not load submissions. Please try again later.</div>';
      }
    };

    checkDbAndLoad();
  } else {
    // Cannot access account page without being logged in
    window.location.href = 'login.html';
  }
}
