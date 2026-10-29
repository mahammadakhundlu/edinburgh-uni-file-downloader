# Edinburgh uni file downloader

A Chrome extension that finds files linked on an Edinburgh Moodle course page or Learn schedule and downloads them in one batch. Built as a personal project to learn how browser extensions work.

It supports Edinburgh Maths Moodle and Edinburgh Learn. This is a personal learning project, not an official University of Edinburgh extension.

## Latest update: 1.1.1

Fixed scanning of Learn schedules uploaded as HTML, including documents redirected to signed storage, inline frames, and slide links in sibling course folders. Moodle regression checks still pass. The updated extension has been manually confirmed working on an Edinburgh Moodle course and a Learn Computer Systems schedule, alongside the automated checks.

To update an existing installation, replace the files in the folder Chrome currently loads, then click its reload button at `chrome://extensions`. Refresh the Learn page and reopen the extension. Alternatively, remove the old extension and use **Load unpacked** to select this new folder. Confirm the extension version is **1.1.1**.

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
5. Files go into **Downloads / Edinburgh Uni / course or document title**. Check actual completion at `chrome://downloads`.

Try one PDF first and open it before running a full batch. Repeated downloads create numbered copies. If Chrome keeps asking for a location, optionally disable **Ask where to save each file before downloading** in Settings > Downloads.

## Coverage

- Moodle: file resources, linked folder resources and direct Moodle file links.
- Learn: PDFs, Office documents, archives, text and common source-code file links on university domains; Blackboard `/bbcswebdav/` links, including extensionless files; links inside accessible Learn frames.
- Linked Learn content folders are inspected within their own folder boundaries, at most two levels deep and 100 requests per frame.
- Extensionless files are checked for file type and filename. Original authenticated Learn URLs are retained when the server redirects to cloud file storage.

Scans the loaded page and accessible frames, not the entire course automatically. Open additional Learn documents/pages and scan separately. Quizzes, submission activities, videos, HTML textbooks, ordinary external websites and restricted/unlinked material are excluded. Folder listings requiring special Blackboard controls may need opening manually.

Automated tests use simulated pages. The extension has been manually confirmed on Edinburgh Moodle and a Learn Computer Systems schedule; other course layouts may differ. If links are missing, a redacted example link helps diagnose them. Downloads accepted by Chrome can still fail later due to an expired login, server error or browser policy; check Chrome's Downloads page.

## Permissions and privacy

- `activeTab` and `scripting`: scan the open course when you click the extension.
- Host access to `learn.ed.ac.uk` and `www.learn.ed.ac.uk`: inspect embedded Learn frames and resolve links across those two hosts. Chrome may ask you to allow this access.
- `downloads`: start file downloads using your existing site session.

No password collection, analytics, remote code or third-party backend. No automatic page monitoring. Requests go to the linked university servers and may follow their normal file-storage redirects. Your browser's ordinary download history still applies.

## Learn the code

| File | Purpose |
| --- | --- |
| `manifest.json` | Name, version, permissions and entry points |
| `popup.html` / `popup.css` | Popup wording and design |
| `popup.js` | Combines results from frames and connects buttons |
| `scanner.js` | Moodle and Learn file discovery |
| `background.js` | URL validation and browser downloads |
| `tests/` | Automated checks without real course access |

Change a heading in `popup.html` or a color in `popup.css`, then reload the extension at `chrome://extensions` and reopen the popup.

With Node.js installed, run `npm test`. GitHub Actions runs the same checks on pushes and pull requests. No dependency installation is required.

## Development status

The Moodle and Learn scanners have automated checks, including duplicate links, folder boundaries, expired sessions and download validation. Manual checks have also confirmed downloads on an Edinburgh Moodle course and a Learn Computer Systems schedule. If you find a link that does not work, open an issue with the site, what you expected, and a redacted example of the link.

## How it works

1. The popup scans the open page and accessible embedded frames.
2. The scanner collects direct file links and checks linked Moodle resources or Learn content folders.
3. You choose which files to keep.
4. The background script validates the URLs and asks Chrome to download them into a course folder.

The code uses plain JavaScript, small functions, explicit loops and named intermediate results. There is no framework or build step.

## Contributing

Bug reports and small improvements are welcome. Run `npm test` before submitting a change. If reporting a missing link, include a redacted example rather than uploading course materials.

## References

- [Chrome local extension installation](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)
- [Chrome scripting and frames](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [Chrome downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads)
- [ChatGPT/Codex plugins](https://learn.chatgpt.com/docs/plugins)
