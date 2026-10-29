const learnHosts = ["learn.ed.ac.uk", "www.learn.ed.ac.uk"];
const fileExtensions =
    /\.(pdf|pptx?|docx?|xlsx?|csv|txt|zip|7z|rar|tar|gz|ipynb|py|java|c|cpp|h|hs|r|m|s|asm|tex|epub|odt|ods|odp)$/i;

function safeName(value) {
    const name = String(value)
        .normalize("NFKC")
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
        .replace(/\.{2,}/g, "_")
        .replace(/[. ]+$/g, "")
        .trim();

    return name.slice(0, 140) || "file";
}

function isSupportedFile(url) {
    if (url.protocol !== "https:") {
        return false;
    }

    const isMoodleFile =
        url.hostname === "moodle1.maths.ed.ac.uk" && /\/pluginfile\.php\//.test(url.pathname);

    const isLearnFile =
        learnHosts.includes(url.hostname) && url.pathname.startsWith("/bbcswebdav/");

    const isUniversityHost = url.hostname === "ed.ac.uk" || url.hostname.endsWith(".ed.ac.uk");

    return isMoodleFile || isLearnFile || (isUniversityHost && fileExtensions.test(url.pathname));
}

async function downloadFiles(course, files) {
    let started = 0;
    const failed = [];
    const seen = new Set();

    for (const file of files) {
        try {
            const url = new URL(file.url);

            if (!isSupportedFile(url)) {
                throw new Error("Unsupported file URL");
            }

            if (seen.has(url.href)) {
                continue;
            }
            seen.add(url.href);

            await chrome.downloads.download({
                url: url.href,
                filename: `Edinburgh Uni/${safeName(course)}/${safeName(file.filename)}`,
                conflictAction: "uniquify",
                saveAs: false,
            });
            started++;
        } catch (error) {
            failed.push(`${file.label || "File"}: ${error.message}`);
        }
    }

    return { started, failed };
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || message?.type !== "download") {
        return;
    }

    const files = Array.isArray(message.files) ? message.files : [];

    downloadFiles(message.course, files)
        .then(reply)
        .catch((error) => reply({ started: 0, failed: [error.message] }));

    // Chrome needs the message channel to stay open until downloads are queued.
    return true;
});
