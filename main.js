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
        const header = containerEl.createDiv("api-designer-settings-header");
        new obsidian_1.Setting(containerEl).setName("API designer settings").setHeading();
        header.createEl("p", {
            text: "Customize how your API endpoint cards look.",
        });
        new obsidian_1.Setting(containerEl)
            .setName("Custom theme JSON")
            .setDesc(createFragment((frag) => {
            frag.appendText("Paste a JSON object defining custom CSS variables. ");
            frag.createEl("br");
            frag.appendText("You can find a JSON example on ");
            frag.createEl("a", {
                href: "https://github.com/ruveydayilmaz/obsidian-api-designer-plugin",
                text: "GitHub",
            });
        }))
            .addTextArea(text => {
            text
                .setPlaceholder("{ \"blue\": \"#4dabf7\" }")
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
                        text: "⚠ Invalid json format",
                        cls: "api-theme-error"
                    });
                    this.errorEl.setCssStyles({
                        color: "var(--color-red, red)",
                        marginTop: "4px",
                        fontSize: "0.9em"
                    });
                }
                yield this.plugin.saveSettings();
            }));
            text.inputEl.addClass("api-theme-json-input");
        });
    }
}
class APIDesignerPlugin extends obsidian_1.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            this.addRibbonIcon("code", "Add API endpoint", () => __awaiter(this, void 0, void 0, function* () {
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
            }));
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
                        const newBlock = "```api-endpoints\n" + JSON.stringify(endpoints, null, 2) + "\n```";
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
                    img.src = "data:image/svg+xml;base64,PHN2ZwogICAgICAgICAgICB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgICAgICAgICAgIHdpZHRoPSIxNiIKICAgICAgICAgICAgaGVpZ2h0PSIxNiIKICAgICAgICAgICAgdmlld0JveD0iMCAwIDI0IDI0IgogICAgICAgICAgICBmaWxsPSJub25lIgogICAgICAgICAgICBzdHJva2U9ImN1cnJlbnRDb2xvciIKICAgICAgICAgICAgc3Ryb2tlLXdpZHRoPSIyIgogICAgICAgICAgICBzdHJva2UtbGluZWNhcD0icm91bmQiCiAgICAgICAgICAgIHN0cm9rZS1saW5lam9pbj0icm91bmQiCiAgICAgICAgICAgIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXNlbmQtaG9yaXpvbnRhbC1pY29uIGx1Y2lkZS1zZW5kLWhvcml6b250YWwiCiAgICAgICAgICAgID4KICAgICAgICAgICAgPHBhdGggZD0iTTMuNzE0IDMuMDQ4YS40OTguNDk4IDAgMCAwLS42ODMuNjI3bDIuODQzIDcuNjI3YTIgMiAwIDAgMSAwIDEuMzk2bC0yLjg0MiA3LjYyN2EuNDk4LjQ5OCAwIDAgMCAuNjgyLjYyN2wxOC04LjVhLjUuNSAwIDAgMCAwLS45MDR6Ii8+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik02IDEyaDE2Ii8+CiAgICAgICAgICA8L3N2Zz4=";
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
                    const responseBox = card.createEl("pre", { cls: "api-response hidden" });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNyYy9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQUEsdUNBUWtCO0FBTWxCLE1BQU0sZ0JBQWdCLEdBQXdCO0lBQzVDLGVBQWUsRUFBRSxFQUFFO0lBQ25CLFdBQVcsRUFBRSxJQUFJO0NBQ2xCLENBQUM7QUFFRixNQUFNLHFCQUFzQixTQUFRLDJCQUFnQjtJQUlsRCxZQUFZLEdBQVEsRUFBRSxNQUF5QjtRQUM3QyxLQUFLLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBSHJCLFlBQU8sR0FBdUIsSUFBSSxDQUFDO1FBSWpDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxPQUFPO1FBQ0wsTUFBTSxFQUFFLFdBQVcsRUFBRSxHQUFHLElBQUksQ0FBQztRQUM3QixXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFcEIsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO1FBQ3JFLElBQUksa0JBQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxPQUFPLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUN2RSxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRTtZQUNuQixJQUFJLEVBQUUsNkNBQTZDO1NBQ3BELENBQUMsQ0FBQztRQUVILElBQUksa0JBQU8sQ0FBQyxXQUFXLENBQUM7YUFDckIsT0FBTyxDQUFDLG1CQUFtQixDQUFDO2FBQzVCLE9BQU8sQ0FDTixjQUFjLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUN0QixJQUFJLENBQUMsVUFBVSxDQUFDLHFEQUFxRCxDQUFDLENBQUM7WUFDdkUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwQixJQUFJLENBQUMsVUFBVSxDQUFDLGlDQUFpQyxDQUFDLENBQUM7WUFDbkQsSUFB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