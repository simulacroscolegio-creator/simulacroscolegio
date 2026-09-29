/* Simulacro · generación de documentos Word sobre las plantillas institucionales.
   Funciona en el navegador (window.JSZip) y en Node (require('jszip')) para pruebas. */
(function (root) {
  "use strict";
  const JSZipLib = root.JSZip || (typeof require === "function" ? require("jszip") : null);
  const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const esc = t => String(t == null ? "" : t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fmtN = n => Number(n || 0).toLocaleString("es-CO");

  /* ---------------- circular (informe del simulacro) ---------------- */
  const F = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>';
  function run(t, b, sz) {
    sz = sz || 20;
    return `<w:r><w:rPr>${F}${b ? "<w:b/><w:bCs/>" : ""}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="es-CO"/></w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
  }
  function p(parts, o) {
    o = o || {};
    if (typeof parts === "string") parts = [[parts, false]];
    return `<w:p><w:pPr>${o.keep ? "<w:keepNext/>" : ""}<w:spacing w:after="${o.after == null ? 120 : o.after}"/><w:jc w:val="${o.jc || "both"}"/></w:pPr>${parts.map(x => run(x[0], x[1])).join("")}</w:p>`;
  }
  const empty = '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
  function cell(t, w, bold, fill, jc) {
    const sh = fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : "";
    return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${sh}<w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="${jc}"/></w:pPr>${run(t, bold, 18)}</w:p></w:tc>`;
  }
  function table(widths, rows) {
    const borders = "<w:tblBorders>" + ["top", "left", "bottom", "right", "insideH", "insideV"]
      .map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/>`).join("") + "</w:tblBorders>";
    let x = `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:jc w:val="center"/>${borders}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;
    rows.forEach((r, i) => {
      const head = i === 0, last = i === rows.length - 1;
      x += `<w:tr><w:trPr>${head ? "<w:tblHeader/>" : ""}<w:cantSplit/></w:trPr>` +
        r.map((v, j) => cell(typeof v === "number" ? fmtN(v) : v, widths[j], head || last,
          head ? "D9E2F3" : (last ? "F2F2F2" : null), j === 0 ? "left" : "center")).join("") + "</w:tr>";
    });
    return x + "</w:tbl>";
  }

  /* d = { fecha, destinatario, asunto, intro, desarrollo, totalTxt,
           poblacion:[[nombre,n]...], total, grados:[[grado,cursos,est,doc]...],
           totGrados:[cursos,est,doc], notas, firma, cargo } */
  function bodyCircular(d) {
    const b = [];
    b.push(p([[`Bogotá, ${d.fecha}`, true]], { after: 0 }));
    b.push(empty, empty);
    b.push(p("Estimada", { after: 0, jc: "left" }));
    b.push(p([[d.destinatario, true]], { jc: "left" }));
    b.push(empty);
    b.push(p([["Asunto: ", true], [d.asunto, false]]));
    b.push(empty);
    b.push(p("Reciban un cordial saludo."));
    b.push(p(d.intro));
    b.push(p([["1.  Desarrollo del simulacro", true]], { keep: true }));
    b.push(p(d.desarrollo));
    b.push(p([["2.  Personas evacuadas", true]], { keep: true }));
    b.push(p(d.totalTxt, { keep: true }));
    b.push(table([5838, 3000], [["Población", "Cantidad"], ...d.poblacion, ["Total", d.total]]));
    b.push(empty);
    b.push(p([["3.  Reporte por grado", true]], { keep: true }));
    b.push(p("El conteo de estudiantes y docentes realizado en el punto de encuentro, por grado, fue el siguiente:", { keep: true }));
    b.push(table([3838, 1500, 1900, 1600], [["Grado", "Cursos", "Estudiantes", "Docentes"], ...d.grados, ["Total", ...d.totGrados]]));
    b.push(empty);
    if (d.notas && d.notas.trim()) {
      b.push(p([["4.  Observaciones", true]], { keep: true }));
      d.notas.split(/\n+/).filter(x => x.trim()).forEach(t => b.push(p(t.trim())));
    }
    b.push(p("Agradecemos a los docentes, brigadistas, estudiantes y a todo el personal su compromiso y colaboración durante el desarrollo de este ejercicio, que fortalece la preparación de nuestra comunidad educativa frente a situaciones de emergencia."));
    b.push(empty);
    b.push(p("Cordialmente,", { jc: "left" }));
    b.push(empty, empty, empty, empty);
    b.push(p([[d.firma, true]], { jc: "center", after: 0 }));
    b.push(p([[d.cargo, true]], { jc: "center", after: 0 }));
    return b.join("");
  }

  /* Informe por secciones (se usa para el consolidado de varios simulacros)
     d = { fecha, destinatario, asunto, intro, firma, cargo,
           secciones:[{ titulo, parrafos:[], tabla:{ anchos:[], filas:[[...]] } }] }
     La primera fila de la tabla es el encabezado y la última se resalta como total si total:true */
  function bodySecciones(d) {
    const b = [];
    b.push(p([[`Bogotá, ${d.fecha}`, true]], { after: 0 }));
    b.push(empty, empty);
    b.push(p("Estimada", { after: 0, jc: "left" }));
    b.push(p([[d.destinatario, true]], { jc: "left" }));
    b.push(empty);
    b.push(p([["Asunto: ", true], [d.asunto, false]]));
    b.push(empty);
    b.push(p("Reciban un cordial saludo."));
    b.push(p(d.intro));
    d.secciones.forEach((sec, i) => {
      b.push(p([[`${i + 1}.  ${sec.titulo}`, true]], { keep: true }));
      (sec.parrafos || []).forEach((t, j) => b.push(p(t, { keep: !!sec.tabla && j === sec.parrafos.length - 1 })));
      if (sec.tabla) { b.push(tableGen(sec.tabla.anchos, sec.tabla.filas, sec.tabla.total)); b.push(empty); }
    });
    b.push(p("Agradecemos a los docentes, brigadistas, estudiantes y a todo el personal su compromiso y colaboración en estos ejercicios, que fortalecen la preparación de nuestra comunidad educativa frente a situaciones de emergencia."));
    b.push(empty);
    b.push(p("Cordialmente,", { jc: "left" }));
    b.push(empty, empty, empty, empty);
    b.push(p([[d.firma, true]], { jc: "center", after: 0 }));
    b.push(p([[d.cargo, true]], { jc: "center", after: 0 }));
    return b.join("");
  }
  function tableGen(widths, rows, total) {
    const borders = "<w:tblBorders>" + ["top", "left", "bottom", "right", "insideH", "insideV"]
      .map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/>`).join("") + "</w:tblBorders>";
    let x = `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:jc w:val="center"/>${borders}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;
    rows.forEach((r, i) => {
      const head = i === 0, last = total && i === rows.length - 1;
      x += `<w:tr><w:trPr>${head ? "<w:tblHeader/>" : ""}<w:cantSplit/></w:trPr>` +
        r.map((v, j) => cell(typeof v === "number" ? fmtN(v) : v, widths[j], head || last,
          head ? "D9E2F3" : (last ? "F2F2F2" : null), j === 0 ? "left" : "center")).join("") + "</w:tr>";
    });
    return x + "</w:tbl>";
  }

  async function withBody(template, body) {
    const zip = await JSZipLib.loadAsync(template);
    const src = await zip.file("word/document.xml").async("string");
    const a = src.indexOf("<w:body>") + "<w:body>".length;
    const s = src.lastIndexOf("<w:sectPr");
    zip.file("word/document.xml", src.slice(0, a) + body + src.slice(s));
    return zip.generateAsync({ type: typeof window !== "undefined" ? "blob" : "nodebuffer", mimeType: DOCX_MIME, compression: "DEFLATE" });
  }
  const circular = (template, d) => withBody(template, bodyCircular(d));
  const consolidado = (template, d) => withBody(template, bodySecciones(d));

  /* ---------------- acta (balance de la reunión) ---------------- */
  const reAll = (re, x) => x.match(re) || [];
  const paras = x => reAll(/<w:p[ >][\s\S]*?<\/w:p>/g, x);
  const cells = row => reAll(/<w:tc>[\s\S]*?<\/w:tc>/g, row);
  const rows = t => reAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g, t);

  function setP(par, text) {
    const pprM = par.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    const ppr = pprM ? pprM[0] : "";
    const head = par.match(/^<w:p(?:\s[^>]*)?>/)[0];
    let rpr = "";
    const rm = par.match(/<w:r>(?:<w:rPr>([\s\S]*?)<\/w:rPr>)?/);
    if (rm && rm[1] != null) rpr = rm[1];
    else { const m2 = ppr.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/); rpr = m2 ? m2[1] : ""; }
    return `${head}${ppr}<w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
  }
  function setCell(c, text) {
    const ps = paras(c);
    const withText = ps.filter(x => x.indexOf("<w:t") >= 0);
    const base = withText[0] || ps[0];
    const first = c.indexOf(ps[0]), lastP = ps[ps.length - 1], last = c.indexOf(lastP) + lastP.length;
    return c.slice(0, first) + setP(base, text) + c.slice(last);
  }
  function setRow(row, vals) {
    const cs = cells(row);
    let out = row;
    Object.keys(vals).forEach(i => { out = out.replace(cs[i], () => setCell(cs[i], vals[i])); });
    return out;
  }
  function replaceCellParas(cellXml, inner) {
    const ps = paras(cellXml);
    const a = cellXml.indexOf(ps[0]), lp = ps[ps.length - 1], z = cellXml.indexOf(lp) + lp.length;
    return cellXml.slice(0, a) + inner + cellXml.slice(z);
  }
  function centerP(par) {
    const m = par.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    if (!m) return par;
    let q = m[0].replace(/<w:jc w:val="[^"]*"\/>/g, "");
    q = q.indexOf("<w:rPr>") >= 0 ? q.replace("<w:rPr>", '<w:jc w:val="center"/><w:rPr>') : q.replace("</w:pPr>", '<w:jc w:val="center"/></w:pPr>');
    return par.replace(m[0], () => q);
  }

  /* d = { no, fechaHora, modalidad, unidad, responsable, relator, asistentes:[],
           objetivos:[], resultados, favorables:[], mejoras:[],
           compromisos:[[accion,inicio,fin,responsable]], proxima } */
  async function acta(template, d) {
    const zip = await JSZipLib.loadAsync(template);
    const X = await zip.file("word/document.xml").async("string");
    const tb = reAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g, X);
    if (tb.length < 4) throw new Error("La plantilla del acta no tiene la estructura esperada.");

    // Tabla 1: encabezado y asistentes
    let t = tb[0], R = rows(t);
    let r0 = setRow(R[0], { 1: `ACTA No. ${d.no}` });
    const c1 = cells(r0)[1], tp = paras(c1).filter(x => x.indexOf("ACTA No") >= 0)[0];
    r0 = r0.replace(tp, () => centerP(tp));
    const n1 = [r0];
    ["fechaHora", "modalidad", "unidad", "responsable", "relator"].forEach((k, i) => n1.push(setRow(R[i + 1], { 1: d[k] || "" })));
    const as = d.asistentes.length ? d.asistentes : [""];
    for (let i = 0; i < as.length; i += 2) {
      const base = i === 0 ? R[6] : R[7];
      const v = { 1: as[i], 2: as[i + 1] || "" };
      if (i > 0) v[0] = "";
      n1.push(setRow(base, v));
    }
    const t1 = t.slice(0, t.indexOf(R[0])) + n1.join("") + t.slice(t.indexOf(R[R.length - 1]) + R[R.length - 1].length);

    // Tabla 2: objetivos
    t = tb[1]; R = rows(t);
    const oc = cells(R[1])[0], ob = paras(R[1]).filter(x => x.indexOf("<w:numPr>") >= 0)[0] || paras(R[1])[0];
    const t2 = t.replace(oc, () => replaceCellParas(oc, d.objetivos.map(o => setP(ob, o)).join("")));

    // Tabla 3: desarrollo
    t = tb[2]; R = rows(t);
    const ps = paras(R[1]);
    const l0 = ps.filter(x => x.indexOf('<w:ilvl w:val="0"/>') >= 0)[0];
    const l1 = ps.filter(x => x.indexOf('<w:ilvl w:val="1"/>') >= 0)[0] || l0;
    const sp = ps.filter(x => x.indexOf("<w:t") < 0)[0] || "";
    let inner = Array.isArray(d.resultados)
      ? setP(l0, "Resultados de los simulacros:") + d.resultados.map(x => setP(l1, x)).join("")
      : setP(l0, "Resultados del simulacro: " + d.resultados);
    if (d.favorables.length) inner += sp + setP(l0, "Aspectos favorables:") + d.favorables.map(x => setP(l1, x)).join("");
    if (d.mejoras.length) inner += sp + setP(l0, "Aspectos por mejorar:") + d.mejoras.map(x => setP(l1, x)).join("");
    const dc = cells(R[1])[0];
    const t3 = t.replace(dc, () => replaceCellParas(dc, inner));

    // Tabla 4: compromisos, próxima reunión y firmas
    t = tb[3]; R = rows(t);
    const n4 = [R[0]];
    const comps = d.compromisos.length ? d.compromisos : [["Sin compromisos registrados.", "", "", ""]];
    comps.forEach(c => n4.push(setRow(R[1], { 0: c[0], 1: c[1], 2: c[2], 3: c[3] })));
    n4.push(setRow(R[3], { 1: d.proxima || "Por definir" }));
    const signers = [[d.responsable, "Firma Responsable"], [d.relator, "Firma Relator"]]
      .concat(d.asistentes.map((n, i) => [n, "Firma Asistente " + (i + 1)]));
    const label = (row, vals) => {
      const cs = cells(row); let out = row;
      Object.keys(vals).forEach(i => {
        const p0 = paras(cs[i])[0];
        out = out.replace(cs[i], () => vals[i] ? cs[i].replace(p0, () => setP(p0, vals[i])) : setCell(cs[i], ""));
      });
      return out;
    };
    for (let k = 0; k < signers.length; k += 2) {
      const a = signers[k], b = signers[k + 1] || ["", ""];
      n4.push(setRow(R[4], { 0: a[0], 1: b[0] }).replace(/<w:pPr>/g, "<w:pPr><w:keepNext/>"));
      n4.push(label(R[5], { 0: a[1], 1: b[1] }));
    }
    const t4 = t.slice(0, t.indexOf(R[0])) + n4.join("") + t.slice(t.indexOf(R[R.length - 1]) + R[R.length - 1].length);

    let Y = X;
    [[tb[0], t1], [tb[1], t2], [tb[2], t3], [tb[3], t4]].forEach(([a, b]) => { Y = Y.replace(a, () => b); });
    zip.file("word/document.xml", Y);
    return zip.generateAsync({ type: typeof window !== "undefined" ? "blob" : "nodebuffer", mimeType: DOCX_MIME, compression: "DEFLATE" });
  }

  const api = { circular, consolidado, acta };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SimDocx = api;
})(typeof window !== "undefined" ? window : globalThis);
