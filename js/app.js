/* Simulacro · interfaz */
"use strict";

/* ================= utilidades ================= */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const jsq = s => String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const fmtN = n => Number(n || 0).toLocaleString("es-CO");
const St = () => Store.S;
const UI = () => St().ui;
const GROUPS = { D: "Docentes", A: "Administrativos y directivos", V: "Visitantes", J: "Jornada complementaria", O: "Otros" };

function fmtClock(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
function fmtDurText(ms) { const s = Math.round(ms / 1000), m = Math.floor(s / 60), r = s % 60; return (m ? m + (m == 1 ? " minuto" : " minutos") : "") + (m && r ? " y " : "") + (r || !m ? r + (r == 1 ? " segundo" : " segundos") : ""); }
function fmtHour(ts) { return new Date(ts).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true }); }
function fmtDate(iso, wd) { const d = new Date(iso + "T12:00:00"); const b = d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }); return wd ? d.toLocaleDateString("es-CO", { weekday: "long" }) + " " + b : b; }
function fmtShort(iso) { return new Date(iso + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }); }
function lab(s) { return new Date(s.fecha + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "2-digit" }); }
function today() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function ddmmyyyy(iso) { return iso ? iso.split("-").reverse().join("/") : ""; }
function toast(t) { $("toastBox").innerHTML = `<div class="toast" role="status">${esc(t)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => $("toastBox").innerHTML = "", 3200); }
function dur(s) { return s.inicio && s.fin ? new Date(s.fin) - new Date(s.inicio) : 0; }

/* ================= catálogos y datos ================= */
const grado = i => St().grados.find(g => g.id === i) || { id: i, nombre: "Grado " + i, corto: String(i), num_cursos: 0 };
const gName = i => grado(i).nombre;
const gShort = i => grado(i).corto;
function gradesText(gs) {
  if (gs.length === 12) return "todos los grados, desde Transición hasta Undécimo";
  const s = [...gs].sort((a, b) => a - b), c = s.every((g, i) => !i || g === s[i - 1] + 1);
  if (s.length === 1) return "el grado " + gName(s[0]);
  if (c) return "los grados " + gName(s[0]) + " a " + gName(s[s.length - 1]);
  const n = s.map(gName); return "los grados " + n.slice(0, -1).join(", ") + " y " + n[n.length - 1];
}
function gradesShort(gs) {
  if (gs.length === 12) return "Todos los grados";
  const s = [...gs].sort((a, b) => a - b), c = s.every((g, i) => !i || g === s[i - 1] + 1);
  return c && s.length > 1 ? gShort(s[0]) + " a " + gShort(s[s.length - 1]) : s.map(gShort).join(", ");
}
const allSims = () => Object.values(St().sims).filter(s => !s.eliminado);
const deletedSims = () => Object.values(St().sims).filter(s => s.eliminado).sort((a, b) => b.fecha.localeCompare(a.fecha));
function activeSim() { return allSims().filter(s => s.estado !== "cerrado").sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)))[0] || null; }
function closedSims() { return allSims().filter(s => s.estado === "cerrado").sort((a, b) => (b.fecha + b.inicio).localeCompare(a.fecha + a.inicio)); }
const rowsOf = (t, id) => Object.values(St()[t]).filter(r => r.simulacro_id === id);
const letter = c => c.slice(c.lastIndexOf(" ") + 1);
function cursosOf(id) { return rowsOf("cursos", id).filter(r => !r.eliminado).sort((a, b) => a.grado - b.grado || letter(a.curso).localeCompare(letter(b.curso))); }
function espOf(id) { return rowsOf("esp", id).filter(r => !r.eliminado).sort((a, b) => a.grado - b.grado || a.nombre.localeCompare(b.nombre)); }
function otrosOf(id) { return rowsOf("otros", id).filter(r => !r.eliminado).sort((a, b) => a.orden - b.orden); }
function asigOf(id) { const m = {}; rowsOf("asig", id).forEach(r => { if (r.brigadista) m[r.grado] = r.brigadista; }); return m; }
const me = () => (St().session || {}).nombre || "";
const isCoord = s => !!St().coordOf[s.id];
function myGrades(s) { const a = asigOf(s.id); return s.grados.filter(g => a[g] === me()); }
function canEdit(s, g) { if (s.estado === "cerrado") return false; return isCoord(s) || myGrades(s).includes(g); }
// Cursos que están dentro de un grupo de especialidad: se cuentan en el grupo, no por separado
function enEsp(id) { const m = {}; espOf(id).forEach(x => (x.cursos || []).forEach(c => { m[c] = x.nombre; })); return m; }
function cursosSueltos(id) { const m = enEsp(id); return cursosOf(id).filter(c => !m[c.curso]); }
function totals(id) {
  const t = { E: 0, D: 0, A: 0, V: 0, J: 0, O: 0, Dc: 0, Ds: 0 };
  cursosSueltos(id).forEach(c => { t.E += +c.estudiantes || 0; t.Dc += +c.docentes || 0; });
  espOf(id).forEach(x => { t.E += +x.estudiantes || 0; t.Dc += +x.docentes || 0; });
  otrosOf(id).forEach(o => { if (o.grupo === "D") t.Ds += +o.cantidad || 0; else t[o.grupo] += +o.cantidad || 0; });
  t.D = t.Dc + t.Ds;
  t.T = t.E + t.D + t.A + t.V + t.J + t.O; return t;
}
// Estudiantes por grado sumando los grupos de especialidad del grado
function estGrado(id, g) {
  return cursosSueltos(id).filter(c => c.grado === g).reduce((a, c) => a + (+c.estudiantes || 0), 0)
    + espOf(id).filter(x => x.grado === g).reduce((a, x) => a + (+x.estudiantes || 0), 0);
}
// Inicio del conteo: el que registró el servidor o, sin red, el primer registro de este equipo
function conteoInicio(s) {
  if (s.conteo_inicio) return s.conteo_inicio;
  const ts = [...rowsOf("cursos", s.id), ...rowsOf("esp", s.id)].filter(r => !r.eliminado && (r.estudiantes != null || r.docentes != null)).map(r => r.updated_at).sort();
  return ts[0] || null;
}
function conteoTxt(s) {
  const c = conteoInicio(s); if (!c) return "";
  const d = new Date(c) - new Date(s.inicio);
  return `${fmtHourS(c)}, ${fmtDurText(Math.max(0, d))} después de la alarma`;
}
function fmtHourS(ts) { return new Date(ts).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }); }
function pendingOf(id) {
  let n = 0;
  ["cursos", "esp", "otros", "asig"].forEach(t => rowsOf(t, id).forEach(r => { if (r._p) n++; }));
  if (St().sims[id] && St().sims[id]._p) n++;
  return n;
}
const clone = o => JSON.parse(JSON.stringify(o));

/* ================= render ================= */
let deferRender = false;
function typing() { const a = document.activeElement; return a && ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName) && $("app").contains(a); }
function render() {
  deferRender = false;
  renderTop(); renderTabs();
  const a = $("app");
  if (!St().session) { a.innerHTML = viewLogin(); return; }
  const t = UI().tab;
  if (t === "sim") a.innerHTML = viewSim();
  else if (t === "rep") a.innerHTML = UI().view ? viewHistDetail() : viewHist();
  else if (t === "bal") a.innerHTML = UI().balId ? viewBalForm() : viewBal();
  else if (t === "cmp") a.innerHTML = viewCmp();
  else a.innerHTML = viewCfg();
  if (t === "cmp") drawCharts();
  tick();
}
function softRender() { if (typing() || $("modal").innerHTML) { deferRender = true; renderTop(); return; } render(); }
document.addEventListener("focusout", () => setTimeout(() => { if (deferRender && !typing() && !$("modal").innerHTML) render(); }, 50));
function go(t) { UI().tab = t; UI().view = null; UI().balId = null; UI().editing = null; Store.save(); render(); window.scrollTo(0, 0); }

function renderTop() {
  if (!St().session) { $("top").innerHTML = ""; return; }
  const p = Store.pendingCount(), b = Store.blockedCount();
  const on = St().online && navigator.onLine;
  const a = activeSim();
  let pill;
  if (b) pill = `<button class="pill p-key" onclick="needKey(()=>toast('Enviando cambios pendientes…'))"><span class="dot"></span>${b} esperan clave</button>`;
  else if (on) pill = `<button class="pill p-ok" onclick="Store.sync(true)"><span class="dot"></span>${p ? "Enviando " + p : "Conectado"}</button>`;
  else pill = `<button class="pill p-off" onclick="Store.sync(true)"><span class="dot"></span>Sin red${p ? " · " + p + " pendientes" : ""}</button>`;
  $("top").innerHTML = `<div class="in"><div class="brand">${logo(32)}<div style="min-width:0"><div class="cond" style="font-weight:600;font-size:18px;line-height:1.1">Simulacro</div><div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(me())}${a && isCoord(a) ? " · coordinador" : ""}</div></div></div>${pill}</div>`;
}
const ICONS = {
  sim: '<path d="M12 8v4l2 2"/><circle cx="12" cy="13" r="8"/><path d="M9 2h6"/>',
  rep: '<path d="M4 5h16v4H4zM6 9v10h12V9M10 13h4"/>',
  bal: '<path d="M9 4h6v3H9zM7 5H5v16h14V5h-2"/><path d="M9 12h6M9 16h4"/>',
  cmp: '<path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/>',
  cfg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3a1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
};
function renderTabs() {
  if (!St().session) { $("tabs").innerHTML = ""; return; }
  const t = [["sim", "Simulacro"], ["rep", "Repositorio"], ["bal", "Balance"], ["cmp", "Comparativo"], ["cfg", "Ajustes"]];
  $("tabs").innerHTML = `<div class="in">${t.map(([k, l]) => `<button class="${UI().tab === k ? "on" : ""}" onclick="go('${k}')" aria-current="${UI().tab === k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>${l}</button>`).join("")}</div>`;
}
function logo(sz) { return `<svg width="${sz}" height="${sz}" viewBox="0 0 64 64" aria-hidden="true" style="flex-shrink:0;display:block"><rect width="64" height="64" rx="14" fill="#1E3A73"/><path d="M40 12v40" stroke="#4CC38A" stroke-width="3" stroke-linecap="round"/><g fill="#fff"><circle cx="14" cy="32" r="3" opacity=".45"/><circle cx="23" cy="32" r="3.5" opacity=".7"/><circle cx="32" cy="32" r="4"/></g><path d="M44 32h9" stroke="#4CC38A" stroke-width="4" stroke-linecap="round"/><path d="M48 26l6 6l-6 6" fill="none" stroke="#4CC38A" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }

/* ================= modales y clave ================= */
function modal(html) { $("modal").innerHTML = `<div class="sheet-bg" onclick="if(event.target===this)closeModal()"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`; }
function closeModal() { $("modal").innerHTML = ""; if (deferRender) render(); }
let afterKey = null;
function needKey(fn) {
  if (Store.isAdmin()) { fn(); return; }
  afterKey = fn;
  modal(`<h2>Clave de informes</h2><p class="muted">Se necesita para generar informes y actas, editar simulacros cerrados y cambiar los ajustes.</p>
  <input id="kk" type="password" autocomplete="off" oninput="$('ke').textContent=''" onkeydown="if(event.key==='Enter')checkKey()">
  <div id="ke" class="err"></div><p class="hint">La app la recuerda durante 15 minutos en este equipo.</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><button class="btn" onclick="afterKey=null;closeModal()">Cancelar</button><button class="btn btn-primary" id="kb" onclick="checkKey()">Continuar</button></div>`);
  setTimeout(() => $("kk") && $("kk").focus(), 60);
}
async function checkKey() {
  const v = $("kk").value; if (!v) { $("ke").textContent = "Escribe la clave."; return; }
  $("kb").innerHTML = '<span class="spin"></span>';
  try {
    const ok = await Store.unlock(v);
    if (!ok) { $("ke").textContent = "La clave no es correcta."; $("kb").textContent = "Continuar"; return; }
    closeModal(); const f = afterKey; afterKey = null; renderTop(); f && f();
  } catch (e) {
    $("ke").textContent = e.offline ? "Sin conexión. La primera verificación de la clave en este equipo necesita internet." : e.message;
    $("kb").textContent = "Continuar";
  }
}

function confirmar(titulo, texto, accion, boton) {
  window.__conf = accion;
  modal(`<h2>${titulo}</h2><p class="muted">${texto}</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-stop" onclick="closeModal();window.__conf&&window.__conf()">${boton || "Eliminar"}</button></div>`);
}

/* ---- borrar ---- */
function delSim(id) {
  const s = St().sims[id];
  needKey(() => confirmar("¿Eliminar este simulacro?",
    `Se eliminará el simulacro del ${fmtShort(s.fecha)} (${esc(s.tipo)}) con todos sus conteos, en todos los equipos. Quedará en la papelera de Ajustes por si necesitas restaurarlo.`,
    () => { const r = clone(St().sims[id]); r.eliminado = true; Store.put("sims", r); UI().view = null; UI().editing = null; UI().balId = null; toast("Simulacro enviado a la papelera."); render(); window.scrollTo(0, 0); }));
}
function restoreSim(id) { needKey(() => { const r = clone(St().sims[id]); r.eliminado = false; Store.put("sims", r); toast("Simulacro restaurado."); }); }
function delCurso(id, curso) {
  const run = () => confirmar("¿Quitar este curso?", `${esc(curso)} dejará de contarse en este simulacro y en sus informes.`,
    () => { const r = clone(St().cursos[id + "|" + curso]); r.eliminado = true; Store.put("cursos", r); }, "Quitar");
  St().sims[id].estado === "cerrado" ? needKey(run) : run();
}
function delEsp(eid) {
  const x = St().esp[eid];
  const run = () => confirmar("¿Quitar este grupo?", `${esc(x.nombre)} dejará de contarse en este simulacro.`,
    () => { const r = clone(St().esp[eid]); r.eliminado = true; Store.put("esp", r); }, "Quitar");
  St().sims[x.simulacro_id].estado === "cerrado" ? needKey(run) : run();
}
function delOtro(oid) {
  const x = St().otros[oid];
  const run = () => confirmar("¿Quitar esta categoría?", `${esc(x.nombre)} dejará de contarse en este simulacro.`,
    () => { const r = clone(St().otros[oid]); r.eliminado = true; Store.put("otros", r); }, "Quitar");
  St().sims[x.simulacro_id].estado === "cerrado" ? needKey(run) : run();
}

/* ================= ingreso ================= */
function viewLogin() {
  const s = St().session;
  return `<div style="min-height:70vh;display:flex;flex-direction:column;justify-content:center;padding-top:30px">
  <div style="margin-bottom:16px">${logo(64)}</div>
  <h1 style="font-size:38px;line-height:1.05">Simulacro</h1>
  <p class="muted" style="margin:8px 0 18px">Registro de evacuaciones del Colegio Cafam en el punto de encuentro.</p>
  ${UI().loginMsg ? `<div class="warn" style="margin:0 0 12px">${esc(UI().loginMsg)}</div>` : ""}
  <div class="sec" style="margin-top:0">
    <label class="lbl" for="lc" style="margin-top:0">Código de acceso</label>
    <input id="lc" type="password" autocomplete="off" oninput="$('le').textContent=''">
    <label class="lbl" for="ln">Nombre del brigadista</label>
    <input id="ln" type="text" value="${esc(UI().lastName || (s && s.nombre) || "")}" placeholder="Nombre y apellido" autocomplete="name" oninput="$('le').textContent=''" onkeydown="if(event.key==='Enter')doLogin()">
    <div id="le" class="err"></div>
    <button class="btn btn-primary btn-block" style="margin-top:14px" id="lb" onclick="doLogin()">Ingresar</button>
    <p class="hint">Tu nombre queda guardado en este dispositivo y acompaña cada registro que hagas. El primer ingreso necesita internet.</p>
  </div></div>`;
}
async function doLogin() {
  const c = $("lc").value.trim(), n = $("ln").value.trim().replace(/\s+/g, " ");
  if (!c || !n) { $("le").textContent = "Escribe el código y tu nombre para continuar."; return; }
  $("lb").innerHTML = '<span class="spin"></span>';
  try {
    const r = await Store.login(c, n);
    if (!r.ok) { $("le").textContent = "El código no es correcto. Verifícalo con la coordinación."; $("lb").textContent = "Ingresar"; return; }
    UI().lastName = n; UI().loginMsg = ""; Store.save(); Store.loop(); render();
  } catch (e) {
    $("le").textContent = e.offline ? "Sin conexión. Conéctate a internet para el primer ingreso." : e.message;
    $("lb").textContent = "Ingresar";
  }
}

/* ================= pestaña simulacro ================= */
function viewSim() {
  const a = activeSim();
  if (!a) {
    if (UI().draft) return viewNew();
    const last = closedSims()[0];
    return `<div style="padding-top:22px"><h1>Hola, ${esc(me().split(" ")[0])}</h1><p class="muted" style="margin:4px 0 0">No hay un simulacro en curso. Si la coordinación inicia uno, aparecerá aquí para que te unas.</p></div>
    <button class="btn btn-go btn-block" style="margin-top:18px;min-height:56px;font-size:18px" onclick="newDraft()">Preparar nuevo simulacro</button>
    ${last ? `<div class="sec"><div class="row"><h3>Último simulacro</h3><button class="btn-ghost btn" onclick="UI().tab='rep';UI().view='${last.id}';render()">Ver</button></div>
    <p class="muted small" style="margin:4px 0 0">${fmtShort(last.fecha)} · ${esc(last.tipo)} · ${gradesShort(last.grados)} · ${fmtClock(dur(last))}</p></div>` : ""}`;
  }
  if (!isCoord(a) && (UI().forceJoin || (!myGrades(a).length && a.estado === "en_curso" && !UI().soloVer))) return viewJoin(a);
  return viewCapture(a);
}
function newDraft(from) {
  UI().draft = { fecha: today(), tipo: from ? from.tipo : "Evacuación general", grados: from ? [...from.grados] : St().grados.map(g => g.id) };
  Store.save(); render(); window.scrollTo(0, 0);
}
function viewNew() {
  const d = UI().draft; const nC = d.grados.reduce((s, g) => s + grado(g).num_cursos, 0);
  return `<div class="row" style="padding-top:18px"><h1>Nuevo simulacro</h1><button class="btn btn-ghost" onclick="UI().draft=null;Store.save();render()">Cancelar</button></div>
  <div class="sec"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div><label class="lbl" style="margin-top:0" for="df">Fecha</label><input id="df" type="date" value="${d.fecha}" onchange="UI().draft.fecha=this.value;Store.save()"></div>
    <div><label class="lbl" style="margin-top:0" for="dt">Tipo</label><select id="dt" onchange="UI().draft.tipo=this.value;Store.save()">${["Evacuación general", "Sismo", "Incendio", "Otro"].map(t => `<option ${t === d.tipo ? "selected" : ""}>${t}</option>`).join("")}</select></div>
  </div><p class="hint">La hora de inicio se registra sola cuando presionas Iniciar.</p></div>
  <div class="sec"><div class="row"><h3>Grados participantes</h3><span class="small muted">${d.grados.length} grados, ${nC} cursos</span></div>
  <div class="chips" style="margin:12px 0 6px"><button class="chip" onclick="setG('all')">Todos</button><button class="chip" onclick="setG('pri')">Transición a 5°</button><button class="chip" onclick="setG('bach')">6° a 11°</button><button class="chip" onclick="setG('none')">Ninguno</button></div>
  ${St().grados.map(g => { const on = d.grados.includes(g.id); return `<div class="grade ${on ? "" : "off"}"><button class="sw ${on ? "" : "off"}" role="switch" aria-checked="${on}" aria-label="${esc(g.nombre)}" onclick="togG(${g.id})"></button><div style="flex:1"><div class="gname" style="font-weight:500">${esc(g.nombre)}</div><div class="small muted">Cursos A a ${String.fromCharCode(64 + g.num_cursos)}</div></div><span class="small muted">${g.num_cursos} cursos</span></div>`; }).join("")}
  <p class="hint">La cantidad de cursos por grado se ajusta en Ajustes.</p></div>
  <button class="btn btn-stop btn-block" style="margin-top:16px;min-height:60px;font-size:19px" onclick="startSim()">Iniciar simulacro y cronómetro</button>
  <div id="ne" class="err" style="text-align:center"></div>`;
}
function setG(m) { UI().draft.grados = St().grados.map(g => g.id).filter(i => m === "all" || (m === "pri" && i < 6) || (m === "bach" && i >= 6)); Store.save(); render(); }
function togG(i) { const g = UI().draft.grados; UI().draft.grados = g.includes(i) ? g.filter(x => x !== i) : [...g, i].sort((a, b) => a - b); Store.save(); render(); }
function startSim() {
  const d = UI().draft;
  if (!d.grados.length) { $("ne").textContent = "Activa al menos un grado para iniciar."; return; }
  if (activeSim()) { $("ne").textContent = "Ya hay un simulacro en curso."; return; }
  const id = Store.uuid(), now = new Date().toISOString();
  St().coordOf[id] = true;
  Store.put("sims", { id, fecha: d.fecha, tipo: d.tipo, grados: d.grados, inicio: now, fin: null, estado: "en_curso", coordinador: me(), notas: "" }, true);
  d.grados.forEach(g => { const gr = grado(g); for (let i = 0; i < gr.num_cursos; i++) Store.put("cursos", { simulacro_id: id, curso: gr.corto + " " + String.fromCharCode(65 + i), grado: g, estudiantes: null, docentes: null, registrado_por: null }, true); });
  St().otrosDef.forEach((o, i) => Store.put("otros", { id: Store.uuid(), simulacro_id: id, nombre: o.nombre, grupo: o.grupo, cantidad: null, orden: i, registrado_por: null, eliminado: false }, true));
  UI().draft = null; UI().open = {}; UI().open[d.grados[0]] = true; UI().soloVer = false;
  Store.commit(); render(); window.scrollTo(0, 0);
}

/* ---- brigadista ---- */
function viewJoin(a) {
  const as = asigOf(a.id); const pick = UI().pick || myGrades(a);
  return `<div style="padding-top:18px"><h1>Unirte al simulacro</h1><p class="muted" style="margin:4px 0 0">${esc(a.tipo)}, iniciado a las ${fmtHour(a.inicio)} por ${esc(a.coordinador)}.</p></div>
  <div class="hud"><div class="clock run"><div><div class="small" style="opacity:.9">Tiempo de evacuación</div><div class="t" id="clk">00:00</div></div></div></div>
  <div class="sec"><h3>¿Qué grados vas a registrar?</h3>
  <div class="chips" style="margin-top:12px">${a.grados.map(g => { const tk = as[g] && as[g] !== me(); const sel = pick.includes(g); return `<button class="chip ${tk ? "taken" : sel ? "sel" : ""}" ${tk ? `aria-disabled="true"` : `onclick="pickG(${g})"`}>${esc(gName(g))}${tk ? " · " + esc(as[g].split(" ")[0]) : ""}</button>`; }).join("")}</div>
  <p class="hint">Los grados punteados ya los tomó otro brigadista. La coordinación puede liberarlos si hace falta.</p>
  <div id="je" class="err"></div>
  <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="joinSim('${a.id}')">Unirme y empezar a registrar</button>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px"><button class="btn" onclick="UI().soloVer=true;UI().forceJoin=false;UI().pick=null;render()">Solo ver</button><button class="btn" onclick="takeCoord('${a.id}')">Asumir coordinación</button></div></div>`;
}
function pickG(g) { const a = activeSim(); UI().pick = UI().pick || myGrades(a); UI().pick = UI().pick.includes(g) ? UI().pick.filter(x => x !== g) : [...UI().pick, g]; render(); }
function joinSim(id) {
  const a = St().sims[id]; const pick = UI().pick || myGrades(a);
  if (!pick.length) { $("je").textContent = "Elige al menos un grado."; return; }
  const as = asigOf(id);
  a.grados.forEach(g => {
    if (pick.includes(g) && as[g] !== me()) Store.put("asig", { simulacro_id: id, grado: g, brigadista: me() }, true);
    if (!pick.includes(g) && as[g] === me()) Store.put("asig", { simulacro_id: id, grado: g, brigadista: null }, true);
  });
  UI().open = {}; UI().open[pick[0]] = true; UI().pick = null; UI().soloVer = false; UI().forceJoin = false;
  Store.commit(); render();
}
function takeCoord(id) {
  modal(`<h2>¿Asumir la coordinación?</h2><p class="muted">Úsalo si el equipo del coordinador se quedó sin batería o sin conexión. Podrás finalizar el simulacro, registrar otras personas y liberar grados.</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="doTakeCoord('${id}')">Asumir</button></div>`);
}
function doTakeCoord(id) { St().coordOf[id] = true; const s = clone(St().sims[id]); s.coordinador = me(); Store.put("sims", s); UI().soloVer = false; closeModal(); render(); }

/* ---- captura ---- */
function stepper(val, editable, onch) {
  if (!editable) return `<div class="step"><input value="${val == null ? "–" : val}" disabled aria-label="valor"></div>`;
  return `<div class="step"><button aria-label="Restar" onclick="${onch}(-1)">−</button><input type="number" inputmode="numeric" min="0" value="${val == null ? "" : val}" placeholder="0" onchange="${onch}(0,this.value)" aria-label="Cantidad"><button aria-label="Sumar" onclick="${onch}(1)">+</button></div>`;
}
function numVal(cur, d, v) { if (d) return Math.max(0, (cur == null ? 0 : +cur) + d); if (v === "" || v == null) return null; return Math.max(0, parseInt(v, 10) || 0); }
function badge(r, editable, has) {
  if (!has) return editable ? `<span class="bd b-ro">Sin registrar</span>` : "";
  if (r._e) return `<span class="bd b-pe">Espera clave</span>`;
  return r._p ? `<span class="bd b-pe">Pendiente</span>` : `<span class="bd b-ok">Compartido</span>`;
}
function hud(s) {
  const t = totals(s.id), done = s.estado !== "en_curso";
  return `<div class="hud"><div class="clock ${done ? "done" : "run"}">
    <div><div class="small" style="opacity:.92">${done ? "Evacuación completada en" : "Tiempo de evacuación · alarma " + fmtHourS(s.inicio)}</div><div class="t" id="clk">${done ? fmtClock(dur(s)) : "00:00"}</div></div>
    ${!done && isCoord(s) ? `<button class="btn" onclick="askFinish()">Finalizar</button>` : ""}
  </div></div>
  <div class="row small muted" style="margin-top:6px"><span>${conteoInicio(s) ? "Conteo iniciado " + esc(conteoTxt(s)) : "El conteo inicia con el primer registro"}</span>${isCoord(s) && s.estado !== "cerrado" ? `<button class="btn btn-ghost small" onclick="editConteo('${s.id}')">Ajustar</button>` : ""}</div>
  <div class="tot" style="margin-top:4px">
    <div><span>Estudiantes</span><b>${fmtN(t.E)}</b></div><div><span>Docentes en clase</span><b>${fmtN(t.Dc)}</b></div>
    <div><span>Docentes sin asignación</span><b>${fmtN(t.Ds)}</b></div><div><span>Docentes total</span><b>${fmtN(t.D)}</b></div>
    <div><span>Administrativos y directivos</span><b>${fmtN(t.A)}</b></div><div><span>Visitantes</span><b>${fmtN(t.V)}</b></div>
    <div><span>Jornada compl. y otros</span><b>${fmtN(t.J + t.O)}</b></div><div class="all"><span>Total evacuados</span><b>${fmtN(t.T)}</b></div>
  </div>`;
}
function viewCapture(a) {
  const coord = isCoord(a), mine = myGrades(a), as = asigOf(a.id);
  const on = St().online && navigator.onLine, p = pendingOf(a.id);
  const grades = coord ? a.grados : [...mine, ...a.grados.filter(g => !mine.includes(g))];
  let h = hud(a);
  if (!on) h += `<div class="warn">Sin conexión. Sigue registrando: ${p ? p + (p === 1 ? " registro queda" : " registros quedan") + " en este equipo y se enviarán" : "lo que registres queda en este equipo y se enviará"} cuando vuelva la red.</div>`;
  if (a.estado === "finalizado" && coord) h += viewFinishPanel(a);
  h += waBar(a);
  if (!coord) h += `<div class="row" style="margin-top:10px"><span class="small muted">${mine.length ? "Registras: " + mine.map(gShort).join(", ") : "Estás en modo solo lectura"}</span><button class="btn btn-ghost small" onclick="UI().soloVer=false;UI().pick=null;changeGrades('${a.id}')">${mine.length ? "Cambiar grados" : "Tomar grados"}</button></div>`;
  h += `<div class="sec"><div class="row"><h3>${coord ? "Cursos" : "Grados"}</h3><span class="small muted">${esc(gradesShort(a.grados))}</span></div>`;
  const cursos = cursosOf(a.id), inE = enEsp(a.id);
  grades.forEach(g => {
    const list = cursos.filter(c => c.grado === g);
    const done = list.filter(c => c.estudiantes != null || inE[c.curso]).length, ed = canEdit(a, g), owner = as[g], open = !!UI().open[g];
    h += `<div style="border-top:1px solid var(--line);margin-top:6px"><button class="ghead" onclick="togOpen(${g})" aria-expanded="${open}"><span><span style="font-weight:600">${esc(gName(g))}</span><span class="small muted" style="display:block">${owner ? "Registra " + esc(owner) : "Sin brigadista asignado"}${!ed ? " · solo lectura" : ""}</span></span><span class="small muted">${done} de ${list.length} cursos ${open ? "▴" : "▾"}</span></button>`;
    if (coord && owner && owner !== me() && a.estado !== "cerrado" && open) h += `<button class="btn btn-ghost small" onclick="release('${a.id}',${g})">Liberar este grado</button>`;
    if (open) list.forEach(c => {
      const k = esc(jsq(c.curso));
      if (inE[c.curso]) { h += `<div class="course"><div class="top2"><span style="font-weight:600;font-size:17px" class="cond">${esc(c.curso)}</span><span class="bd b-ro">En especialidad</span></div><p class="small muted" style="margin:0">Se cuenta en ${esc(inE[c.curso])}</p></div>`; return; }
      h += `<div class="course"><div class="top2"><span style="font-weight:600;font-size:17px" class="cond">${esc(c.curso)}</span><span style="display:flex;gap:6px;align-items:center">${c.registrado_por && coord ? `<span class="small muted">${esc(c.registrado_por.split(" ")[0])}</span>` : ""}${badge(c, ed, c.estudiantes != null || c.docentes != null)}${coord && a.estado !== "cerrado" ? `<button class="btn btn-ghost small" style="min-height:32px;padding:2px 6px" aria-label="Quitar ${esc(c.curso)}" onclick="delCurso('${a.id}','${k}')">✕</button>` : ""}</span></div>
      <div class="counts"><div><label>Estudiantes</label>${stepper(c.estudiantes, ed, `((d,v)=>setC('${a.id}','${k}','estudiantes',d,v))`)}</div><div><label>Docentes</label>${stepper(c.docentes, ed, `((d,v)=>setC('${a.id}','${k}','docentes',d,v))`)}</div></div></div>`;
    });
    const ge = estGrado(a.id, g), gd = list.filter(c => !inE[c.curso]).reduce((s, c) => s + (+c.docentes || 0), 0) + espOf(a.id).filter(x => x.grado === g).reduce((s, x) => s + (+x.docentes || 0), 0);
    h += `<div class="gsum"><span>Total ${esc(gName(g))}</span><span>${fmtN(ge)} ${ge === 1 ? "estudiante" : "estudiantes"} · ${fmtN(gd)} ${gd === 1 ? "docente" : "docentes"}</span></div></div>`;
  });
  h += `</div>`;
  const esps = espOf(a.id), ro = a.estado === "cerrado";
  h += `<div class="sec"><div class="row"><h3>Especialidades</h3>${ro ? "" : `<button class="btn" onclick="espSheet('${a.id}')">Agregar grupo</button>`}</div>`;
  if (!esps.length) h += `<p class="muted small" style="margin:8px 0 0">Si algún grupo evacuó desde una especialidad de Tecnología o Artes, agrégalo aquí para contarlo aparte de su curso.</p>`;
  esps.forEach(x => {
    h += `<div class="course"><div class="top2"><span style="font-weight:500">${esc(x.nombre)}</span><span style="display:flex;gap:6px;align-items:center">${badge(x, !ro, x.estudiantes != null || x.docentes != null)}${ro ? "" : `<button class="btn btn-ghost small" onclick="delEsp('${x.id}')">Quitar</button>`}</span></div>
    <div class="counts"><div><label>Estudiantes</label>${stepper(x.estudiantes, !ro, `((d,v)=>setE('${x.id}','estudiantes',d,v))`)}</div><div><label>Docentes</label>${stepper(x.docentes, !ro, `((d,v)=>setE('${x.id}','docentes',d,v))`)}</div></div></div>`;
  });
  h += `</div>`;
  if (coord) {
    h += `<div class="sec"><h3>Otras personas</h3>`;
    otrosOf(a.id).forEach(o => { h += `<div class="course"><div class="top2"><span><span style="font-weight:500">${esc(o.nombre)}</span><span class="small muted" style="display:block">Suma en ${GROUPS[o.grupo].toLowerCase()}</span></span><span style="display:flex;gap:6px;align-items:center">${badge(o, !ro, o.cantidad != null)}${ro ? "" : `<button class="btn btn-ghost small" onclick="delOtro('${o.id}')">Quitar</button>`}</span></div>${stepper(o.cantidad, !ro, `((d,v)=>setO('${o.id}',d,v))`)}</div>`; });
    if (!ro) h += `<button class="btn btn-block" style="margin-top:12px" onclick="catSheet('${a.id}')">Agregar categoría</button>`;
    h += `</div><div class="sec"><label class="lbl" for="nt" style="margin-top:0">Observaciones para el informe</label><textarea id="nt" placeholder="Los estudiantes de 10° A y 10° B evacuaron con su docente desde el taller de Tecnología." onchange="setNotas('${a.id}',this.value)">${esc(a.notas)}</textarea><p class="hint">Si lo dejas vacío, el informe no incluye esta sección.</p></div>
    <button class="btn btn-block" style="margin-top:14px;color:var(--red);border-color:var(--red)" onclick="delSim('${a.id}')">Eliminar este simulacro</button>
    <p class="hint" style="text-align:center">Úsalo si se inició por error. Requiere la clave de informes.</p>`;
  }
  return h;
}
function editConteo(id) {
  const s = St().sims[id], c = conteoInicio(s) ? new Date(conteoInicio(s)) : new Date();
  const v = [c.getHours(), c.getMinutes(), c.getSeconds()].map(x => String(x).padStart(2, "0")).join(":");
  modal(`<h2>Inicio del conteo</h2><p class="muted">La app toma la hora del primer registro. Corrígela si el conteo empezó antes.</p>
  <input id="ct" type="time" step="1" value="${v}"><div id="cte" class="err"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveConteo('${id}')">Guardar</button></div>`);
}
function saveConteo(id) {
  const v = $("ct").value; if (!v) { $("cte").textContent = "Escribe la hora."; return; }
  const s = clone(St().sims[id]); const d = new Date(s.inicio); const [h, m, sec] = v.split(":");
  d.setHours(+h, +m, +(sec || 0), 0);
  if (d < new Date(s.inicio)) { $("cte").textContent = "El conteo no puede empezar antes de la alarma."; return; }
  s.conteo_inicio = d.toISOString(); Store.put("sims", s); closeModal();
}
function togOpen(g) { UI().open[g] = !UI().open[g]; Store.save(); render(); }
function changeGrades(id) { UI().pick = myGrades(St().sims[id]); UI().forceJoin = true; render(); window.scrollTo(0, 0); }
function setC(id, curso, f, d, v) { const r = clone(St().cursos[id + "|" + curso]); r[f] = numVal(r[f], d, v); if (St().sims[id].estado !== "cerrado" || !r.registrado_por) r.registrado_por = me(); Store.put("cursos", r); }
function setE(eid, f, d, v) { const r = clone(St().esp[eid]); r[f] = numVal(r[f], d, v); r.registrado_por = me(); Store.put("esp", r); }
function setO(oid, d, v) { const r = clone(St().otros[oid]); r.cantidad = numVal(r.cantidad, d, v); r.registrado_por = me(); Store.put("otros", r); }
function setNotas(id, v) { const s = clone(St().sims[id]); s.notas = v; Store.put("sims", s); }
function release(id, g) { Store.put("asig", { simulacro_id: id, grado: g, brigadista: null }); toast(gName(g) + " quedó libre para otro brigadista."); }

/* ---- finalizar y cerrar ---- */
function askFinish() {
  const a = activeSim();
  modal(`<h2>¿Finalizar el simulacro?</h2><p class="muted">El cronómetro se detiene en <b id="fclk">${fmtClock(Date.now() - new Date(a.inicio))}</b>. Los brigadistas podrán seguir completando conteos hasta que cierres el simulacro.</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px"><button class="btn" onclick="closeModal()">Seguir contando</button><button class="btn btn-stop" onclick="finish()">Finalizar</button></div>`);
}
function finish() { const s = clone(activeSim()); s.fin = new Date().toISOString(); s.estado = "finalizado"; Store.put("sims", s); closeModal(); render(); window.scrollTo(0, 0); }
function viewFinishPanel(a) {
  const p = pendingOf(a.id), inE = enEsp(a.id), empty = cursosOf(a.id).filter(c => c.estudiantes == null && !inE[c.curso]).length;
  return `<div class="sec" style="border-color:var(--green)"><h3>Simulacro finalizado</h3>
  <p class="muted small" style="margin:4px 0 0">Inicio ${fmtHour(a.inicio)}, cierre ${fmtHour(a.fin)}. ${empty ? `Faltan ${empty} cursos por registrar.` : "Todos los cursos tienen conteo."}</p>
  ${p ? `<div class="warn">Este equipo tiene ${p} ${p === 1 ? "registro pendiente" : "registros pendientes"} por enviar. Confirma también con los brigadistas que estén conectados antes de generar el informe.</div>` : ""}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><button class="btn btn-primary" onclick="needKey(()=>showReport('${a.id}'))">Generar informe</button><button class="btn" onclick="askClose('${a.id}')">Cerrar y guardar</button></div></div>`;
}
function askClose(id) {
  modal(`<h2>¿Cerrar el simulacro?</h2><p class="muted">Pasará al repositorio. Después de cerrarlo, cualquier cambio en las cifras necesitará la clave de informes.</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="closeSim('${id}')">Cerrar</button></div>`);
}
function closeSim(id) { const s = clone(St().sims[id]); s.estado = "cerrado"; Store.put("sims", s); closeModal(); toast("Simulacro guardado en el repositorio."); UI().tab = "rep"; UI().view = id; Store.save(); render(); window.scrollTo(0, 0); }

/* ---- hojas: especialidades y categorías ---- */
let espSt = { area: "Tecnología", g: null, i: 0, free: "", cur: [] };
function espList() { return St().esps.filter(e => e.area === espSt.area && e.activo !== false && espSt.g >= e.grado_min && espSt.g <= e.grado_max); }
function espNeedCourses() { if (espSt.area === "Otra") return false; const e = espList()[espSt.i]; return !!(e && e.requiere_cursos); }
function espSheet(id) {
  const a = St().sims[id]; espSt.sim = id;
  if (espSt.g == null || !a.grados.includes(espSt.g)) espSt.g = a.grados[a.grados.length - 1];
  const l = espList(); if (espSt.i >= l.length) espSt.i = 0;
  const need = espNeedCourses(), cur = [...espSt.cur].sort().join("");
  const name = (espSt.area === "Otra" ? (espSt.free || "Nombre del grupo") : espSt.area + " · " + (l[espSt.i] ? l[espSt.i].nombre : "")) + " · " + gShort(espSt.g) + (need && cur ? " " + cur : "");
  const nCur = cursosOf(id).filter(c => c.grado === espSt.g).map(c => letter(c.curso));
  modal(`<div class="row"><h2>Agregar grupo de especialidad</h2><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div>
  <span class="lbl">Área</span><div class="chips">${["Tecnología", "Artes", "Educación Física", "Otra"].map(x => `<button class="chip ${x === espSt.area ? "sel" : ""}" onclick="espSt.area='${x}';espSt.i=0;espSt.cur=[];espSheet('${id}')">${x}</button>`).join("")}</div>
  <label class="lbl" for="eg">Grado</label><select id="eg" onchange="espSt.g=+this.value;espSt.i=0;espSt.cur=[];espSheet('${id}')">${a.grados.map(g => `<option value="${g}" ${g === espSt.g ? "selected" : ""}>${esc(gName(g))}</option>`).join("")}</select>
  ${espSt.area === "Otra" ? `<label class="lbl" for="ef">Nombre del grupo</label><input id="ef" value="${esc(espSt.free)}" placeholder="Robótica competitiva" oninput="espSt.free=this.value">`
      : l.length ? `<span class="lbl">Especialidad</span><div class="chips">${l.map((e, i) => `<button class="chip ${i === espSt.i ? "sel" : ""}" onclick="espSt.i=${i};espSt.cur=[];espSheet('${id}')">${esc(e.nombre)}</button>`).join("")}</div>`
      : `<p class="small muted" style="margin-top:12px">No hay especialidades de ${espSt.area} para ${esc(gName(espSt.g))}. Puedes agregarlas en Ajustes o usar la opción Otra.</p>`}
  ${need ? `<span class="lbl">Cursos que la conforman</span><div class="chips">${nCur.map(L => `<button class="chip ${espSt.cur.includes(L) ? "sel" : ""}" style="min-width:44px" onclick="togCur('${L}')">${gShort(espSt.g)} ${L}</button>`).join("")}</div>` : ""}
  <p class="small muted" style="margin-top:14px">Se registrará como <b>${esc(name)}</b></p>
  <div id="ee" class="err"></div><button class="btn btn-primary btn-block" style="margin-top:10px" onclick="addEsp()">Agregar grupo</button>`);
}
function togCur(L) { espSt.cur = espSt.cur.includes(L) ? espSt.cur.filter(x => x !== L) : [...espSt.cur, L]; espSheet(espSt.sim); }
function addEsp() {
  const l = espList();
  if (espSt.area === "Otra") { const v = ($("ef") ? $("ef").value : "").trim(); if (!v) { $("ee").textContent = "Escribe el nombre del grupo."; return; } espSt.free = v; }
  else if (!l[espSt.i]) { $("ee").textContent = "Elige una especialidad."; return; }
  const need = espNeedCourses();
  if (need && !espSt.cur.length) { $("ee").textContent = "Selecciona los cursos que conforman el grupo."; return; }
  const cur = [...espSt.cur].sort();
  const n = (espSt.area === "Otra" ? espSt.free : espSt.area + " · " + l[espSt.i].nombre) + " · " + gShort(espSt.g) + (need ? " " + cur.join("") : "");
  Store.put("esp", { id: Store.uuid(), simulacro_id: espSt.sim, nombre: n, grado: espSt.g, cursos: need ? cur.map(L => gShort(espSt.g) + " " + L) : [], estudiantes: null, docentes: null, registrado_por: me(), eliminado: false }, true);
  espSt.cur = []; closeModal(); Store.commit();
}
function catSheet(id) {
  modal(`<div class="row"><h2>Agregar categoría</h2><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div>
  <label class="lbl" for="cn">Nombre</label><input id="cn" placeholder="Contratistas de obra">
  <label class="lbl" for="cg">Se suma en</label><select id="cg">${Object.entries(GROUPS).map(([k, v]) => `<option value="${k}" ${k === "O" ? "selected" : ""}>${v}</option>`).join("")}</select>
  <label class="chk"><input type="checkbox" id="ck" checked> Mantener en próximos simulacros</label>
  <div id="ce" class="err"></div><button class="btn btn-primary btn-block" style="margin-top:14px" onclick="addCat('${id}')">Agregar categoría</button>`);
}
function addCat(id) { const n = $("cn").value.trim(); if (!n) { $("ce").textContent = "Escribe el nombre de la categoría."; return; } if (otrosOf(id).some(o => o.nombre.toLowerCase() === n.toLowerCase())) { $("ce").textContent = "Esa categoría ya está en este simulacro."; return; } if ($("ck").checked) Store.addCategoria(n, $("cg").value); Store.put("otros", { id: Store.uuid(), simulacro_id: id, nombre: n, grupo: $("cg").value, cantidad: null, orden: otrosOf(id).length, registrado_por: me(), eliminado: false }, true); closeModal(); Store.commit(); }

/* ================= WhatsApp ================= */
const gNum = g => gShort(g).replace("°", "");
function medioMinuto(ms) { const h = Math.round(ms / 30000), m = Math.floor(h / 2), half = h % 2 === 1; return (m ? m + (half ? " 1/2" : "") : (half ? "1/2" : "0")) + " mn"; }
function waCuerpo(id, titulo, ms) {
  const s = St().sims[id], t = totals(id);
  const l = [titulo, `Estudiantes ${[...s.grados].sort((a, b) => a - b).map(gNum).join(", ")}: ${t.E}`, `Profesores: ${t.Dc} en clase, ${t.Ds} sin clase`];
  otrosOf(id).filter(o => o.grupo !== "D" && +o.cantidad > 0).forEach(o => l.push(`${o.nombre}: ${o.cantidad}`));
  l.push("", `Total ${t.T} evacuados`, "", `Tiempo: ${medioMinuto(ms)}`);
  return l.join("\n");
}
function waResumen(id) { return waCuerpo(id, "Total", dur(St().sims[id])); }
function waParcial(id) { const s = St().sims[id]; return waCuerpo(id, "Parcial " + fmtHour(Date.now()), Date.now() - new Date(s.inicio)); }
function waFaltantes(id) {
  const s = St().sims[id], inE = enEsp(id), falt = cursosOf(id).filter(c => !inE[c.curso] && c.estudiantes == null);
  if (!falt.length) return `Todos los cursos ya reportaron (${fmtHour(Date.now())}).`;
  const l = [`Cursos sin reporte a las ${fmtHour(Date.now())}:`];
  s.grados.forEach(g => { const f = falt.filter(c => c.grado === g).map(c => letter(c.curso)); if (f.length) l.push(`${gName(g)}: ${f.join(", ")}`); });
  return l.join("\n");
}
function sendWA(text) {
  const url = "https://wa.me/?text=" + encodeURIComponent(text);
  const w = window.open(url, "_blank");
  if (!w) location.href = url;
}
function waBar(s) {
  const done = s.estado !== "en_curso";
  return `<div class="sec"><div class="row"><h3>Enviar por WhatsApp</h3><span class="small muted">Eliges el chat al abrir</span></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
  <button class="btn" onclick="sendWA(${done ? `waResumen('${s.id}')` : `waParcial('${s.id}')`})">${done ? "Resumen final" : "Conteo parcial"}</button>
  <button class="btn" onclick="sendWA(waFaltantes('${s.id}'))">Cursos faltantes</button></div></div>`;
}

/* ================= informe ================= */
function gradeRows(id) {
  const s = St().sims[id]; const cs = cursosSueltos(id);
  const rows = s.grados.map(g => { const l = cs.filter(c => c.grado === g); return [gName(g), l.length, l.reduce((a, c) => a + (+c.estudiantes || 0), 0), l.reduce((a, c) => a + (+c.docentes || 0), 0)]; });
  const es = espOf(id);
  if (es.length) rows.push(["Especialidades", es.length, es.reduce((a, x) => a + (+x.estudiantes || 0), 0), es.reduce((a, x) => a + (+x.docentes || 0), 0)]);
  const dOut = otrosOf(id).filter(o => o.grupo === "D").reduce((a, o) => a + (+o.cantidad || 0), 0);
  if (dOut) rows.push(["Docentes sin asignación", "", "", dOut]);
  return rows;
}
function reportData(id) {
  const s = St().sims[id], t = totals(id), cfg = St().cfg;
  const d = s.fin ? dur(s) : Date.now() - new Date(s.inicio);
  const tipoTxt = s.tipo === "Evacuación general" ? "evacuación" : s.tipo === "Otro" ? "evacuación" : "evacuación por " + s.tipo.toLowerCase();
  const pob = [["Estudiantes", t.E], ["Docentes asignados a clases", t.Dc], ["Docentes sin asignación", t.Ds], ["Personal administrativo y directivo", t.A], ["Visitantes", t.V], ["Jornada escolar complementaria", t.J]];
  otrosOf(id).filter(o => o.grupo === "O" && +o.cantidad).forEach(o => pob.push([o.nombre, +o.cantidad]));
  return {
    fecha: fmtDate(s.fecha), destinatario: cfg.destinatario,
    asunto: `Informe del simulacro de ${tipoTxt} realizado el ${fmtDate(s.fecha)}`,
    intro: `Por medio de la presente, informamos los resultados del simulacro de ${tipoTxt} realizado el ${fmtDate(s.fecha, true)}, en el que participaron los estudiantes de ${gradesText(s.grados)}, junto con los docentes, el personal administrativo y directivo, los visitantes y las demás personas que se encontraban en las instalaciones del colegio.`,
    desarrollo: `La señal de alarma se activó a las ${fmtHour(s.inicio)} y la evacuación concluyó a las ${fmtHour(new Date(s.inicio).getTime() + d)}, con un tiempo total de ${fmtDurText(d)}, contado desde la activación de la alarma hasta el reporte del último grupo en el punto de encuentro.${conteoInicio(s) ? ` El conteo en el punto de encuentro comenzó a las ${conteoTxt(s)}.` : ""}`,
    totalTxt: `En total fueron evacuadas ${fmtN(t.T)} personas, entre ellas ${fmtN(t.D)} docentes (${fmtN(t.Dc)} asignados a clases y ${fmtN(t.Ds)} sin asignación), distribuidas de la siguiente manera:`,
    poblacion: pob, total: t.T, grados: gradeRows(id), totGrados: [cursosSueltos(id).length + espOf(id).length, t.E, t.D],
    notas: s.notas || "", firma: cfg.firma, cargo: cfg.cargo
  };
}
function showReport(id) {
  const r = reportData(id), s = St().sims[id], p = pendingOf(id);
  modal(`<div class="row"><h2>Informe</h2><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div>
  ${p ? `<div class="warn">Este equipo tiene ${p} ${p === 1 ? "registro que aún no se ha compartido" : "registros que aún no se han compartido"}. Verifica que los demás equipos estén sincronizados para que el informe no salga incompleto.</div>` : ""}
  <p class="small muted">Vista previa. El Word se descarga con el membrete institucional.</p>
  <div class="page">
    <p><b>Bogotá, ${esc(r.fecha)}</b></p><br><p style="margin:0">Estimada</p><p><b>${esc(r.destinatario)}</b></p>
    <p><b>Asunto:</b> ${esc(r.asunto)}</p><p>Reciban un cordial saludo.</p><p>${esc(r.intro)}</p>
    <p><b>1.&nbsp; Desarrollo del simulacro</b></p><p>${esc(r.desarrollo)}</p>
    <p><b>2.&nbsp; Personas evacuadas</b></p><p>${esc(r.totalTxt)}</p>
    <table><tr><th>Población</th><th>Cantidad</th></tr>${r.poblacion.map(x => `<tr><td>${esc(x[0])}</td><td>${fmtN(x[1])}</td></tr>`).join("")}<tr class="sum"><td>Total</td><td>${fmtN(r.total)}</td></tr></table>
    <p><b>3.&nbsp; Reporte por grado</b></p><p>El conteo de estudiantes y docentes realizado en el punto de encuentro, por grado, fue el siguiente:</p>
    <table><tr><th>Grado</th><th>Cursos</th><th>Estudiantes</th><th>Docentes</th></tr>${r.grados.map(x => `<tr><td>${esc(x[0])}</td><td>${x[1]}</td><td>${x[2] === "" ? "" : fmtN(x[2])}</td><td>${fmtN(x[3])}</td></tr>`).join("")}<tr class="sum"><td>Total</td><td>${r.totGrados[0]}</td><td>${fmtN(r.totGrados[1])}</td><td>${fmtN(r.totGrados[2])}</td></tr></table>
    ${r.notas.trim() ? `<p><b>4.&nbsp; Observaciones</b></p><p>${esc(r.notas)}</p>` : ""}
    <p>Agradecemos a los docentes, brigadistas, estudiantes y a todo el personal su compromiso y colaboración durante el desarrollo de este ejercicio, que fortalece la preparación de nuestra comunidad educativa frente a situaciones de emergencia.</p>
    <p style="margin-top:14px">Cordialmente,</p><br><br><p style="text-align:center;margin:0"><b>${esc(r.firma)}</b></p><p style="text-align:center"><b>${esc(r.cargo)}</b></p>
  </div>
  <div id="we" class="err"></div>
  <button class="btn btn-primary btn-block" style="margin-top:14px" id="wb" onclick="downloadReport('${id}')">Descargar Word</button>`);
}
async function loadTemplate(name) { const r = await fetch("plantillas/" + name); if (!r.ok) throw new Error("No se encontró la plantilla " + name); return r.arrayBuffer(); }
async function deliver(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (matchMedia("(pointer:coarse)").matches && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}
async function downloadReport(id) {
  const b = $("wb"); b.innerHTML = '<span class="spin"></span> Generando';
  try {
    const blob = await SimDocx.circular(await loadTemplate("circular.docx"), reportData(id));
    await deliver(blob, `Informe simulacro ${St().sims[id].fecha}.docx`);
  } catch (e) { $("we").textContent = "No se pudo generar el documento: " + e.message; }
  b.textContent = "Descargar Word";
}

/* ================= repositorio ================= */
function viewHist() {
  const list0 = closedSims();
  if (!list0.length) return `<div style="padding-top:18px"><h1>Repositorio</h1></div><div class="sec"><p class="muted" style="margin:0">Aquí aparecerán los simulacros cuando se cierren.</p></div>`;
  const years = [...new Set(list0.map(h => h.fecha.slice(0, 4)))];
  if (!years.includes(UI().year)) UI().year = years[0];
  const list = list0.filter(h => h.fecha.startsWith(UI().year));
  return `<div class="row" style="padding-top:18px"><h1>Repositorio</h1><select style="width:auto" onchange="UI().year=this.value;render()" aria-label="Año">${years.map(y => `<option ${y === UI().year ? "selected" : ""}>${y}</option>`).join("")}</select></div>
  <p class="muted" style="margin:4px 0 0">Simulacros cerrados, del más reciente al más antiguo.</p>
  <div class="sec" style="padding-top:4px;padding-bottom:4px">${list.map((h, i) => { const t = totals(h.id); return `<button class="hist" style="${i ? "" : "border-top:none"}" onclick="UI().view='${h.id}';render();window.scrollTo(0,0)"><div class="row"><span class="cond" style="font-weight:600;font-size:18px">${fmtShort(h.fecha)}</span><span class="cond" style="font-weight:600;font-size:18px">${fmtN(t.T)} personas</span></div><div class="row small muted"><span>${esc(h.tipo)}, ${esc(gradesShort(h.grados))}</span><span>${fmtClock(dur(h))}</span></div></button>`; }).join("")}</div>`;
}
function viewHistDetail() {
  const h = St().sims[UI().view]; if (!h) { UI().view = null; return viewHist(); }
  if (UI().editing === h.id) return viewEdit(h);
  const t = totals(h.id), rows = gradeRows(h.id);
  return `<button class="btn btn-ghost" style="margin-top:12px;padding-left:0" onclick="UI().view=null;render()">‹ Repositorio</button>
  <h1>${fmtShort(h.fecha)}</h1><p class="muted" style="margin:2px 0 0">${esc(h.tipo)}, ${esc(gradesShort(h.grados))}. Alarma ${fmtHourS(h.inicio)}, duración ${fmtClock(dur(h))}.${conteoInicio(h) ? " Conteo iniciado " + esc(conteoTxt(h)) + "." : ""} Coordinó ${esc(h.coordinador)}.</p>
  ${h.editado_por ? `<p class="small muted" style="margin:4px 0 0">Última edición: ${esc(h.editado_por)}, ${fmtShort(String(h.editado_en).slice(0, 10))}</p>` : ""}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
    <button class="btn btn-primary" onclick="needKey(()=>showReport('${h.id}'))">Generar informe</button>
    <button class="btn" onclick="needKey(()=>{UI().editing='${h.id}';render();window.scrollTo(0,0)})">Editar datos</button>
    <button class="btn" style="grid-column:1/-1" onclick="UI().tab='bal';UI().balId=null;openBal('${h.id}')">Balance y acta de la reunión</button>
    <button class="btn" style="grid-column:1/-1" onclick="UI().tab='sim';UI().view=null;newDraft(St().sims['${h.id}'])">Usar esta configuración en uno nuevo</button>
    <button class="btn" style="grid-column:1/-1;color:var(--red);border-color:var(--red)" onclick="delSim('${h.id}')">Eliminar simulacro</button>
  </div>
  <div class="sec"><h3>Personas evacuadas</h3><table class="t" style="margin-top:6px"><tr><th>Población</th><th>Cantidad</th></tr>
  ${[["Estudiantes", t.E], ["Docentes asignados a clases", t.Dc], ["Docentes sin asignación", t.Ds], ["Administrativos y directivos", t.A], ["Visitantes", t.V], ["Jornada complementaria", t.J], ["Otros", t.O]].map(r => `<tr><td>${r[0]}</td><td>${fmtN(r[1])}</td></tr>`).join("")}<tr class="sum"><td>Total</td><td>${fmtN(t.T)}</td></tr></table></div>
  <div class="sec"><h3>Por grado</h3><p class="small muted" style="margin:2px 0 0">Toca un grado para ver el detalle por curso.</p><table class="t" style="margin-top:6px"><tr><th>Grado</th><th>Cursos</th><th>Est.</th><th>Doc.</th><th aria-hidden="true"></th></tr>
  ${rows.map(r => { const gi = St().grados.findIndex(g => g.nombre === r[0]); const act = gi >= 0 ? `gradeDetail('${h.id}',${St().grados[gi].id})` : r[0] === "Especialidades" ? `espDetail('${h.id}')` : ""; return `<tr ${act ? `class="clk" tabindex="0" role="button" onclick="${act}" onkeydown="if(event.key==='Enter')${act}"` : ""}><td>${esc(r[0])}</td><td>${r[1]}</td><td>${r[2] === "" ? "" : fmtN(r[2])}</td><td>${fmtN(r[3])}</td><td style="color:var(--ink-3);width:18px">${act ? "›" : ""}</td></tr>`; }).join("")}
  <tr class="sum"><td>Total</td><td>${cursosSueltos(h.id).length + espOf(h.id).length}</td><td>${fmtN(t.E)}</td><td>${fmtN(t.D)}</td><td></td></tr></table></div>
  <div class="sec"><h3>Enviar por WhatsApp</h3><p class="small muted" style="margin:2px 0 8px">Abre WhatsApp con el resumen escrito para que elijas el chat o el grupo.</p><button class="btn btn-block" onclick="sendWA(waResumen('${h.id}'))">Enviar resumen</button></div>`;
}
function gradeDetail(id, g) {
  const h = St().sims[id], inE = enEsp(id), list = cursosOf(id).filter(c => c.grado === g), es = espOf(id).filter(x => x.grado === g);
  const suel = list.filter(c => !inE[c.curso]);
  const e = suel.reduce((s, c) => s + (+c.estudiantes || 0), 0), d = suel.reduce((s, c) => s + (+c.docentes || 0), 0);
  modal(`<div class="row"><h2>${esc(gName(g))}</h2><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div>
  <p class="small muted" style="margin:2px 0 8px">${fmtShort(h.fecha)} · ${esc(h.tipo)} · ${list.length} cursos</p>
  <table class="t"><tr><th>Curso</th><th>Estudiantes</th><th>Docentes</th></tr>${list.map(c => inE[c.curso] ? `<tr><td><b class="cond" style="font-size:16px">${esc(c.curso)}</b><span class="small muted" style="display:block">En ${esc(inE[c.curso])}</span></td><td>–</td><td>–</td></tr>` : `<tr><td><b class="cond" style="font-size:16px">${esc(c.curso)}</b>${c.registrado_por ? `<span class="small muted" style="display:block">${esc(c.registrado_por)}</span>` : ""}</td><td>${c.estudiantes == null ? "–" : fmtN(c.estudiantes)}</td><td>${c.docentes == null ? "–" : fmtN(c.docentes)}</td></tr>`).join("")}
  ${es.map(x => `<tr><td>${esc(x.nombre)}<span class="small muted" style="display:block">Grupo de especialidad</span></td><td>${fmtN(x.estudiantes)}</td><td>${fmtN(x.docentes)}</td></tr>`).join("")}
  <tr class="sum"><td>Total ${esc(gName(g))}</td><td>${fmtN(e + es.reduce((s, x) => s + (+x.estudiantes || 0), 0))}</td><td>${fmtN(d + es.reduce((s, x) => s + (+x.docentes || 0), 0))}</td></tr></table>`);
}
function espDetail(id) {
  const es = espOf(id);
  modal(`<div class="row"><h2>Especialidades</h2><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div>
  <table class="t" style="margin-top:8px"><tr><th>Grupo</th><th>Estudiantes</th><th>Docentes</th></tr>${es.map(x => `<tr><td>${esc(x.nombre)}</td><td>${fmtN(x.estudiantes)}</td><td>${fmtN(x.docentes)}</td></tr>`).join("")}<tr class="sum"><td>Total</td><td>${fmtN(es.reduce((s, x) => s + (+x.estudiantes || 0), 0))}</td><td>${fmtN(es.reduce((s, x) => s + (+x.docentes || 0), 0))}</td></tr></table>`);
}
function viewEdit(h) {
  const ms = dur(h), st = new Date(h.inicio);
  let b = `<div class="row" style="padding-top:18px"><h1>Editar datos</h1><button class="btn btn-go" onclick="UI().editing=null;toast('Cambios guardados.');render()">Listo</button></div>
  <p class="muted" style="margin:4px 0 0">${fmtShort(h.fecha)} · ${esc(h.tipo)}. Cada cambio se guarda al instante y queda registrado a tu nombre.</p>
  <div class="sec"><label class="lbl" style="margin-top:0" for="eh">Hora de inicio</label><input id="eh" type="time" value="${String(st.getHours()).padStart(2, "0")}:${String(st.getMinutes()).padStart(2, "0")}" onchange="editStart('${h.id}',this.value)">
  <label class="lbl">Duración (minutos y segundos)</label><div style="display:flex;gap:8px"><input type="number" min="0" value="${Math.floor(ms / 60000)}" onchange="editDur('${h.id}','m',this.value)" aria-label="Minutos"><input type="number" min="0" max="59" value="${Math.round(ms / 1000) % 60}" onchange="editDur('${h.id}','s',this.value)" aria-label="Segundos"></div>
  <div class="row" style="margin-top:12px"><span class="small muted">${conteoInicio(h) ? "Conteo iniciado " + esc(conteoTxt(h)) : "Sin hora de inicio del conteo"}</span><button class="btn btn-ghost small" onclick="editConteo('${h.id}')">Ajustar</button></div></div><div class="sec"><h3>Cursos</h3>`;
  h.grados.forEach(g => {
    b += `<p class="small muted" style="margin:12px 0 0;font-weight:600">${esc(gName(g))}</p>`;
    cursosOf(h.id).filter(c => c.grado === g).forEach(c => { const k = esc(jsq(c.curso)); b += `<div class="course" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span class="cond" style="font-weight:600;width:52px">${esc(c.curso)}</span>${stepper(c.estudiantes, true, `((d,v)=>setC('${h.id}','${k}','estudiantes',d,v))`)}${stepper(c.docentes, true, `((d,v)=>setC('${h.id}','${k}','docentes',d,v))`)}<button class="btn btn-ghost small" aria-label="Quitar ${esc(c.curso)}" onclick="delCurso('${h.id}','${k}')">✕</button></div>`; });
  });
  b += `</div>`;
  const es = espOf(h.id);
  if (es.length) b += `<div class="sec"><h3>Especialidades</h3>${es.map(x => `<div class="course"><div class="row" style="margin-bottom:6px"><span style="font-weight:500">${esc(x.nombre)}</span><button class="btn btn-ghost small" onclick="delEsp('${x.id}')">Quitar</button></div><div class="counts">${stepper(x.estudiantes, true, `((d,v)=>setE('${x.id}','estudiantes',d,v))`)}${stepper(x.docentes, true, `((d,v)=>setE('${x.id}','docentes',d,v))`)}</div></div>`).join("")}</div>`;
  b += `<div class="sec"><h3>Otras personas</h3>${otrosOf(h.id).map(o => `<div class="course row"><span>${esc(o.nombre)}<button class="btn btn-ghost small" style="display:block;padding-left:0" onclick="delOtro('${o.id}')">Quitar</button></span>${stepper(o.cantidad, true, `((d,v)=>setO('${o.id}',d,v))`)}</div>`).join("")}</div>
  <div class="sec"><label class="lbl" style="margin-top:0" for="hn">Observaciones</label><textarea id="hn" onchange="setNotas('${h.id}',this.value)">${esc(h.notas)}</textarea></div>`;
  return b;
}
function editStart(id, v) { const s = clone(St().sims[id]); const ms = dur(s); const d = new Date(s.inicio); const [a, b] = v.split(":"); d.setHours(+a, +b, 0, 0); s.inicio = d.toISOString(); s.fin = new Date(d.getTime() + ms).toISOString(); Store.put("sims", s); }
function editDur(id, u, v) { const s = clone(St().sims[id]); const sec = Math.round(dur(s) / 1000); let m = Math.floor(sec / 60), r = sec % 60; if (u === "m") m = Math.max(0, +v || 0); else r = Math.min(59, Math.max(0, +v || 0)); s.fin = new Date(new Date(s.inicio).getTime() + (m * 60 + r) * 1000).toISOString(); Store.put("sims", s); }

/* ================= balance y acta ================= */
// Un balance puede ser de un simulacro (tabla bal, clave = id del simulacro)
// o de varios simulacros (tabla cons, clave = id propio).
const balKind = () => UI().balKind || "bal";
function balOf(id) { const b = St().bal[id]; return b && !b.eliminado ? b : null; }
function consList() { return Object.values(St().cons).filter(c => !c.eliminado).sort((a, b) => String(b.datos.fecha).localeCompare(String(a.datos.fecha))); }
function curBal() { const r = balKind() === "cons" ? St().cons[UI().balId] : St().bal[UI().balId]; return r && !r.eliminado ? r : null; }
function putBal(r) { if (r.estado === "generada") r.estado = "borrador"; Store.put(balKind() === "cons" ? "cons" : "bal", r); }
function stBadge(r) { return !r ? ["Sin balance", "b-ro"] : r.estado === "generada" ? ["Acta generada", "b-ok"] : ["Borrador", "b-pe"]; }
function nextActaNo() {
  const y = today().slice(0, 4);
  return String([...Object.values(St().bal), ...Object.values(St().cons)].filter(b => !b.eliminado && b.acta_no && String(b.datos.fecha || "").startsWith(y)).length + 1);
}
function tipoTxt(t) { return t === "Evacuación general" || t === "Otro" ? "evacuación" : t.toLowerCase(); }
function rangoTxt(ids) {
  const f = ids.map(i => St().sims[i]).filter(Boolean).map(s => s.fecha).sort();
  return f[0] === f[f.length - 1] ? "el " + fmtDate(f[0]) : "entre el " + fmtDate(f[0]) + " y el " + fmtDate(f[f.length - 1]);
}
function nuevoDatos(obj) { return { fecha: today(), hora: "14:00", lugar: "", mod: "Presencial", unidad: (St().cfg || {}).unidad_acta || "", resp: me().toUpperCase(), rel: "", asis: [], obj, fav: [], mej: [], comp: [], prox: "" }; }

function viewBal() {
  const list = closedSims(), cons = consList();
  return `<div style="padding-top:18px"><h1>Balance</h1><p class="muted" style="margin:4px 0 0">Notas de la reunión posterior a los simulacros y generación del acta.</p></div>
  <div class="sec"><div class="row"><h3>Balances de varios simulacros</h3><button class="btn" onclick="pickCons()">Nuevo</button></div>
  ${cons.length ? cons.map(c => { const [st, cl] = stBadge(c); const sims = c.simulacros.map(i => St().sims[i]).filter(s => s && !s.eliminado); return `<button class="hist" onclick="openCons('${c.id}')"><div class="row"><span class="cond" style="font-weight:600;font-size:17px">${sims.length} simulacros</span><span class="bd ${cl}">${st}</span></div><div class="small muted">${sims.map(s => lab(s)).join(", ")}${c.acta_no ? " · Acta No. " + esc(c.acta_no) : ""}</div></button>`; }).join("")
      : `<p class="small muted" style="margin:8px 0 0">Para una reunión que revisa varios simulacros a la vez.</p>`}</div>
  <div class="sec" style="padding-top:12px;padding-bottom:4px"><h3>Por simulacro</h3>
  ${list.length ? list.map(h => { const b = balOf(h.id), [st, c] = stBadge(b); return `<button class="hist" onclick="openBal('${h.id}')"><div class="row"><span class="cond" style="font-weight:600;font-size:18px">${fmtShort(h.fecha)}</span><span class="bd ${c}">${st}</span></div><div class="small muted">${esc(h.tipo)}, ${esc(gradesShort(h.grados))}${b && b.acta_no ? " · Acta No. " + esc(b.acta_no) : ""}</div></button>`; }).join("")
      : `<p class="muted small" style="margin:8px 0 10px">Cuando cierres un simulacro, aquí podrás registrar el balance de la reunión.</p>`}</div>`;
}
function openBal(id) {
  const h = St().sims[id], old = St().bal[id];
  const crear = () => {
    const r = { simulacro_id: id, estado: "borrador", acta_no: nextActaNo(), eliminado: false, _srvDel: old ? old._srvDel : false,
      datos: nuevoDatos(["Realizar el balance del simulacro de " + tipoTxt(h.tipo) + " del " + fmtDate(h.fecha) + ".", "Identificar los aspectos favorables y los aspectos por mejorar.", "Definir compromisos para el próximo simulacro."]) };
    Store.put("bal", r, true); Store.commit();
  };
  UI().balKind = "bal"; UI().balId = id; UI().tab = "bal";
  if (!old) crear();
  else if (old.eliminado) { needKey(() => { crear(); render(); }); return; }
  Store.save(); render(); window.scrollTo(0, 0);
}
function pickCons(pre) {
  UI().consPick = pre || UI().consPick || [];
  const all = closedSims();
  if (all.length < 2) { toast("Se necesitan al menos dos simulacros cerrados."); return; }
  modal(`<div class="row"><h2>Balance de varios simulacros</h2><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div>
  <p class="muted small">Elige los simulacros que se revisarán en la reunión.</p>
  <div class="chips">${all.map(x => `<button class="chip ${UI().consPick.includes(x.id) ? "sel" : ""}" onclick="togConsPick('${x.id}')">${lab(x)} · ${esc(x.tipo)}</button>`).join("")}</div>
  <div id="pe" class="err"></div><button class="btn btn-primary btn-block" style="margin-top:14px" onclick="createCons()">Crear balance</button>`);
}
function togConsPick(id) { const p = UI().consPick; UI().consPick = p.includes(id) ? p.filter(x => x !== id) : [...p, id]; pickCons(); }
function createCons() {
  const ids = UI().consPick.filter(i => St().sims[i] && !St().sims[i].eliminado);
  if (ids.length < 2) { $("pe").textContent = "Elige al menos dos simulacros."; return; }
  const id = Store.uuid();
  Store.put("cons", { id, simulacros: ids, estado: "borrador", acta_no: nextActaNo(), eliminado: false,
    datos: nuevoDatos(["Realizar el balance consolidado de los simulacros realizados " + rangoTxt(ids) + ".", "Identificar los aspectos favorables y los aspectos por mejorar que se repiten entre simulacros.", "Definir compromisos para los próximos simulacros."]) }, true);
  UI().consPick = []; closeModal(); Store.commit(); openCons(id);
}
function openCons(id) { UI().balKind = "cons"; UI().balId = id; UI().tab = "bal"; Store.save(); render(); window.scrollTo(0, 0); }
function consSims(r) { return r.simulacros.map(i => St().sims[i]).filter(s => s && !s.eliminado).sort((a, b) => String(a.inicio).localeCompare(String(b.inicio))); }
function resumen(id) {
  const h = St().sims[id], t = totals(id);
  return `El simulacro se realizó el ${fmtDate(h.fecha)} con la participación de ${gradesText(h.grados)}. La alarma se activó a las ${fmtHour(h.inicio)} y la evacuación tomó ${fmtDurText(dur(h))}.${conteoInicio(h) ? ` El conteo comenzó a las ${conteoTxt(h)}.` : ""} En el punto de encuentro se reportaron ${fmtN(t.T)} personas: ${fmtN(t.E)} estudiantes, ${fmtN(t.D)} docentes (${fmtN(t.Dc)} asignados a clases y ${fmtN(t.Ds)} sin asignación), ${fmtN(t.A)} administrativos y directivos, ${fmtN(t.V)} visitantes y ${fmtN(t.J + t.O)} personas de jornada complementaria y otros.`;
}
function resumenCons(r) {
  const sims = consSims(r);
  const items = sims.map(s => { const t = totals(s.id); return `${fmtDate(s.fecha)} (${s.tipo.toLowerCase()}, ${gradesShort(s.grados)}): la evacuación tomó ${fmtDurText(dur(s))}${conteoInicio(s) ? `, el conteo comenzó a las ${conteoTxt(s)}` : ""} y se reportaron ${fmtN(t.T)} personas, ${fmtN(t.D)} de ellas docentes (${fmtN(t.Dc)} en clase y ${fmtN(t.Ds)} sin asignación).`; });
  if (sims.length > 1) {
    const avg = sims.reduce((a, s) => a + dur(s), 0) / sims.length, per = Math.round(sims.reduce((a, s) => a + totals(s.id).T, 0) / sims.length);
    items.push(`En conjunto, el tiempo promedio de evacuación fue de ${fmtDurText(avg)} y se evacuaron en promedio ${fmtN(per)} personas por simulacro.`);
  }
  return items;
}
function knownPeople() { const s = new Set(); [...Object.values(St().bal), ...Object.values(St().cons)].forEach(b => { if (b.eliminado) return; (b.datos.asis || []).forEach(n => s.add(n)); if (b.datos.rel) s.add(b.datos.rel); }); return [...s]; }
function setB(k, v) { const r = clone(curBal()); if (k === "no") r.acta_no = v; else r.datos[k] = v; putBal(r); }
function addItem(k) { const i = $("in_" + k); const v = i.value.trim(); if (!v) return; const r = clone(curBal()); r.datos[k].push(k === "asis" ? v.toUpperCase() : v); putBal(r); setTimeout(() => $("in_" + k) && $("in_" + k).focus(), 60); }
function rmItem(k, i) { const r = clone(curBal()); r.datos[k].splice(i, 1); putBal(r); }
function addAsis(n) { const r = clone(curBal()); if (!r.datos.asis.includes(n)) r.datos.asis.push(n); putBal(r); }
function addComp() { const a = $("cA").value.trim(); if (!a) { $("cE").textContent = "Escribe el compromiso."; return; } const r = clone(curBal()); r.datos.comp.push({ a, i: $("cI").value, f: $("cF").value, r: $("cR").value.trim() }); putBal(r); }
function importAspects() {
  const r = clone(curBal()); let n = 0;
  consSims(r).forEach(s => { const b = balOf(s.id); if (!b) return; ["fav", "mej"].forEach(k => (b.datos[k] || []).forEach(x => { if (!r.datos[k].includes(x)) { r.datos[k].push(x); n++; } })); });
  if (!n) { toast("Los balances individuales no tienen aspectos nuevos para traer."); return; }
  putBal(r); toast(n === 1 ? "Se agregó 1 aspecto." : `Se agregaron ${n} aspectos.`);
}
function delBal() {
  const kind = balKind(), id = UI().balId;
  needKey(() => confirmar("¿Eliminar este balance?", "Se eliminarán las notas de la reunión y el acta en todos los equipos. Podrás restaurarlo desde la papelera de Ajustes.",
    () => { const r = clone(kind === "cons" ? St().cons[id] : St().bal[id]); r.eliminado = true; Store.put(kind === "cons" ? "cons" : "bal", r); UI().balId = null; toast("Balance enviado a la papelera."); render(); }));
}
function listBlock(key, title, ph) {
  const b = curBal().datos;
  return `<div class="sec"><h3>${title}</h3>${b[key].map((x, i) => `<div class="li"><span>${esc(x)}</span><button class="btn btn-ghost small" onclick="rmItem('${key}',${i})">Quitar</button></div>`).join("") || `<p class="small muted" style="margin:8px 0 0">Aún no hay elementos.</p>`}
  <div class="addrow"><input id="in_${key}" placeholder="${esc(ph)}" onkeydown="if(event.key==='Enter')addItem('${key}')"><button class="btn" onclick="addItem('${key}')">Agregar</button></div></div>`;
}
function viewBalForm() {
  const row = curBal(), cons = balKind() === "cons";
  if (!row) { UI().balId = null; return viewBal(); }
  const h = cons ? null : St().sims[UI().balId];
  if (!cons && !h) { UI().balId = null; return viewBal(); }
  const b = row.datos, [st, c] = stBadge(row), kp = knownPeople().filter(n => !b.asis.includes(n));
  const sims = cons ? consSims(row) : [];
  const titulo = cons ? `Balance de ${sims.length} simulacros` : `Balance del ${fmtShort(h.fecha)}`;
  const resultados = cons ? `<ul style="margin:0;padding-left:18px">${resumenCons(row).map(x => `<li style="margin-bottom:4px">${esc(x)}</li>`).join("")}</ul>` : `<p style="margin:0">${esc(resumen(h.id))}</p>`;
  return `<button class="btn btn-ghost" style="margin-top:12px;padding-left:0" onclick="UI().balId=null;Store.save();render()">‹ Balance</button>
  <div class="row"><h1>${titulo}</h1><span class="bd ${c}">${st}</span></div>
  ${cons ? `<p class="muted small" style="margin:4px 0 0">${sims.map(s => `${lab(s)} · ${esc(s.tipo)}`).join(" / ")}</p>` : ""}
  <p class="muted small" style="margin:4px 0 0">Todo se guarda a medida que escribes. El acta se genera con la clave de informes.</p>
  <div class="sec"><h3>Datos de la reunión</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div><label class="lbl" for="b1">Acta No.</label><input id="b1" value="${esc(row.acta_no || "")}" onchange="setB('no',this.value)"></div>
    <div><label class="lbl" for="b2">Modalidad</label><select id="b2" onchange="setB('mod',this.value)">${["Presencial", "Virtual", "Mixta"].map(m => `<option ${m === b.mod ? "selected" : ""}>${m}</option>`).join("")}</select></div>
    <div><label class="lbl" for="b3">Fecha</label><input id="b3" type="date" value="${b.fecha}" onchange="setB('fecha',this.value)"></div>
    <div><label class="lbl" for="b4">Hora</label><input id="b4" type="time" value="${b.hora}" onchange="setB('hora',this.value)"></div></div>
    <label class="lbl" for="b5">Lugar</label><input id="b5" value="${esc(b.lugar)}" placeholder="Sala de juntas" onchange="setB('lugar',this.value)">
    <label class="lbl" for="b6">Unidad</label><input id="b6" value="${esc(b.unidad)}" onchange="setB('unidad',this.value)">
    <label class="lbl" for="b7">Responsable</label><input id="b7" value="${esc(b.resp)}" onchange="setB('resp',this.value.toUpperCase())">
    <label class="lbl" for="b8">Relator</label><input id="b8" value="${esc(b.rel)}" placeholder="Quien toma el acta" onchange="setB('rel',this.value.toUpperCase())"></div>
  <div class="sec"><h3>Asistentes</h3>${b.asis.map((x, i) => `<div class="li"><span>${esc(x)}</span><button class="btn btn-ghost small" onclick="rmItem('asis',${i})">Quitar</button></div>`).join("") || `<p class="small muted" style="margin:8px 0 0">Agrega a las personas que asistieron.</p>`}
    ${kp.length ? `<p class="small muted" style="margin:10px 0 6px">Asistentes de reuniones anteriores</p><div class="chips">${kp.map(n => `<button class="chip" onclick="addAsis('${esc(jsq(n))}')">+ ${esc(n)}</button>`).join("")}</div>` : ""}
    <div class="addrow"><input id="in_asis" placeholder="Nombre completo" onkeydown="if(event.key==='Enter')addItem('asis')"><button class="btn" onclick="addItem('asis')">Agregar</button></div></div>
  ${listBlock("obj", "Objetivo de la reunión", "Nuevo objetivo")}
  <div class="sec"><h3>Resultados ${cons ? "de los simulacros" : "del simulacro"}</h3><p class="small muted" style="margin:2px 0 6px">Se incluye${cons ? "n" : ""} automáticamente en el acta con los datos registrados.</p>${resultados}</div>
  ${cons ? `<button class="btn btn-block" style="margin-top:14px" onclick="importAspects()">Traer aspectos de los balances individuales</button>` : ""}
  ${listBlock("fav", "Aspectos favorables", "Los estudiantes siguieron las rutas señaladas")}
  ${listBlock("mej", "Aspectos por mejorar", "La alarma no se escuchó en el bloque C")}
  <div class="sec"><h3>Compromisos</h3>${b.comp.map((x, i) => `<div class="li"><span>${esc(x.a)}<span class="small muted" style="display:block">${esc(x.r || "Sin responsable")} · ${x.i ? fmtShort(x.i) : "–"} a ${x.f ? fmtShort(x.f) : "–"}</span></span><button class="btn btn-ghost small" onclick="rmItem('comp',${i})">Quitar</button></div>`).join("")}
    <label class="lbl" for="cA">Compromiso</label><input id="cA" placeholder="Revisar el sonido de la alarma en el bloque C">
    <label class="lbl" for="cR">Responsable</label><input id="cR" placeholder="Coordinación administrativa">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="lbl" for="cI">Inicio</label><input id="cI" type="date" value="${b.fecha}"></div><div><label class="lbl" for="cF">Fin</label><input id="cF" type="date"></div></div>
    <div id="cE" class="err"></div><button class="btn btn-block" style="margin-top:10px" onclick="addComp()">Agregar compromiso</button></div>
  <div class="sec"><label class="lbl" for="b9" style="margin-top:0">Fecha, hora y modalidad de la próxima reunión</label><input id="b9" value="${esc(b.prox)}" placeholder="Por definir" onchange="setB('prox',this.value)"></div>
  <div id="gE" class="err" style="text-align:center"></div>
  <button class="btn btn-primary btn-block" style="margin-top:14px;min-height:52px" onclick="genActa()">Generar acta</button>
  <button class="btn btn-block" style="margin-top:10px;color:var(--red);border-color:var(--red)" onclick="delBal()">Eliminar balance</button>`;
}
function genActa() {
  const b = curBal().datos, miss = [];
  if (!b.lugar.trim()) miss.push("el lugar"); if (!b.rel.trim()) miss.push("el relator"); if (!b.asis.length) miss.push("los asistentes");
  if (!b.fav.length && !b.mej.length) miss.push("al menos un aspecto favorable o por mejorar");
  if (miss.length) { $("gE").textContent = "Falta completar " + miss.join(", ") + "."; return; }
  needKey(showActa);
}
function hourTxt(hh) { const [a, m] = hh.split(":"); const d = new Date(); d.setHours(+a, +m, 0, 0); return fmtHour(d.getTime()); }
function actaData() {
  const row = curBal(), b = row.datos, cons = balKind() === "cons";
  return {
    no: row.acta_no || "", fechaHora: `${fmtDate(b.fecha)}, ${b.lugar.trim().toLowerCase()} a las ${hourTxt(b.hora)}`, modalidad: b.mod, unidad: b.unidad,
    responsable: b.resp, relator: b.rel, asistentes: b.asis, objetivos: b.obj, resultados: cons ? resumenCons(row) : resumen(row.simulacro_id),
    favorables: b.fav, mejoras: b.mej, compromisos: b.comp.map(c => [c.a, ddmmyyyy(c.i), ddmmyyyy(c.f), c.r]), proxima: b.prox
  };
}
function showActa() {
  const d = actaData();
  const row = clone(curBal()); row.estado = "generada"; Store.put(balKind() === "cons" ? "cons" : "bal", row);
  const asisRows = []; for (let i = 0; i < d.asistentes.length; i += 2) asisRows.push(`<tr><td class="k">${i ? "" : "ASISTENTES:"}</td><td>${esc(d.asistentes[i])}</td><td>${esc(d.asistentes[i + 1] || "")}</td></tr>`);
  const sig = [[d.responsable, "Firma Responsable"], [d.relator, "Firma Relator"], ...d.asistentes.map((n, i) => [n, "Firma Asistente " + (i + 1)])];
  let sg = ""; for (let i = 0; i < sig.length; i += 2) { const a = sig[i], c = sig[i + 1] || ["", ""]; sg += `<tr class="sg"><td colspan="2">${esc(a[0])}</td><td colspan="2">${esc(c[0])}</td></tr><tr class="sl"><td colspan="2">${a[1]}<br>Nombre completo</td><td colspan="2">${c[1] ? c[1] + "<br>Nombre completo" : ""}</td></tr>`; }
  const res = Array.isArray(d.resultados) ? `<li>Resultados de los simulacros:<ul style="list-style:circle">${d.resultados.map(x => `<li>${esc(x)}</li>`).join("")}</ul></li>` : `<li>Resultados del simulacro: ${esc(d.resultados)}</li>`;
  modal(`<div class="row"><h2>Acta No. ${esc(d.no)}</h2><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div>
  <p class="small muted">Vista previa. El Word se descarga en el formato de acta del colegio, con su logo.</p>
  <div class="acta"><table><tr><td style="width:18%;text-align:center;font-weight:bold;color:#1E3A73">[logo institucional]</td><td colspan="2" class="h" style="font-size:15px;vertical-align:middle">ACTA No. ${esc(d.no)}</td></tr>
   <tr><td class="k">FECHA Y HORA:</td><td colspan="2">${esc(d.fechaHora)}</td></tr><tr><td class="k">MODALIDAD:</td><td colspan="2">${esc(d.modalidad)}</td></tr><tr><td class="k">UNIDAD:</td><td colspan="2">${esc(d.unidad)}</td></tr>
   <tr><td class="k">RESPONSABLE:</td><td colspan="2">${esc(d.responsable)}</td></tr><tr><td class="k">RELATOR:</td><td colspan="2">${esc(d.relator)}</td></tr>${asisRows.join("")}</table>
   <table><tr><td class="h">OBJETIVO DE LA REUNIÓN</td></tr><tr><td><ul>${d.objetivos.map(o => `<li>${esc(o)}</li>`).join("")}</ul></td></tr></table>
   <table><tr><td class="h">DESARROLLO DE LOS TEMAS TRATADOS</td></tr><tr><td><ul>${res}
   ${d.favorables.length ? `<li>Aspectos favorables:<ul style="list-style:circle">${d.favorables.map(x => `<li>${esc(x)}</li>`).join("")}</ul></li>` : ""}
   ${d.mejoras.length ? `<li>Aspectos por mejorar:<ul style="list-style:circle">${d.mejoras.map(x => `<li>${esc(x)}</li>`).join("")}</ul></li>` : ""}</ul></td></tr></table>
   <table><tr><td class="h">COMPROMISOS</td><td class="h">Inicio</td><td class="h">Fin</td><td class="h">RESPONSABLE</td></tr>
   ${d.compromisos.map(x => `<tr><td>${esc(x[0])}</td><td>${x[1]}</td><td>${x[2]}</td><td>${esc(x[3])}</td></tr>`).join("") || `<tr><td colspan="4">Sin compromisos registrados.</td></tr>`}
   <tr><td class="k" style="text-align:left">FECHA, HORA Y MODALIDAD DE LA PRÓXIMA REUNIÓN:</td><td colspan="3">${esc(d.proxima || "Por definir")}</td></tr>${sg}</table></div>
  <div id="we" class="err"></div>
  <button class="btn btn-primary btn-block" style="margin-top:14px" id="wb" onclick="downloadActa()">Descargar Word</button>`);
}
async function downloadActa() {
  const b = $("wb"); b.innerHTML = '<span class="spin"></span> Generando';
  try {
    const d = actaData(), row = curBal();
    const fecha = balKind() === "cons" ? row.datos.fecha : St().sims[row.simulacro_id].fecha;
    const blob = await SimDocx.acta(await loadTemplate("acta.docx"), d);
    await deliver(blob, `Acta ${d.no} balance ${balKind() === "cons" ? "simulacros" : "simulacro"} ${fecha}.docx`);
  } catch (e) { $("we").textContent = "No se pudo generar el documento: " + e.message; }
  b.textContent = "Descargar Word";
}

/* ================= informe consolidado de varios simulacros ================= */
function consReportData(ids) {
  const sims = ids.map(i => St().sims[i]).filter(s => s && !s.eliminado).sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
  const cfg = St().cfg, n = sims.length, T = sims.map(s => totals(s.id)), D = sims.map(dur);
  const avg = D.reduce((a, b) => a + b, 0) / n, iMin = D.indexOf(Math.min(...D)), iMax = D.indexOf(Math.max(...D));
  const ritmo = Math.round(sims.reduce((a, s, i) => a + (D[i] ? T[i].T / (D[i] / 60000) : 0), 0) / n);
  const dif = D[n - 1] - D[0];
  const secs = [];
  secs.push({ titulo: "Simulacros incluidos", parrafos: [`Este informe consolida ${n} simulacros realizados ${rangoTxt(ids)}:`],
    tabla: { anchos: [1900, 1800, 2238, 1300, 1600], filas: [["Fecha", "Tipo", "Grados", "Tiempo", "Personas"], ...sims.map((s, i) => [fmtShort(s.fecha), s.tipo, gradesShort(s.grados), fmtClock(D[i]), T[i].T])] } });
  secs.push({ titulo: "Tiempos de evacuación", parrafos: [
    `El tiempo promedio de evacuación fue de ${fmtDurText(avg)}. El menor tiempo se registró el ${fmtDate(sims[iMin].fecha)}, con ${fmtDurText(D[iMin])}, y el mayor el ${fmtDate(sims[iMax].fecha)}, con ${fmtDurText(D[iMax])}.`,
    dif === 0 ? "El primer y el último simulacro del periodo registraron el mismo tiempo." : `Entre el primer y el último simulacro del periodo, el tiempo ${dif < 0 ? "se redujo" : "aumentó"} en ${fmtDurText(Math.abs(dif))}.`,
    `En promedio se evacuaron ${fmtN(ritmo)} personas por minuto. Este indicador permite comparar simulacros con distinta cantidad de grados participantes.`] });
  const cats = [["Estudiantes", "E"], ["Docentes asignados a clases", "Dc"], ["Docentes sin asignación", "Ds"], ["Personal administrativo y directivo", "A"], ["Visitantes", "V"], ["Jornada escolar complementaria", "J"], ["Otros", "O"]];
  const sum = k => T.reduce((a, t) => a + t[k], 0);
  secs.push({ titulo: "Personas evacuadas", parrafos: [`En total se registraron ${fmtN(sum("T"))} evacuaciones de personas en los ${n} simulacros, distribuidas así:`],
    tabla: { anchos: [4238, 2300, 2300], total: true, filas: [["Población", "Total acumulado", "Promedio por simulacro"], ...cats.filter(([, k]) => sum(k)).map(([nm, k]) => [nm, sum(k), Math.round(sum(k) / n)]), ["Total", sum("T"), Math.round(sum("T") / n)]] } });
  const gr = St().grados.filter(g => sims.some(s => s.grados.includes(g.id))).map(g => {
    const part = sims.filter(s => s.grados.includes(g.id));
    const e = part.map(s => estGrado(s.id, g.id));
    const d = part.map(s => cursosSueltos(s.id).filter(c => c.grado === g.id).reduce((a, c) => a + (+c.docentes || 0), 0) + espOf(s.id).filter(x => x.grado === g.id).reduce((a, x) => a + (+x.docentes || 0), 0));
    return [g.nombre, part.length, Math.round(e.reduce((a, b) => a + b, 0) / part.length), Math.round(d.reduce((a, b) => a + b, 0) / part.length)];
  });
  secs.push({ titulo: "Participación por grado", parrafos: ["Promedio de estudiantes y docentes reportados por grado en los simulacros en que participó:"],
    tabla: { anchos: [3238, 1800, 2000, 1800], filas: [["Grado", "Simulacros", "Prom. estudiantes", "Prom. docentes"], ...gr] } });
  const obs = (UI().consObs || "").split(/\n+/).map(x => x.trim()).filter(Boolean);
  if (obs.length) secs.push({ titulo: "Observaciones", parrafos: obs });
  return {
    fecha: fmtDate(today()), destinatario: cfg.destinatario, firma: cfg.firma, cargo: cfg.cargo,
    asunto: `Informe consolidado de los simulacros realizados ${rangoTxt(ids)}`,
    intro: `Por medio de la presente, compartimos los resultados consolidados de los ${n} simulacros de evacuación realizados ${rangoTxt(ids)}, con el fin de identificar la evolución de los tiempos de respuesta y la participación de la comunidad educativa.`,
    secciones: secs
  };
}
function showConsReport() {
  const ids = cmpSel().map(s => s.id);
  if (ids.length < 2) { toast("Selecciona al menos dos simulacros."); return; }
  const r = consReportData(ids);
  const tbl = t => `<table>${t.filas.map((f, i) => `<tr ${t.total && i === t.filas.length - 1 ? 'class="sum"' : ""}>${f.map(v => i === 0 ? `<th>${esc(v)}</th>` : `<td>${typeof v === "number" ? fmtN(v) : esc(v)}</td>`).join("")}</tr>`).join("")}</table>`;
  modal(`<div class="row"><h2>Informe consolidado</h2><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div>
  <label class="lbl" for="co" style="margin-top:0">Observaciones (opcional)</label>
  <textarea id="co" placeholder="Conclusiones o recomendaciones generales" onchange="UI().consObs=this.value;showConsReport()">${esc(UI().consObs || "")}</textarea>
  <p class="small muted">Vista previa. El Word se descarga con el membrete institucional.</p>
  <div class="page"><p><b>Bogotá, ${esc(r.fecha)}</b></p><br><p style="margin:0">Estimada</p><p><b>${esc(r.destinatario)}</b></p>
    <p><b>Asunto:</b> ${esc(r.asunto)}</p><p>Reciban un cordial saludo.</p><p>${esc(r.intro)}</p>
    ${r.secciones.map((s, i) => `<p><b>${i + 1}.&nbsp; ${esc(s.titulo)}</b></p>${(s.parrafos || []).map(x => `<p>${esc(x)}</p>`).join("")}${s.tabla ? tbl(s.tabla) : ""}`).join("")}
    <p>Agradecemos a los docentes, brigadistas, estudiantes y a todo el personal su compromiso y colaboración en estos ejercicios, que fortalecen la preparación de nuestra comunidad educativa frente a situaciones de emergencia.</p>
    <p style="margin-top:14px">Cordialmente,</p><br><br><p style="text-align:center;margin:0"><b>${esc(r.firma)}</b></p><p style="text-align:center"><b>${esc(r.cargo)}</b></p></div>
  <div id="we" class="err"></div>
  <button class="btn btn-primary btn-block" style="margin-top:14px" id="wb" onclick="downloadConsReport()">Descargar Word</button>`);
}
async function downloadConsReport() {
  const b = $("wb"); b.innerHTML = '<span class="spin"></span> Generando';
  try {
    const blob = await SimDocx.consolidado(await loadTemplate("circular.docx"), consReportData(cmpSel().map(s => s.id)));
    await deliver(blob, `Informe consolidado simulacros ${today()}.docx`);
  } catch (e) { $("we").textContent = "No se pudo generar el documento: " + e.message; }
  b.textContent = "Descargar Word";
}

/* ================= comparativo ================= */
const CAT = [["E", "Estudiantes", "#1E3A73"], ["D", "Docentes", "#2F8FD0"], ["A", "Administrativos", "#0B7A45"], ["V", "Visitantes", "#E0A21B"], ["J", "Jornada compl.", "#8E5BC9"], ["O", "Otros", "#8190A8"]];
let charts = {};
function cmpSel() {
  const all = closedSims();
  if (!UI().cmp) UI().cmp = { sel: all.slice(0, 6).map(h => h.id), metric: "E" };
  return all.filter(h => UI().cmp.sel.includes(h.id)).sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
}
function viewCmp() {
  const all = closedSims(), sel = cmpSel();
  let h = `<div style="padding-top:18px"><h1>Comparativo</h1><p class="muted" style="margin:4px 0 0">Elige los simulacros que quieres comparar.</p></div>`;
  if (all.length < 2) return h + `<div class="sec"><p class="muted" style="margin:0">El comparativo estará disponible cuando haya al menos dos simulacros cerrados.</p></div>`;
  h += `<div class="sec"><div class="chips">${all.map(x => `<button class="chip ${UI().cmp.sel.includes(x.id) ? "sel" : ""}" onclick="togCmp('${x.id}')">${lab(x)} · ${esc(x.tipo)}</button>`).join("")}</div>
  <div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-ghost small" onclick="UI().cmp.sel=closedSims().map(x=>x.id);Store.save();render()">Todos</button><button class="btn btn-ghost small" onclick="UI().cmp.sel=[];Store.save();render()">Ninguno</button></div></div>`;
  if (sel.length < 2) return h + `<div class="sec" style="text-align:center"><p class="muted" style="margin:0">Selecciona al menos dos simulacros para ver el comparativo.</p></div>`;
  const durs = sel.map(x => dur(x) / 1000), avg = durs.reduce((a, b) => a + b, 0) / durs.length;
  const best = sel[durs.indexOf(Math.min(...durs))], last = sel[sel.length - 1], prev = sel[sel.length - 2], dl = dur(last) - dur(prev);
  h += `<div class="kpis"><div><span>Tiempo promedio</span><b>${fmtClock(avg * 1000)}</b><small>${sel.length} simulacros</small></div>
  <div><span>Mejor tiempo</span><b>${fmtClock(Math.min(...durs) * 1000)}</b><small>${lab(best)}</small></div>
  <div><span>Último frente al anterior</span><b style="color:${dl <= 0 ? "var(--green)" : "var(--red)"}">${dl <= 0 ? "−" : "+"}${fmtClock(Math.abs(dl))}</b><small>${dl <= 0 ? "más rápido" : "más lento"}</small></div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px"><button class="btn btn-primary" onclick="needKey(showConsReport)">Informe consolidado</button><button class="btn" onclick="pickCons(cmpSel().map(s=>s.id))">Balance de estos simulacros</button></div>
  <div class="sec"><h3>Tiempo de evacuación</h3><p class="small muted" style="margin:2px 0 0">Minutos desde la alarma hasta el último reporte. La línea es el promedio.</p><div class="cbox"><canvas id="chT" role="img" aria-label="Tiempos de evacuación por simulacro"></canvas></div></div>
  <div class="sec"><h3>Personas evacuadas por población</h3><p class="small muted" style="margin:2px 0 0">Toca una categoría de la leyenda para ocultarla o mostrarla.</p><div class="cbox" style="height:300px"><canvas id="chP" role="img" aria-label="Personas evacuadas por población"></canvas></div></div>
  <div class="sec"><h3>Ritmo de evacuación</h3><p class="small muted" style="margin:2px 0 0">Personas evacuadas por minuto. Permite comparar simulacros con distinta cantidad de grados.</p><div class="cbox"><canvas id="chR" role="img" aria-label="Personas por minuto"></canvas></div></div>
  <div class="sec"><div class="row"><h3>Por grado</h3><select style="width:auto" onchange="UI().cmp.metric=this.value;Store.save();render()" aria-label="Dato"><option value="E" ${UI().cmp.metric === "E" ? "selected" : ""}>Estudiantes</option><option value="D" ${UI().cmp.metric === "D" ? "selected" : ""}>Docentes</option></select></div><p class="small muted" style="margin:2px 0 0">Los grados que no participaron en un simulacro aparecen vacíos.</p><div class="cbox" style="height:320px"><canvas id="chG" role="img" aria-label="Comparativo por grado"></canvas></div></div>
  <div class="sec"><h3>Resumen</h3><div style="overflow-x:auto"><table class="t" style="min-width:520px"><tr><th>Simulacro</th><th>Grados</th><th>Tiempo</th><th>Est.</th><th>Doc.</th><th>Adm.</th><th>Vis.</th><th>JEC y otros</th><th>Total</th></tr>${sel.map(x => { const t = totals(x.id); return `<tr><td>${lab(x)}<span class="small muted" style="display:block">${esc(x.tipo)}</span></td><td>${esc(gradesShort(x.grados))}</td><td>${fmtClock(dur(x))}</td><td>${fmtN(t.E)}</td><td>${fmtN(t.D)}</td><td>${fmtN(t.A)}</td><td>${fmtN(t.V)}</td><td>${fmtN(t.J + t.O)}</td><td><b>${fmtN(t.T)}</b></td></tr>`; }).join("")}</table></div></div>`;
  return h;
}
function togCmp(id) { const s = UI().cmp.sel; UI().cmp.sel = s.includes(id) ? s.filter(x => x !== id) : [...s, id]; Store.save(); render(); }
function drawCharts() {
  Object.values(charts).forEach(c => c.destroy()); charts = {};
  if (typeof Chart === "undefined" || !$("chT")) return;
  const sel = cmpSel(); if (sel.length < 2) return;
  const cs = getComputedStyle(document.documentElement);
  Chart.defaults.color = cs.getPropertyValue("--ink-2").trim(); Chart.defaults.borderColor = cs.getPropertyValue("--line").trim();
  Chart.defaults.font.family = '"Barlow",system-ui,sans-serif'; Chart.defaults.font.size = 12;
  const L = sel.map(lab), mins = sel.map(x => Math.round(dur(x) / 600) / 100), avg = mins.reduce((a, b) => a + b, 0) / mins.length, T = sel.map(x => totals(x.id));
  charts.t = new Chart($("chT"), { type: "bar", data: { labels: L, datasets: [{ type: "bar", label: "Tiempo", data: mins, backgroundColor: sel.map(x => x.tipo === "Sismo" ? "#2F8FD0" : x.tipo === "Incendio" ? "#C8102E" : "#1E3A73"), borderRadius: 6, maxBarThickness: 48 }, { type: "line", label: "Promedio", data: mins.map(() => Math.round(avg * 100) / 100), borderColor: "#0B7A45", borderDash: [6, 4], pointRadius: 0, borderWidth: 2 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => " " + fmtClock(c.raw * 60000) + " min" } } }, scales: { y: { beginAtZero: true, title: { display: true, text: "Minutos" } } } } });
  charts.p = new Chart($("chP"), { type: "bar", data: { labels: L, datasets: CAT.map(([k, n, c]) => ({ label: n, data: T.map(t => t[k]), backgroundColor: c, maxBarThickness: 48 })) }, options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } }, tooltip: { mode: "index", callbacks: { footer: it => "Total: " + fmtN(it.reduce((s, i) => s + i.raw, 0)) } } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { callback: v => fmtN(v) } } } } });
  charts.r = new Chart($("chR"), { type: "line", data: { labels: L, datasets: [{ label: "Personas por minuto", data: sel.map((x, i) => dur(x) ? Math.round(T[i].T / (dur(x) / 60000)) : 0), borderColor: "#1E3A73", backgroundColor: "#1E3A73", pointRadius: 5, tension: .25 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
  const pal = ["#1E3A73", "#2F8FD0", "#0B7A45", "#E0A21B", "#8E5BC9", "#C8102E", "#8190A8", "#5DCAA5"], f = UI().cmp.metric === "D" ? "docentes" : "estudiantes";
  charts.g = new Chart($("chG"), { type: "bar", data: { labels: St().grados.map(g => g.corto), datasets: sel.map((x, i) => ({ label: lab(x), backgroundColor: pal[i % pal.length], maxBarThickness: 22, data: St().grados.map(g => !x.grados.includes(g.id) ? null : f === "estudiantes" ? estGrado(x.id, g.id) : cursosSueltos(x.id).filter(c => c.grado === g.id).reduce((s, c) => s + (+c.docentes || 0), 0) + espOf(x.id).filter(z => z.grado === g.id).reduce((s, z) => s + (+z.docentes || 0), 0)) })) }, options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } }, scales: { y: { beginAtZero: true } } } });
}

/* ================= ajustes ================= */
function viewCfg() {
  const s = St();
  let h = `<div style="padding-top:18px"><h1>Ajustes</h1></div>
  <div class="sec"><h3>Tu perfil</h3><label class="lbl" for="pn">Nombre del brigadista en este equipo</label><input id="pn" value="${esc(me())}" onchange="if(this.value.trim()){Store.setName(this.value.trim().replace(/\\s+/g,' '));toast('Nombre actualizado.')}">
  <p class="small muted" style="margin:12px 0 0">${Store.pendingCount() ? Store.pendingCount() + " registros pendientes por enviar." : "No hay registros pendientes."} ${s.lastSync ? "Última sincronización: " + new Date(s.lastSync).toLocaleString("es-CO", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" }) + "." : ""}</p>
  ${s.lastError ? `<p class="err">${esc(s.lastError)}</p>` : ""}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><button class="btn" onclick="Store.sync(true).then(()=>toast('Sincronización completa.'))">Sincronizar ahora</button><button class="btn" onclick="doLogout()">Salir de este equipo</button></div></div>`;
  if (!Store.isAdmin()) return h + `<div class="sec"><h3>Configuración del colegio</h3><p class="muted">Cursos por grado, datos del informe y del acta, y especialidades. Requiere la clave de informes.</p><button class="btn btn-primary btn-block" onclick="needKey(()=>{UI().cfgEdit=null;render()})">Desbloquear configuración</button></div>` + versionTxt();
  if (!UI().cfgEdit) UI().cfgEdit = { cfg: clone(s.cfg), cursos: s.grados.map(g => g.num_cursos), esps: clone(s.esps), nuevas: [], otros: clone(s.otrosDef), otrosNew: [] };
  const e = UI().cfgEdit;
  h += `<div class="sec"><div class="row"><h3>Cursos por grado</h3><span class="small muted">${e.cursos.reduce((a, b) => a + b, 0)} cursos</span></div>${s.grados.map((g, i) => `<div class="grade"><div style="flex:1"><div style="font-weight:500">${esc(g.nombre)}</div><div class="small muted">A a ${String.fromCharCode(64 + e.cursos[i])}</div></div>${stepper(e.cursos[i], true, `((d,v)=>setCur(${i},d,v))`)}</div>`).join("")}<p class="hint">Los cambios aplican a los simulacros nuevos; los anteriores conservan sus cursos.</p></div>
  <div class="sec"><h3>Datos del informe y del acta</h3>
    <label class="lbl" for="c1">Informe dirigido a</label><input id="c1" value="${esc(e.cfg.destinatario)}" onchange="UI().cfgEdit.cfg.destinatario=this.value.toUpperCase()">
    <label class="lbl" for="c2">Firma del informe</label><input id="c2" value="${esc(e.cfg.firma)}" onchange="UI().cfgEdit.cfg.firma=this.value.toUpperCase()">
    <label class="lbl" for="c3">Cargo</label><input id="c3" value="${esc(e.cfg.cargo)}" onchange="UI().cfgEdit.cfg.cargo=this.value.toUpperCase()">
    <label class="lbl" for="c4">Unidad en el acta</label><input id="c4" value="${esc(e.cfg.unidad_acta)}" onchange="UI().cfgEdit.cfg.unidad_acta=this.value"></div>
  <div class="sec"><h3>Especialidades</h3><p class="small muted" style="margin:2px 0 0">Desactiva las que no se ofrezcan este año o elimínalas de forma definitiva. Los cambios se aplican al guardar.</p>
  ${["Tecnología", "Artes", "Educación Física"].map(area => `<p class="small muted" style="margin:14px 0 0;font-weight:600">${area}</p>${e.esps.filter(x => x.area === area && !x._del).map(x => `<div class="grade ${x.activo ? "" : "off"}"><button class="sw ${x.activo ? "" : "off"}" role="switch" aria-checked="${x.activo}" aria-label="${esc(x.nombre)}" onclick="togEsp(${x.id})"></button><div style="flex:1"><div class="gname">${esc(x.nombre)}</div><div class="small muted">${esc(gShort(x.grado_min))} a ${esc(gShort(x.grado_max))}${x.requiere_cursos ? ", con selección de cursos" : ""}</div></div><button class="btn btn-ghost small" onclick="delEspCat(${x.id})">Eliminar</button></div>`).join("")}`).join("")}
  ${e.nuevas.map((x, i) => `<div class="li"><span>${esc(x.area)} · ${esc(x.nombre)}<span class="small muted" style="display:block">${gShort(x.grado_min)} a ${gShort(x.grado_max)}</span></span><button class="btn btn-ghost small" onclick="UI().cfgEdit.nuevas.splice(${i},1);render()">Quitar</button></div>`).join("")}
  <p class="small muted" style="margin:16px 0 0;font-weight:600">Agregar especialidad</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="lbl" for="na">Área</label><select id="na"><option>Tecnología</option><option>Artes</option><option>Educación Física</option></select></div><div><label class="lbl" for="nn">Nombre</label><input id="nn" placeholder="Robótica"></div>
  <div><label class="lbl" for="n1">Desde</label><select id="n1">${s.grados.map(g => `<option value="${g.id}">${esc(g.nombre)}</option>`).join("")}</select></div><div><label class="lbl" for="n2">Hasta</label><select id="n2">${s.grados.map(g => `<option value="${g.id}" ${g.id === 11 ? "selected" : ""}>${esc(g.nombre)}</option>`).join("")}</select></div></div>
  <label class="chk"><input type="checkbox" id="nr" checked> Pedir los cursos que conforman el grupo</label><div id="ne2" class="err"></div>
  <button class="btn btn-block" style="margin-top:10px" onclick="addNewEsp()">Agregar a la lista</button></div>
  <div class="sec"><h3>Categorías de otras personas</h3><p class="small muted" style="margin:2px 0 0">Aparecen en cada simulacro nuevo. Los simulacros anteriores conservan las suyas.</p>
  ${e.otros.filter(o => !o._del).map((o, i) => `<div class="li"><span>${esc(o.nombre)}<span class="small muted" style="display:block">Suma en ${GROUPS[o.grupo].toLowerCase()}</span></span>${o.id != null ? `<button class="btn btn-ghost small" onclick="delOtroDef(${o.id})">Eliminar</button>` : `<span class="small muted">Por enviar</span>`}</div>`).join("")}
  ${e.otrosNew.map((o, i) => `<div class="li"><span>${esc(o.nombre)}<span class="small muted" style="display:block">Nueva · suma en ${GROUPS[o.grupo].toLowerCase()}</span></span><button class="btn btn-ghost small" onclick="UI().cfgEdit.otrosNew.splice(${i},1);render()">Quitar</button></div>`).join("")}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="lbl" for="on">Nombre</label><input id="on" placeholder="PMU"></div><div><label class="lbl" for="og">Se suma en</label><select id="og">${Object.entries(GROUPS).map(([k, v]) => `<option value="${k}" ${k === "O" ? "selected" : ""}>${v}</option>`).join("")}</select></div></div>
  <div id="oe" class="err"></div><button class="btn btn-block" style="margin-top:10px" onclick="addOtroDef()">Agregar a la lista</button></div>
  <div id="se" class="err" style="text-align:center"></div>
  <button class="btn btn-primary btn-block" style="margin-top:14px;min-height:52px" id="sb" onclick="saveCfg()">Guardar ajustes</button>
  ${viewTrash()}
  <div class="sec"><h3>Claves</h3><p class="muted small" style="margin:0">El código de acceso y la clave de informes se cambian directamente en la base de datos. Los equipos toman la nueva clave en su siguiente conexión.</p></div>`;
  return h + versionTxt();
}
function viewTrash() {
  const sims = deletedSims(), bals = Object.values(St().bal).filter(b => b.eliminado && St().sims[b.simulacro_id]), cons = Object.values(St().cons).filter(c => c.eliminado);
  const items = [
    ...sims.map(x => `<div class="li"><span>Simulacro del ${fmtShort(x.fecha)}<span class="small muted" style="display:block">${esc(x.tipo)}, ${esc(gradesShort(x.grados))}</span></span><button class="btn btn-ghost small" onclick="restoreSim('${x.id}')">Restaurar</button></div>`),
    ...bals.map(b => `<div class="li"><span>Balance del simulacro del ${fmtShort(St().sims[b.simulacro_id].fecha)}${b.acta_no ? `<span class="small muted" style="display:block">Acta No. ${esc(b.acta_no)}</span>` : ""}</span><button class="btn btn-ghost small" onclick="restoreBal('bal','${b.simulacro_id}')">Restaurar</button></div>`),
    ...cons.map(c => `<div class="li"><span>Balance de ${c.simulacros.length} simulacros${c.acta_no ? `<span class="small muted" style="display:block">Acta No. ${esc(c.acta_no)}</span>` : ""}</span><button class="btn btn-ghost small" onclick="restoreBal('cons','${c.id}')">Restaurar</button></div>`)];
  return `<div class="sec"><h3>Papelera</h3><p class="small muted" style="margin:2px 0 0">Simulacros y balances eliminados. Al restaurarlos vuelven a aparecer en todos los equipos.</p>${items.join("") || `<p class="small muted" style="margin:8px 0 0">La papelera está vacía.</p>`}</div>`;
}
function restoreBal(kind, id) { needKey(() => { const r = clone(St()[kind][id]); r.eliminado = false; Store.put(kind, r); toast("Balance restaurado."); }); }
function versionTxt() { return `<p class="hint" style="text-align:center;margin-top:18px">Simulacro ${esc(SIM_CONFIG.version)}</p>`; }
function setCur(i, d, v) { const e = UI().cfgEdit; const n = d ? e.cursos[i] + d : (parseInt(v, 10) || 1); e.cursos[i] = Math.min(26, Math.max(1, n)); render(); }
function delEspCat(id) { const x = UI().cfgEdit.esps.find(z => z.id === id); confirmar("¿Eliminar esta especialidad?", `${esc(x.area)} · ${esc(x.nombre)} dejará de aparecer para seleccionar. Los simulacros anteriores conservan sus grupos. Se aplica al guardar los ajustes.`, () => { x._del = true; render(); }); }
function delOtroDef(id) { const o = UI().cfgEdit.otros.find(z => z.id === id); confirmar("¿Eliminar esta categoría?", `${esc(o.nombre)} dejará de aparecer en los simulacros nuevos. Se aplica al guardar los ajustes.`, () => { o._del = true; render(); }); }
function addOtroDef() {
  const n = $("on").value.trim(), e = UI().cfgEdit;
  if (!n) { $("oe").textContent = "Escribe el nombre."; return; }
  if ([...e.otros.filter(o => !o._del), ...e.otrosNew].some(o => o.nombre.toLowerCase() === n.toLowerCase())) { $("oe").textContent = "Esa categoría ya existe."; return; }
  e.otrosNew.push({ nombre: n, grupo: $("og").value }); render();
}
function togEsp(id) { const x = UI().cfgEdit.esps.find(z => z.id === id); x.activo = !x.activo; render(); }
function addNewEsp() {
  const n = $("nn").value.trim(), a = +$("n1").value, b = +$("n2").value;
  if (!n) { $("ne2").textContent = "Escribe el nombre."; return; }
  if (b < a) { $("ne2").textContent = "El grado final debe ser igual o posterior al inicial."; return; }
  UI().cfgEdit.nuevas.push({ area: $("na").value, nombre: n, grado_min: a, grado_max: b, requiere_cursos: $("nr").checked, activo: true, orden: 99 }); render();
}
async function saveCfg() {
  if (!Store.isAdmin()) { needKey(saveCfg); return; }
  const e = UI().cfgEdit, s = St(), b = $("sb");
  const changedEsp = e.esps.filter(x => { const o = s.esps.find(z => z.id === x.id); return x._del || !o || o.activo !== x.activo; })
    .map(x => ({ id: x.id, area: x.area, nombre: x.nombre, grado_min: x.grado_min, grado_max: x.grado_max, requiere_cursos: x.requiere_cursos, activo: x.activo, orden: x.orden, eliminar: !!x._del }));
  const payload = { autor: me(), config: e.cfg, grados: s.grados.map((g, i) => ({ id: g.id, num_cursos: e.cursos[i] })), especialidades: changedEsp.concat(e.nuevas),
    otros_default: e.otros.filter(o => o._del && o.id != null).map(o => ({ id: o.id, eliminar: true })).concat(e.otrosNew) };
  b.innerHTML = '<span class="spin"></span> Guardando';
  try {
    const r = await Store.rpc("sim_guardar_ajustes", { p_codigo: s.session.codigo, p_clave_informes: Store.adminKey, p_datos: payload });
    if (!r || !r.ok) { $("se").textContent = r && r.error === "clave_informes" ? "La clave de informes cambió. Vuelve a desbloquear." : "No se pudieron guardar los ajustes."; b.textContent = "Guardar ajustes"; return; }
    // Las especialidades inactivas no llegan en el catálogo; se conservan en la edición
    const c = await Store.rpc("sim_ingresar", { p_codigo: s.session.codigo });
    if (c && c.ok) Store.applyCatalog(c);
    UI().cfgEdit = null; Store.save(); toast("Ajustes guardados."); render();
  } catch (err) { $("se").textContent = err.offline ? "Sin conexión. Los ajustes necesitan internet para guardarse." : err.message; b.textContent = "Guardar ajustes"; }
}
function doLogout() {
  const p = Store.pendingCount();
  modal(`<h2>¿Salir de este equipo?</h2><p class="muted">${p ? `Hay ${p} registros pendientes. Quedan guardados en este equipo y se enviarán cuando alguien vuelva a ingresar.` : "Tendrás que escribir de nuevo el código de acceso para ingresar."}</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="closeModal();Store.logout();render()">Salir</button></div>`);
}

/* ================= reloj, eventos e inicio ================= */
function tick() {
  const a = activeSim(); const el = $("clk");
  if (el && a && a.estado === "en_curso") el.textContent = fmtClock(Date.now() - new Date(a.inicio));
  const f = $("fclk"); if (f && a) f.textContent = fmtClock(Date.now() - new Date(a.inicio));
}
setInterval(tick, 500);
setInterval(() => { if (St() && St().session) renderTop(); }, 5000);

function showUpdate(worker) {
  $("bannerBox").innerHTML = `<div class="banner"><span>Hay una versión nueva de la app.</span><button onclick="this.disabled=true;window.__sw&&window.__sw.postMessage('skipWaiting')">Actualizar</button></div>`;
  window.__sw = worker;
}
async function init() {
  await Store.load();
  Store.on(kind => {
    if (kind === "codigo") { UI().loginMsg = "El código de acceso cambió. Ingresa el nuevo código."; render(); return; }
    if (kind === "login" || kind === "logout") { render(); return; }
    if (kind && kind.tomado) { toast(`${gName(kind.tomado.id)} ya lo tiene ${kind.tomado.por}.`); }
    if (kind === "net") { toast(St().online ? "Conexión recuperada. Enviando registros pendientes…" : "Sin conexión. Los registros se guardan en este equipo."); }
    if (kind === "sync-quiet") { renderTop(); return; }
    softRender();
  });
  render();
  if (St().session) { Store.sync(true); Store.loop(); }
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.register("sw.js");
      const watch = w => w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) showUpdate(w); });
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => watch(reg.installing));
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; location.reload(); } });
    } catch (e) { console.warn("Service worker no registrado", e); }
  }
}
init();
