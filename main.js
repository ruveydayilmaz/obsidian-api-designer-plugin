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
        containerEl
            .createEl("p", { text: "Created by ", cls: "api-designer-settings-desc" })
            .createEl("a", {
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
                        text: "Invalid format",
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNyYy9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQUEsdUNBU2tCO0FBTWxCLE1BQU0sZ0JBQWdCLEdBQXdCO0lBQzVDLGVBQWUsRUFBRSxFQUFFO0lBQ25CLFdBQVcsRUFBRSxJQUFJO0NBQ2xCLENBQUM7QUFFRixNQUFNLHFCQUFzQixTQUFRLDJCQUFnQjtJQUlsRCxZQUFZLEdBQVEsRUFBRSxNQUF5QjtRQUM3QyxLQUFLLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBSHJCLFlBQU8sR0FBdUIsSUFBSSxDQUFDO1FBSWpDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxPQUFPO1FBQ0wsTUFBTSxFQUFFLFdBQVcsRUFBRSxHQUFHLElBQUksQ0FBQztRQUM3QixXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFcEIsV0FBVzthQUNSLFFBQVEsQ0FBQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFFLEdBQUcsRUFBRSw0QkFBNEIsRUFBRSxDQUFDO2FBQ3pFLFFBQVEsQ0FBQyxHQUFHLEVBQUU7WUFDYixJQUFJLEVBQUUsU0FBUztZQUNmLElBQUksRUFBRSxrQ0FBa0M7U0FDekMsQ0FBQyxDQUFDO1FBQ0wsSUFBSSxrQkFBTyxDQUFDLFdBQVcsQ0FBQzthQUNyQixPQUFPLENBQUMsaUJBQWlCLENBQUM7YUFDMUIsT0FBTyxDQUFDLDZDQUE2QyxDQUFDO2FBQ3RELE9BQU8sQ0FDTixjQUFjLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUN0QixJQUFJLENBQUMsVUFBVSxDQUNiLHFEQUFxRCxDQUN0RCxDQUFDO1lBQ0YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwQixJQUFJLENBQUMsVUFBVSxDQUFDLGlDQUFpQyxDQUFDLENBQUM7WUFDbkQsSUFBSSxDQUFDLFFBQVEs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