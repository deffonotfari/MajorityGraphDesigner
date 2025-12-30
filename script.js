document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("graph-canvas");
  const ctx = canvas.getContext("2d");

  const nodeForm = document.getElementById("node-form");
  const nodeLabelInput = document.getElementById("node-label");

  const edgeForm = document.getElementById("edge-form");
  const fromSelect = document.getElementById("from-node");
  const toSelect = document.getElementById("to-node");

  const edgesBody = document.getElementById("edges-body");

  const downloadJpgButton = document.getElementById("download-jpg");
  const downloadPngButton = document.getElementById("download-png");
  const downloadSvgButton = document.getElementById("download-svg");
  const clearButton = document.getElementById("clear-graph");

  const saveButton = document.getElementById("save-graph");
  const loadButton = document.getElementById("load-graph");
  const loadFileInput = document.getElementById("load-file");

  const NODE_RADIUS = 25;

  let nodes = []; // { id, label, x, y }
  let edges = []; // { id, fromId, toId }
  let nextNodeId = 1;
  let nextEdgeId = 1;

  // ----- Tabs -----
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;

      tabButtons.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(target).classList.add("active");
    });
  });

  // -------- Node Handling --------
  nodeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const label = nodeLabelInput.value.trim();
    if (!label) return;

    addNode(label);
    nodeLabelInput.value = "";
  });

  function addNode(label) {
    const id = nextNodeId++;
    nodes.push({ id, label, x: 0, y: 0 });
    layoutNodes();
    updateNodeSelects();
    redraw();
    refreshEdgeTable();
  }

  // -------- Edges --------
  edgeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fromId = parseInt(fromSelect.value, 10);
    const toId = parseInt(toSelect.value, 10);
    if (Number.isNaN(fromId) || Number.isNaN(toId)) return;

    addEdge(fromId, toId);
  });

  function addEdge(fromId, toId) {
    edges.push({ id: nextEdgeId++, fromId, toId });
    redraw();
    refreshEdgeTable();
  }

  function updateNodeSelects() {
    [fromSelect, toSelect].forEach((select) => {
      const current = select.value;
      select.innerHTML = '<option value="">—</option>';

      nodes.forEach((node) => {
        const opt = document.createElement("option");
        opt.value = node.id;
        opt.textContent = node.label;
        select.appendChild(opt);
      });

      if (current) select.value = current;
    });
  }

  // -------- Edge Table (editable) --------
  function refreshEdgeTable() {
    edgesBody.innerHTML = "";

    edges.forEach((edge) => {
      const row = document.createElement("tr");

      const fromCell = document.createElement("td");
      const fromSel = makeNodeSelect(edge.fromId, (newVal) => {
        edge.fromId = newVal;
        redraw();
      });
      fromCell.appendChild(fromSel);

      const toCell = document.createElement("td");
      const toSel = makeNodeSelect(edge.toId, (newVal) => {
        edge.toId = newVal;
        redraw();
      });
      toCell.appendChild(toSel);

      const actionsCell = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.onclick = () => {
        edges = edges.filter((e) => e.id !== edge.id);
        redraw();
        refreshEdgeTable();
      };
      actionsCell.appendChild(delBtn);

      row.appendChild(fromCell);
      row.appendChild(toCell);
      row.appendChild(actionsCell);
      edgesBody.appendChild(row);
    });
  }

  function makeNodeSelect(selectedId, onChange) {
    const select = document.createElement("select");
    nodes.forEach((n) => {
      const opt = document.createElement("option");
      opt.value = n.id;
      opt.textContent = n.label;
      if (n.id === selectedId) opt.selected = true;
      select.appendChild(opt);
    });
    select.onchange = (e) => onChange(parseInt(e.target.value, 10));
    return select;
  }

  // -------- LaTeX-like handling --------
  function normalizeLatex(text) {
    // \frac{a}{b} -> (a)/(b) for simple on-canvas layout
    return text.replace(/\\frac\s*{([^}]+)}\s*{([^}]+)}/g, "($1)/($2)");
  }

  function parseRich(label) {
    const parts = [];
    let i = 0;
    while (i < label.length) {
      const ch = label[i];

      if (ch === "_" || ch === "^") {
        const type = ch === "_" ? "sub" : "sup";
        i++;

        if (label[i] === "{") {
          i++;
          let buf = "";
          while (i < label.length && label[i] !== "}") buf += label[i++];
          i++; // skip }
          if (buf) parts.push({ text: buf, type });
        } else {
          const t = label[i] ?? "";
          if (t) parts.push({ text: t, type });
          i++;
        }
      } else {
        let buf = ch;
        i++;
        while (i < label.length && label[i] !== "_" && label[i] !== "^") {
          buf += label[i++];
        }
        parts.push({ text: buf, type: "normal" });
      }
    }
    return parts;
  }

  function drawRichText(text, x, y) {
    const parsed = parseRich(text);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    const baseFont = 18;
    const smallFont = 14;
    const offset = 7;

    let totalWidth = 0;
    parsed.forEach((p) => {
      ctx.font = `${p.type === "normal" ? baseFont : smallFont}px 'Times New Roman', Times, serif`;
      totalWidth += ctx.measureText(p.text).width;
    });

    let maxAbove = 0;
    let maxBelow = 0;
    parsed.forEach((p) => {
      if (p.type === "normal") {
        maxAbove = Math.max(maxAbove, baseFont * 0.8);
        maxBelow = Math.max(maxBelow, baseFont * 0.3);
      } else if (p.type === "sub") {
        maxAbove = Math.max(maxAbove, smallFont * 0.4);
        maxBelow = Math.max(maxBelow, smallFont * 0.9 + offset);
      } else {
        maxAbove = Math.max(maxAbove, smallFont * 0.9 + offset);
        maxBelow = Math.max(maxBelow, smallFont * 0.3);
      }
    });

    const baseline = y + (maxAbove - maxBelow) / 2;
    let cursor = x - totalWidth / 2;

    parsed.forEach((p) => {
      ctx.font = `${p.type === "normal" ? baseFont : smallFont}px 'Times New Roman', Times, serif`;
      const w = ctx.measureText(p.text).width;

      let drawY = baseline;
      if (p.type === "sub") drawY = baseline + offset;
      if (p.type === "sup") drawY = baseline - offset;

      ctx.fillText(p.text, cursor + w / 2, drawY);
      cursor += w;
    });
  }

  // -------- Layout & Drawing --------
  function layoutNodes() {
    if (nodes.length === 0) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 60;

    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      node.x = cx + radius * Math.cos(angle);
      node.y = cy + radius * Math.sin(angle);
    });
  }

  function redraw() {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    edges.forEach((edge) => {
      const from = nodes.find((n) => n.id === edge.fromId);
      const to = nodes.find((n) => n.id === edge.toId);
      if (from && to) drawArrow(from.x, from.y, to.x, to.y);
    });

    nodes.forEach(drawNode);
  }

  function drawNode(node) {
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#fff";
    ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#000";
    const processed = normalizeLatex(node.label);
    drawRichText(processed, node.x, node.y + 3);

    ctx.restore();
  }

  function drawArrow(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy) || 1;

    const startX = x1 + (dx / dist) * NODE_RADIUS;
    const startY = y1 + (dy / dist) * NODE_RADIUS;
    const endX = x2 - (dx / dist) * NODE_RADIUS;
    const endY = y2 - (dy / dist) * NODE_RADIUS;

    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#000";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const angle = Math.atan2(dy, dx);
    const L = 12;

    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - L * Math.cos(angle - Math.PI / 7),
      endY - L * Math.sin(angle - Math.PI / 7)
    );
    ctx.lineTo(
      endX - L * Math.cos(angle + Math.PI / 7),
      endY - L * Math.sin(angle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // -------- Export helpers --------
  function triggerDownload(url, filename, revoke = false) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (revoke) URL.revokeObjectURL(url);
  }

  downloadJpgButton.addEventListener("click", () =>
    triggerDownload(canvas.toDataURL("image/jpeg", 1.0), "majority-graph.jpg")
  );

  downloadPngButton.addEventListener("click", () =>
    triggerDownload(canvas.toDataURL("image/png"), "majority-graph.png")
  );

  downloadSvgButton.addEventListener("click", () => {
    const png = canvas.toDataURL("image/png");
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
  <image href="${png}" x="0" y="0" width="${canvas.width}" height="${canvas.height}" />
</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    triggerDownload(URL.createObjectURL(blob), "majority-graph.svg", true);
  });

  // -------- Save / Load --------
  saveButton.addEventListener("click", () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { nodes, edges, nextNodeId, nextEdgeId },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    triggerDownload(URL.createObjectURL(blob), "graph.json", true);
  });

  loadButton.addEventListener("click", () => loadFileInput.click());

  loadFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);

        nodes = Array.isArray(data.nodes) ? data.nodes : [];
        edges = Array.isArray(data.edges) ? data.edges : [];

        nextNodeId =
          typeof data.nextNodeId === "number"
            ? data.nextNodeId
            : nodes.reduce((m, n) => Math.max(m, n.id || 0), 0) + 1;

        nextEdgeId =
          typeof data.nextEdgeId === "number"
            ? data.nextEdgeId
            : edges.reduce((m, e2) => Math.max(m, e2.id || 0), 0) + 1;

        const positioned = nodes.every(
          (n) => typeof n.x === "number" && typeof n.y === "number"
        );
        if (!positioned) layoutNodes();

        updateNodeSelects();
        refreshEdgeTable();
        redraw();
      } catch {
        alert("Invalid graph file.");
      }
    };
    reader.readAsText(file);
    loadFileInput.value = "";
  });

  // -------- Clear --------
  clearButton.addEventListener("click", () => {
    nodes = [];
    edges = [];
    nextNodeId = 1;
    nextEdgeId = 1;
    updateNodeSelects();
    refreshEdgeTable();
    redraw();
  });

  redraw();
});
