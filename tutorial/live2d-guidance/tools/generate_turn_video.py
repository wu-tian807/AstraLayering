#!/usr/bin/env python3
"""Generate a reference head-turn video (Seedance via an OpenAI Videos API proxy).

The result is a shape prior for nine-axis work; it is not a production asset.
Connection settings are the video keys in the live2d-maker skill `.env`
(video_base_url / video_api_key; the shell environment overrides them). The
image keys are never used.

Each run writes <out>.mp4 and <out>.json (model, parameters, prompt, input and
output SHA-256, remote video id). The API key is never written or printed.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_ENV = Path(__file__).resolve().parents[3] / '.agents/skills/live2d-maker/.env'
TERMINAL = {'completed', 'failed', 'cancelled', 'expired'}


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def connection(env_path: Path) -> tuple[str, str]:
    env = read_env(env_path)
    base = os.environ.get('video_base_url') or env.get('video_base_url') or env.get('layering_video_base_url')
    key = os.environ.get('video_api_key') or env.get('video_api_key') or env.get('layering_video_api_key')
    if not base or not key:
        sys.exit(f'缺少视频接口配置：在 {env_path} 填写 video_base_url 和 video_api_key。')
    return base.rstrip('/'), key


def request(method: str, url: str, key: str, body: bytes | None = None,
            content_type: str | None = None, timeout: int = 120) -> bytes:
    headers = {'Authorization': f'Bearer {key}'}
    if content_type:
        headers['Content-Type'] = content_type
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode('utf-8', 'replace')[:2000]
        sys.exit(f'{method} {url} -> HTTP {error.code}: {detail}')


def data_url(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or 'image/png'
    return f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--image', type=Path, required=True, help='首帧参考图（正面原图）')
    parser.add_argument('--prompt', help='提示词文本；与 --prompt-file 二选一')
    parser.add_argument('--prompt-file', type=Path)
    parser.add_argument('--out', type=Path, required=True, help='输出路径前缀，生成 .mp4 与 .json')
    parser.add_argument('--model', default='seedance-2.5')
    parser.add_argument('--seconds', default='5')
    parser.add_argument('--size', help='如 720x1280；留空由服务决定')
    parser.add_argument('--extra', action='append', default=[], metavar='KEY=VALUE',
                        help='额外请求字段，原样透传给服务')
    parser.add_argument('--env', type=Path, default=DEFAULT_ENV)
    parser.add_argument('--poll', type=float, default=10)
    parser.add_argument('--timeout', type=float, default=1800, help='等待生成的最长秒数')
    args = parser.parse_args()

    prompt = args.prompt if args.prompt is not None else (
        args.prompt_file.read_text(encoding='utf-8') if args.prompt_file else None)
    if not prompt:
        parser.error('需要 --prompt 或 --prompt-file')
    base, key = connection(args.env)

    fields = {'model': args.model, 'prompt': prompt, 'seconds': str(args.seconds)}
    if args.size:
        fields['size'] = args.size
    for item in args.extra:
        name, _, value = item.partition('=')
        fields[name] = value
    # The proxy drops multipart uploads (silently falls back to text-to-video);
    # a data URL in a JSON body is what selects image-to-video.
    body = json.dumps({**fields, 'input_reference': data_url(args.image)}).encode()
    created = json.loads(request('POST', f'{base}/videos', key, body, 'application/json'))
    video_id = created['id']
    print(f'已提交 {video_id}（{args.model}）', flush=True)

    started = time.monotonic()
    status = created
    while status.get('status') not in TERMINAL:
        if time.monotonic() - started > args.timeout:
            sys.exit(f'等待超时：{video_id} 仍为 {status.get("status")}')
        time.sleep(args.poll)
        status = json.loads(request('GET', f'{base}/videos/{video_id}', key))
        print(f'  {status.get("status")} {status.get("progress", "")}', flush=True)
    if status['status'] != 'completed':
        sys.exit(f'生成失败：{json.dumps(status, ensure_ascii=False)[:2000]}')

    video = request('GET', f'{base}/videos/{video_id}/content', key, timeout=600)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    mp4 = args.out.with_suffix('.mp4')
    mp4.write_bytes(video)
    record = {
        'tool': 'generate_turn_video.py', 'model': args.model, 'videoId': video_id,
        'fields': {k: v for k, v in fields.items() if k != 'prompt'}, 'prompt': prompt,
        'input': {'path': str(args.image), 'sha256': sha256(args.image.read_bytes())},
        'output': {'path': mp4.name, 'sha256': sha256(video), 'bytes': len(video)},
        'status': {k: v for k, v in status.items() if k not in ('url',)},
        'elapsedSeconds': round(time.monotonic() - started, 1),
    }
    mp4.with_suffix('.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'完成：{mp4}（{len(video)} 字节）')


if __name__ == '__main__':
    main()
