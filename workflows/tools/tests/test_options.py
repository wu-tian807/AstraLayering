import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "options.py"


class OptionsTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="workflow-options-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / "中文 路径"
        self.path = self.root / "options.json"

    def command(self, operation, *args):
        # -S disables site packages, proving the CLI has no third-party dependency.
        return [sys.executable, "-S", str(SCRIPT), operation, "--work-root", str(self.root), *args]

    def run_cli(self, operation, *args, success=True):
        result = subprocess.run(self.command(operation, *args), capture_output=True, text=True, timeout=20)
        if success:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)

    def read(self):
        return json.loads(self.path.read_text(encoding="utf-8"))

    def test_create_update_types_and_literal_strings(self):
        self.run_cli("set", "simplify", "true")
        self.run_cli("set", "count", "-12", "--type", "integer")
        literal = '中文 空格 "quote" = # $(command) `command` \\ path\nnext'
        self.run_cli("set", "label", literal, "--type", "string")
        self.run_cli("set", "empty", "", "--type", "string")
        self.run_cli("set", "literal_false", "false", "--type", "string")
        self.run_cli("set", "simplify", "false")
        expected = {"simplify": False, "count": -12, "label": literal, "empty": "", "literal_false": "false"}
        self.assertEqual(self.read(), expected)
        for name, value in expected.items():
            self.assertEqual(self.run_cli("get", name), {name: value})
        self.assertFalse(self.path.read_bytes().startswith(b"\xef\xbb\xbf"))
        self.assertEqual([entry.name for entry in self.root.iterdir()], ["options.json"])

    def test_bad_arguments_leave_existing_config_untouched(self):
        self.run_cli("set", "simplify", "true")
        original = self.path.read_bytes()
        for args in [("set", "simplify", "yes"), ("set", "count", "1.5", "--type", "integer"),
                     ("set", "bad-name", "true"), ("set", "simplify"), ("get", "missing")]:
            with self.subTest(args=args):
                self.run_cli(*args, success=False)
                self.assertEqual(self.path.read_bytes(), original)
        self.root = Path("relative-root")
        self.run_cli("set", "simplify", "true", success=False)

    def test_reject_malformed_or_nonflat_config_without_overwriting(self):
        self.root.mkdir()
        for content in ['{', '[]', '{"a": true, "a": false}', '{"a": {"nested": true}}',
                        '{"a": [1]}', '{"a": null}', '{"a": 1.5}', '{"bad-name": true}']:
            with self.subTest(content=content):
                self.path.write_text(content, encoding="utf-8")
                original = self.path.read_bytes()
                self.run_cli("set", "simplify", "true", success=False)
                self.assertEqual(self.path.read_bytes(), original)
                self.assertEqual([entry.name for entry in self.root.iterdir()], ["options.json"])

    def test_parallel_writers_preserve_all_options(self):
        self.run_cli("set", "simplify", "true")
        processes = [subprocess.Popen(self.command("set", "worker_" + str(i), str(i), "--type", "integer"),
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                     for i in range(10)]
        try:
            for process in processes:
                _, error = process.communicate(timeout=20)
                self.assertEqual(process.returncode, 0, error)
        finally:
            for process in processes:
                if process.poll() is None:
                    process.kill()
                    process.communicate()
        expected = {"simplify": True}
        expected.update({"worker_" + str(i): i for i in range(10)})
        self.assertEqual(self.read(), expected)
        self.assertEqual([entry.name for entry in self.root.iterdir()], ["options.json"])

    def test_missing_get_does_not_create_config(self):
        self.run_cli("get", "simplify", success=False)
        self.assertFalse(self.root.exists())


if __name__ == "__main__":
    unittest.main()
