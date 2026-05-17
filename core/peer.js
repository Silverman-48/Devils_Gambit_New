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
  // firewalls, cross-country connections).  OpenRelay static-auth is free and
  // requires no account — credential is the shared public secret.
  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302'  },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'turn:staticauth.openrelay.metered.ca:80',                    credential: 'openrelayprojectsecret' },
    { urls: 'turn:staticauth.openrelay.metered.ca:443?transport=tcp',     credential: 'openrelayprojectsecret' },
  ];
  const PEER_OPT_BASE = { debug: 0, config: { iceServers: ICE_SERVERS } };

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

    const self      = this;
    const maxTries  = 6;
    let   triesLeft = maxTries;

    return new Promise(function tryOnce(resolveOuter, rejectOuter) {
      if (self.destroyed) { rejectOuter(new Error('Session destroyed')); return; }
      const code   = randomCode();
      const peerId = ID_PREFIX + code;
      const peer   = new window.Peer(peerId, PEER_OPT_BASE);

      let settled = false;
      const cleanupAndRetry = function (err) {
        try { peer.destroy(); } catch (e) {}
        if (triesLeft > 0) {
          triesLeft--;
          // Different code might be available — try again.
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
        self._wireHostPeerEvents();
        resolveOuter({ roomCode: code, peerId: id });
      });

      peer.on('error', function (err) {
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
    });
  };


  // ── Host: wire up incoming guest connections ───────────────────────────────
  PeerSession.prototype._wireHostPeerEvents = function () {
    const self = this;
    self.peer.on('connection', function (conn) {
      conn.on('open', function () {
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

      conn.on('close', function () { self._handleConnClose(conn); });
      conn.on('error', function () { self._handleConnClose(conn); });
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

    const self = this;
    return new Promise(function (resolve, reject) {
      // Random suffix for our own ID — guests don't need a friendly code.
      const peer = new window.Peer(PEER_OPT_BASE);
      let settled = false;
      let timeout;

      peer.on('open', function () {
        const conn = peer.connect(targetId, { reliable: true });
        timeout = setTimeout(function () {
          if (settled) return;
          settled = true;
          try { peer.destroy(); } catch (e) {}
          reject(new Error('Could not reach room "' + code + '" (timed out). Make sure the host is online and has not closed the room.'));
        }, 60000);

        conn.on('open', function () {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
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
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          try { peer.destroy(); } catch (e) {}
          reject(err || new Error('Failed to open data channel to host.'));
        });
      });

      peer.on('error', function (err) {
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
})();
// ──────────────────────────────────────────────────────────────────────────────
