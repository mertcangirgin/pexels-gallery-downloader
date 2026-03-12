#!/usr/bin/env python3
"""Download Pexels assets listed in a manifest JSON file."""

from __future__ import annotations

import argparse
import errno
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)


@dataclass
class Stats:
    photos_downloaded: int = 0
    videos_downloaded: int = 0
    skipped: int = 0
    failed: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download photo and video files from a Pexels manifest."
    )
    parser.add_argument(
        "manifest_path",
        help="Path to the manifest JSON file.",
    )
    parser.add_argument(
        "--output-root",
        help="Base directory. Files go to <output-root>/photos and <output-root>/videos.",
    )
    parser.add_argument(
        "--photos-dir",
        help="Explicit photos directory. Overrides --output-root for photos.",
    )
    parser.add_argument(
        "--videos-dir",
        help="Explicit videos directory. Overrides --output-root for videos.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.2,
        help="Delay in seconds between downloads. Default: %(default)s",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip files that already exist.",
    )
    return parser.parse_args()


def infer_extension(url: str, kind: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix:
        return suffix
    return ".jpg" if kind == "photo" else ".mp4"


def resolve_output_dirs(args: argparse.Namespace) -> tuple[Path, Path]:
    if not args.output_root and not (args.photos_dir and args.videos_dir):
        raise SystemExit(
            "Provide either --output-root or both --photos-dir and --videos-dir."
        )

    output_root = Path(args.output_root).expanduser().resolve() if args.output_root else None
    photos_dir = (
        Path(args.photos_dir).expanduser().resolve()
        if args.photos_dir
        else output_root / "photos"
    )
    videos_dir = (
        Path(args.videos_dir).expanduser().resolve()
        if args.videos_dir
        else output_root / "videos"
    )

    photos_dir.mkdir(parents=True, exist_ok=True)
    videos_dir.mkdir(parents=True, exist_ok=True)
    return photos_dir, videos_dir


def fetch_bytes(url: str) -> bytes:
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": "https://www.pexels.com/",
        },
    )
    with urlopen(request) as response:
        return response.read()


def main() -> int:
    args = parse_args()
    manifest_path = Path(args.manifest_path).expanduser().resolve()
    photos_dir, videos_dir = resolve_output_dirs(args)
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    items = payload.get("items")

    if not isinstance(items, list) or not items:
        print("Manifest does not contain any items.", file=sys.stderr)
        return 1

    stats = Stats()
    total = len(items)

    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            stats.failed += 1
            continue

        media_id = str(item.get("id", "")).strip()
        kind = str(item.get("kind", "")).strip()
        url = str(item.get("download_url", "")).strip()

        if not media_id or kind not in {"photo", "video"} or not url:
            print(f"[{index}/{total}] invalid manifest item", file=sys.stderr)
            stats.failed += 1
            continue

        target_dir = photos_dir if kind == "photo" else videos_dir
        destination = target_dir / f"{media_id}{infer_extension(url, kind)}"
        print(f"[{index}/{total}] {kind} -> {destination}", file=sys.stderr)

        if args.skip_existing and destination.exists():
            stats.skipped += 1
            print("  skipped existing", file=sys.stderr)
            continue

        try:
            destination.write_bytes(fetch_bytes(url))
        except OSError as exc:
            stats.failed += 1
            if exc.errno == errno.ENOSPC:
                print(
                    "  failed: no space left on the target drive. Free up disk space and rerun with --skip-existing.",
                    file=sys.stderr,
                )
            else:
                print(f"  failed: {exc}", file=sys.stderr)
        except (HTTPError, URLError) as exc:
            stats.failed += 1
            print(f"  failed: {exc}", file=sys.stderr)
            continue

        if kind == "photo":
            stats.photos_downloaded += 1
        else:
            stats.videos_downloaded += 1

        if args.delay > 0:
            time.sleep(args.delay)

    print("Summary")
    print(f"  photos_downloaded: {stats.photos_downloaded}")
    print(f"  videos_downloaded: {stats.videos_downloaded}")
    print(f"  skipped: {stats.skipped}")
    print(f"  failed: {stats.failed}")
    if stats.failed == 0:
        print("All files were downloaded successfully.")
    print("Built by Mert Can Girgin")
    print("MSc | DevOps Engineer | Linux Administrator")
    print("Guardian of the Linux realms. No outage shall pass.")
    return 0 if stats.failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
