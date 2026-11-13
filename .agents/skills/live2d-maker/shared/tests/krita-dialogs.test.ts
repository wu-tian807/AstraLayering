import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SectionKrita } from '../krita/section-krita.ts';
import { submitJob } from '../krita/bridge/client.mjs';

// Opt in with the native executable: this exercises real Qt timers and nested
// event loops, including the guard's delayed cancellation, without artwork.
test('native Krita: wait for progress while rejecting interactive dialogs',
  { skip: !process.env.ASTRA_TEST_KRITA, timeout: 180_000 }, async t => {
    const root = await mkdtemp(join(tmpdir(), 'krita-dialog-test-'));
    const section = new SectionKrita({ section: root, krita: process.env.ASTRA_TEST_KRITA! });
    t.after(async () => { await section.release(); await rm(root, { recursive: true, force: true }); });
    await section.reserve(); await section.start();
    const run = async (name: string, source: string) => {
      const path = join(root, name + '.py'); await writeFile(path, source);
      return submitJob(section.bridge!, path, { timeoutSeconds: 30 });
    };
    const prelude = `from PyQt5.QtCore import QTimer, Qt
from PyQt5.QtWidgets import QDialog, QProgressDialog, QLabel, QVBoxLayout, QPushButton
`;
    const progress = await run('progress', prelude + `dialog = QProgressDialog('Working', '', 0, 0)
dialog.setCancelButton(None)
dialog.setMinimumDuration(0)
QTimer.singleShot(1500, dialog.accept)
result = dialog.exec_()
`);
    assert.equal(progress.ok, true); assert.deepEqual(progress.dialogs, []);
    assert.equal(progress.result, 1);

    // Krita's ForcedDialog is exposed to Python as QDialog, so identify its
    // actual Qt inheritance rather than its Python type or translated title.
    const forced = await run('forced', prelude + `class KisDelayedSaveDialog(QDialog):
    pass
dialog = KisDelayedSaveDialog()
dialog.setWindowFlags(dialog.windowFlags() & ~Qt.WindowCloseButtonHint)
QVBoxLayout(dialog).addWidget(QLabel('Waiting', dialog))
QTimer.singleShot(1500, dialog.accept)
result = dialog.exec_()
`);
    assert.equal(forced.ok, true); assert.equal(forced.result, 1);

    const choices = await run('choices', prelude + `class KisDelayedSaveDialog(QDialog):
    pass
dialog = KisDelayedSaveDialog()
QVBoxLayout(dialog).addWidget(QPushButton('Save without waiting', dialog))
QTimer.singleShot(3000, dialog.accept)
result = dialog.exec_()
`);
    assert.equal(choices.ok, false); assert.equal(choices.result, 0);
    assert.equal(choices.dialogs?.length, 1);

    const unrelated = await run('unrelated', prelude + `dialog = QDialog()
dialog.setWindowTitle('Krita')
dialog.setWindowFlags(dialog.windowFlags() & ~Qt.WindowCloseButtonHint)
QVBoxLayout(dialog).addWidget(QLabel('Waiting', dialog))
QTimer.singleShot(3000, dialog.accept)
result = dialog.exec_()
`);
    assert.equal(unrelated.ok, false); assert.equal(unrelated.result, 0);
    assert.equal(unrelated.dialogs?.length, 1);
  });
