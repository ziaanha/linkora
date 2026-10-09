
const shortenForm = document.getElementById("shortenForm");
const longUrlInput = document.getElementById("longUrl");
const customSlugInput = document.getElementById("customSlug");
const formError = document.getElementById("formError");

const resultBox = document.getElementById("resultBox");
const shortUrlElement = document.getElementById("shortUrl");
const originalUrlElement = document.getElementById("originalUrl");
const copyLatestBtn = document.getElementById("copyLatestBtn");
const copyFeedback = document.getElementById("copyFeedback");

const linkList = document.getElementById("linkList");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");

const totalLinksElement = document.getElementById("totalLinks");
const savedLinksElement = document.getElementById("savedLinks");

const clearHistoryBtn = document.getElementById("clearHistoryBtn");

const STORAGE_KEY = "linkora-links-v1";

let links = loadLinks();
let latestLinkId = null;

function loadLinks() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

        if (!Array.isArray(saved)) return [];

        return saved.filter(item =>
            item &&
            typeof item.id === "string" &&
            typeof item.slug === "string" &&
            typeof item.originalUrl === "string" &&
            typeof item.createdAt === "string"
        );
    } catch {
        return [];
    }
}

function saveLinks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
        return true;
    } catch {
        formError.textContent =
            "Browser storage is unavailable. Your links may not be saved.";
        return false;
    }
}

function makeSlug() {
    const characters = "abcdefghjkmnpqrstuvwxyz23456789";
    const randomValues = new Uint32Array(8);
    crypto.getRandomValues(randomValues);

    return Array.from(randomValues, value =>
        characters[value % characters.length]
    ).join("");
}

function isValidHttpUrl(value) {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
}

function normalizeUrl(value) {
    const url = new URL(value);
    return url.href;
}

function showError(message) {
    formError.textContent = message;
}

function clearError() {
    formError.textContent = "";
}

function shortenLink(event) {
    event.preventDefault();
    clearError();
    copyFeedback.textContent = "";

    const rawUrl = longUrlInput.value.trim();
    const customSlug = customSlugInput.value.trim();

    if (!isValidHttpUrl(rawUrl)) {
        showError("Please enter a valid URL starting with http:// or https://.");
        return;
    }

    if (customSlug && !/^[a-zA-Z0-9_-]{1,30}$/.test(customSlug)) {
        showError("Your alias can contain letters, numbers, hyphens, and underscores.");
        return;
    }

    const originalUrl = normalizeUrl(rawUrl);

    let slug = customSlug;

    if (slug) {
        const duplicate = links.some(
            link => link.slug.toLowerCase() === slug.toLowerCase()
        );

        if (duplicate) {
            showError("That alias is already in use. Please choose another.");
            return;
        }
    } else {
        do {
            slug = makeSlug();
        } while (links.some(link => link.slug === slug));
    }

    const link = {
        id: makeSlug() + "-" + Date.now().toString(36),
        slug,
        originalUrl,
        createdAt: new Date().toISOString()
    };

    links.unshift(link);
    latestLinkId = link.id;

    saveLinks();
    renderLinks();
    showResult(link);

    longUrlInput.value = "";
    customSlugInput.value = "";
}

function showResult(link) {
    resultBox.hidden = false;

    // Demo only: this is not a functioning redirect URL.
    shortUrlElement.textContent = `linkora.local/${link.slug}`;
    shortUrlElement.href = "#";

    originalUrlElement.textContent = link.originalUrl;
    copyLatestBtn.textContent = "Copy link";

    resultBox.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

async function copyText(text, button) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.select();

            const copied = document.execCommand("copy");
            textArea.remove();

            if (!copied) throw new Error("Copy failed");
        }

        const previousText = button.textContent;
        button.textContent = "Copied ✓";

        setTimeout(() => {
            button.textContent = previousText;
        }, 1500);
    } catch {
        copyFeedback.textContent =
            "Copy wasn't available. Select and copy the link manually.";
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function createLinkItem(link) {
    const item = document.createElement("article");
    item.className = "link-item";

    const top = document.createElement("div");
    top.className = "link-item-top";

    const shortLink = document.createElement("a");
    shortLink.href = "#";
    shortLink.textContent = `linkora.local/${link.slug}`;
    shortLink.title = "Demo link — not a live redirect";

    shortLink.addEventListener("click", event => {
        event.preventDefault();
        copyText(shortLink.textContent, copyButton);
    });

    const date = document.createElement("span");
    date.className = "link-date";
    date.textContent = formatDate(link.createdAt);

    top.append(shortLink, date);

    const original = document.createElement("p");
    original.className = "link-original";
    original.textContent = link.originalUrl;

    const actions = document.createElement("div");
    actions.className = "link-item-actions";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Copy short link";

    copyButton.addEventListener("click", () => {
        copyText(shortLink.textContent, copyButton);
    });

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.textContent = "Open original ↗";

    openButton.addEventListener("click", () => {
        const opened = window.open(
            link.originalUrl,
            "_blank",
            "noopener,noreferrer"
        );

        if (opened) opened.opener = null;
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
        links = links.filter(item => item.id !== link.id);

        if (latestLinkId === link.id) {
            latestLinkId = null;
            resultBox.hidden = true;
        }

        saveLinks();
        renderLinks();
    });

    actions.append(copyButton, openButton, deleteButton);
    item.append(top, original, actions);

    return item;
}

function renderLinks() {
    const query = searchInput.value.trim().toLowerCase();

    const filteredLinks = links.filter(link =>
        link.slug.toLowerCase().includes(query) ||
        link.originalUrl.toLowerCase().includes(query)
    );

    linkList.replaceChildren();

    filteredLinks.forEach(link => {
        linkList.appendChild(createLinkItem(link));
    });

    emptyState.hidden = filteredLinks.length > 0;

    if (links.length === 0) {
        emptyState.querySelector("h3").textContent = "No links yet";
        emptyState.querySelector("p").textContent =
            "Your shortened links will bloom here.";
    } else if (filteredLinks.length === 0) {
        emptyState.querySelector("h3").textContent = "No matches found";
        emptyState.querySelector("p").textContent =
            "Try a different search term.";
    }

    totalLinksElement.textContent = links.length;
    savedLinksElement.textContent = links.length;
}

shortenForm.addEventListener("submit", shortenLink);

copyLatestBtn.addEventListener("click", () => {
    const link = links.find(item => item.id === latestLinkId);

    if (link) {
        copyText(`linkora.local/${link.slug}`, copyLatestBtn);
    }
});

searchInput.addEventListener("input", renderLinks);

clearHistoryBtn.addEventListener("click", () => {
    if (links.length === 0) return;

    const confirmed = window.confirm(
        "Clear all saved links from this browser?"
    );

    if (!confirmed) return;

    links = [];
    latestLinkId = null;
    resultBox.hidden = true;

    saveLinks();
    renderLinks();
});

renderLinks();