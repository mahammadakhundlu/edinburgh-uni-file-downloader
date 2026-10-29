// Runs inside the course tab so requests use your existing Moodle session.
async function scanCourse() {
    if (["learn.ed.ac.uk", "www.learn.ed.ac.uk"].includes(location.hostname)) return scanLearn();
    if (location.hostname !== "moodle1.maths.ed.ac.uk")
        throw new Error("Open your Edinburgh Maths Moodle course page first.");
    const root = document.querySelector("#region-main") || document.querySelector("main");
    if (!root) throw new Error("No course content found. Open a Moodle course page.");
    const course = document.querySelector("h1")?.textContent.trim() || document.title;
    const files = new Map(),
        resources = new Map(),
        issues = [];
    const getMoodleFileUrl = (value) => {
        try {
            const url = new URL(value, location.href);
            return url.origin === location.origin &&
                /\/pluginfile\.php\//.test(url.pathname) &&
                /\/mod_(resource|folder|page)\//.test(url.pathname)
                ? url
                : null;
        } catch {
            return null;
        }
    };
    function addFile(value, label) {
        const url = getMoodleFileUrl(value);
        if (!url) return;
        url.hash = "";
        url.searchParams.delete("forcedownload");
        const key = url.href;
        url.searchParams.set("forcedownload", "1");
        let filename;
        try {
            filename = decodeURIComponent(url.pathname.split("/").pop());
        } catch {
            filename = url.pathname.split("/").pop();
        }
        if (filename) files.set(key, { url: url.href, filename, label: label || filename });
    }
    for (const a of root.querySelectorAll("a[href]")) {
        const url = new URL(a.getAttribute("href"), location.href);
        if (url.origin !== location.origin) continue;
        const label = (a.querySelector(".instancename")?.textContent || a.textContent)
            .replace(/\s+/g, " ")
            .trim();
        if (getMoodleFileUrl(url.href)) addFile(url.href, label);
        else if (/\/mod\/(resource|folder)\/view\.php$/.test(url.pathname)) {
            url.hash = "";
            resources.set(url.href, label || "Course resource");
        }
    }
    const pendingResources = [...resources];
    async function checkResources() {
        while (pendingResources.length) {
            const [url, label] = pendingResources.shift();
            try {
                const response = await fetch(url, {
                    credentials: "same-origin",
                    signal: AbortSignal.timeout(20000),
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                if (
                    new URL(response.url).origin !== location.origin ||
                    /\/login\//.test(new URL(response.url).pathname)
                )
                    throw new Error("Please sign in again");
                // Some Moodle resources redirect straight to a file. Avoid reading its body.
                if (getMoodleFileUrl(response.url)) {
                    addFile(response.url, label);
                    await response.body?.cancel();
                    continue;
                }
                if (!(response.headers.get("content-type") || "").includes("text/html")) {
                    await response.body?.cancel();
                    throw new Error("Could not identify the file URL");
                }
                const page = new DOMParser().parseFromString(await response.text(), "text/html");
                const content = page.querySelector("#region-main") || page.querySelector("main");
                let found = false;
                for (const element of content?.querySelectorAll(
                    "a[href],iframe[src],embed[src],object[data]",
                ) || []) {
                    const value =
                        element.getAttribute("href") ||
                        element.getAttribute("src") ||
                        element.getAttribute("data");
                    const resolved = new URL(value, response.url).href;
                    if (getMoodleFileUrl(resolved)) {
                        addFile(resolved, label);
                        found = true;
                    }
                }
                if (!found) throw new Error("No downloadable file found");
            } catch (e) {
                issues.push(`${label}: ${e.message}`);
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(4, pendingResources.length) }, checkResources));
    return { course, files: [...files.values()], issues };
}

// Learn Ultra often renders its documents inside a separate frame. The popup
// invokes this in each accessible frame and combines the resulting file lists.
async function scanLearn() {
    const course =
        document.querySelector("h1")?.textContent.trim() || document.title || "Learn course";
    const files = new Map(),
        issues = [],
        pendingResources = [],
        visited = new Set();
    const university = (url) =>
        url.protocol === "https:" &&
        (url.hostname === "ed.ac.uk" || url.hostname.endsWith(".ed.ac.uk"));
    const learn = (url) => ["learn.ed.ac.uk", "www.learn.ed.ac.uk"].includes(url.hostname);
    const webdav = (url) => learn(url) && url.pathname.startsWith("/bbcswebdav/");
    const extension =
        /\.(pdf|pptx?|docx?|xlsx?|csv|txt|zip|7z|rar|tar|gz|ipynb|py|java|c|cpp|h|hs|r|m|s|asm|tex|epub|odt|ods|odp)$/i;
    function addFile(url, label, name) {
        url.hash = "";
        let filename = name;
        if (!filename) {
            try {
                filename = decodeURIComponent(url.pathname.split("/").pop());
            } catch {
                filename = url.pathname.split("/").pop();
            }
        }
        if (filename) files.set(url.href, { url: url.href, filename, label: label || filename });
    }
    function collectLinks(page, base, depth = 0, boundary = null) {
        for (const element of page.querySelectorAll(
            "a[href],iframe[src],embed[src],object[data]",
        )) {
            const raw =
                element.getAttribute("href") ||
                element.getAttribute("src") ||
                element.getAttribute("data");
            // Ultra can place the whole schedule in an inline or same-origin frame.
            if (depth <= 2) {
                const inlineHtml = element.getAttribute("srcdoc");
                if (inlineHtml) {
                    const framePage = new DOMParser().parseFromString(inlineHtml, "text/html");
                    collectLinks(framePage, base, depth + 1);
                }
                try {
                    if (element.contentDocument) {
                        collectLinks(element.contentDocument, element.contentDocument.baseURI || base, depth + 1);
                    }
                } catch {
                    // Cross-origin documents are checked through their linked URL below.
                }
            }
            if (!raw || raw.startsWith("#")) continue;
            let url;
            try {
                url = new URL(raw, base);
            } catch {
                continue;
            }
            if (!university(url)) continue;
            if (
                boundary &&
                (url.origin !== boundary.origin || !url.pathname.startsWith(boundary.pathname))
            )
                continue;
            const label = (element.textContent || element.getAttribute("title") || "")
                .replace(/\s+/g, " ")
                .trim();
            if (extension.test(url.pathname)) addFile(url, label);
            else if (
                webdav(url) &&
                !/\.(js|css|png|jpe?g|svg|gif|mp4)$/i.test(url.pathname)
            ) {
                url.hash = "";
                if (depth <= 2 && !visited.has(url.href)) {
                    visited.add(url.href);
                    pendingResources.push({ url, label, depth });
                }
            }
        }
    }
    collectLinks(document, document.baseURI || location.href);
    // Bounded traversal only of explicitly linked Learn content folders, never
    // parent folders, quiz actions, the rest of the course, or external websites.
    let checked = 0;
    while (pendingResources.length && checked < 100) {
        const { url, label, depth } = pendingResources.shift();
        checked++;
        try {
            const response = await fetch(url.href, {
                credentials: "include",
                signal: AbortSignal.timeout(15000),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const type = (response.headers.get("content-type") || "").toLowerCase();
            const disposition = response.headers.get("content-disposition") || "";
            if (type.includes("text/html") || type.includes("application/xhtml")) {
                const final = new URL(response.url);
                const isLoginPage = learn(final) && /\/(login|auth)(\/|\.|$)|\/webapps\/login/i.test(final.pathname);
                if (final.protocol !== "https:" || isLoginPage) {
                    await response.body?.cancel();
                    throw new Error("Sign in again or open this link manually");
                }
                const page = new DOMParser().parseFromString(await response.text(), "text/html");
                // Learn serves uploaded HTML via signed storage redirects. It is
                // still the linked document, so read its links instead of treating
                // the redirect as a failed login. DOMParser does not run its scripts.
                // Use the original content URL for relative paths when storage is
                // on a different host, rather than following storage URLs as files.
                let base = webdav(final) ? final.href : url.href;
                const declaredBase = page.querySelector?.("base[href]")?.getAttribute("href");
                if (declaredBase) {
                    const candidate = new URL(declaredBase, base);
                    if (university(candidate)) base = candidate.href;
                }
                // A folder stays within its subtree. An HTML schedule can link
                // to sibling course folders and must not use the HTML filename
                // as a folder boundary.
                let boundary = null;
                if (url.pathname.endsWith("/")) {
                    boundary = new URL(url.href);
                    boundary.search = "";
                    boundary.hash = "";
                }
                const before = files.size,
                    queued = pendingResources.length;
                collectLinks(page, base, depth + 1, boundary);
                if (files.size === before && pendingResources.length === queued)
                    throw new Error("No files found in this linked page or folder");
            } else {
                await response.body?.cancel();
                if (!type || /json|javascript|xml/.test(type))
                    throw new Error("Could not identify a downloadable file");
                let name;
                const encoded = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
                const plain = disposition.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i);
                if (encoded) {
                    try {
                        name = decodeURIComponent(encoded[1].trim());
                    } catch {}
                }
                if (!name && plain) name = (plain[1] || plain[2]).trim();
                const types = {
                    "application/pdf": ".pdf",
                    "application/zip": ".zip",
                    "text/plain": ".txt",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
                        ".pptx",
                };
                if (!name && types[type.split(";")[0]])
                    name = (label || "Course file") + types[type.split(";")[0]];
                // Keep the original authenticated Learn URL; cloud redirects may expire.
                addFile(url, label, name);
            }
        } catch (e) {
            issues.push(`${label || url.pathname}: ${e.message}`);
        }
    }
    if (pendingResources.length)
        issues.push("Scan limit reached. Open the remaining folder and scan it separately.");
    return { course, files: [...files.values()], issues };
}
