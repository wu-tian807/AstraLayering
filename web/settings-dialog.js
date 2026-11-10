import { pickServerPath } from './server-picker.js';

// Both software fields share their picker, scan UI, and polling logic.
const software = [
 { name: 'krita', label: 'Krita', note: '绘制、组装与阴影需要', placeholder: '例如 /usr/bin/krita' },
 { name: 'ffmpeg', label: 'FFmpeg', note: '仅头部九轴需要；选择已安装或解压的文件', placeholder: 'ffmpeg 或 ffmpeg.exe 的完整路径' },
];
export function createSettings({ get, post, esc, icon, onSaved }) {
 let settings = null;
 const load = async () => (settings = await get('./api/settings'));
 const pick = options => pickServerPath({ get, esc, icon, ...options });

 // Resolves true once saved. `focus` names the field to fill, `error` says why it is asked.
 function show({ focus, error } = {}) {
  const dialog = document.querySelector('#settings-dialog');
  return new Promise(async resolve => {
   let saved = false, active = true;
   const polling = new Map();
   try { await load(); } catch (failure) { error = failure.message; }
   const defaults = settings?.defaults ?? {};
   dialog.innerHTML = `<div class="modal-heading"><div><span class="eyebrow">SETTINGS</span><h2>全局设置</h2><p>保存在服务器上，所有任务的启动都使用这里的设置。</p></div><button class="icon-button" data-close>${icon('close')}</button></div>
   <form class="settings-form">${error ? `<p class="form-error settings-reason">${esc(error)}</p>` : ''}
    ${software.map(({ name, label, note, placeholder }) => `<label class="field-label" for="settings-${name}">${label} 可执行文件 <span>${note}</span></label>
    <div class="path-field"><input id="settings-${name}" name="${name}" value="${esc(settings?.[name] ?? '')}" placeholder="${placeholder}"><button type="button" class="button" data-pick="${name}">浏览</button><button type="button" class="button" data-scan="${name}">${icon('search')}自动扫描</button></div>
    <div class="scan-status" data-scan-status="${name}" aria-live="polite"></div>`).join('')}
    <label class="field-label" for="settings-directory">默认运行目录 <span>新任务创建在这里，并追踪其中的任务</span></label>
    <div class="path-field"><input id="settings-directory" name="directory" value="${esc(settings?.directory ?? '')}" required><button type="button" class="button" data-pick="directory">浏览</button></div>
    <label class="field-label" for="settings-knowledge">默认先验知识目录 <span>新任务记录它；已有任务沿用创建时的目录</span></label>
    <div class="path-field"><input id="settings-knowledge" name="knowledge" value="${esc(settings?.knowledge ?? '')}" placeholder="${esc(defaults.knowledge ?? '')}"><button type="button" class="button" data-pick="knowledge">浏览</button></div>
    <p class="dialog-note">运行目录默认是仓库下的 .run/；demos/ 用于导出与展示成果。FFmpeg 路径会传给九轴 agent。先验知识目录留空时使用 skill 自带的 knowledge/。</p>
    <p class="form-error" role="alert"></p>
    <div class="modal-footer"><span></span><button type="button" class="button" data-close>取消</button><button class="primary">保存设置</button></div></form>`;
   const form = dialog.querySelector('form');
   const scanFields = software.map(({ name, label }) => {
    const status = dialog.querySelector(`[data-scan-status="${name}"]`), button = dialog.querySelector(`[data-scan="${name}"]`);
    let running = false, revision = 0;
    const draw = scan => {
     if (!active) return;
     running = scan.running;
     button.innerHTML = running ? icon('stop') + '停止扫描' : icon('search') + '自动扫描';
     const progress = running ? `正在扫描 ${esc(scan.current || '…')} · 已检查 ${scan.scanned} 项` : scan.finishedAt ? `扫描结束 · 共检查 ${scan.scanned} 项` : '';
     status.innerHTML = (progress ? `<small>${progress}</small>` : '') + (scan.error ? `<small class="status-error">${esc(scan.error)}</small>` : '')
      + scan.found.map(path => `<button type="button" class="found-software" data-found="${esc(path)}">${icon('check')}${esc(path)}</button>`).join('')
      + (!running && scan.finishedAt && !scan.found.length ? `<small>没有找到 ${label}，请手动选择。</small>` : '');
     status.querySelectorAll('[data-found]').forEach(found => found.onclick = () => { form.elements[name].value = found.dataset.found; });
     clearTimeout(polling.get(name));
     if (running && dialog.open) polling.set(name, setTimeout(loadScan, 700));
    };
    const loadScan = () => {
     const request = ++revision;
     return get(`./api/${name}-scan`).then(scan => { if (request === revision) draw(scan); }, failure => {
      if (!active || request !== revision) return;
      status.textContent = failure.message;
      if (running && dialog.open) polling.set(name, setTimeout(loadScan, 700));
     });
    };
    button.onclick = async () => {
     button.disabled = true;
     clearTimeout(polling.get(name)); revision++;
     try { draw(await post(`${name}-scan`, { action: running ? 'stop' : 'start' })); }
     catch (failure) { form.querySelector('[role="alert"]').textContent = failure.message; }
     finally { button.disabled = false; }
    };
    return loadScan;
   });
   const titles = { krita: '选择 Krita 可执行文件', ffmpeg: '选择 FFmpeg 可执行文件', directory: '选择默认运行目录', knowledge: '选择先验知识目录' };
   dialog.querySelectorAll('[data-pick]').forEach(button => button.onclick = async () => {
    const field = form.elements[button.dataset.pick];
    const path = await pick({ kind: software.some(tool => tool.name === field.name) ? 'file' : 'dir', path: field.value.trim() || (field.name === 'knowledge' ? defaults.knowledge : ''), title: titles[field.name] });
    if (path) field.value = path;
   });
   form.onsubmit = async event => {
    event.preventDefault();
    const fields = new FormData(form), button = form.querySelector('.primary');
    button.disabled = true; form.querySelector('[role="alert"]').textContent = '';
    try {
     settings = await post('settings', { directory: fields.get('directory').trim(), krita: fields.get('krita').trim(), ffmpeg: fields.get('ffmpeg').trim(), knowledge: fields.get('knowledge').trim() });
     saved = true; await onSaved(settings); dialog.close();
    } catch (failure) { form.querySelector('[role="alert"]').textContent = failure.message; }
    finally { button.disabled = false; }
   };
   dialog.querySelectorAll('[data-close]').forEach(button => button.onclick = () => dialog.close());
   dialog.addEventListener('close', () => { active = false; for (const timer of polling.values()) clearTimeout(timer); resolve(saved); }, { once: true });
   dialog.showModal();
   if (focus) form.elements[focus]?.focus();
   scanFields.forEach(loadScan => loadScan());
  });
 }

 // A refused software path opens its global field before retrying the start.
 async function withSoftware(run) {
  for (;;) {
   try { return await run(); }
   catch (error) {
    const focus = error.ffmpeg ? 'ffmpeg' : error.krita ? 'krita' : undefined;
    if (!focus || !await show({ focus, error: error.message })) throw error;
   }
  }
 }
 return { load, show, withSoftware, current: () => settings };
}
