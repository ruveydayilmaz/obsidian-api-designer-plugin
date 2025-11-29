"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const DEFAULT_SETTINGS = {
    customThemeJson: "",
    customTheme: null,
};
class APIDesignerSettingTab extends obsidian_1.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.errorEl = null;
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h1", { text: "API Designer" });
        containerEl.createEl("p", { text: "Created by " }).createEl("a", {
            text: "Ruveyda",
            href: "https://github.com/ruveydayilmaz",
        });
        new obsidian_1.Setting(containerEl)
            .setName("Customize theme")
            .setDesc("Customize how your API endpoint cards look.")
            .setDesc(createFragment((frag) => {
            frag.appendText("Paste a JSON object defining custom CSS variables. ");
            frag.createEl("br");
            frag.appendText("You can find a JSON example on ");
            frag.createEl("a", {
                href: "https://github.com/ruveydayilmaz/obsidian-api-designer-plugin",
                text: "GitHub",
            });
        }))
            .addTextArea((text) => {
            text
                .setPlaceholder('{ "blue": "#4dabf7" }')
                .setValue(this.plugin.settings.customThemeJson || "")
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                if (this.errorEl) {
                    this.errorEl.remove();
                    this.errorEl = null;
                }
                if (!value.trim()) {
                    this.plugin.settings.customThemeJson = "";
                    this.plugin.settings.customTheme = null;
                    yield this.plugin.saveSettings();
                    return;
                }
                this.plugin.settings.customThemeJson = value;
                try {
                    const parsed = JSON.parse(value);
                    this.plugin.settings.customTheme = parsed;
                }
                catch (_a) {
                    this.errorEl = containerEl.createEl("div", {
                        text: "⚠ Invalid JSON format",
                        cls: "api-theme-error",
                    });
                    this.errorEl.setCssStyles({
                        color: "var(--color-red, red)",
                        marginTop: "4px",
                        fontSize: "0.9em",
                    });
                }
                yield this.plugin.saveSettings();
            }));
            text.inputEl.addClass("api-theme-json-input");
        });
    }
}
class APIDesignerPlugin extends obsidian_1.Plugin {
    constructor(app, manifest) {
        super(app, manifest);
        this.settings = {
            customThemeJson: "",
            customTheme: null,
        };
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            this.addRibbonIcon("code", "Add API endpoint", () => {
                const view = this.app.workspace.getActiveViewOfType(obsidian_1.MarkdownView);
                if (!view)
                    return;
                const editor = view.editor;
                const sample = {
                    method: "POST",
                    endpoint: "/login",
                    requestBody: [
                        { name: "email", type: "string" },
                        { name: "password", type: "string" },
                    ],
                    responseBody: [
                        { name: "success", type: "string" },
                        { name: "message", type: "string" },
                    ],
                };
                editor.replaceSelection("```api-endpoints\n" + JSON.stringify([sample], null, 2) + "\n```\n");
            });
            this.registerMarkdownCodeBlockProcessor("api-endpoints", (source, el, ctx) => {
                let endpoints;
                try {
                    endpoints = deepClone(JSON.parse(source));
                }
                catch (_a) {
                    el.createEl("div", { text: "Invalid JSON" });
                    return;
                }
                const codeBlock = el.closest(".block-language-api-endpoints");
                if (!codeBlock)
                    return;
                const info = ctx.getSectionInfo(codeBlock);
                if (!info)
                    return;
                const view = this.app.workspace.getActiveViewOfType(obsidian_1.MarkdownView);
                if (!view)
                    return;
                const editor = view.editor;
                const updateNote = () => {
                    setTimeout(() => {
                        const doc = editor.getValue();
                        const lines = doc.split("\n");
                        let start = info.lineStart;
                        while (start >= 0 && !/^```api-endpoints\b/.test(lines[start]))
                            start--;
                        if (start < 0)
                            return;
                        let end = start + 1;
                        while (end < lines.length && !/^```/.test(lines[end]))
                            end++;
                        if (end >= lines.length)
                            end = lines.length - 1;
                        const newBlock = "```api-endpoints\n" +
                            JSON.stringify(endpoints, null, 2) +
                            "\n```";
                        editor.replaceRange(newBlock, { line: start, ch: 0 }, { line: end, ch: lines[end].length });
                    }, 0);
                };
                const debouncedUpdate = debounce(updateNote, 120);
                endpoints.forEach((ep) => {
                    const card = el.createDiv({ cls: `api-card` });
                    const header = card.createDiv({ cls: "api-header" });
                    const methodSelect = header.createEl("select", {
                        cls: "method-select",
                    });
                    ["GET", "POST", "PUT", "DELETE"].forEach((m) => {
                        const opt = methodSelect.createEl("option", { text: m, value: m });
                        if (ep.method === m)
                            opt.selected = true;
                    });
                    const refreshMethodClass = () => {
                        methodSelect.removeClasses([
                            "method-GET",
                            "method-POST",
                            "method-PUT",
                            "method-DELETE",
                        ]);
                        methodSelect.addClass(`method-${ep.method}`);
                    };
                    refreshMethodClass();
                    methodSelect.onchange = () => {
                        ep.method = methodSelect.value;
                        refreshMethodClass();
                        debouncedUpdate();
                    };
                    const endpointInput = header.createEl("input", {
                        type: "text",
                        cls: "endpoint-input",
                    });
                    endpointInput.value = ep.endpoint;
                    endpointInput.placeholder = "/endpoint";
                    endpointInput.onblur = () => {
                        ep.endpoint = endpointInput.value;
                        updateNote();
                    };
                    const sendBtn = header.createEl("button", { cls: "send-btn" });
                    sendBtn.ariaLabel = "WIP";
                    sendBtn.disabled = true;
                    const img = sendBtn.createEl("img", { cls: "send-icon" });
                    img.src =
                        "data:image/svg+xml;base64,PHN2ZwogICAgICAgICAgICB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgICAgICAgICAgIHdpZHRoPSIxNiIKICAgICAgICAgICAgaGVpZ2h0PSIxNiIKICAgICAgICAgICAgdmlld0JveD0iMCAwIDI0IDI0IgogICAgICAgICAgICBmaWxsPSJub25lIgogICAgICAgICAgICBzdHJva2U9ImN1cnJlbnRDb2xvciIKICAgICAgICAgICAgc3Ryb2tlLXdpZHRoPSIyIgogICAgICAgICAgICBzdHJva2UtbGluZWNhcD0icm91bmQiCiAgICAgICAgICAgIHN0cm9rZS1saW5lam9pbj0icm91bmQiCiAgICAgICAgICAgIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXNlbmQtaG9yaXpvbnRhbC1pY29uIGx1Y2lkZS1zZW5kLWhvcml6b250YWwiCiAgICAgICAgICAgID4KICAgICAgICAgICAgPHBhdGggZD0iTTMuNzE0IDMuMDQ4YS40OTguNDk4IDAgMCAwLS42ODMuNjI3bDIuODQzIDcuNjI3YTIgMiAwIDAgMSAwIDEuMzk2bC0yLjg0MiA3LjYyN2EuNDk4LjQ5OCAwIDAgMCAuNjgyLjYyN2wxOC04LjVhLjUuNSAwIDAgMCAwLS45MDR6Ii8+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik02IDEyaDE2Ii8+CiAgICAgICAgICA8L3N2Zz4=";
                    img.alt = "Send";
                    const body = card.createDiv({ cls: "body" });
                    const wrapperLeft = body.createDiv({ cls: "title-wrapper" });
                    wrapperLeft.createEl("h5", { text: "Request" });
                    const reqList = wrapperLeft.createDiv({ cls: "inner-body" });
                    renderPropList(reqList, ep.requestBody, () => updateNote());
                    const wrapperRight = body.createDiv({ cls: "title-wrapper" });
                    wrapperRight.createEl("h5", { text: "Response" });
                    const resList = wrapperRight.createDiv({ cls: "inner-body" });
                    renderPropList(resList, ep.responseBody, () => updateNote());
                    const responseBox = card.createEl("pre", {
                        cls: "api-response hidden",
                    });
                    responseBox.createEl("code");
                });
            });
            this.addSettingTab(new APIDesignerSettingTab(this.app, this));
        });
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
    applyCustomTheme() {
        const theme = this.settings.customTheme;
        if (!theme)
            return;
        for (const [rawKey, value] of Object.entries(theme)) {
            const key = rawKey.startsWith("api-") ? rawKey : `api-${rawKey}`;
            document.body.style.setProperty(`--${key}`, value);
        }
    }
    onunload() { }
}
exports.default = APIDesignerPlugin;
// ------------ HELPERS ------------ //
function renderPropList(container, props, onUpdate) {
    container.empty();
    props.forEach((prop) => {
        renderPropRow(container, prop, onUpdate, () => {
            const idx = props.indexOf(prop);
            if (idx >= 0) {
                props.splice(idx, 1);
                renderPropList(container, props, onUpdate);
                onUpdate();
            }
        });
    });
    const addBtn = container.createEl("button", { text: "New", cls: "add-btn" });
    addBtn.onclick = () => {
        props.push({ name: "", type: "string" });
        renderPropList(container, props, onUpdate);
        onUpdate();
    };
}
function renderPropRow(container, prop, onUpdate, onDelete) {
    var _a;
    const row = container.createDiv({ cls: "inner-body-item" });
    const nameInput = row.createEl("input", { type: "text" });
    nameInput.value = (_a = prop.name) !== null && _a !== void 0 ? _a : "";
    nameInput.placeholder = "Property name";
    nameInput.onblur = () => {
        prop.name = nameInput.value;
        onUpdate();
    };
    const wrapper = row.createDiv({ cls: "select-wrapper" });
    wrapper.createDiv({ cls: "select-icon" });
    const typeSelect = wrapper.createEl("select", { cls: "type-select" });
    ["string", "number", "boolean", "object", "array"].forEach((t) => {
        const opt = typeSelect.createEl("option", { text: t, value: t });
        if (prop.type === t)
            opt.selected = true;
    });
    typeSelect.onchange = () => {
        prop.type = typeSelect.value;
        if (prop.type === "object") {
            if (!Array.isArray(prop.items))
                prop.items = [];
        }
        if (prop.type === "array") {
            if (!prop.items || Array.isArray(prop.items)) {
                prop.items = { name: "item", type: "string" };
            }
        }
        renderSub();
        onUpdate();
    };
    const delBtn = row.createEl("button", { text: "🗑️", cls: "delete-btn" });
    delBtn.onclick = () => onDelete();
    let subContainer = null;
    const ensureSubContainer = () => {
        if (!subContainer)
            subContainer = row.createDiv({ cls: "sub-fields" });
        return subContainer;
    };
    const removeSubContainer = () => {
        if (subContainer) {
            subContainer.detach();
            subContainer = null;
        }
    };
    const renderSub = () => {
        if (prop.type === "object" && Array.isArray(prop.items)) {
            const sc = ensureSubContainer();
            sc.empty();
            renderPropList(sc, prop.items, onUpdate);
        }
        else if (prop.type === "array" &&
            prop.items &&
            !Array.isArray(prop.items)) {
            const sc = ensureSubContainer();
            sc.empty();
            const label = sc.createEl("div", { text: "Array items" });
            label.addClass("sub-label");
            renderPropRow(sc, prop.items, onUpdate, () => {
                prop.items = { name: "item", type: "string" };
                renderSub();
                onUpdate();
            });
        }
        else {
            removeSubContainer();
        }
    };
    renderSub();
}
function debounce(fn, wait = 200) {
    let t = null;
    return (...args) => {
        if (t)
            window.clearTimeout(t);
        t = window.setTimeout(() => fn(...args), wait);
    };
}
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNyYy9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQUEsdUNBU2tCO0FBTWxCLE1BQU0sZ0JBQWdCLEdBQXdCO0lBQzVDLGVBQWUsRUFBRSxFQUFFO0lBQ25CLFdBQVcsRUFBRSxJQUFJO0NBQ2xCLENBQUM7QUFFRixNQUFNLHFCQUFzQixTQUFRLDJCQUFnQjtJQUlsRCxZQUFZLEdBQVEsRUFBRSxNQUF5QjtRQUM3QyxLQUFLLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBSHJCLFlBQU8sR0FBdUIsSUFBSSxDQUFDO1FBSWpDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxPQUFPO1FBQ0wsTUFBTSxFQUFFLFdBQVcsRUFBRSxHQUFHLElBQUksQ0FBQztRQUM3QixXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFcEIsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLENBQUMsQ0FBQztRQUNyRCxXQUFXLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUU7WUFDL0QsSUFBSSxFQUFFLFNBQVM7WUFDZixJQUFJLEVBQUUsa0NBQWtDO1NBQ3pDLENBQUMsQ0FBQztRQUNILElBQUksa0JBQU8sQ0FBQyxXQUFXLENBQUM7YUFDckIsT0FBTyxDQUFDLGlCQUFpQixDQUFDO2FBQzFCLE9BQU8sQ0FBQyw2Q0FBNkMsQ0FBQzthQUN0RCxPQUFPLENBQ04sY0FBYyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUU7WUFDdEIsSUFBSSxDQUFDLFVBQVUsQ0FDYixxREFBcUQsQ0FDdEQsQ0FBQztZQUNGLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDcEIsSUFBSSxDQUFD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