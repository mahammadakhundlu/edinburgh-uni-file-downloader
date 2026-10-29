# Edinburgh uni file downloader

A Chrome extension that finds files linked on an Edinburgh Moodle course page or Learn schedule and downloads them in one batch.
It supports Edinburgh Maths Moodle and Edinburgh Learn. This is a personal learning project, not an official University of Edinburgh extension.

## Install

No build step, dependencies, API keys, or GitHub connection needed.

1. Extract the ZIP (or clone this repository).
2. Type `chrome://extensions` into Chrome.
3. Enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
4. Pin **Edinburgh uni file downloader** using Chrome's puzzle-piece menu.

If replacing the Moodle-only prototype, remove that extension first and load this folder instead.

## Use

1. Sign in normally and open your Moodle course or Learn schedule/document.
2. Expand sections and scroll through the page so its links are loaded.
3. Click the extension. Keep the popup open until scanning finishes.
4. Review the file list, untick anything unwanted, then click **Download all**.
5. Check actual completion at `chrome://downloads` to see where files go.

Try one PDF first and open it before running a full batch. Repeated downloads create numbered copies. If Chrome keeps asking for a location, optionally disable **Ask where to save each file before downloading** in Settings > Downloads.

## How it works

1. The popup scans the open page and accessible embedded frames.
2. The scanner collects direct file links and checks linked Moodle resources or Learn content folders.
3. You choose which files to keep.
4. The background script validates the URLs and asks Chrome to download them into a course folder.

The code uses plain JavaScript, small functions, explicit loops and named intermediate results. There is no framework or build step.
