# pexels-gallery-downloader
Small toolkit for collecting a Pexels profile gallery in the browser and then downloading the resolved photo and video files on Linux or Windows.

If you want a practical way to archive a public Pexels creator gallery without fighting browser challenges from a headless terminal flow, this project is built for that use case.

It works in two stages:

- browser-based manifest generation
- terminal-based downloading from that manifest

The browser step is manual on purpose. Pexels profile pages are protected by normal browser checks and Cloudflare challenges, so the reliable approach is to collect the gallery metadata inside a real browser session first, then download the resolved files from a terminal afterward.

## Why this exists

This project is useful when you want:

- a repeatable way to collect a public Pexels creator gallery
- a workflow that works on both Linux and Windows
- a practical browser-first solution instead of a fragile headless scraper
- a resumable download process for large galleries
- a small toolset that stays easy to understand and reuse

It is not meant to be a generic web scraping framework. It is meant to stay focused on one practical workflow:

1. open a Pexels profile in the browser
2. generate a manifest JSON
3. download the files from Linux or PowerShell

## Who this is for

This project is a good fit for:

- designers who want to collect Pexels gallery assets for inspiration or project use
- developers who want a repeatable way to download large public Pexels galleries
- content creators who prefer saving a full creator gallery instead of downloading files one by one
- Linux users who want a terminal-based downloader after a browser step
- Windows users who want a PowerShell-based downloader
- anyone who needs to resume large downloads without starting over

This project is probably not enough by itself if you need:

- a fully automated browser bypass flow
- unattended scraping without any manual browser session
- support for many stock media websites beyond Pexels

## How it works

The same browser snippet works for any public Pexels profile page. You do not need a different script per creator.

The flow is simple:

- open a public Pexels profile in Chrome
- run the browser snippet from `browser/pexels_manifest_export.js`
- let it collect gallery items and resolve the real media URLs
- copy the generated JSON manifest
- save that manifest to a `.json` file
- run either the Linux downloader or the Windows PowerShell downloader

The downloaders do not use thumbnail grid URLs. They use the resolved `download_url` values from the manifest.

## What is included

This project contains:

- `browser/pexels_manifest_export.js`: browser snippet for collecting a profile gallery manifest
- `linux/download_from_manifest.py`: Linux downloader
- `windows/download_from_manifest.ps1`: Windows PowerShell downloader
- `examples/manifest.example.json`: example manifest structure

## Requirements

### Browser requirements

For manifest generation you need:

- Google Chrome or another Chromium-based browser
- access to the public Pexels profile page you want to collect
- DevTools access with `F12`

### Linux requirements

For the Linux downloader you need:

- Linux shell access
- Python 3
- standard library networking support available in Python
- write access to the target download directories
- enough free disk space for the files you are downloading

Check Python:

```bash
python3 --version
```

### Windows requirements

For the PowerShell downloader you need:

- Windows PowerShell or PowerShell
- permission to run local PowerShell scripts
- write access to the target download directories
- enough free disk space for the files you are downloading

Check PowerShell:

```powershell
$PSVersionTable.PSVersion
```

If script execution is blocked, run the script with `ExecutionPolicy Bypass` as
shown later in this README.

## Browser manifest generation

Open the target Pexels profile in Chrome.

Example:

```text
https://www.pexels.com/@silverkblack/
```

Then:

1. Press `F12`
2. Open `Sources`
3. In the left sidebar, open `Snippets`
4. Create a new snippet
5. Paste the contents of [browser/pexels_manifest_export.js](/home/mert/projects/pexels-gallery-downloader/browser/pexels_manifest_export.js)
6. Run it with `Ctrl+Enter`
7. Wait for all scan and resolve messages to finish

After it finishes, go to the console and run:

```js
copy(JSON.stringify(window.pexelsPayload, null, 2))
```

Then:

1. Open Notepad or another text editor
2. Press `Ctrl+V`
3. Save the file as a manifest JSON

Example manifest paths:

```text
E:\pexels-assets\silverkblack-manifest.json
/data/pexels-assets/silverkblack-manifest.json
```

If clipboard access fails in DevTools, run this instead and copy the JSON manually:

```js
JSON.stringify(window.pexelsPayload, null, 2)
```

That saved JSON file becomes the input for both terminal downloaders.

## Why the browser step is manual

This project uses a browser step because that is the reliable part of the workflow.

The profile page is already open in a valid browser session, so the snippet can:

- scroll through the gallery
- click `Load more` when needed
- open each media detail page
- resolve the direct photo or video URL

That is far more stable than trying to force the whole process through a plain terminal scraper.

## Linux usage

The Linux downloader reads a manifest file and downloads:

- photos into a photos directory
- videos into a videos directory

You can either give it one root directory or separate photo and video directories.

### Linux example with one root directory

```bash
python3 linux/download_from_manifest.py \
  /data/pexels-assets/silverkblack-manifest.json \
  --output-root /data/pexels-assets/silverkblack \
  --skip-existing
```

This writes to:

```text
/data/pexels-assets/silverkblack/photos
/data/pexels-assets/silverkblack/videos
```

### Linux example with separate directories

```bash
python3 linux/download_from_manifest.py \
  /data/pexels-assets/silverkblack-manifest.json \
  --photos-dir /data/pexels-assets/silverkblack-photos \
  --videos-dir /data/pexels-assets/silverkblack-videos \
  --skip-existing
```

### Linux resume example

If the process stops because the disk fills up or the terminal closes, run the same command again with `--skip-existing`:

```bash
python3 linux/download_from_manifest.py \
  /data/pexels-assets/silverkblack-manifest.json \
  --output-root /data/pexels-assets/silverkblack \
  --skip-existing
```

If you move the target to another disk, point the script at the new directories:

```bash
python3 linux/download_from_manifest.py \
  /data/pexels-assets/silverkblack-manifest.json \
  --photos-dir /mnt/bigdisk/silverkblack-photos \
  --videos-dir /mnt/bigdisk/silverkblack-videos \
  --skip-existing
```

## Windows PowerShell usage

The PowerShell downloader follows the same logic as the Linux downloader.

You can give it:

- one root output directory
- or separate photo and video directories

### PowerShell example with one root directory

```powershell
.\windows\download_from_manifest.ps1 `
  -ManifestPath "E:\pexels-assets\silverkblack-manifest.json" `
  -OutputRoot "E:\pexels-assets\silverkblack" `
  -SkipExisting
```

This writes to:

```text
E:\pexels-assets\silverkblack\photos
E:\pexels-assets\silverkblack\videos
```

### PowerShell example with separate directories

```powershell
.\windows\download_from_manifest.ps1 `
  -ManifestPath "E:\pexels-assets\silverkblack-manifest.json" `
  -PhotosDir "E:\pexels-assets\silverkblack-photos" `
  -VideosDir "E:\pexels-assets\silverkblack-videos" `
  -SkipExisting
```

### PowerShell resume example

If a download stops, rerun it with `-SkipExisting`:

```powershell
powershell -ExecutionPolicy Bypass -File ".\windows\download_from_manifest.ps1" `
  -ManifestPath "E:\pexels-assets\silverkblack-manifest.json" `
  -OutputRoot "E:\pexels-assets\silverkblack" `
  -SkipExisting
```

If you move the target to another drive after running out of space:

```powershell
powershell -ExecutionPolicy Bypass -File ".\windows\download_from_manifest.ps1" `
  -ManifestPath "E:\pexels-assets\silverkblack-manifest.json" `
  -PhotosDir "F:\pexels-assets\silverkblack-photos" `
  -VideosDir "F:\pexels-assets\silverkblack-videos" `
  -SkipExisting
```

## Manifest format

Each manifest item should contain:

- `id`
- `kind`
- `page_url`
- `download_url`

See [examples/manifest.example.json](/home/mert/projects/pexels-gallery-downloader/examples/manifest.example.json).

## Behavior and safeguards

The downloaders are designed to stay practical for large galleries.

They:

- create missing target directories automatically
- stop with an explicit error if the target drive does not exist
- skip already-downloaded files when `--skip-existing` or `-SkipExisting` is used
- print a clear warning if the target drive runs out of space
- print a summary at the end of the run

This makes the workflow easier to resume after interruptions.

## Troubleshooting

If the browser snippet stops too early:

- rerun it on the profile page
- let it finish all `resolve` steps before copying the JSON

If clipboard copy fails:

- print `JSON.stringify(window.pexelsPayload, null, 2)` in the console
- copy the JSON manually
- save it as `something-manifest.json`

If PowerShell blocks script execution:

```powershell
powershell -ExecutionPolicy Bypass -File ".\windows\download_from_manifest.ps1" -ManifestPath "E:\pexels-assets\silverkblack-manifest.json" -OutputRoot "E:\pexels-assets\silverkblack"
```

If a download fails partway through:

- rerun the same command with `--skip-existing` or `-SkipExisting`
- or point the downloader at a new disk and continue from there

## Author

Built by Mert Can Girgin

MSc | DevOps Engineer | Linux Administrator

Guardian of the Linux realms. No outage shall pass.
