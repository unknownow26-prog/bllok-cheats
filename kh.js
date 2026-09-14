/* KANHA BLOOKET ENGINE — SINGLE FILE v1.0
   All modules merged. Load via bookmarklet.
   https://github.com/YOUR-USERNAME/kanha-blooket */
(function () {
  if (window.__KH_LOADED__ && window.KH) { console.log('%cKH already running', 'color:orange'); return; }
  window.__KH_LOADED__ = true;

  /* ============================================================
     SECTION 1 — CORE
     ============================================================ */
  if (!window.KH) {
    const KH = window.KH = {
      version: '1.0',
      log: (...a) => console.log('%c[KH]', 'color:#e11d48;font-weight:bold', ...a),
      warn: (...a) => console.warn('%c[KH]', 'color:#e11d48;font-weight:bold', ...a),
      _intervals: [],
    };

    KH.state = {
      get game()  { return window.game || window.gameData || null; },
      get player(){ return window.player || window.playerData || null; },
      set(obj, path, val) {
        try {
          const root = obj === 'game' ? KH.state.game : KH.state.player;
          if (!root) return false;
          const parts = path.split('.'); const last = parts.pop();
          let cur = root; for (const p of parts) cur = cur[p];
          cur[last] = val; return true;
        } catch (e) { KH.warn('set failed', path, e.message); return false; }
      },
      setGame(p, v){ return KH.state.set('game', p, v); },
      setPlayer(p, v){ return KH.state.set('player', p, v); },
    };

    KH.fiber = {
      rootOf(el) {
        if (!el) return null;
        const k = Object.keys(el).find(k =>
          k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
        return k ? el[k] : null;
      },
      walkUp(el, fn, max = 40) {
        let f = KH.fiber.rootOf(el); let i = 0;
        while (f && i++ < max) { const r = fn(f); if (r !== undefined) return r; f = f.return; }
        return undefined;
      },
      hunt(pred) {
        const seen = new WeakSet(); let found;
        const visit = (f) => {
          if (!f || seen.has(f) || found) return;
          seen.add(f);
          try { if (pred(f) !== undefined) { found = pred(f); return; } } catch {}
          visit(f.child); visit(f.sibling);
        };
        const seed = KH.fiber.rootOf(document.body) ||
                     KH.fiber.rootOf(document.querySelector('#root') || document.body);
        let top = seed; while (top && top.return) top = top.return;
        visit(top); return found;
      },
    };

    KH.socket = {
      _origEmit: null, _origOn: null,
      blockedOut: new Set(), listeners: [],
      install() {
        const hook = () => {
          if (!window.io || !window.io.Socket || !window.io.Socket.prototype) return false;
          const proto = window.io.Socket.prototype;
          if (this._origEmit) return true;
          this._origEmit = proto.emit; this._origOn = proto.on;
          const self = this;
          proto.emit = function (ev, ...a) {
            if (self.blockedOut.has(ev)) { KH.log('socket BLOCKED:', ev); return this; }
            self.listeners.forEach(fn => fn('out', ev, a));
            return self._origEmit.apply(this, [ev, ...a]);
          };
          proto.on = function (ev, cb) {
            const w = (...a) => { self.listeners.forEach(fn => fn('in', ev, a)); return cb(...a); };
            return self._origOn.call(this, ev, w);
          };
          KH.log('socket hooked'); return true;
        };
        if (!hook()) {
          const t = setInterval(() => { if (hook()) clearInterval(t); }, 200);
          KH._intervals.push(t);
        }
      },
      block(e){ this.blockedOut.add(e); },
      unblock(e){ this.blockedOut.delete(e); },
      onEvent(fn){ this.listeners.push(fn); },
    };
    KH.socket.install();

    KH.tick = (fn, ms = 500) => { const id = setInterval(fn, ms); KH._intervals.push(id); return id; };
    KH.clearAll = () => { KH._intervals.forEach(clearInterval); KH._intervals = []; KH.log('cleared'); };

    KH.menu = (() => {
      let el;
      const build = () => {
        if (document.getElementById('kh-menu')) return document.getElementById('kh-menu');
        el = document.createElement('div');
        el.id = 'kh-menu';
        el.style.cssText = `position:fixed;top:14px;right:14px;z-index:2147483647;
          background:#0a0a0a;border:1px solid #e11d48;border-radius:10px;
          font:12px/1.5 ui-monospace,Menlo,monospace;color:#e5e5e5;
          min-width:220px;box-shadow:0 8px 30px rgba(225,29,72,.25);`;
        el.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid #1f1f1f;">
            <span style="color:#e11d48;font-weight:700;letter-spacing:.5px;">KANHA ENGINE</span>
            <span id="kh-min" style="cursor:pointer;color:#888;">—</span>
          </div>
          <div id="kh-body" style="padding:8px 10px;display:flex;flex-direction:column;gap:6px;max-height:70vh;overflow-y:auto;"></div>`;
        document.body.appendChild(el);
        el.querySelector('#kh-min').onclick = () => {
          const b = el.querySelector('#kh-body');
          b.style.display = b.style.display === 'none' ? 'flex' : 'none';
        };
        return el;
      };
      return {
        add(label, onToggle, initial = true) {
          const root = build(); const body = root.querySelector('#kh-body');
          let on = initial;
          const btn = document.createElement('button');
          const paint = () => {
            btn.textContent = `${label}: ${on ? 'ON' : 'OFF'}`;
            btn.style.cssText = `padding:6px 8px;border:1px solid ${on ? '#e11d48' : '#333'};
              background:${on ? '#1a0509' : '#111'};color:${on ? '#fff' : '#888'};
              border-radius:6px;cursor:pointer;text-align:left;font:inherit;`;
          };
          paint();
          btn.onclick = () => { on = !on; paint(); onToggle(on); };
          body.appendChild(btn); onToggle(on);
          return { set: (v) => { on = v; paint(); onToggle(on); } };
        },
        raw(node) { const root = build(); root.querySelector('#kh-body').appendChild(node); },
      };
    })();

    KH.log('core ready');
  }

  /* ============================================================
     SECTION 2 — AUTO-ANSWER
     ============================================================ */
  (function () {
    const KH = window.KH;
    const norm = s => (s || '').toString().trim().toLowerCase();

    function findQuestionObject() {
      return KH.fiber.hunt(f => {
        const p = f.memoizedProps; if (!p || typeof p !== 'object') return;
        if (p.question && (p.answers || p.correctAnswer || p.answer)) return p;
        if (p.currentQuestion) return p.currentQuestion;
        if (p.questionData) return p.questionData;
      });
    }
    function findChoices() {
      const out = [];
      document.querySelectorAll('button, [role="button"], [class*="answer" i], [class*="choice" i]').forEach(el => {
        const f = KH.fiber.rootOf(el); if (!f) return;
        const p = f.memoizedProps || {};
        const text = norm(p.children || p.text || p.answer || el.textContent);
        if (text) out.push({ el, text, props: p });
      });
      return out;
    }
    function correctText(q) {
      if (!q) return null;
      if (typeof q.correctAnswer === 'string') return norm(q.correctAnswer);
      if (Array.isArray(q.answers) && q.correctAnswerIndex != null) {
        const a = q.answers[q.correctAnswerIndex];
        return norm(typeof a === 'string' ? a : a?.text || a?.answer);
      }
      if (Array.isArray(q.answers)) {
        const c = q.answers.find(a => a && (a.correct || a.isCorrect));
        if (c) return norm(c.text || c.answer || c);
      }
      if (q.correct) return norm(q.correct);
      return null;
    }
    function fire(el) {
      ['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t =>
        el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })));
    }
    let lastKey = '';
    function tick() {
      const q = findQuestionObject();
      const key = q ? JSON.stringify(q).slice(0, 200) : '';
      if (key && key === lastKey) return;
      const want = correctText(q); if (!want) return;
      const choices = findChoices();
      const hit = choices.find(c => c.text === want) ||
                  choices.find(c => c.text.includes(want) || want.includes(c.text));
      if (hit) { lastKey = key; fire(hit.el); KH.log('answered:', hit.text); }
    }
    KH.menu.add('Auto-Answer', on => { if (on) KH.tick(tick, 250); else KH.clearAll(); });
  })();

  /* ============================================================
     SECTION 3 — UNKICKABLE
     ============================================================ */
  (function () {
    const KH = window.KH;
    const KICK = [/kick/i, /remove.?player/i, /ban/i, /boot/i, /expel/i];
    const isKick = e => KICK.some(r => r.test(String(e)));

    KH.socket.onEvent((dir, ev) => { if (dir === 'out' && isKick(ev)) KH.log('kick blocked:', ev); });
    const block = () => ['kickPlayer','kick','removePlayer','banPlayer','bootPlayer'].forEach(e => KH.socket.block(e));

    KH.tick(() => {
      document.querySelectorAll('[class*="kick" i], [class*="ban" i]').forEach(el => el.style.display = 'none');
    }, 1000);

    KH.tick(() => {
      const g = KH.state.game; const me = KH.state.player;
      if (!g || !me) return;
      const id = me.id || me.uid || me.clientId; if (!id) return;
      ['players','playerList','participants','lobby'].forEach(k => {
        if (Array.isArray(g[k])) g[k] = g[k].filter(p => (p?.id || p?.uid || p?.clientId) !== id);
      });
    }, 1500);

    KH.menu.add('Unkickable', on => {
      if (on) { block(); KH.tick(block, 2000); }
      else ['kickPlayer','kick','removePlayer','banPlayer','bootPlayer'].forEach(e => KH.socket.unblock(e));
    });
  })();

  /* ============================================================
     SECTION 4 — FORGE TOKENS/XP
     ============================================================ */
  (function () {
    const KH = window.KH;
    function findStore() {
      return KH.fiber.hunt(f => {
        const s = f.memoizedState; if (!s) return;
        let h = s;
        while (h) {
          const v = h.memoizedState;
          if (v && typeof v === 'object') {
            if ('tokens' in v && ('xp' in v || 'level' in v || 'name' in v)) return v;
            if (v.player && 'tokens' in v.player) return v.player;
          }
          h = h.next;
        }
      });
    }
    function findSetState() {
      return KH.fiber.hunt(f => { const q = f.queue; if (q && typeof q.dispatch === 'function') return q.dispatch; });
    }
    function forge(tokens = 1e9, xp = 1e9) {
      const s = findStore();
      if (s) { s.tokens = tokens; if ('xp' in s) s.xp = xp; KH.log('forged', { tokens, xp }); }
      ['game','player','gameData','playerData'].forEach(k => {
        if (window[k]) {
          if ('tokens' in window[k]) window[k].tokens = tokens;
          if ('xp' in window[k]) window[k].xp = xp;
        }
      });
      const set = findSetState();
      if (typeof set === 'function') { try { set(x => ({ ...x })); } catch {} }
    }
    KH.forge = forge;
    KH.menu.add('Forge Tokens/XP', on => { if (on) KH.tick(() => forge(), 3000); });
  })();

  /* ============================================================
     SECTION 5 — GAME MODULES
     ============================================================ */
  (function () {
    const KH = window.KH;

    KH.goldquest = {
      setGold(n = 1e9) { KH.state.setGame('gold', n); },
      revealChests() {
        KH.tick(() => {
          const g = KH.state.game; if (!g || !Array.isArray(g.chests)) return;
          document.querySelectorAll('[class*="chest" i]').forEach((el, i) => {
            const c = g.chests[i];
            if (c) { el.style.outline = '3px solid #e11d48'; el.title = 'gold:' + c.gold; }
          });
        }, 800);
      },
      autoPickBest() {
        KH.tick(() => {
          const g = KH.state.game;
          if (!g || !Array.isArray(g.chests) || g.phase !== 'pick') return;
          const best = g.chests.map((c, i) => ({ i, v: c.gold })).sort((a,b)=>b.v-a.v)[0];
          if (!best) return;
          document.querySelectorAll('[class*="chest" i]')[best.i]?.click();
        }, 400);
      },
    };

    KH.crypto = {
      setCrypto(n = 1e9) { KH.state.setPlayer('crypto', n); },
      autoPassword() {
        KH.socket.onEvent((dir, ev, a) => {
          if (dir === 'in' && /password/i.test(ev)) {
            const pw = a?.[0]?.password || a?.[0];
            if (typeof pw === 'string') sessionStorage.setItem('kh_pw', pw);
          }
        });
        KH.tick(() => {
          const inp = document.querySelector('input[type="password"], input[name*="password" i]');
          const pw = sessionStorage.getItem('kh_pw');
          if (inp && pw && !inp.value) { inp.value = pw; inp.dispatchEvent(new Event('input', { bubbles: true })); }
        }, 300);
      },
    };

    KH.racing = {
      instantWin() { KH.state.setGame('progress', KH.state.game?.goal ?? 1e9); },
      noDecay() {
        KH.tick(() => {
          const g = KH.state.game;
          if (g && g.progress < (g._kh_last || 0)) g.progress = g._kh_last;
          if (g) g._kh_last = g.progress;
        }, 100);
      },
    };

    KH.fishing = {
      setWeight(n = 1e9) { KH.state.setGame('weight', n); KH.state.setGame('weight2', n); },
      setLure(r = 4) { KH.state.setGame('lure', r); },
      perfectCatch() { KH.tick(() => { const g = KH.state.game; if (g && 'tension' in g) g.tension = 0.5; }, 100); },
    };

    KH.td = {
      setCash(n = 1e9) { KH.state.setGame('cash', n); },
      setLives(n = 1e9){ KH.state.setGame('lives', n); },
      nuke() { const g = KH.state.game; if (g && Array.isArray(g.enemies)) g.enemies.length = 0; },
      maxTowers() {
        const g = KH.state.game; if (!g || !Array.isArray(g.towers)) return;
        g.towers.forEach(t => { t.level = 99; t.damage = 1e9; t.range = 1e9; });
      },
    };

    KH.menu.add('GoldQuest: Max', on => { if (on) { KH.tick(() => KH.goldquest.setGold(1e9), 2000); KH.goldquest.revealChests(); KH.goldquest.autoPickBest(); } });
    KH.menu.add('Crypto: Max', on => { if (on) { KH.tick(() => KH.crypto.setCrypto(1e9), 2000); KH.crypto.autoPassword(); } });
    KH.menu.add('Racing: Win', on => { if (on) KH.racing.instantWin(); });
    KH.menu.add('Fishing: Max', on => { if (on) { KH.tick(() => { KH.fishing.setWeight(1e9); KH.fishing.setLure(4); }, 2000); KH.fishing.perfectCatch(); } });
    KH.menu.add('TD: God', on => { if (on) { KH.tick(() => { KH.td.setCash(1e9); KH.td.setLives(1e9); KH.td.maxTowers(); }, 1500); KH.tick(() => KH.td.nuke(), 5000); } });
  })();

  /* ============================================================
     SECTION 6 — SOCKET SNIFFER
     ============================================================ */
  (function () {
    const KH = window.KH;
    KH.sniffer = { on: false };
    KH.socket.onEvent((dir, ev, a) => {
      if (!KH.sniffer.on) return;
      const c = dir === 'out' ? '#22c55e' : '#eab308';
      console.log(`%c${dir.toUpperCase()} ${ev}`, `color:${c};font-weight:bold`, ...a);
    });
    KH.menu.add('Socket Sniffer', on => { KH.sniffer.on = on; });
  })();

  console.log('%cKANHA ENGINE ONLINE', 'color:#e11d48;font-size:16px;font-weight:900;letter-spacing:1px');
})();
