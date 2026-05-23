'use strict';
const { EventEmitter } = require('events');
const { spawn }        = require('child_process');
const path             = require('path');
const http             = require('http');
const fs               = require('fs');
const { app }          = require('electron');

class BackendManager extends EventEmitter {
  /**
   * @param {object} options
   * @param {number}  options.port        - Port to bind Stirling-PDF on (default 8080)
   * @param {string}  options.jrePath     - Absolute path to bundled JRE bin dir
   * @param {string}  options.jarPath     - Absolute path to stirling-pdf.jar
   * @param {string}  options.dataDir     - Directory for configs / logs / uploads
   */
  constructor(options = {}) {
    super();
    this.port    = options.port    || 8080;
    this.host    = 'localhost';
    this.jrePath = options.jrePath;   // e.g. .../resources/jre/bin
    this.jarPath = options.jarPath;   // e.g. .../resources/stirling-pdf.jar
    this.dataDir = options.dataDir || path.join(app.getPath('userData'), 'data');

    this.status         = 'stopped'; // stopped | starting | running | error
    this.lastError      = null;
    this._proc          = null;
    this._healthTimer   = null;
    this._startupTimer  = null;
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  /** Resolve the java executable (bundled JRE → system java fallback) */
  _javaExe() {
    if (this.jrePath && fs.existsSync(this.jrePath)) {
      const exe = path.join(this.jrePath, process.platform === 'win32' ? 'java.exe' : 'java');
      if (fs.existsSync(exe)) return exe;
    }
    return 'java'; // fall back to system PATH
  }

  /** Ensure required data sub-directories exist */
  _ensureDataDirs() {
    for (const sub of ['configs', 'customFiles', 'logs', 'pipeline', 'tessdata']) {
      const d = path.join(this.dataDir, sub);
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    }
  }

  /** HTTP health probe — resolves true when the app is responding */
  _healthCheck() {
    return new Promise((resolve) => {
      const req = http.get(
        { hostname: this.host, port: this.port, path: '/', timeout: 5000 },
        (res) => resolve(res.statusCode >= 200 && res.statusCode < 400)
      );
      req.on('error',   () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
  }

  _setStatus(status) {
    const prev = this.status;
    this.status = status;
    if (prev !== status) this.emit('status', { status, previous: prev, error: this.lastError });
  }

  // ── health monitor ────────────────────────────────────────────────────────

  _startHealthMonitor() {
    this._stopHealthMonitor();
    this._healthTimer = setInterval(async () => {
      const ok = await this._healthCheck();
      if (ok  && this.status !== 'running') this._setStatus('running');
      if (!ok && this.status === 'running') {
        this.lastError = 'Backend became unreachable';
        this._setStatus('error');
      }
    }, 8000);
  }

  _stopHealthMonitor() {
    if (this._healthTimer) { clearInterval(this._healthTimer); this._healthTimer = null; }
  }

  /** Poll until the server is up or we time out (120 s) */
  _waitForHealthy(maxMs = 120_000) {
    const deadline = Date.now() + maxMs;
    const poll = async () => {
      if (Date.now() > deadline) {
        this.lastError = 'Startup timed out (120 s). The JVM may still be initialising.';
        this._setStatus('error');
        return;
      }
      if (await this._healthCheck()) {
        this._setStatus('running');
        this._startHealthMonitor();
      } else {
        this._startupTimer = setTimeout(poll, 3000);
      }
    };
    poll();
  }

  // ── public API ────────────────────────────────────────────────────────────

  getUrl() { return `http://${this.host}:${this.port}`; }

  async start() {
    if (this.status === 'running' || this.status === 'starting') return;

    // Validate JAR exists
    if (!this.jarPath || !fs.existsSync(this.jarPath)) {
      this.lastError = `Stirling-PDF JAR not found at: ${this.jarPath}`;
      this._setStatus('error');
      return;
    }

    this._setStatus('starting');
    this.lastError = null;
    this._ensureDataDirs();

    const javaExe = this._javaExe();
    const args = [
      `-Dserver.port=${this.port}`,
      `-DDOCKER_ENABLE_SECURITY=false`,
      `-DSECURITY_ENABLELOGIN=false`,
      `-DUI_APP_NAME=StirlingPDF Desktop`,
      `-DUI_HOME_DESCRIPTION=Your all-in-one PDF toolkit`,
      `-DSYSTEM_DEFAULT_LOCALE=en-US`,
      `-DSYSTEM_GOOGLE_VISIBILITY=false`,
      `-DMETRICS_ENABLED=false`,
      `-DINSTALL_BOOK_AND_ADVANCE_HTML_OPS=false`,
      `-DLANGS=en_GB`,
      // Point Stirling-PDF's data directories to our userData folder
      `-DCUSTOM_CONFIG_DIR=${path.join(this.dataDir, 'configs')}`,
      `-DCUSTOM_FILES_DIR=${path.join(this.dataDir, 'customFiles')}`,
      `-Dlogging.file.name=${path.join(this.dataDir, 'logs', 'stirling-pdf.log')}`,
      '-jar', this.jarPath,
    ];

    this._proc = spawn(javaExe, args, {
      cwd: this.dataDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this._proc.stdout.on('data', (d) => {
      const line = d.toString();
      // Detect Spring Boot "Started" log line as early-ready signal
      if (line.includes('Started') && line.includes('JVM')) this._waitForHealthy();
    });

    this._proc.stderr.on('data', (d) => {
      const line = d.toString();
      if (line.toLowerCase().includes('error') && !line.includes('INFO')) {
        console.error('[stirling-pdf]', line.trim());
      }
    });

    this._proc.on('error', (err) => {
      this.lastError = err.code === 'ENOENT'
        ? `Java not found at "${javaExe}". The bundled JRE may be missing.`
        : `Failed to start Stirling-PDF: ${err.message}`;
      this._setStatus('error');
    });

    this._proc.on('close', (code) => {
      this._proc = null;
      if (this.status !== 'stopped') {
        this.lastError = code !== 0 ? `Stirling-PDF exited with code ${code}` : null;
        this._setStatus(code !== 0 ? 'error' : 'stopped');
      }
    });

    // Begin polling regardless — catches cases where stdout line never fires
    this._waitForHealthy();
  }

  async stop() {
    this._stopHealthMonitor();
    if (this._startupTimer) { clearTimeout(this._startupTimer); this._startupTimer = null; }

    return new Promise((resolve) => {
      if (!this._proc) { this._setStatus('stopped'); resolve(true); return; }

      const proc = this._proc;
      this._proc = null;

      const onDone = () => { this._setStatus('stopped'); resolve(true); };

      proc.once('close', onDone);

      // Graceful SIGTERM, then force-kill after 5 s
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', proc.pid.toString(), '/f', '/t'], { windowsHide: true });
        } else {
          proc.kill('SIGTERM');
          setTimeout(() => { try { proc.kill('SIGKILL'); } catch (_) {} }, 5000);
        }
      } catch (_) { onDone(); }
    });
  }

  async restart() {
    await this.stop();
    await new Promise(r => setTimeout(r, 1500));
    await this.start();
  }

  destroy() {
    this._stopHealthMonitor();
    if (this._startupTimer) clearTimeout(this._startupTimer);
    if (this._proc) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', this._proc.pid.toString(), '/f', '/t'], { windowsHide: true });
        } else {
          this._proc.kill('SIGKILL');
        }
      } catch (_) {}
      this._proc = null;
    }
  }
}

module.exports = BackendManager;
