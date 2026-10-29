const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const dir = require("node:path").join(__dirname, "../");
function anchor(href, text) {
    return { getAttribute: () => href, textContent: text, querySelector: () => null };
}
const base = "https://moodle1.maths.ed.ac.uk";
const direct = base + "/live2023/pluginfile.php/1/mod_resource/content/1/notes.pdf";
const folder = base + "/live2023/pluginfile.php/2/mod_folder/content/0/tasks.pdf";
let fetches = 0;
const root = {
    querySelectorAll: () => [
        anchor(direct, "Notes"),
        anchor(direct + "?forcedownload=1", "Notes copy"),
        anchor(base + "/live2023/mod/resource/view.php?id=2", "Workshop"),
        anchor(base + "/live2023/mod/folder/view.php?id=3", "Folder"),
        anchor(base + "/live2023/mod/resource/view.php?id=4", "Restricted"),
        anchor(base + "/live2023/mod/quiz/view.php?id=9", "Quiz"),
        anchor("https://example.org/thing.pdf", "External"),
    ],
};
const ctx = {
    URL,
    Map,
    AbortSignal,
    location: {
        href: base + "/live2023/course/view.php?id=428",
        origin: base,
        hostname: "moodle1.maths.ed.ac.uk",
    },
    document: {
        title: "Course",
        querySelector: (s) => (s === "h1" ? { textContent: "Linear Algebra 2" } : root),
    },
    fetch: async (url) => {
        fetches++;
        if (url.endsWith("4")) return { ok: false, status: 403 };
        if (url.endsWith("2")) return { ok: true, url: direct, body: { cancel: async () => {} } };
        return { ok: true, url, headers: { get: () => "text/html" }, text: async () => "<folder>" };
    },
    DOMParser: class {
        parseFromString() {
            return { querySelector: () => ({ querySelectorAll: () => [anchor(folder, "Tasks")] }) };
        }
    },
};
(async () => {
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(dir + "scanner.js", "utf8"), ctx);
    const result = await ctx.scanCourse();
    assert.equal(result.files.length, 2);
    assert.equal(result.issues.length, 1);
    assert.equal(fetches, 3);
    assert.equal(result.course, "Linear Algebra 2");
    assert(result.files.every((f) => f.url.endsWith("forcedownload=1")));
    let listener;
    const downloads = [];
    const bg = {
        URL,
        chrome: {
            runtime: { id: "test", onMessage: { addListener: (fn) => (listener = fn) } },
            downloads: {
                download: async (args) => {
                    downloads.push(args);
                    return downloads.length;
                },
            },
        },
    };
    vm.createContext(bg);
    vm.runInContext(fs.readFileSync(dir + "background.js", "utf8"), bg);
    const response = await new Promise((resolve) =>
        listener(
            {
                type: "download",
                course: "../../Course: name",
                files: [
                    ...result.files,
                    result.files[0],
                    { url: "https://evil.example/x", label: "Invalid" },
                ],
            },
            { id: "test" },
            resolve,
        ),
    );
    assert.equal(response.started, 2);
    assert.equal(response.failed.length, 1);
    assert.equal(downloads.length, 2);
    assert(
        downloads.every(
            (x) => !x.filename.includes("..") && x.filename.startsWith("Edinburgh Uni/"),
        ),
    );
    assert.equal(downloads[0].conflictAction, "uniquify");
    assert.equal(
        listener({ type: "download" }, { id: "other" }, () => {
            throw Error("Wrong sender accepted");
        }),
        undefined,
    );
    console.log(
        "PASS: file discovery, deduplication, redirected files, folder files, restricted resources, quiz/external exclusion, filename safety, sender validation, and batch downloads.",
    );
})().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
