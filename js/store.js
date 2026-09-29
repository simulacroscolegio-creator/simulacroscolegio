/* Simulacro · capa de datos
   - Guarda todo en el dispositivo (IndexedDB) para funcionar sin red.
   - Envía los cambios pendientes y descarga los nuevos cuando hay conexión.
   - Cada registro modificado localmente lleva _p = 1 hasta que el servidor lo acepta. */
(function () {
  "use strict";
  const CFG = window.SIM_CONFIG;
  const TABLES = {
    sims: { srv: "simulacros", key: r => r.id },
    cursos: { srv: "cursos", key: r => r.simulacro_id + "|" + r.curso },
    esp: { srv: "especialidades", key: r => r.id },
    otros: { srv: "otros", key: r => r.id },
    asig: { srv: "asignaciones", key: r => r.simulacro_id + "|" + r.grado },
    bal: { srv: "balances", key: r => r.simulacro_id },
    cons: { srv: "consolidados", key: r => r.id }
  };

  /* ---------- IndexedDB ---------- */
  let dbp = null;
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const rq = indexedDB.open("simulacro", 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("kv");
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    return dbp;
  }
  async function idbGet(k) {
    try {
      const db = await idb();
      return await new Promise((res, rej) => {
        const rq = db.transaction("kv").objectStore("kv").get(k);
        rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
      });
    } catch (e) {
      try { return JSON.parse(localStorage.getItem("sim_" + k) || "null"); } catch (e2) { return null; }
    }
  }
  async function idbPut(k, v) {
    try {
      const db = await idb();
      await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(v, k);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
    } catch (e) {
      try { localStorage.setItem("sim_" + k, JSON.stringify(v)); } catch (e2) { /* sin espacio */ }
    }
  }

  /* ---------- estado ---------- */
  function blank() {
    return {
      session: null, cfg: null, grados: [], esps: [], otrosDef: [], verif: null, cursor: null,
      sims: {}, cursos: {}, esp: {}, otros: {}, asig: {}, bal: {}, cons: {}, coordOf: {},
      ui: { tab: "sim", open: {} }, online: navigator.onLine, lastSync: 0, lastError: "", catQueue: []
    };
  }
  let S = blank();
  const listeners = [];
  function emit(kind) { listeners.forEach(f => { try { f(kind); } catch (e) { console.error(e); } }); }
  let saveT = null;
  function save() { clearTimeout(saveT); saveT = setTimeout(() => idbPut("state", S), 250); }

  async function load() {
    const st = await idbGet("state");
    if (st && typeof st === "object") S = Object.assign(blank(), st);
    S.online = navigator.onLine;
    return S;
  }

  /* ---------- API ---------- */
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  async function rpc(fn, args) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12000);
    let res;
    try {
      res = await fetch(`${CFG.url}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { apikey: CFG.key, "Content-Type": "application/json" },
        body: JSON.stringify(args || {}),
        signal: ctl.signal,
        cache: "no-store"
      });
    } catch (e) {
      const err = new Error("Sin conexión"); err.offline = true; throw err;
    } finally { clearTimeout(t); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* respuesta vacía */ }
    if (!res.ok) {
      const msg = (data && (data.message || data.hint)) || ("Error " + res.status);
      const err = new Error(msg); err.status = res.status;
      if (res.status >= 500 || res.status === 0) err.offline = true;
      throw err;
    }
    return data;
  }
  function setOnline(v) {
    const was = S.online; S.online = v;
    if (was !== v) emit("net");
  }

  /* ---------- catálogos e ingreso ---------- */
  function applyCatalog(d) {
    S.cfg = d.config; S.grados = d.grados || []; S.esps = d.especialidades || [];
    S.otrosDef = d.otros_default || []; S.verif = d.verificador || null;
  }
  async function login(codigo, nombre) {
    const d = await rpc("sim_ingresar", { p_codigo: codigo });
    if (!d || !d.ok) return { ok: false, error: "codigo" };
    applyCatalog(d);
    S.session = { codigo, nombre };
    setOnline(true);
    save(); emit("login");
    await sync(true);
    return { ok: true };
  }
  // Los datos y los pendientes se conservan en el equipo; se envían en el próximo ingreso.
  function logout() { S.session = null; save(); emit("logout"); }
  function setName(n) { if (S.session) { S.session.nombre = n; save(); emit("change"); } }

  /* ---------- escritura local ---------- */
  function put(table, row, quiet) {
    row.updated_at = new Date().toISOString();
    row._p = 1; delete row._e;
    S[table][TABLES[table].key(row)] = row;
    if (!quiet) { save(); emit("change"); scheduleSync(600); }
    return row;
  }
  function commit() { save(); emit("change"); scheduleSync(300); }
  // Categoría de "otras personas" que se conserva para próximos simulacros
  function addCategoria(nombre, grupo) {
    S.catQueue = S.catQueue || [];
    S.catQueue.push({ nombre, grupo });
    if (!S.otrosDef.some(o => o.nombre.toLowerCase() === nombre.toLowerCase())) S.otrosDef.push({ id: null, nombre, grupo });
    save(); scheduleSync(300);
  }
  function pendingRows() {
    const out = [];
    Object.keys(TABLES).forEach(t => Object.values(S[t]).forEach(r => { if (r._p) out.push([t, r]); }));
    return out;
  }
  function pendingCount() { return pendingRows().length; }
  function blockedCount() { return pendingRows().filter(([, r]) => r._e).length; }

  /* ---------- clave de informes ---------- */
  let adminKey = null, adminUntil = 0;
  try {
    const k = JSON.parse(sessionStorage.getItem("sim_admin") || "null");
    if (k && k.until > Date.now()) { adminKey = k.key; adminUntil = k.until; }
  } catch (e) { /* ignorar */ }
  function isAdmin() { return !!adminKey && Date.now() < adminUntil; }
  async function sha256Iter(salt, clave, n) {
    let v = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + clave));
    for (let i = 2; i <= n; i++) v = await crypto.subtle.digest("SHA-256", v);
    return [...new Uint8Array(v)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  async function unlock(clave) {
    let ok = false;
    if (S.verif && S.verif.hash && crypto.subtle) {
      ok = (await sha256Iter(S.verif.salt, clave, S.verif.iteraciones)) === S.verif.hash;
    } else {
      const d = await rpc("sim_verificar_informes", { p_codigo: S.session.codigo, p_clave: clave });
      ok = !!(d && d.ok);
    }
    if (ok) {
      adminKey = clave; adminUntil = Date.now() + 15 * 60000;
      try { sessionStorage.setItem("sim_admin", JSON.stringify({ key: adminKey, until: adminUntil })); } catch (e) { /* */ }
      // Los cambios que esperaban la clave vuelven a la cola
      pendingRows().forEach(([, r]) => { if (r._e === "clave") delete r._e; });
      save(); scheduleSync(100);
    }
    return ok;
  }

  /* ---------- sincronización ---------- */
  // Qué cambios exigen la clave de informes (el servidor aplica las mismas reglas)
  function needsKey(t, r) {
    if (t === "bal" || t === "cons") return r.estado === "generada" || !!r.eliminado || !!r._srvDel;
    if (t === "sims" && !!r.eliminado !== !!r._srvDel) return true;
    const simId = t === "sims" ? r.id : r.simulacro_id;
    const s = S.sims[simId];
    return !!(s && s._srv === "cerrado");
  }
  function clean(r) {
    const o = {};
    Object.keys(r).forEach(k => { if (k[0] !== "_" && k !== "sync_at") o[k] = r[k]; });
    return o;
  }
  let syncing = false, syncAgain = false, syncT = null;
  function scheduleSync(ms) { clearTimeout(syncT); syncT = setTimeout(() => sync(), ms == null ? 600 : ms); }

  async function sync(force) {
    if (!S.session) return;
    if (syncing) { syncAgain = true; return; }
    if (!navigator.onLine && !force) { setOnline(false); return; }
    syncing = true;
    let changed = 0;
    try {
      // 1. Enviar pendientes (con la clave vigente, los que la esperaban vuelven a la cola)
      if (isAdmin()) pendingRows().forEach(([, r]) => { if (r._e === "clave") delete r._e; });
      const pend = pendingRows().filter(([, r]) => !r._e);
      const cats = (S.catQueue || []).slice();
      if (pend.length || cats.length) {
        const payload = { autor: S.session.nombre, rol: "brigadista" };
        if (cats.length) payload.categorias = cats;
        const sent = [];
        let usesKey = false;
        pend.forEach(([t, r]) => {
          if (needsKey(t, r)) {
            if (!isAdmin()) { r._e = "clave"; return; }
            usesKey = true;
          }
          if (t === "asig" && S.coordOf[r.simulacro_id]) payload.rol = "coordinador";
          const srv = TABLES[t].srv;
          (payload[srv] = payload[srv] || []).push(clean(r));
          sent.push([t, r, r.updated_at]);
        });
        changed += sent.length + (pend.length - sent.length);
        if (usesKey) payload.clave_informes = adminKey;
        // Los simulacros van primero para que existan antes que sus registros
        if (sent.length || cats.length) {
          const res = await rpc("sim_enviar", { p_codigo: S.session.codigo, p_datos: payload });
          if (res && res.ok && cats.length) S.catQueue = (S.catQueue || []).slice(cats.length);
          if (!res || !res.ok) {
            if (res && res.error === "codigo") { S.session = null; save(); emit("codigo"); return; }
            if (res && res.error === "clave_informes") { adminKey = null; adminUntil = 0; sent.forEach(([, r]) => { if (usesKey) r._e = "clave"; }); }
          } else {
            const rej = res.rechazados || [];
            const rejKey = new Set();
            rej.forEach(x => {
              if (x.tabla === "asignaciones" && x.motivo === "tomado") {
                const k = Object.keys(S.asig).find(k2 => S.asig[k2]._p && S.asig[k2].grado === x.id);
                if (k) { S.asig[k].brigadista = x.por; delete S.asig[k]._p; emit({ tomado: x }); }
              } else if (x.motivo === "cerrado" || x.motivo === "requiere_clave") {
                rejKey.add(x.tabla);
              }
            });
            sent.forEach(([t, r, ts]) => {
              if (rejKey.has(TABLES[t].srv) && needsKey(t, r) === false && r._p) { r._e = "clave"; return; }
              if (r.updated_at === ts && r._p) delete r._p;
            });
          }
        }
      }
      // 2. Descargar cambios
      const d = await rpc("sim_descargar", { p_codigo: S.session.codigo, p_desde: S.cursor });
      if (!d || !d.ok) {
        if (d && d.error === "codigo") { S.session = null; save(); emit("codigo"); }
        return;
      }
      changed += merge(d);
      S.cursor = d.cursor;
      pendingRows().forEach(([t, r]) => { if (r._e === "clave" && !needsKey(t, r)) delete r._e; });
      if (d.config_cambio) {
        const c = await rpc("sim_ingresar", { p_codigo: S.session.codigo });
        if (c && c.ok) applyCatalog(c);
      }
      S.lastSync = Date.now(); S.lastError = "";
      setOnline(true);
    } catch (e) {
      if (e.offline) setOnline(false);
      else { S.lastError = e.message; emit("error"); }
    } finally {
      syncing = false; save(); emit(changed ? "sync" : "sync-quiet");
      if (syncAgain) { syncAgain = false; scheduleSync(300); }
    }
  }
  function merge(d) {
    let n = 0;
    const map = { sims: d.simulacros, cursos: d.cursos, esp: d.especialidades, otros: d.otros, asig: d.asignaciones, bal: d.balances, cons: d.consolidados };
    Object.keys(map).forEach(t => (map[t] || []).forEach(row => {
      const k = TABLES[t].key(row);
      const loc = S[t][k];
      if (t === "sims") row._srv = row.estado;
      if (t === "sims" || t === "bal" || t === "cons") row._srvDel = !!row.eliminado;
      if (loc && loc._p && loc.updated_at > row.updated_at) {
        if (t === "sims") loc._srv = row.estado;
        if (t === "sims" || t === "bal" || t === "cons") loc._srvDel = !!row.eliminado;
        return;
      }
      if (!loc || JSON.stringify(Object.assign({}, loc, { sync_at: 0 })) !== JSON.stringify(Object.assign({}, row, { sync_at: 0 }))) n++;
      S[t][k] = row;
    }));
    return n;
  }

  /* ---------- ciclo automático ---------- */
  let loopT = null;
  function loop() {
    clearTimeout(loopT);
    const active = Object.values(S.sims).some(s => s.estado !== "cerrado" && !s.eliminado);
    const ms = document.visibilityState === "visible" ? (active ? 4000 : 20000) : 60000;
    loopT = setTimeout(async () => { await sync(); loop(); }, ms);
  }
  window.addEventListener("online", () => { setOnline(true); sync(true); });
  window.addEventListener("offline", () => setOnline(false));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { sync(); loop(); } });

  window.Store = {
    load, login, logout, setName, put, commit, addCategoria, sync, loop, uuid, unlock, isAdmin, rpc,
    pendingCount, blockedCount, on: f => listeners.push(f), save, applyCatalog,
    get S() { return S; },
    get adminKey() { return isAdmin() ? adminKey : null; }
  };
})();
