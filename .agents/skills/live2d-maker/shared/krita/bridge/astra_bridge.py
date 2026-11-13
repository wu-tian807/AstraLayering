"""Script bridge for a section's private Krita: runs any Python file an agent
drops into <bridge>/jobs and writes the outcome next to it.

Loaded only from the private resource directory the workflow prepares for the
section; never installed into the user's Krita profile.

Protocol (version 1), all paths under $ASTRA_KRITA_BRIDGE:
  ready.json            written once the main window exists: pid, version, jobs dir
  jobs/<id>.py          a job; write it elsewhere first, then rename it here
  jobs/<id>.running     present while the job runs
  jobs/<id>.json        {ok, result, stdout, stderr, error, hints, dialogs, seconds}
  jobs/<id>.py.done     the job source, kept after it ran
  quit                  asks Krita to close normally
Each job runs on Krita's GUI thread with `Krita`, `krita`, `BRIDGE` and the
persistent `session` dict in scope; it reports through a `result` variable.
"""
import contextlib
import faulthandler
import io
import json
import os
import re
import time
import traceback

import krita
from krita import Extension, Krita
from PyQt5.QtCore import QTimer, Qt
from PyQt5 import sip
from PyQt5.QtWidgets import QApplication, QAbstractButton, QDialog

PROTOCOL = 1
# A crash prints the Python stack to Krita's stderr, which ends up in the
# section's crash log: the agent sees which line of its script took Krita down.
faulthandler.enable()
ROOT = os.environ.get('ASTRA_KRITA_BRIDGE', '')
JOBS = os.path.join(ROOT, 'jobs')

DIALOG_HINT = ('Krita 弹出了对话框“{title}”，无人操作的界面会因此卡住，桥接已自动取消它，'
               '对应操作没有完成。不要在脚本里打开需要人操作的对话框；导出和保存的参数通过 InfoObject 传入。')
# How long a dialog stays up before it is cancelled. Qt finishes showing a
# dialog on later event loop turns (QDialog::adjustPosition from a timer);
# cancelling it before then lets Krita delete the dialog under that pending
# call, which crashed Krita in about a third of the export dialogs cancelled
# at once. Waiting this long crashed none.
DIALOG_GRACE = 0.5
# Common mistakes, matched against the traceback text.
ERROR_HINTS = [
    (re.compile(r"paint\w*\(.*unexpected type 'QPointF'|argument \d+ has unexpected type 'QPointF'"),
     'Krita 5.3 的 Node.paintLine / paintRectangle / paintEllipse 接受整数 QPoint，'
     '用 QPoint(round(x), round(y))；paintLine 第 3、4 个参数是两端压感（0–1）。'),
    (re.compile(r"'NoneType' object has no attribute '(activeView|addView|currentBrushPreset|setCurrentBrushPreset|setForeGroundColor|setBrushSize)'"),
     '当前没有可用窗口或视图。绘制使用视图的笔刷、颜色和尺寸：先 Krita.instance().activeWindow().addView(doc)，'
     '再从 activeWindow().activeView() 设置笔刷后调用 paint* 接口。'),
    (re.compile(r"'NoneType' object has no attribute"),
     '某个查找返回了 None（例如 nodeByName、openDocument、activeDocument、rootNode）。确认名称、路径和文档已打开；'
     '关闭或重新打开后旧的文档、图层和视图引用失效，要重新取得，打开后先 doc.waitForDone() 再确认 rootNode() 不是 None。'),
    (re.compile(r"No module named"),
     'Krita 内置 Python 缺少该模块。只用 Krita、PyQt5 和标准库；需要其他库时在宿主进程中处理导出的图片。'),
]


def _batch_documents(method):
    # Documents from createDocument / openDocument start outside batch mode
    # even when Krita is in it (and the notifier does not report them), so
    # their first export or save would open an options dialog.
    def wrapper(self, *args):
        document = method(self, *args)
        if document is not None:
            document.setBatchmode(True)
        return document
    return wrapper


def _batch_first(method):
    # A script that left batch mode (Krita's or the document's) would get
    # an export options or file dialog nobody can answer.
    def wrapper(self, *args):
        Krita.instance().setBatchmode(True)
        self.setBatchmode(True)
        return method(self, *args)
    return wrapper


for _name in ('exportImage', 'saveAs', 'save'):
    setattr(krita.Document, _name, _batch_first(getattr(krita.Document, _name)))
Krita.createDocument = _batch_documents(Krita.createDocument)
Krita.openDocument = _batch_documents(Krita.openDocument)


def _write_json(path, value):
    temporary = path + '.tmp'
    with open(temporary, 'w', encoding='utf-8') as handle:
        json.dump(value, handle, ensure_ascii=False, default=str)
    os.replace(temporary, path)


def _is_progress_dialog(widget):
    # These dialogs finish automatically. Rejecting them cancels a running
    # image operation, rather than answering a question. Check C++ inheritance:
    # PyQt exposes Krita's own dialog classes as plain QDialog wrappers.
    if widget.inherits('QProgressDialog'):
        return True
    # Only the non-interactive ForcedDialog variant; the SaveDialog variant
    # offers choices that must still be reported and cancelled by the guard.
    return (widget.inherits('KisDelayedSaveDialog')
            and not (widget.windowFlags() & Qt.WindowCloseButtonHint)
            and not any(button.isVisible() for button in widget.findChildren(QAbstractButton)))


class Bridge(Extension):
    def __init__(self, parent):
        super().__init__(parent)
        self.timer = None
        self.guard = None
        self.running = None
        self.dialogs = []
        # Visible dialogs (C++ address) and when the guard first saw them.
        self.shown = {}
        self.session = {}
        self.settle_until = 0.0

    def setup(self):
        pass

    def createActions(self, window):
        # Called once per window; the first one starts the bridge.
        if self.timer or not ROOT:
            return
        os.makedirs(JOBS, exist_ok=True)
        self.timer = QTimer()
        self.timer.timeout.connect(self.poll)
        self.timer.start(100)
        # Qt never re-enters a timer whose slot is still running, so the
        # job's own poll cannot clear a dialog it is blocked on; a second
        # timer keeps firing inside the dialog's nested event loop.
        self.guard = QTimer()
        self.guard.timeout.connect(self.dismiss_dialogs)
        self.guard.start(200)
        _write_json(os.path.join(ROOT, 'ready.json'), {
            'protocol': PROTOCOL, 'pid': os.getpid(), 'version': Krita.instance().version(), 'jobs': JOBS})

    def dismiss_dialogs(self):
        # A modal dialog runs a nested event loop, so this timer still fires
        # while the job that opened it is blocked. Krita's export options
        # dialog is not always reported by activeModalWidget(), so every
        # visible top-level interactive dialog counts. Each is recorded when first seen
        # and cancelled once it has been up for DIALOG_GRACE.
        # Python wrappers are recreated per call, so compare the C++ objects.
        now, shown = time.monotonic(), {}
        widgets = [QApplication.activeModalWidget()] + QApplication.topLevelWidgets()
        for widget in widgets:
            if widget is None or not widget.isVisible() or not (isinstance(widget, QDialog) or widget.isModal()):
                continue
            if _is_progress_dialog(widget):
                continue
            key = sip.unwrapinstance(widget)
            if key in shown:
                continue
            if key not in self.shown:
                self.dialogs.append({'title': widget.windowTitle() or type(widget).__name__, 'class': type(widget).__name__})
            shown[key] = self.shown.get(key, now)
            if now - shown[key] >= DIALOG_GRACE:
                widget.reject() if hasattr(widget, 'reject') else widget.close()
        self.shown = shown

    def poll(self):
        # The next job waits until every dialog is gone and the cancelled
        # operation has settled.
        if self.running or self.shown or time.monotonic() < self.settle_until:
            return
        if os.path.exists(os.path.join(ROOT, 'quit')):
            self.timer.stop()
            self.guard.stop()
            Krita.instance().quit()
            return
        try:
            names = sorted(name for name in os.listdir(JOBS) if name.endswith('.py'))
        except FileNotFoundError:
            return
        if names:
            self.run(names[0][:-3])

    def run(self, job):
        source = os.path.join(JOBS, job + '.py')
        marker = os.path.join(JOBS, job + '.running')
        self.running, self.dialogs = job, []
        open(marker, 'w').close()
        application = Krita.instance()
        application.setBatchmode(True)
        for document in application.documents():
            document.setBatchmode(True)
        stdout, stderr = io.StringIO(), io.StringIO()
        scope = {'__name__': '__astra_job__', '__file__': source, 'Krita': Krita, 'krita': krita,
                 'BRIDGE': ROOT, 'session': self.session, 'result': None}
        started = time.monotonic()
        outcome = {'ok': True}
        try:
            with open(source, encoding='utf-8') as handle:
                code = compile(handle.read(), source, 'exec')
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                exec(code, scope)
        except BaseException:
            outcome = {'ok': False, 'error': traceback.format_exc()}
        self.dismiss_dialogs()
        hints = [DIALOG_HINT.format(title=dialog['title']) for dialog in self.dialogs]
        if not outcome['ok']:
            hints += [hint for pattern, hint in ERROR_HINTS if pattern.search(outcome['error'])][:1]
        outcome.update({'result': scope.get('result'), 'stdout': stdout.getvalue(), 'stderr': stderr.getvalue(),
                        'hints': hints, 'dialogs': self.dialogs, 'seconds': round(time.monotonic() - started, 3)})
        # A job that hit a dialog did not do what it asked, even without an exception.
        if self.dialogs:
            outcome['ok'] = False
            # A cancelled operation finishes tearing down on later event loop turns.
            self.settle_until = time.monotonic() + 1.5
        os.replace(source, source + '.done')
        _write_json(os.path.join(JOBS, job + '.json'), outcome)
        os.remove(marker)
        self.running = None


Krita.instance().addExtension(Bridge(Krita.instance()))
