// ── PeerJS wrapper ────────────────────────────────────────────────────────────
//
// Thin React-free abstraction over the PeerJS library (loaded from the
// peerjs CDN before this file).  Exposes one constructor on the window:
//
//   const session = new window.PeerSession();
//   session.hostCreate(opts).then(({ roomCode }) => ...);
//   session.guestJoin(roomCode, opts).then(() => ...);
//   session.send(msg);                          // broadcast to all peers
//   session.sendTo(peerId, msg);                // targeted send (host → guest)
//   session.onMessage = (msg, fromPeerId) => ...;
//   session.onPeerJoin = (peerInfo) => ...;
//   session.onPeerLeave = (peerInfo) => ...;
//   session.onError    = (err) => ...;
//   session.destroy();                          // close everything cleanly
//
// Roles:
//   • Host (role='host')  owns one Peer + N DataConnections (one per guest).
//   • Guest (role='guest') owns one Peer + one DataConnection to the host.
//
// Room codes are derived from a 4-char human-friendly suffix tacked onto a
// fixed namespace prefix.  The full PeerJS ID never leaks into the UI, so
// the user only ever types "WOLF" or similar.
//
// This file is OPTIONAL — if it (or the peerjs CDN script) is missing, the
// online/ folder simply won't activate and the router falls back to the
// vanilla pass-and-play menu.  Nothing in core/ or standard/ depends on it.
//
// Load order (only if Online mode is included):
//   peerjs CDN → core/peer.js → online/lobby.js → router.js
// ──────────────────────────────────────────────────────────────────────────────


(function () {
  // ──────────────────────────────────────────────────────────────────────────
  // ── DEBUG TOOLS (easy to remove: see the block at the bottom marked ─────
  // ── "REMOVE-DEBUG-BLOCK" and the dbg(...) / wireConnDebug(...) calls.) ──
  // ──────────────────────────────────────────────────────────────────────────
  // Toggle DEBUG=false to silence everything without removing code.
  // FORCE_TURN_ONLY=true forces all connections through the TURN relay — use
  // this to test whether TURN is actually reachable.  If a connection works
  // with FORCE_TURN_ONLY=true, TURN is fine; if not, the TURN config is broken.
  // ENABLE_TURN=false drops back to the old STUN-only config (matches the
  // previous working version exactly).  Useful for A/B testing: if TURN entries
  // somehow break things, flipping this off proves it.
  const DEBUG           = false;
  const FORCE_TURN_ONLY = false;
  const ENABLE_TURN     = true;

  const _peerLog = [];
  if (typeof window !== 'undefined') {
    window.PEER_LOG = _peerLog;
    // Type window.dumpPeerLog() in DevTools to dump the full log.
    window.dumpPeerLog = function () {
      console.log('━━━━━━━━━━━━━ PEER DEBUG LOG (' + _peerLog.length + ' entries) ━━━━━━━━━━━━━');
      _peerLog.forEach(function (e, i) {
        const ts = new Date(e.t).toISOString().slice(11, 23);
        console.log('#' + i, ts, '[' + e.cat + ']', e.msg, e.data !== undefined ? e.data : '');
      });
      return _peerLog;
    };
    // window.clearPeerLog() resets the log buffer.
    window.clearPeerLog = function () { _peerLog.length = 0; };
  }
  function dbg(cat, msg, data) {
    if (!DEBUG) return;
    const entry = { t: Date.now(), cat: cat, msg: msg, data: data };
    _peerLog.push(entry);
    if (_peerLog.length > 1000) _peerLog.shift();
    try {
      if (data !== undefined) console.log('[peer:' + cat + ']', msg, data);
      else                    console.log('[peer:' + cat + ']', msg);
      if (typeof window !== 'undefined' && typeof window.__peerDbgOverlay === 'function') {
        window.__peerDbgOverlay(entry);
      }
    } catch (e) {}
  }
  // Attaches detailed ICE / connection-state listeners to a PeerJS DataConnection.
  // Logs every ICE candidate type (host=local, srflx=STUN-mapped, relay=TURN)
  // and every state transition.  This is the most useful signal for diagnosing
  // cross-network failures — if no 'relay' candidates appear, TURN isn't working.
  function wireConnDebug(conn, label) {
    if (!DEBUG || !conn) return;
    let attempts = 0;
    let sawRelay = false;
    // After 8s of gathering, if no relay candidate has appeared, log a loud
    // warning — this is the #1 cause of cross-network failures and the
    // overlay's "TURN: ✗" indicator alone is easy to miss.
    const relayWatchdog = setTimeout(function () {
      if (!sawRelay) dbg('ice', label + ': ⚠ NO RELAY CANDIDATE after 8s — TURN is broken or unreachable');
    }, 8000);
    function tryWire() {
      const pc = conn.peerConnection;
      if (!pc) {
        if (++attempts < 50) return setTimeout(tryWire, 100);
        dbg('debug', label + ': no peerConnection after 5s — PeerJS internals changed?');
        return;
      }
      dbg('debug', label + ': listeners wired');
      pc.addEventListener('icecandidate', function (ev) {
        if (!ev.candidate) { dbg('ice', label + ': gathering done'); return; }
        const c = ev.candidate;
        let type = c.type || 'unknown';
        let addr = c.address || '';
        if (!type && c.candidate) {
          // Older Edge / Safari put the type inside the candidate string.
          const parts = c.candidate.split(' ');
          type = parts[7] || 'unknown';
          addr = parts[4] || addr;
        }
        if (type === 'relay') { sawRelay = true; clearTimeout(relayWatchdog); }
        dbg('ice', label + ': candidate ' + type + ' ' + (c.protocol || '') + ' ' + addr);
      });
      pc.addEventListener('iceconnectionstatechange', function () {
        dbg('ice', label + ': iceConnectionState=' + pc.iceConnectionState);
      });
      pc.addEventListener('icegatheringstatechange', function () {
        dbg('ice', label + ': iceGatheringState=' + pc.iceGatheringState);
      });
      pc.addEventListener('connectionstatechange', function () {
        dbg('conn', label + ': connectionState=' + pc.connectionState);
      });
      pc.addEventListener('signalingstatechange', function () {
        dbg('debug', label + ': signalingState=' + pc.signalingState);
      });
    }
    tryWire();
  }
  // ──────────────────────────────────────────────────────────────────────────
  // ── END OF DEBUG TOOLS (top section) ──────────────────────────────────────
  // ──────────────────────────────────────────────────────────────────────────


  // ── Configuration ──────────────────────────────────────────────────────────
  // Namespace prefix keeps our IDs from colliding with other PeerJS apps that
  // happen to share the same default signalling server.  The friendly room
  // code (4 chars) is what the user types — the prefix is invisible.
  const ID_PREFIX     = 'devilgambit-';
  const CODE_LENGTH   = 4;
  // Ambiguous chars (0/O, 1/I/L) excluded so codes are easy to read aloud.
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const PROTOCOL_VER  = 1;  // bumped if the message protocol changes

  // ── WebRTC / PeerJS base options ───────────────────────────────────────────
  // STUN: tells each peer its public IP so they can attempt a direct connection.
  // TURN: relay fallback used when direct P2P fails (symmetric NAT, strict
  // firewalls, cross-country connections).  The OpenRelay public credentials
  // below are widely shared — if they stop working, sign up free at metered.ca
  // and swap in your own dedicated credentials.
  //
  // NOTE for TURN entries: both `username` AND `credential` are REQUIRED by the
  // RTCIceServer spec.  Omitting either causes the entire entry to be rejected
  // by Chrome/Edge, which means TURN silently doesn't work.
  const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302'  },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
  ];
  // ── TURN credentials (Metered.ca) ────────────────────────────────────────
  // Relay fallback for symmetric NAT / strict firewalls (cross-network play).
  // Credentials rotate — update from app.metered.ca dashboard if they expire.
  const TURN_SERVERS = [
    { urls: 'turn:standard.relay.metered.ca:80',                  username: '0ce5907e990bd753b4a09f9c', credential: 'WEZ9vhXoKnMX29bG' },
    { urls: 'turn:standard.relay.metered.ca:80?transport=tcp',    username: '0ce5907e990bd753b4a09f9c', credential: 'WEZ9vhXoKnMX29bG' },
    { urls: 'turn:standard.relay.metered.ca:443',                 username: '0ce5907e990bd753b4a09f9c', credential: 'WEZ9vhXoKnMX29bG' },
    { urls: 'turns:standard.relay.metered.ca:443?transport=tcp',  username: '0ce5907e990bd753b4a09f9c', credential: 'WEZ9vhXoKnMX29bG' },
  ];
  const ICE_SERVERS = ENABLE_TURN ? STUN_SERVERS.concat(TURN_SERVERS) : STUN_SERVERS;

  // PEER_OPT_BASE is built to match the OLD (working) version's shape exactly
  // when neither debug-only flag is on:  { debug: 0, config: { iceServers } }.
  // The extra options below are added only when the matching toggle is true,
  // so they cannot affect normal operation.
  const PEER_OPT_BASE = { debug: 0, config: { iceServers: ICE_SERVERS } };
  if (FORCE_TURN_ONLY) PEER_OPT_BASE.config.iceTransportPolicy = 'relay';

  dbg('init', 'PeerSession module loaded', {
    stun: STUN_SERVERS.length,
    turn: ENABLE_TURN ? TURN_SERVERS.length : 0,
    forceTurnOnly: FORCE_TURN_ONLY,
    timeoutMs: 60000,
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  function randomCode() {
    let s = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      s += CODE_ALPHABET[(Math.random() * CODE_ALPHABET.length) | 0];
    }
    return s;
  }

  function normalizeCode(raw) {
    return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
  }

  function isPeerJsLoaded() {
    return typeof window !== 'undefined' && typeof window.Peer === 'function';
  }


  // ── PeerSession ────────────────────────────────────────────────────────────
  function PeerSession() {
    this.role        = null;   // 'host' | 'guest'
    this.peer        = null;   // the PeerJS Peer
    this.conns       = [];     // DataConnection[] (host: many, guest: 1)
    this.roomCode    = null;
    this.localName   = 'Player';
    this.destroyed   = false;

    // Public callbacks — set by the consumer (lobby / app)
    this.onMessage   = null;   // (msg, fromPeerId) => void
    this.onPeerJoin  = null;   // (peerInfo)        => void   (host only)
    this.onPeerLeave = null;   // (peerInfo)        => void
    this.onError     = null;   // (err)             => void

    // Host-only bookkeeping
    this._guestInfo  = {};     // peerId → { peerId, name, joinedAt }
  }


  // ── Sanity check before any peer op ────────────────────────────────────────
  PeerSession.prototype._assertReady = function () {
    if (!isPeerJsLoaded()) {
      throw new Error('PeerJS library not loaded. Include the peerjs CDN script before core/peer.js.');
    }
  };


  // ── Host: create a room, retrying on ID collision ──────────────────────────
  // Resolves with { roomCode, peerId } when the host's Peer is open and ready
  // to accept incoming connections.  Rejects on a fatal PeerJS error.
  PeerSession.prototype.hostCreate = function (opts) {
    opts = opts || {};
    this._assertReady();
    this.role      = 'host';
    this.localName = (opts.name || '').trim();
    dbg('host', 'hostCreate called', { name: this.localName });

    const self      = this;
    const maxTries  = 6;
    let   triesLeft = maxTries;

    return new Promise(function tryOnce(resolveOuter, rejectOuter) {
      if (self.destroyed) { rejectOuter(new Error('Session destroyed')); return; }
      const code   = randomCode();
      const peerId = ID_PREFIX + code;
      dbg('host', 'attempting to claim peer id', { peerId, triesLeft });
      const peer   = new window.Peer(peerId, PEER_OPT_BASE);

      let settled = false;
      const cleanupAndRetry = function (err) {
        try { peer.destroy(); } catch (e) {}
        if (triesLeft > 0) {
          triesLeft--;
          // Different code might be available — try again.
          dbg('host', 'id collision — retrying', { triesLeft });
          tryOnce(resolveOuter, rejectOuter);
        } else {
          rejectOuter(err || new Error('Could not create room after ' + maxTries + ' attempts'));
        }
      };

      peer.on('open', function (id) {
        if (settled) return;
        settled       = true;
        self.peer     = peer;
        self.roomCode = code;
        dbg('host', 'peer open — room ready', { id, code });
        self._wireHostPeerEvents();
        resolveOuter({ roomCode: code, peerId: id });
      });

      peer.on('error', function (err) {
        dbg('host', 'peer error', { type: err && err.type, msg: err && err.message });
        if (settled) {
          // Post-open errors get surfaced to the consumer
          if (typeof self.onError === 'function') self.onError(err);
          return;
        }
        settled = true;
        if (err && err.type === 'unavailable-id') {
          cleanupAndRetry(err);
        } else {
          rejectOuter(err);
        }
      });

      peer.on('disconnected', function () { dbg('host', 'peer disconnected from signalling server'); });
      peer.on('close',        function () { dbg('host', 'peer closed'); });
    });
  };


  // ── Host: wire up incoming guest connections ───────────────────────────────
  PeerSession.prototype._wireHostPeerEvents = function () {
    const self = this;
    self.peer.on('connection', function (conn) {
      dbg('host', 'incoming connection attempt', { peer: conn.peer });
      wireConnDebug(conn, 'host←' + conn.peer.slice(-8));

      conn.on('open', function () {
        dbg('host', 'guest data channel open', { peer: conn.peer });
        self.conns.push(conn);
        // Default name; updated when guest sends its hello.
        self._guestInfo[conn.peer] = {
          peerId:   conn.peer,
          name:     '',
          joinedAt: Date.now(),
        };
        if (typeof self.onPeerJoin === 'function') {
          self.onPeerJoin(self._guestInfo[conn.peer]);
        }
      });

      conn.on('data', function (data) {
        // Intercept the protocol-level hello to capture the guest name.
        if (data && data._pver === PROTOCOL_VER && data._hello) {
          if (self._guestInfo[conn.peer]) {
            self._guestInfo[conn.peer].name = (data._hello.name || '').trim();
            if (typeof self.onPeerJoin === 'function') {
              // Re-notify so the lobby can refresh the display name.
              self.onPeerJoin(self._guestInfo[conn.peer]);
            }
          }
          return;
        }
        if (typeof self.onMessage === 'function') {
          self.onMessage(data, conn.peer);
        }
      });

      conn.on('close', function () { dbg('host', 'guest conn close', { peer: conn.peer }); self._handleConnClose(conn); });
      conn.on('error', function (err) { dbg('host', 'guest conn error', { peer: conn.peer, err: err && err.message }); self._handleConnClose(conn); });
    });
  };


  // ── Host/guest: handle a connection dropping ───────────────────────────────
  PeerSession.prototype._handleConnClose = function (conn) {
    const idx = this.conns.indexOf(conn);
    if (idx !== -1) this.conns.splice(idx, 1);
    const info = this._guestInfo[conn.peer] || { peerId: conn.peer, name: 'Peer' };
    delete this._guestInfo[conn.peer];
    if (typeof this.onPeerLeave === 'function') this.onPeerLeave(info);
  };


  // ── Guest: connect to an existing host by friendly room code ───────────────
  PeerSession.prototype.guestJoin = function (rawCode, opts) {
    opts = opts || {};
    this._assertReady();
    this.role      = 'guest';
    this.localName = (opts.name || '').trim();

    const code = normalizeCode(rawCode);
    if (code.length !== CODE_LENGTH) {
      return Promise.reject(new Error('Room code must be ' + CODE_LENGTH + ' characters.'));
    }
    this.roomCode = code;
    const targetId = ID_PREFIX + code;
    dbg('guest', 'guestJoin called', { code, targetId, name: this.localName });

    const self = this;
    return new Promise(function (resolve, reject) {
      // Random suffix for our own ID — guests don't need a friendly code.
      const peer = new window.Peer(PEER_OPT_BASE);
      let settled = false;
      let timeout;
      const t0 = Date.now();

      peer.on('open', function (myId) {
        dbg('guest', 'peer open after ' + (Date.now() - t0) + 'ms', { myId });
        dbg('guest', 'connecting to host', { targetId });
        const conn = peer.connect(targetId, { reliable: true });
        wireConnDebug(conn, 'guest→host');

        timeout = setTimeout(function () {
          if (settled) return;
          settled = true;
          const pc = conn && conn.peerConnection;
          dbg('guest', 'TIMEOUT after 60s', {
            iceState: pc ? pc.iceConnectionState : 'no-pc',
            gathering: pc ? pc.iceGatheringState : 'no-pc',
            connState: pc ? pc.connectionState  : 'no-pc',
          });
          try { peer.destroy(); } catch (e) {}
          reject(new Error('Could not reach room "' + code + '" (timed out). Make sure the host is online and has not closed the room.'));
        }, 60000);

        conn.on('open', function () {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          dbg('guest', 'data channel open after ' + (Date.now() - t0) + 'ms');
          self.peer  = peer;
          self.conns = [conn];
          // Send our protocol-level hello so the host can label us nicely.
          // We use _pver / _hello (not __proto__ / variants) so the keys are
          // treated as plain properties by every serialiser and JS engine.
          try {
            conn.send({ _pver: PROTOCOL_VER, _hello: { name: self.localName } });
          } catch (e) {}
          self._wireGuestConnEvents(conn);
          resolve({ roomCode: code });
        });

        conn.on('error', function (err) {
          dbg('guest', 'conn error', { err: err && err.message });
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          try { peer.destroy(); } catch (e) {}
          reject(err || new Error('Failed to open data channel to host.'));
        });
      });

      peer.on('error', function (err) {
        dbg('guest', 'peer error', { type: err && err.type, msg: err && err.message });
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        // Most likely: host doesn't exist (peer-unavailable) or signalling problem.
        if (err && err.type === 'peer-unavailable') {
          reject(new Error('No room found with code "' + code + '". Check the code and try again.'));
        } else {
          reject(err);
        }
      });

      peer.on('disconnected', function () { dbg('guest', 'disconnected from signalling server'); });
      peer.on('close',        function () { dbg('guest', 'peer closed'); });
    });
  };


  // ── Guest: react to host messages + disconnect ─────────────────────────────
  PeerSession.prototype._wireGuestConnEvents = function (conn) {
    const self = this;
    conn.on('data', function (data) {
      // Protocol-level frames (_pver present) are reserved for the wrapper layer.
      // Pass everything else straight to the consumer.
      if (data && data._pver === PROTOCOL_VER && (data._hello || data._ack)) return;
      if (typeof self.onMessage === 'function') self.onMessage(data, conn.peer);
    });
    conn.on('close', function () {
      self._handleConnClose(conn);
    });
    conn.on('error', function () {
      self._handleConnClose(conn);
    });
  };


  // ── Send to all peers ──────────────────────────────────────────────────────
  PeerSession.prototype.send = function (msg) {
    if (this.destroyed) return;
    for (let i = 0; i < this.conns.length; i++) {
      const c = this.conns[i];
      if (c && c.open) {
        try { c.send(msg); } catch (e) { /* swallow; close handler will deal */ }
      }
    }
  };


  // ── Send to one specific peer (host targeting a single guest) ─────────────
  PeerSession.prototype.sendTo = function (peerId, msg) {
    if (this.destroyed) return;
    for (let i = 0; i < this.conns.length; i++) {
      const c = this.conns[i];
      if (c && c.peer === peerId && c.open) {
        try { c.send(msg); } catch (e) {}
        return;
      }
    }
  };


  // ── Roster (host only) ─────────────────────────────────────────────────────
  PeerSession.prototype.getGuestList = function () {
    return Object.keys(this._guestInfo).map(k => this._guestInfo[k]);
  };

  PeerSession.prototype.getPeerCount = function () {
    return this.conns.length;
  };


  // ── Tear down everything ───────────────────────────────────────────────────
  PeerSession.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;
    for (let i = 0; i < this.conns.length; i++) {
      try { this.conns[i].close(); } catch (e) {}
    }
    this.conns = [];
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    this._guestInfo  = {};
    this.onMessage   = null;
    this.onPeerJoin  = null;
    this.onPeerLeave = null;
    this.onError     = null;
  };


  // ── Static helpers exposed for the lobby ───────────────────────────────────
  PeerSession.isAvailable = isPeerJsLoaded;
  PeerSession.normalizeCode = normalizeCode;
  PeerSession.PROTOCOL_VER  = PROTOCOL_VER;

  window.PeerSession = PeerSession;


  // ──────────────────────────────────────────────────────────────────────────
  // ── REMOVE-DEBUG-BLOCK ─ Visual debug overlay (deletable as a unit) ──────
  // ──────────────────────────────────────────────────────────────────────────
  // To completely strip the debug system: delete this block, delete the
  // "DEBUG TOOLS" block at the top of this file, and delete every `dbg(...)`
  // / `wireConnDebug(...)` call.  Or just set DEBUG=false up top to silence.
  //
  // While enabled:
  //   • A small panel appears in the bottom-left of every page
  //   • Shows last ICE state, connection state, and recent log entries
  //   • Press Ctrl+Shift+D to hide / show
  //   • Use window.dumpPeerLog() in DevTools for the full log
  if (DEBUG && typeof document !== 'undefined') {
    const init = function () {
      if (document.getElementById('peer-dbg-overlay')) return;
      const box = document.createElement('div');
      box.id = 'peer-dbg-overlay';
      box.style.cssText = [
        'position:fixed', 'bottom:8px', 'left:8px', 'z-index:99999',
        'width:300px', 'max-height:240px', 'overflow-y:auto',
        'background:rgba(0,0,0,0.85)', 'color:#9fd', 'font:11px/1.3 monospace',
        'padding:6px 8px', 'border:1px solid #4a4', 'border-radius:4px',
        'pointer-events:auto', 'user-select:text',
      ].join(';');
      box.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #383;padding-bottom:3px;margin-bottom:4px">' +
        '<b style="color:#9fd">⛧ peer debug</b>' +
        '<span><button id="peer-dbg-dump" style="font:10px monospace;margin-right:4px;cursor:pointer">dump</button>' +
        '<button id="peer-dbg-clear" style="font:10px monospace;margin-right:4px;cursor:pointer">clear</button>' +
        '<button id="peer-dbg-hide" style="font:10px monospace;cursor:pointer">×</button></span></div>' +
        '<div id="peer-dbg-status" style="color:#fc6;margin-bottom:3px"></div>' +
        '<div id="peer-dbg-list"></div>';
      document.body.appendChild(box);
      document.getElementById('peer-dbg-dump').onclick  = function () { window.dumpPeerLog(); };
      document.getElementById('peer-dbg-clear').onclick = function () { window.clearPeerLog(); render(); };
      document.getElementById('peer-dbg-hide').onclick  = function () { box.style.display = 'none'; };

      const list = document.getElementById('peer-dbg-list');
      const stat = document.getElementById('peer-dbg-status');
      let lastIce = '-', lastConn = '-', relaySeen = false;
      function render() {
        stat.textContent = 'ice:' + lastIce + ' | conn:' + lastConn + ' | TURN:' + (relaySeen ? '✓ relay seen' : '✗ no relay yet');
        const recent = _peerLog.slice(-12).reverse();
        list.innerHTML = recent.map(function (e) {
          const ts = new Date(e.t).toISOString().slice(14, 22);
          let color = '#9fd';
          if (e.cat === 'ice')   color = '#fc6';
          if (e.cat === 'conn')  color = '#6cf';
          if (/error|TIMEOUT|fail/i.test(e.msg)) color = '#f66';
          return '<div style="color:' + color + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
                 '<span style="opacity:0.6">' + ts + '</span> [' + e.cat + '] ' + e.msg +
                 (e.data !== undefined ? ' <span style="opacity:0.7">' + JSON.stringify(e.data).slice(0, 60) + '</span>' : '') +
                 '</div>';
        }).join('');
      }
      window.__peerDbgOverlay = function (entry) {
        if (entry.msg && entry.msg.indexOf('iceConnectionState=') !== -1) {
          lastIce = entry.msg.split('=')[1];
        }
        if (entry.msg && entry.msg.indexOf('connectionState=') !== -1) {
          lastConn = entry.msg.split('=')[1];
        }
        if (entry.msg && entry.msg.indexOf(' relay ') !== -1) relaySeen = true;
        render();
      };
      // Ctrl+Shift+D toggles visibility.
      document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
          box.style.display = box.style.display === 'none' ? 'block' : 'none';
        }
      });
      render();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
  // ──────────────────────────────────────────────────────────────────────────
  // ── END REMOVE-DEBUG-BLOCK ────────────────────────────────────────────────
  // ──────────────────────────────────────────────────────────────────────────
})();
// ──────────────────────────────────────────────────────────────────────────────
