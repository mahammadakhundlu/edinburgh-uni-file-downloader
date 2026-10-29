const supportedHosts = ["moodle1.maths.ed.ac.uk", "learn.ed.ac.uk", "www.learn.ed.ac.uk"];

let result = { files: [], course: "" };

function getElement(id) {
    return document.getElementById(id);
}

function updateSelection() {
    const boxes = [...document.querySelectorAll(".file input")];
    const selectedCount = boxes.filter((box) => box.checked).length;
    const allSelected = selectedCount === boxes.length;

    getElement("download").disabled = selectedCount === 0;
    getElement("download").textContent = allSelected
        ? `Download all ${selectedCount} files`
        : `Download ${selectedCount} selected files`;

    getElement("all").checked = boxes.length > 0 && allSelected;
    getElement("all").indeterminate = selectedCount > 0 && !allSelected;
}

function showIssues(issues) {
    const container = getElement("issues");
    container.replaceChildren();

    for (const issue of issues) {
        const paragraph = document.createElement("p");
        paragraph.textContent = issue;
        container.append(paragraph);
    }
}

function showFiles(files) {
    const container = getElement("files");
    container.replaceChildren();

    for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const row = document.createElement("label");
        row.className = "file";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.value = index;
        checkbox.addEventListener("change", updateSelection);

        const description = document.createElement("span");
        description.textContent = file.label;

        const filename = document.createElement("small");
        filename.textContent = file.filename;

        description.append(filename);
        row.append(checkbox, description);
        container.append(row);
    }
}

function combineScans(injections) {
    const files = new Map();
    const issues = new Set();
    let course = "";

    for (const injection of injections) {
        const scan = injection.result;
        if (!scan) continue;

        if (!course && scan.course) course = scan.course;
        for (const file of scan.files) files.set(file.url, file);
        for (const issue of scan.issues) issues.add(issue);
    }

    return {
        course: course || "Course files",
        files: [...files.values()],
        issues: [...issues],
    };
}

async function scanPage() {
    getElement("scan").disabled = true;
    getElement("download").disabled = true;
    getElement("all").disabled = true;
    getElement("files").replaceChildren();
    getElement("count").textContent = "Finding files…";
    getElement("status").textContent = "Checking file and folder links. Keep this popup open.";
    showIssues([]);

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const host = tab?.url && new URL(tab.url).hostname;

        if (!supportedHosts.includes(host)) {
            throw new Error(
                "Open your Edinburgh Moodle course or Learn document in this tab, then try again.",
            );
        }

        // Learn can put the schedule inside a frame instead of the main page.
        const target = { tabId: tab.id, allFrames: true };
        await chrome.scripting.executeScript({ target, files: ["scanner.js"] });

        const injections = await chrome.scripting.executeScript({
            target,
            func: async () => {
                try {
                    return await scanCourse();
                } catch (error) {
                    return { course: "", files: [], issues: [error.message] };
                }
            },
        });

        result = combineScans(injections);
        getElement("count").textContent = `${result.files.length} files found`;
        getElement("status").textContent =
            result.files.length > 0
                ? "Ready. Untick any files you want to leave out."
                : "No files found. Expand course sections, scroll through the page, and rescan.";

        showFiles(result.files);
        showIssues(result.issues);
        updateSelection();
    } catch (error) {
        result = { files: [], course: "" };
        getElement("count").textContent = "Open a course page";
        getElement("status").textContent = error.message;
    } finally {
        getElement("scan").disabled = false;
        getElement("all").disabled = false;
    }
}

async function downloadSelected() {
    const boxes = document.querySelectorAll(".file input:checked");
    const files = [];

    for (const box of boxes) {
        files.push(result.files[Number(box.value)]);
    }

    getElement("download").disabled = true;
    getElement("scan").disabled = true;
    getElement("status").textContent = "Starting downloads…";

    try {
        const response = await chrome.runtime.sendMessage({
            type: "download",
            course: result.course,
            files,
        });

        getElement("status").textContent =
            `${response.started} downloads started. Check Chrome’s Downloads for completion.`;
        showIssues(response.failed);
    } catch (error) {
        getElement("status").textContent = error.message;
    } finally {
        getElement("scan").disabled = false;
        updateSelection();
    }
}

getElement("scan").addEventListener("click", scanPage);
getElement("download").addEventListener("click", downloadSelected);
getElement("all").addEventListener("change", () => {
    const selectAll = getElement("all").checked;

    for (const box of document.querySelectorAll(".file input")) {
        box.checked = selectAll;
    }
    updateSelection();
});

scanPage();
