import {
  layerState,
  stateKey,
  layerTree,
  layerTypes,
  blends,
} from "./layer-model.js";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const eye =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z"/><circle cx="10" cy="10" r="2.5"/></svg>';
async function api(operation, data) {
  const r = await fetch("./api/studio/layers/" + operation, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const value = await r.json();
  if (!r.ok) throw Error(value.error || r.statusText);
  return value;
}
export class LayerPanel {
  constructor({ composite, changed, busy, error, download, rendered, retry, selected }) {
    this.callbacks = { composite, changed, busy, error, download, rendered, retry, selected };
    this.epoch = 0;
    this.layers = [];
    this.collapsed = new Set();
    this.undo = [];
    this.redo = [];
    $("#layer-filter").oninput = () => this.render();
    $("#layers").onclick = (e) => {
      const row = e.target.closest("[data-layer]");
      if (!row) return;
      const l = this.layers.find((l) => l.id === row.dataset.layer);
      if (e.target.closest("[data-fold]")) {
        this.collapsed.has(l.id)
          ? this.collapsed.delete(l.id)
          : this.collapsed.add(l.id);
      } else if (e.target.closest("[data-eye]") && this.session) {
        this.change(l.id, "visible", !l.visible);
      } else {this.select(l.id,{reveal:false});return;}
      this.render();
    };
    for (const id of ["layer-opacity", "layer-opacity-number"]) {
      const el = $("#" + id);
      el.addEventListener(id === "layer-opacity" ? "input" : "change", () => {
        if (el.value === "" || !Number.isFinite(el.valueAsNumber))
          return this.render();
        this.change(
          this.selected,
          "opacity",
          Math.round(Math.max(0, Math.min(100, el.valueAsNumber)) * 2.55),
          id === "layer-opacity",
        );
      });
      if (id === "layer-opacity")
        el.onchange = () => {
          this.gesture = false;
          void this.flush();
        };
    }
    $("#layer-blend").onchange = (e) =>
      this.change(this.selected, "blend", e.target.value);
    $("#layer-inherit").onchange = (e) =>
      this.change(this.selected, "inheritAlpha", e.target.checked);
    $("#layer-passthrough").onchange = (e) =>
      this.change(this.selected, "passThrough", e.target.checked);
    $("#layer-undo").onclick = () => this.history(this.undo, this.redo);
    $("#layer-redo").onclick = () => this.history(this.redo, this.undo);
    $("#layer-restore").onclick = () => {
      if (!this.session) return;
      this.undo.push(layerState(this.layers));
      this.redo = [];
      this.assign(this.original);
      this.queue();
    };
    $("#layer-retry").onclick = () => {
      if (this.owner) void (this.callbacks.retry ? this.callbacks.retry() : this.open({ ...this.owner, layerKey: "reopen" }));
    };
    $("#layer-save").onclick = () => void this.save();
    this.render();
  }
  release(session) {
    if (session) void api("close", { session }).catch(() => {});
  }
  clear(beacon = false) {
    this.epoch++;
    clearTimeout(this.timer);
    if (this.session) {
      if (beacon)
        navigator.sendBeacon(
          "./api/studio/layers/close",
          new Blob([JSON.stringify({ session: this.session })], {
            type: "application/json",
          }),
        );
      else this.release(this.session);
    }
    this.session = null;
    this.owner = null;
    this.layers = [];
    this.original = [];
    this.undo = [];
    this.redo = [];
    this.selected = null;
    this.collapsed.clear();
    this.loading = this.working = this.saving = this.gesture = false;
    this.message = "";
    this.openError = "";
    this.callbacks.busy(false);
    this.render();
  }
  async open(owner) {
    this.clear();
    this.owner = owner;
    if (owner.physicsCase) {
      this.layers = owner.layers.map(l => ({ ...l, opacity: Math.round(l.opacity * 255) }));
      this.original = layerState(this.layers); this.selected = owner.physicsCase.layers[0]?.id;
      this.message = '示例项目 · 图层只读'; this.callbacks.changed(owner, this.layers); this.render(); return;
    }
    if (!/\.(kra|psd)$/i.test(owner.name)) return;
    // Read-only metadata is temporary until the native graph (including masks) is ready.
    const parents = [];
    this.layers = (owner.savedLayers || owner.layers || []).map((l, i) => {
      const id = "saved" + i;
      const parentId = l.depth ? parents[l.depth - 1] : null;
      parents[l.depth] = id;
      return {
        ...l,
        id,
        parentId,
        type: l.type || (l.group ? "grouplayer" : "paintlayer"),
        opacity: Math.round(l.opacity * 255),
      };
    });
    const epoch = this.epoch;
    this.loading = true;
    this.message = "正在读取图层与蒙版…";
    this.render();
    try {
      const availability = await fetch("./api/studio/layers").then((r) =>
        r.json(),
      );
      if (epoch !== this.epoch) return;
      if (!availability.available)
        throw Error("图层只读 · 未配置 Krita 合成服务");
      const project = owner.project;
      const r = project ? await fetch('./api/studio/layers/open-project', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: project.name, dir: project.dir, preview: project.previewMode,
          path: project.files.document.path, version: project.files.document.version }),
      }) : await fetch('./api/studio/layers/open?format=' + owner.name.split('.').at(-1).toLowerCase(), {
        method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: owner.file,
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || r.statusText);
      if (epoch !== this.epoch) {
        this.release(data.session);
        return;
      }
      this.session = data.session;
      this.revision = data.revision;
      this.layers = data.layers;
      this.original = layerState(data.layers);
      this.ack = this.original;
      this.selected = this.layers.find((l) => !l.mask)?.id;
      this.callbacks.changed(owner, data.layers);
      if (this.owner.layerKey !== "baseline")
        await this.callbacks.composite(owner, data, null);
      this.message = "Krita 合成 · 原尺寸";
    } catch (e) {
      if (epoch === this.epoch) this.openError = this.message = e.message;
    } finally {
      if (epoch === this.epoch) {
        this.loading = false;
        this.render();
      }
    }
  }
  assign(values) {
    const map = new Map(values.map((v) => [v.id, v]));
    this.layers = this.layers.map((l) => ({ ...l, ...map.get(l.id) }));
  }
  change(id, key, value, gesture = false) {
    const l = this.layers.find((l) => l.id === id);
    if (
      !this.session ||
      this.saving ||
      !l ||
      l[key] === value ||
      l.type === "selectionmask"
    )
      return;
    if (!gesture || !this.gesture) {
      this.undo.push(layerState(this.layers));
      if (this.undo.length > 50) this.undo.shift();
    }
    this.gesture = gesture;
    this.redo = [];
    l[key] = value;
    this.queue();
  }
  select(id,{notify=true,reveal=true}={}) {
    const row = this.layers.find(l => l.id === id);
    if (!row) return;
    this.selected = id;
    if(reveal)$('#layer-filter').value = '';
    let parent = row.parentId;
    while (parent) {
      this.collapsed.delete(parent);
      parent = this.layers.find(l => l.id === parent)?.parentId;
    }
    this.render();
    if(reveal)[...document.querySelectorAll('[data-layer]')].find(el => el.dataset.layer === id)?.scrollIntoView({ block: 'nearest' });
    if(notify)this.callbacks.selected?.(row);
  }
  history(from, to) {
    if (!from.length || !this.session || this.saving) return;
    to.push(layerState(this.layers));
    this.assign(from.pop());
    this.queue();
  }
  queue() {
    this.message = "正在合成…";
    this.callbacks.busy(true);
    this.render();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 180);
  }
  async flush() {
    clearTimeout(this.timer);
    if (this.working || !this.session) return;
    const epoch = this.epoch;
    this.working = true;
    try {
      while (
        epoch === this.epoch &&
        stateKey(this.layers) !== stateKey(this.ack)
      ) {
        const desired = layerState(this.layers);
        const data = await api("edit", {
          session: this.session,
          revision: this.revision,
          state: desired,
        });
        if (epoch !== this.epoch) return;
        this.revision = data.revision;
        this.ack = layerState(data.layers);
        // A more recent slider/eye edit wins; don't flash obsolete composites.
        if (stateKey(desired) !== stateKey(this.layers)) continue;
        this.assign(this.ack);
        let color = null;
        if (!data.baseline) {
          const r = await fetch(this.assetURL());
          if (!r.ok) throw Error("合成图读取失败，请重新打开文件");
          color = await r.blob();
        }
        if (epoch !== this.epoch) return;
        if (stateKey(desired) !== stateKey(this.layers)) continue;
        await this.callbacks.composite(this.owner, data, color);
      }
      this.message = "Krita 合成 · 原尺寸";
    } catch (e) {
      if (epoch === this.epoch) {
        this.assign(this.ack);
        this.undo = [];
        this.redo = [];
        this.message = e.message;
        this.callbacks.error(e.message);
      }
    } finally {
      if (epoch === this.epoch) {
        this.working = false;
        this.callbacks.busy(false);
        this.render();
      }
    }
  }
  assetURL(kind = "png") {
    return (
      "./studio-layer-asset?" +
      new URLSearchParams({
        session: this.session,
        revision: this.revision,
        kind,
      })
    );
  }
  async save() {
    if (!this.session || this.pending || this.saving) return;
    const epoch = this.epoch;
    this.saving = true;
    this.message = "正在保存 KRA…";
    this.render();
    try {
      await api("export", { session: this.session, revision: this.revision });
      if (epoch !== this.epoch) return;
      const r = await fetch(this.assetURL("kra"));
      if (!r.ok) throw Error("KRA 下载失败");
      const file = await r.blob();
      if (epoch !== this.epoch) return;
      this.callbacks.download(
        file,
        this.owner.name.replace(/\.[^.]+$/, "") + "-edited.kra",
      );
      this.message = "KRA 已保存";
    } catch (e) {
      if (epoch === this.epoch) {
        this.message = e.message;
        this.callbacks.error(e.message);
      }
    } finally {
      if (epoch === this.epoch) {
        this.saving = false;
        this.render();
      }
    }
  }
  get pending() {
    return (
      this.loading ||
      this.working ||
      (!!this.session && stateKey(this.layers) !== stateKey(this.ack))
    );
  }
  render() {
    const rows = layerTree(
        this.layers,
        this.collapsed,
        $("#layer-filter").value,
      ),
      selected = this.layers.find((l) => l.id === this.selected);
    const masks = this.layers.filter((l) => l.mask).length;
    $("#layer-count").textContent = this.layers.length
      ? `${this.layers.length - masks} 层${masks ? " · " + masks + " 蒙版" : ""}`
      : "0";
    const list = $("#layers"),
      scroll = list.scrollTop;
    list.innerHTML = rows
      .filter((l) => l.shown)
      .map((l) => {
        const type = layerTypes[l.type] || l.type;
        const status =
          l.type === "selectionmask"
            ? "选区，不参与合成"
            : !l.visible
              ? l.mask
                ? "已停用"
                : "已隐藏"
              : l.inheritedHidden
                ? "自身可见，父级已隐藏"
                : l.mask
                  ? "已启用"
                  : "可见";
        return `<div class="layer-row ${l.id === this.selected ? "selected" : ""} ${!l.visible ? "hidden-layer" : ""} ${l.inheritedHidden ? "inherited-hidden" : ""} ${l.mask ? "mask-layer" : ""}" data-layer="${esc(l.id)}" role="listitem" style="--depth:${Math.min(l.depth, 12)}" title="${esc(l.name)} · ${type} · ${status}">
        <button class="layer-eye" data-eye aria-label="${esc((l.mask ? "启用蒙版 " : "显示图层 ") + l.name)}" aria-pressed="${l.visible}" ${!this.session || this.saving || l.type === "selectionmask" ? "disabled" : ""}>${eye}${!l.visible ? "<i></i>" : ""}</button>
        <button class="layer-fold" data-fold aria-label="${this.collapsed.has(l.id) ? "展开" : "收起"} ${esc(l.name)}" ${l.hasChildren ? "" : "disabled"}>${l.hasChildren ? (this.collapsed.has(l.id) ? "▸" : "▾") : ""}</button>
        <button class="layer-select" aria-label="选择 ${esc(l.name)}" aria-pressed="${l.id === this.selected}">${l.thumbnail ? `<img src="${l.thumbnail}" alt="" loading="lazy">` : `<span class="layer-thumb">${l.group ? "▱" : "▧"}</span>`}<span class="layer-name">${esc(l.name)}</span><span class="layer-badge">${l.mask ? "M" : l.group ? "组" : l.inheritAlpha ? "α" : ""}</span></button></div>`;
      })
      .join("");
    list.scrollTop = scroll;
    $("#layer-note").textContent =
      this.message ||
      (this.owner ? "合成图，无图层" : "打开 KRA / PSD 以编辑图层");
    $("#layer-retry").hidden =
      !this.owner ||
      !/\.(kra|psd)$/i.test(this.owner.name) ||
      this.loading ||
      (!!this.session &&
        !this.message.includes("失败") &&
        !this.message.includes("重新"));
    $("#layer-undo").disabled =
      !this.session || !this.undo.length || this.saving;
    $("#layer-redo").disabled =
      !this.session || !this.redo.length || this.saving;
    $("#layer-restore").disabled =
      !this.session ||
      stateKey(this.layers) === stateKey(this.original) ||
      this.saving;
    $("#layer-save").disabled = !this.session || this.pending || this.saving;
    $("#layer-properties").hidden = !selected || !this.session;
    this.callbacks.rendered?.();
    if (!selected || !this.session) return;
    $("#layer-selected").textContent = selected.name;
    $("#layer-kind").textContent = layerTypes[selected.type] || selected.type;
    $("#layer-mask-hint").hidden = !selected.mask;
    $("#layer-mask-hint").textContent =
      selected.type === "selectionmask"
        ? "选区蒙版不参与合成"
        : "眼睛开关启用／停用蒙版";
    $("#layer-paint-properties").hidden = !!selected.mask;
    $("#layer-opacity").value = $("#layer-opacity-number").value = Math.round(
      selected.opacity / 2.55,
    );
    $("#layer-opacity").disabled = $("#layer-opacity-number").disabled =
      !!selected.passThrough || this.saving;
    const modes = { ...blends };
    if (!modes[selected.blend])
      modes[selected.blend] = "原模式 · " + selected.blend;
    $("#layer-blend").innerHTML = Object.entries(modes)
      .map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`)
      .join("");
    $("#layer-blend").value = selected.blend;
    $("#layer-blend").disabled = !!selected.passThrough || this.saving;
    $("#layer-inherit").checked = selected.inheritAlpha;
    $("#layer-inherit").disabled = this.saving;
    $("#layer-passthrough-row").hidden = !selected.group;
    $("#layer-passthrough").checked = !!selected.passThrough;
    $("#layer-passthrough").disabled = this.saving;
  }
}
