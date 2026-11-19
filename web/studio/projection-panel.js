import { projectionLayers } from './projection-model.js';
const $ = s => document.querySelector(s);
const short = name => String(name || '').split('/').at(-1);
export class ProjectionPanel {
  constructor(layers, source) {
    this.layers = layers; this.source = source;
  }
  render() {
    const bindings = this.source()?.shadowBindings, panel = this.layers;
    const shadows = projectionLayers(bindings, panel.previewLayers());
    const key = JSON.stringify([bindings, panel.session, panel.selected, panel.saving,
      shadows.map(s => [s.layer?.id, s.layer?.visible, s.layer?.opacity])]);
    if (key === this.key) return; this.key = key;
    $('#projection-count').textContent = shadows.length ? `${shadows.length} 项` : '';
    const missing = shadows.filter(s => !s.layer).length;
    $('#projection-status').textContent = !shadows.length ? '未发现投影关系；从已完成蒙版制作的项目加载'
      : !panel.session ? '正在关联 KRA 图层…' : missing ? `${missing} 项未找到对应图层，请更新项目` : '开关与图层同步';
    const rows = shadows.map(s => {
      const row = document.createElement('div'); row.className = 'projection-row';
      row.dataset.shadow = s.id;
      row.classList.toggle('selected', !!s.layer && panel.selected === s.layer.id);
      const toggle = document.createElement('input'); toggle.type = 'checkbox';
      toggle.checked = s.layer?.visible ?? true; toggle.disabled = !s.layer || !panel.session || panel.saving;
      toggle.setAttribute('aria-label', `显示投影 ${s.id}`);
      toggle.onchange = () => { panel.setVisible(s.layer.id, toggle.checked); this.render(); };
      const select = document.createElement('button'); select.className = 'projection-select';
      select.disabled = !s.layer; select.title = s.notes || s.id;
      const label = document.createElement('b'); label.textContent = short(s.layer?.name) || s.id;
      const relation = document.createElement('small'); relation.textContent =
        `${s.casters.map(l => short(l.name)).join('、') || short(s.casterPartId)} → ${s.receivers.map(l => short(l.name)).join('、') || s.receiverPartIds.map(short).join('、')}`;
      select.append(label, relation);
      select.onclick = () => { panel.select(s.layer.id); this.render(); };
      row.append(toggle, select); return row;
    });
    $('#projection-list').replaceChildren(...rows);
  }
}
