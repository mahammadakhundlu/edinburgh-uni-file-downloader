const fs = require("node:fs"),
    vm = require("node:vm"),
    assert = require("node:assert/strict"),
    path = require("node:path");
const dir = path.join(__dirname, "../"),
    base = "https://learn.ed.ac.uk";
function link(href, text = "Slides") {
    return { textContent: text, getAttribute: (k) => (k === "href" ? href : null) };
}
const folder = base + "/bbcswebdav/courses/TEST/slides/",
    opaque = base + "/bbcswebdav/xid-123_1";
const nodes = [
    link(folder),
    link(opaque, "Lecture"),
    link("https://www.inf.ed.ac.uk/teaching/tasks.zip", "Source"),
    link("javascript:alert(1)"),
    link("https://evil.ed.ac.uk.evil.com/file.pdf"),
    link(base + "/ultra/quiz/1"),
];
let requests = [];
const ctx = {
    URL,
    Map,
    Set,
    AbortSignal,
    location: { hostname: "learn.ed.ac.uk", href: base + "/ultra/courses/TEST", origin: base },
    document: {
        title: "Computer Systems",
        querySelector: () => null,
        querySelectorAll: () => nodes,
    },
    fetch: async (url) => {
        requests.push(url);
        return {
            ok: true,
            url,
            headers: {
                get: (key) =>
                    key === "content-type"
                        ? url === opaque
                            ? "application/pdf"
                            : "text/html"
                        : url === opaque
                          ? "attachment; filename*=UTF-8''Lecture%201.pdf"
                          : null,
            },
            body: { cancel: async () => {} },
            text: async () => "<folder>",
        };
    },
    DOMParser: class {
        parseFromString() {
            return {
                querySelectorAll: () => [
                    link(folder + "week1.pdf"),
                    link(folder + "week1.pdf"),
                    link(base + "/bbcswebdav/courses/OTHER/private.pdf"),
                    link("../parent.pdf"),
                    link("https://example.com/no.pdf"),
                ],
            };
        }
    },
};
(async () => {
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(dir + "scanner.js", "utf8"), ctx);
    const result = await ctx.scanCourse();
    assert.equal(result.files.length, 3);
    assert.equal(requests.length, 2);
    assert.equal(result.issues.length, 0);
    assert(result.files.some((f) => f.filename === "Lecture 1.pdf" && f.url === opaque));
    assert(result.files.some((f) => f.filename === "week1.pdf"));
    assert(!result.files.some((f) => f.url.includes("private") || f.url.includes("evil")));
    let listener;
    const downloaded = [];
    const bg = {
        URL,
        chrome: {
            runtime: { id: "self", onMessage: { addListener: (fn) => (listener = fn) } },
            downloads: { download: async (x) => downloaded.push(x) },
        },
    };
    vm.createContext(bg);
    vm.runInContext(fs.readFileSync(dir + "background.js", "utf8"), bg);
    const response = await new Promise((reply) =>
        listener(
            {
                type: "download",
                course: result.course,
                files: [
                    ...result.files,
                    { url: "https://evil.ed.ac.uk.evil.com/file.pdf" },
                    { url: "http://learn.ed.ac.uk/bbcswebdav/xid-1" },
                ],
            },
            { id: "self" },
            reply,
        ),
    );
    assert.equal(response.started, 3);
    assert.equal(response.failed.length, 2);
    ctx.fetch = async (url) => ({
        ok: true,
        url: base + "/login",
        headers: { get: () => "text/html" },
        body: { cancel: async () => {} },
    });
    assert.equal((await ctx.scanCourse()).issues.length, 2);
    ctx.location.hostname = "www.learn.ed.ac.uk";
    assert((await ctx.scanCourse()).files.some((f) => f.filename === "tasks.zip"));

    // The schedule in the bug report is an uploaded HTML file. Learn redirects
    // it to storage, and its slides live outside the HTML file's own path.
    const schedule = base + "/bbcswebdav/courses/TEST/UNSAFE_HTML_20261029135851.html";
    const slides = "https://www.learn.ed.ac.uk/bbcswebdav/courses/TEST/L4-6_ISA_slides.pdf";
    ctx.document.querySelectorAll = () => [link(schedule, "User-generated HTML")];
    ctx.fetch = async () => ({
        ok: true,
        url: "https://storage.example.edu/signed/schedule.html?token=example",
        headers: { get: () => "text/html" },
        text: async () => "<schedule>",
    });
    ctx.DOMParser = class {
        parseFromString() {
            return { querySelectorAll: () => [
                link(slides, "MIPS ISA 1"),
                link("tutorials/tutorial1.pdf", "Tutorial 1"),
                link("https://evil.example/file.pdf"),
            ] };
        }
    };
    const scheduleResult = await ctx.scanCourse();
    assert.equal(scheduleResult.issues.length, 0);
    assert.equal(scheduleResult.files.length, 2);
    assert(scheduleResult.files.some(file => file.url === slides));
    assert(scheduleResult.files.some(file => file.url === base + "/bbcswebdav/courses/TEST/tutorials/tutorial1.pdf"));

    // The storage URL need not end in .html; the response type is authoritative.
    ctx.document.querySelectorAll = () => [link(base + "/bbcswebdav/pid-1/xid-2")];
    assert.equal((await ctx.scanCourse()).files.length, 2);

    // An about:blank/srcdoc frame can be visible without a separate permitted
    // frame injection. The parent scan must still read its links.
    ctx.document.querySelectorAll = () => [{
        textContent: "",
        getAttribute: name => name === "srcdoc" ? "<schedule>" : null,
    }];
    const inlineResult = await ctx.scanCourse();
    assert(inlineResult.files.some(file => file.url === slides));

    ctx.document.querySelectorAll = () => [{
        textContent: "",
        getAttribute: () => null,
        contentDocument: { baseURI: schedule, querySelectorAll: () => [link(slides)] },
    }];
    assert.equal((await ctx.scanCourse()).files.length, 1);
    console.log(
        "PASS: Learn links, folder boundaries, WebDAV files, login expiry, redirected HTML schedules, sibling slide links, relative paths, inline frames, and download validation.",
    );
})().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
