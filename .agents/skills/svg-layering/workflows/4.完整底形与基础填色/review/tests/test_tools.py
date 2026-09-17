"""Regression checks for evidence correctness, not character aesthetics."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from PIL import Image

TOOLS = Path(__file__).resolve().parents[1]
SAMPLE = '''<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
<g id="resources"><defs><clipPath id="clip"><rect width="20" height="20"/></clipPath>
<rect id="tile" width="4" height="4" fill="lime"/></defs></g>
<g id="back" data-part="hair"><rect id="base" width="20" height="20" fill="red"/></g>
<g id="front" data-part="front"><rect id="cover" x="10" width="10" height="20" fill="blue"/></g>
<g id="tip" data-part="hair" transform="translate(2,2)" clip-path="url(#clip)">
<use id="instance" href="#tile"/></g></svg>'''


class ReviewToolsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.work = Path(self.temp.name)
        self.svg = self.work / "sample.svg"
        self.svg.write_text(SAMPLE)
        self.original = self.svg.read_bytes()

    def run_tool(self, name, *args, expected=0):
        result = subprocess.run([sys.executable, str(TOOLS / name), *map(str, args)],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        self.assertEqual(self.svg.read_bytes(), self.original)
        return result

    def test_overlay_flattens_the_whole_composite(self):
        ref = self.work / "white.png"
        Image.new("RGB", (20, 20), "white").save(ref)
        self.run_tool("compare.py", ref, self.svg, self.work / "head", "--crop", 10, 0, 10, 10)
        with Image.open(self.work / "head-overlay.png") as im:
            self.assertEqual(im.size, (10, 10))
            self.assertEqual(im.getpixel((5, 5)), (127, 127, 255))
        with Image.open(self.work / "head-side.png") as im:
            self.assertEqual(im.size, (20, 10))
            self.assertEqual(im.getpixel((15, 5)), (0, 0, 255))

    def test_isolation_keeps_all_part_segments_and_resources(self):
        dest = self.work / "hair.png"
        self.run_tool("render.py", self.svg, dest, "--part", "hair", "--scale", 2)
        with Image.open(dest) as im:
            self.assertEqual(im.size, (40, 40))
            self.assertEqual(im.getpixel((30, 10)), (255, 0, 0, 255))
            self.assertEqual(im.getpixel((6, 6)), (0, 255, 0, 255))
        self.run_tool("render.py", self.svg, dest, "--id", "front")
        with Image.open(dest) as im:
            self.assertEqual(im.getpixel((5, 10))[3], 0)
            self.assertEqual(im.getpixel((15, 10)), (0, 0, 255, 255))

    def test_mismatched_dimensions_and_viewboxes_are_rejected(self):
        ref = self.work / "wrong.png"
        Image.new("RGB", (21, 20), "white").save(ref)
        self.run_tool("compare.py", ref, self.svg, self.work / "bad", expected=2)
        self.assertFalse((self.work / "bad-side.png").exists())
        wrong = self.work / "shifted.svg"
        wrong.write_text(SAMPLE.replace('viewBox="0 0 20 20"', 'viewBox="1 0 20 20"'))
        self.run_tool("compare.py", wrong, self.svg, self.work / "bad", expected=2)

    def test_unknown_selector_and_overwrite_are_rejected(self):
        self.run_tool("render.py", self.svg, self.work / "empty.png", "--part", "missing", expected=2)
        self.assertFalse((self.work / "empty.png").exists())
        self.run_tool("render.py", self.svg, self.svg, expected=2)
        self.run_tool("render.py", self.svg, self.work / "out.png", "--manifest", self.svg, expected=2)
        self.run_tool("inspect_svg.py", self.svg, "--output", self.svg, expected=2)

    def test_structure_finds_broken_references_duplicates_and_changes(self):
        broken = self.work / "broken.svg"
        broken.write_text(SAMPLE.replace('href="#tile"', 'href="#absent"').replace('id="cover"', 'id="base"'))
        result = self.run_tool("inspect_svg.py", broken, expected=1)
        data = json.loads(result.stdout)
        self.assertEqual(data["duplicate_ids"], ["base"])
        self.assertEqual(data["missing_local_references"], ["absent"])
        changed = self.work / "changed.svg"
        changed.write_text(SAMPLE.replace('x="10"', 'x="9"'))
        result = self.run_tool("inspect_svg.py", changed, "--baseline", self.svg)
        changes = json.loads(result.stdout)["comparison"]["changed_elements"]
        self.assertEqual(len(changes), 1)
        self.assertEqual(changes[0]["id"], "cover")
        self.assertEqual(changes[0]["attributes"]["x"], {"before": "10", "after": "9"})

    def test_identical_render_and_out_of_canvas_crop(self):
        self.run_tool("compare.py", self.svg, self.svg, self.work / "same")
        self.assertTrue(json.loads((self.work / "same.json").read_text())["identical_render"])
        self.run_tool("render.py", self.svg, self.work / "invalid.png", "--crop", 10, 10, 20, 20, expected=2)

    def test_effect_toggle_ignores_document_stage_marker(self):
        staged = self.work / "staged.svg"
        staged.write_text(SAMPLE.replace('<svg ', '<svg data-stage="05-1" ', 1)
                          .replace('id="front"', 'id="front" data-stage="05-1"'))
        dest = self.work / "flat.png"
        self.run_tool("render.py", staged, dest, "--hide-stage", "05-1")
        with Image.open(dest) as im:
            self.assertEqual(im.getpixel((15, 10)), (255, 0, 0, 255))


if __name__ == "__main__":
    unittest.main()
