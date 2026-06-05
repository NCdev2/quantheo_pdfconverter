document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const btnMin = document.getElementById('btn-min');
  const btnMax = document.getElementById('btn-max');
  const btnClose = document.getElementById('btn-close');
  
  const navItems = document.querySelectorAll('.nav-item[data-target]');
  const pages = document.querySelectorAll('.page');
  
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  
  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const btnBrowser = document.getElementById('btn-browser');
  
  const webview = document.getElementById('stirling-webview');
  const webviewLoading = document.getElementById('webview-loading');
  const webviewErrorMsg = document.getElementById('webview-error-msg');
  const webviewUrlDisplay = document.getElementById('webview-url-display');
  const webviewRefresh = document.getElementById('webview-refresh');
  const webviewFullscreen = document.getElementById('webview-fullscreen');
  const sidebar = document.querySelector('.sidebar');
  
  const startupOverlay = document.getElementById('startup-overlay');
  const startupBar = document.getElementById('startup-bar');
  
  const toastEl = document.getElementById('toast');
  
  const settingAutoStart = document.getElementById('setting-autostart');
  const settingAutoLaunch = document.getElementById('setting-autolaunch');
  const settingPort = document.getElementById('setting-port');

  let currentStatus = 'stopped';
  let backendUrl = 'http://localhost:8080';
  let themeCss = '';

  // Load our beautiful gift wrap theme
  try {
    const response = await fetch('stirling-theme.css');
    themeCss = await response.text();
  } catch (err) {
    console.error('Failed to load theme css', err);
  }

  // License Status & Trial Enforcement
  const licenseStatus = await window.stirlingAPI.getLicenseStatus();
  let restrictFeatures = licenseStatus.status === 'expired';

  const licenseInput = document.getElementById('license-input');
  const licenseStatusEl = document.getElementById('license-status');
  const submitLicenseBtn = document.getElementById('submit-license');

  function updateLicenseUI(statusObj) {
    if (statusObj.status === 'licensed') {
      licenseStatusEl.textContent = `Status: Valid License (Owner: ${statusObj.owner}, Expires: ${new Date(statusObj.expiry).toLocaleDateString()})`;
      licenseStatusEl.style.color = '#2ecc71';
      restrictFeatures = false;
    } else if (statusObj.status === 'trial') {
      licenseStatusEl.textContent = `Status: Trial Mode (${statusObj.daysRemaining} days remaining)`;
      licenseStatusEl.style.color = '#f1c40f';
    } else if (statusObj.status === 'expired') {
      licenseStatusEl.textContent = 'Status: Trial Expired. Premium features locked.';
      licenseStatusEl.style.color = '#e74c3c';
    }

    if (restrictFeatures) {
      // Disable premium tabs
      document.querySelector('.nav-item[data-target="convert-page"]').style.display = 'none';
      document.querySelector('.nav-item[data-target="image-page"]').style.display = 'none';
      if (document.querySelector('.nav-item[data-target="convert-page"]').classList.contains('active') ||
          document.querySelector('.nav-item[data-target="image-page"]').classList.contains('active')) {
          document.querySelector('.nav-item[data-target="webview-page"]').click();
      }
    } else {
      document.querySelector('.nav-item[data-target="convert-page"]').style.display = 'flex';
      document.querySelector('.nav-item[data-target="image-page"]').style.display = 'flex';
    }
  }

  updateLicenseUI(licenseStatus);

  submitLicenseBtn.addEventListener('click', async () => {
    const key = licenseInput.value.trim();
    if (!key) return;
    const res = await window.stirlingAPI.applyLicense(key);
    if (res.ok) {
      showToast('License successfully applied!');
      updateLicenseUI(await window.stirlingAPI.getLicenseStatus());
      if (currentStatus === 'running' && webview.reload) webview.reload(); // Reload to remove CSS restrictions
    } else {
      showToast('Error: ' + res.error, 'error');
    }
  });

  // Inject CSS automatically when webview loads a new page
  if (webview && webview.addEventListener) {
    webview.addEventListener('dom-ready', () => {
      const currentSrc = webview.src || webview.getAttribute('src') || '';
      if (themeCss && currentSrc.startsWith('http')) {
        webview.insertCSS(themeCss);
      }
      if (restrictFeatures && currentSrc.startsWith('http')) {
        // Enforce trial limitation on Stirling PDF web wrapper
        const restrictCss = `
          .tools-grid > a:not([href*="pdf-to-word"]):not([href*="word-to-pdf"]):not([href*="view-pdf"]) {
            display: none !important;
          }
          .custom-card:not([href*="pdf-to-word"]):not([href*="word-to-pdf"]):not([href*="view-pdf"]) {
            display: none !important;
          }
          .home-card-link:not([href*="pdf-to-word"]):not([href*="word-to-pdf"]):not([href*="view-pdf"]) {
             display: none !important;
          }
        `;
        webview.insertCSS(restrictCss);
      }
    });
  }

  // Titlebar controls
  btnMin.addEventListener('click', () => window.stirlingAPI.windowMinimize());
  btnMax.addEventListener('click', () => window.stirlingAPI.windowMaximize());
  btnClose.addEventListener('click', () => window.stirlingAPI.windowClose());

  // Navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      
      const targetId = item.getAttribute('data-target');
      pages.forEach(p => {
        if (p.id === targetId) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });

      if (targetId === 'webview-page' && currentStatus === 'running') {
        const currentSrc = webview.src || webview.getAttribute('src') || '';
        if (currentSrc.startsWith('data:text/html')) {
          webview.src = backendUrl;
          webview.setAttribute('src', backendUrl);
        }
      }
    });
  });

  // Settings
  const settings = await window.stirlingAPI.getSettings();
  settingAutoStart.checked = settings.autoStart;
  settingAutoLaunch.checked = settings.autoLaunch;
  settingPort.value = settings.port;

  settingAutoStart.addEventListener('change', (e) => {
    window.stirlingAPI.setSetting('autoStart', e.target.checked);
    showToast('Setting saved');
  });
  settingAutoLaunch.addEventListener('change', (e) => {
    window.stirlingAPI.setSetting('autoLaunch', e.target.checked);
    showToast('Setting saved');
  });
  settingPort.addEventListener('change', (e) => {
    window.stirlingAPI.setSetting('port', parseInt(e.target.value, 10));
    showToast('Port setting saved. Restart backend to apply.');
  });

  // Actions
  btnStart.addEventListener('click', () => window.stirlingAPI.startBackend());
  btnStop.addEventListener('click', () => window.stirlingAPI.stopBackend());
  
  btnBrowser.addEventListener('click', () => {
    if (currentStatus === 'running') {
      window.stirlingAPI.openExternal(backendUrl);
    }
  });

  webviewRefresh.addEventListener('click', () => {
    if (currentStatus === 'running') {
       if (webview.reload) webview.reload();
    }
  });

  webviewFullscreen.addEventListener('click', () => {
    if (sidebar.style.display === 'none') {
      sidebar.style.display = 'flex';
      webviewFullscreen.textContent = '⛶ Full Screen';
    } else {
      sidebar.style.display = 'none';
      webviewFullscreen.textContent = '✖ Exit Full Screen';
    }
  });

  // Status Updates
  window.stirlingAPI.onBackendStatus((statusData) => {
    updateStatusUI(statusData);
  });

  // Initial Status
  const initStatus = await window.stirlingAPI.getBackendStatus();
  updateStatusUI(initStatus);

  // Fake startup sequence for visuals
  setTimeout(() => { startupBar.style.width = '40%'; }, 500);
  setTimeout(() => { startupBar.style.width = '80%'; }, 1000);
  setTimeout(() => { 
    startupBar.style.width = '100%';
    setTimeout(() => {
      startupOverlay.classList.add('hidden');
    }, 400);
  }, 1500);

  function updateStatusUI(data) {
    currentStatus = data.status;
    backendUrl = data.url || `http://localhost:${data.port || 8080}`;
    webviewUrlDisplay.textContent = backendUrl;

    // Reset dot
    statusDot.className = 'status-dot';
    statusDot.classList.add(data.status);
    
    statusText.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);

    const currentSrc = webview.src || webview.getAttribute('src') || '';

    if (data.status === 'running') {
      btnStart.style.opacity = '0.5';
      btnStart.style.pointerEvents = 'none';
      btnStop.style.opacity = '1';
      btnStop.style.pointerEvents = 'auto';
      
      webviewLoading.style.display = 'none';
      if (document.getElementById('webview-page').classList.contains('active') && currentSrc.startsWith('data:text/html')) {
         webview.src = backendUrl;
         webview.setAttribute('src', backendUrl);
      }
    } else if (data.status === 'starting') {
      btnStart.style.opacity = '0.5';
      btnStart.style.pointerEvents = 'none';
      btnStop.style.opacity = '1';
      btnStop.style.pointerEvents = 'auto';
      webviewLoading.style.display = 'flex';
      if (!currentSrc.startsWith('data:text/html')) {
        webview.src = 'data:text/html,<html><body style="background:transparent;"></body></html>';
        webview.setAttribute('src', 'data:text/html,<html><body style="background:transparent;"></body></html>');
      }
    } else {
      // Stopped or error
      btnStart.style.opacity = '1';
      btnStart.style.pointerEvents = 'auto';
      btnStop.style.opacity = '0.5';
      btnStop.style.pointerEvents = 'none';
      webviewLoading.style.display = 'flex';
      if (!currentSrc.startsWith('data:text/html')) {
        webview.src = 'data:text/html,<html><body style="background:transparent;"></body></html>';
        webview.setAttribute('src', 'data:text/html,<html><body style="background:transparent;"></body></html>');
      }
      
      if (data.status === 'error' && data.error) {
        // Show persistent error banner inside the loading pane
        if (webviewErrorMsg) {
          webviewErrorMsg.textContent = data.error;
          webviewErrorMsg.style.display = 'block';
        }
        showToast(data.error, 'error');
      } else {
        if (webviewErrorMsg) webviewErrorMsg.style.display = 'none';
      }
    }
  }

  let toastTimeout;
  function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = type;
    toastEl.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 3000);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CONVERT PAGE
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── Tab switching ────────────────────────────────────────────────────────
  const convertTabs   = document.querySelectorAll('.convert-tab');
  const convertPanels = document.querySelectorAll('.convert-panel');

  convertTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      convertTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const mode = tab.dataset.mode;
      convertPanels.forEach(p => {
        p.classList.toggle('active', p.id === `panel-${mode}`);
      });
    });
  });

  // ── PDF → Markdown ───────────────────────────────────────────────────────
  const pdfDropZone    = document.getElementById('pdf-drop-zone');
  const pdfFileInput   = document.getElementById('pdf-file-input');
  const pdfFileInfo    = document.getElementById('pdf-file-info');
  const pdfFileName    = document.getElementById('pdf-file-name');
  const pdfFileMeta    = document.getElementById('pdf-file-meta');
  const btnConvertPdfMd = document.getElementById('btn-convert-pdf-md');
  const mdOutput       = document.getElementById('md-output');
  const btnSaveMd      = document.getElementById('btn-save-md');
  const btnCopyMd      = document.getElementById('btn-copy-md');

  let selectedPdfPath  = null;
  let convertedMd      = '';

  function setPdfFile(filePath, name, size) {
    selectedPdfPath = filePath;
    pdfFileName.textContent = name;
    pdfFileMeta.textContent = size ? `${(size / 1024).toFixed(1)} KB` : '';
    pdfFileInfo.style.display = 'flex';
    pdfDropZone.classList.add('has-file');
    pdfDropZone.querySelector('.drop-zone-icon').textContent = '✅';
    pdfDropZone.querySelector('.drop-zone-text').textContent = name;
    pdfDropZone.querySelector('.drop-zone-sub').textContent  = 'Click to change file';
    btnConvertPdfMd.disabled = false;
  }

  // Click to browse
  pdfDropZone.addEventListener('click', async () => {
    const filePath = await window.stirlingAPI.openFile({
      title: 'Select a PDF file',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      properties: ['openFile'],
    });
    if (filePath) {
      const name = filePath.split(/[\\/]/).pop();
      setPdfFile(filePath, name);
    }
  });

  // Drag & drop
  pdfDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    pdfDropZone.classList.add('drag-over');
  });
  pdfDropZone.addEventListener('dragleave', () => pdfDropZone.classList.remove('drag-over'));
  pdfDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    pdfDropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.pdf')) {
      setPdfFile(file.path, file.name, file.size);
    }
  });

  // Convert button
  btnConvertPdfMd.addEventListener('click', async () => {
    if (!selectedPdfPath) return;

    const icon = btnConvertPdfMd.querySelector('.btn-icon');
    const originalText = icon.textContent;
    icon.textContent = '⏳';
    btnConvertPdfMd.disabled = true;
    btnConvertPdfMd.classList.add('loading');
    mdOutput.value = 'Converting…';

    const result = await window.stirlingAPI.pdfToMarkdown(selectedPdfPath);

    icon.textContent = originalText;
    btnConvertPdfMd.classList.remove('loading');
    btnConvertPdfMd.disabled = false;

    if (result.ok) {
      convertedMd = result.markdown;
      mdOutput.value = convertedMd;
      btnSaveMd.disabled = false;
      btnCopyMd.style.display = 'inline-flex';
      const pages = result.pages ? ` • ${result.pages} page${result.pages !== 1 ? 's' : ''}` : '';
      pdfFileMeta.textContent = (pdfFileMeta.textContent.split('•')[0]).trim() + pages;
    } else {
      mdOutput.value = `Error: ${result.error}`;
    }
  });

  // Save .md file
  btnSaveMd.addEventListener('click', async () => {
    if (!convertedMd) return;
    const baseName = (pdfFileName.textContent || 'document').replace(/\.pdf$/i, '');
    const savePath = await window.stirlingAPI.saveFile({
      title: 'Save Markdown File',
      defaultPath: `${baseName}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (!savePath) return;
    const result = await window.stirlingAPI.writeTextFile(savePath, convertedMd);
    if (result.ok) {
      showConvertToast(`Saved: ${savePath.split(/[\\/]/).pop()}`);
    } else {
      showConvertToast(`Save failed: ${result.error}`, 'error');
    }
  });

  // Copy to clipboard
  btnCopyMd.addEventListener('click', async () => {
    if (!convertedMd) return;
    await navigator.clipboard.writeText(convertedMd);
    showConvertToast('Markdown copied to clipboard!');
  });

  // ── Markdown → PDF ───────────────────────────────────────────────────────
  const mdEditor       = document.getElementById('md-editor');
  const mdPreview      = document.getElementById('md-preview');
  const btnConvertMdPdf = document.getElementById('btn-convert-md-pdf');
  const btnLoadMdFile   = document.getElementById('btn-load-md-file');

  // Simple client-side markdown renderer for the live preview
  // (Uses basic regex — the real conversion uses markdown-it in main process)
  function renderMarkdownPreview(text) {
    if (!text.trim()) {
      mdPreview.innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:40px">Start typing to see a preview…</p>';
      return;
    }
    let html = text
      // Headings
      .replace(/^#{6}\s(.+)$/gm, '<h6>$1</h6>')
      .replace(/^#{5}\s(.+)$/gm, '<h5>$1</h5>')
      .replace(/^#{4}\s(.+)$/gm, '<h4>$1</h4>')
      .replace(/^#{3}\s(.+)$/gm, '<h3>$1</h3>')
      .replace(/^#{2}\s(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#{1}\s(.+)$/gm, '<h1>$1</h1>')
      // Bold / italic
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      // Code
      .replace(/```[\s\S]*?```/g, m => `<pre><code>${m.replace(/```(\w*\n?)/g,'').replace(/```/g,'').trim()}</code></pre>`)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Blockquote
      .replace(/^>\s(.+)$/gm, '<blockquote>$1</blockquote>')
      // Unordered lists
      .replace(/^\s*[-*+]\s(.+)$/gm, '<li>$1</li>')
      // Ordered lists
      .replace(/^\s*\d+\.\s(.+)$/gm, '<li>$1</li>')
      // Horizontal rule
      .replace(/^[-*_]{3,}$/gm, '<hr>')
      // Links & images
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      // Paragraphs (double newlines)
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // Wrap li in ul
    html = html.replace(/(<li>.*?<\/li>)+/gs, m => `<ul>${m}</ul>`);

    mdPreview.innerHTML = `<p>${html}</p>`;
  }

  // Debounced live preview
  let previewTimer = null;
  mdEditor.addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => renderMarkdownPreview(mdEditor.value), 150);
  });
  renderMarkdownPreview(mdEditor.value);

  // Load .md file
  btnLoadMdFile.addEventListener('click', async () => {
    const filePath = await window.stirlingAPI.openFile({
      title: 'Open Markdown File',
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
      properties: ['openFile'],
    });
    if (filePath) {
      // Read file content via a workaround — request main to convert (returns text)
      // Use fetch with file:// protocol (Electron allows this in renderer)
      try {
        const res = await fetch('file://' + filePath.replace(/\\/g, '/'));
        const text = await res.text();
        mdEditor.value = text;
        renderMarkdownPreview(text);
      } catch (e) {
        showConvertToast('Could not read file', 'error');
      }
    }
  });

  // Export to PDF
  btnConvertMdPdf.addEventListener('click', async () => {
    const content = mdEditor.value.trim();
    if (!content) { showConvertToast('Please enter some Markdown first', 'error'); return; }

    const savePath = await window.stirlingAPI.saveFile({
      title: 'Save PDF',
      defaultPath: 'document.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!savePath) return;

    const icon = btnConvertMdPdf.querySelector('.btn-icon');
    icon.textContent = '⏳';
    btnConvertMdPdf.disabled = true;
    btnConvertMdPdf.classList.add('loading');

    const result = await window.stirlingAPI.markdownToPdf(content, savePath);

    icon.textContent = '⚡';
    btnConvertMdPdf.classList.remove('loading');
    btnConvertMdPdf.disabled = false;

    if (result.ok) {
      showConvertToast(`PDF saved: ${savePath.split(/[\\/]/).pop()}`);
    } else {
      showConvertToast(`Error: ${result.error}`, 'error');
    }
  });

  // ── Shared toast for convert page ────────────────────────────────────────
  const toastEl = document.getElementById('toast');
  let convertToastTimer;
  function showConvertToast(msg, type = 'success') {
    toastEl.textContent = msg;
    toastEl.className = type;
    toastEl.classList.add('show');
    clearTimeout(convertToastTimer);
    convertToastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE TOOLS PAGE
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const imgDropZone    = document.getElementById('img-drop-zone');
  const imgFileInput   = document.getElementById('img-file-input');
  const imgFileInfo    = document.getElementById('img-file-info');
  const imgFileName    = document.getElementById('img-file-name');
  const imgFileMeta    = document.getElementById('img-file-meta');
  const btnResizeSkew  = document.getElementById('btn-resize-skew');
  const imgPreview     = document.getElementById('img-preview');
  const btnSaveImg     = document.getElementById('btn-save-img');

  // Modal Elements
  const modalOverlay   = document.getElementById('resize-modal-overlay');
  const btnModalClose  = document.getElementById('btn-modal-close');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const btnModalOk     = document.getElementById('btn-modal-ok');

  const radioType      = document.getElementsByName('resize-type');
  const resizeH        = document.getElementById('resize-h');
  const resizeV        = document.getElementById('resize-v');
  const btnLinkAspect  = document.getElementById('btn-link-aspect');
  
  const skewH          = document.getElementById('skew-h');
  const skewV          = document.getElementById('skew-v');

  let currentImageSrc  = null;
  let originalImageObj = null;
  let modifiedBase64   = null;

  let isAspectLinked   = true; // Turn on by default, but user wants unlink option available

  // Set initial state for linked button
  btnLinkAspect.classList.add('active');

  function loadImage(filePath, fileName, fileSize) {
    imgFileName.textContent = fileName;
    imgFileMeta.textContent = fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : '';
    imgFileInfo.style.display = 'flex';
    imgDropZone.classList.add('has-file');
    imgDropZone.querySelector('.drop-zone-icon').textContent = '✅';
    imgDropZone.querySelector('.drop-zone-text').textContent = fileName;
    imgDropZone.querySelector('.drop-zone-sub').textContent  = 'Click to change image';
    btnResizeSkew.disabled = false;

    // Load into preview and memory
    const img = new Image();
    // Allow reading local file via custom file path in renderer or file://
    img.src = 'file://' + filePath.replace(/\\/g, '/');
    img.onload = () => {
      originalImageObj = img;
      currentImageSrc = filePath;
      showPreview(img.src);
    };
  }

  function showPreview(src) {
    imgPreview.innerHTML = `<img src="${src}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">`;
    btnSaveImg.disabled = false;
    modifiedBase64 = src; // Will be a data URL if edited
  }

  // Click to browse
  imgDropZone.addEventListener('click', async () => {
    const filePath = await window.stirlingAPI.openFile({
      title: 'Select an Image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
      properties: ['openFile'],
    });
    if (filePath) {
      const name = filePath.split(/[\\/]/).pop();
      loadImage(filePath, name, null);
    }
  });

  // Open modal
  btnResizeSkew.addEventListener('click', () => {
    if (!originalImageObj) return;
    
    // Reset inputs
    radioType[0].checked = true; // Percentage
    resizeH.value = 100;
    resizeV.value = 100;
    skewH.value = 0;
    skewV.value = 0;
    
    modalOverlay.classList.add('active');
  });

  // Close modal
  const closeModal = () => modalOverlay.classList.remove('active');
  btnModalClose.addEventListener('click', closeModal);
  btnModalCancel.addEventListener('click', closeModal);

  // Aspect ratio link toggle
  btnLinkAspect.addEventListener('click', () => {
    isAspectLinked = !isAspectLinked;
    if (isAspectLinked) {
      btnLinkAspect.classList.add('active');
      // immediately sync V to H
      resizeV.value = resizeH.value;
    } else {
      btnLinkAspect.classList.remove('active');
    }
  });

  // Handle Percentage vs Pixels toggle
  Array.from(radioType).forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'percentage') {
        resizeH.value = 100;
        resizeV.value = 100;
      } else {
        // Switch to pixels
        resizeH.value = originalImageObj.width;
        resizeV.value = originalImageObj.height;
      }
    });
  });

  // Handle resize input sync
  resizeH.addEventListener('input', () => {
    if (isAspectLinked) resizeV.value = resizeH.value;
  });
  resizeV.addEventListener('input', () => {
    if (isAspectLinked) resizeH.value = resizeV.value;
  });

  // Apply Changes
  btnModalOk.addEventListener('click', () => {
    if (!originalImageObj) return;

    const isPercentage = radioType[0].checked;
    let newWidth, newHeight;

    if (isPercentage) {
      newWidth = originalImageObj.width * (parseFloat(resizeH.value) / 100);
      newHeight = originalImageObj.height * (parseFloat(resizeV.value) / 100);
    } else {
      newWidth = parseFloat(resizeH.value);
      newHeight = parseFloat(resizeV.value);
    }

    const sH = parseFloat(skewH.value) || 0;
    const sV = parseFloat(skewV.value) || 0;

    // Use Canvas for Resize & Skew
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Convert skew degrees to radians
    const radH = sH * Math.PI / 180;
    const radV = sV * Math.PI / 180;

    // Calculate bounding box for the skewed image to prevent clipping
    const absSkewH = Math.abs(Math.tan(radH) * newHeight);
    const absSkewV = Math.abs(Math.tan(radV) * newWidth);
    
    canvas.width = newWidth + absSkewH;
    canvas.height = newHeight + absSkewV;

    // Apply transformation
    // setTransform(a, b, c, d, e, f)
    // a (m11) Horizontal scaling.
    // b (m12) Horizontal skewing. (tan of vertical skew)
    // c (m21) Vertical skewing. (tan of horizontal skew)
    // d (m22) Vertical scaling.
    // e (dx) Horizontal moving.
    // f (dy) Vertical moving.
    
    const dx = sH < 0 ? absSkewH : 0;
    const dy = sV < 0 ? absSkewV : 0;
    
    ctx.setTransform(1, Math.tan(radV), Math.tan(radH), 1, dx, dy);
    
    // Draw the image
    ctx.drawImage(originalImageObj, 0, 0, newWidth, newHeight);

    // Get Data URL
    const dataUrl = canvas.toDataURL('image/png');
    showPreview(dataUrl);
    
    closeModal();
  });

  // Save Image
  btnSaveImg.addEventListener('click', async () => {
    if (!modifiedBase64) return;
    
    const baseName = (imgFileName.textContent || 'image').replace(/\.[^/.]+$/, "");
    const savePath = await window.stirlingAPI.saveFile({
      title: 'Save Image',
      defaultPath: `${baseName}_edited.png`,
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    });
    
    if (!savePath) return;

    if (modifiedBase64.startsWith('data:image')) {
      // Save data url
      const result = await window.stirlingAPI.writeBinaryFile(savePath, modifiedBase64);
      if (result.ok) {
        toastEl.textContent = 'Image saved successfully!';
        toastEl.className = 'success show';
        setTimeout(() => toastEl.classList.remove('show'), 3500);
      } else {
        toastEl.textContent = 'Error saving image: ' + result.error;
        toastEl.className = 'error show';
        setTimeout(() => toastEl.classList.remove('show'), 3500);
      }
    } else {
      // It's the original file path, maybe they just saved without changes.
      toastEl.textContent = 'Image saved (Unchanged)!';
      toastEl.className = 'success show';
      setTimeout(() => toastEl.classList.remove('show'), 3500);
    }
  });

});

