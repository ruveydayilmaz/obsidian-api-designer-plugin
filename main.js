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
        header.createEl("h2", { text: "API Designer Settings" });
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
                    this.plugin.applyCustomTheme();
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
                        cls: "api-theme-error"
                    });
                    this.errorEl.setCssStyles({
                        color: "var(--color-red, red)",
                        marginTop: "4px",
                        fontSize: "0.9em"
                    });
                }
                yield this.plugin.saveSettings();
                this.plugin.applyCustomTheme();
            }));
            text.inputEl.addClass("api-theme-json-input");
        });
    }
}
class APIDesignerPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.CUSTOM_STYLE_ID = "api-designer-custom-style";
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            this.applyCustomTheme();
            this.addRibbonIcon("code", "Add API Endpoint", () => __awaiter(this, void 0, void 0, function* () {
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
                const originalBlock = "```api-endpoints\n" + source + "\n```";
                const info = ctx.getSectionInfo(el);
                if (!info)
                    return;
                const view = this.app.workspace.getActiveViewOfType(obsidian_1.MarkdownView);
                if (!view)
                    return;
                const editor = view.editor;
                const updateNote = () => {
                    setTimeout(() => {
                        const doc = editor.getValue();
                        const startOffset = (info === null || info === void 0 ? void 0 : info.lineStart) ? editor.posToOffset({ line: info.lineStart, ch: 0 }) : -1;
                        const endOffset = (info === null || info === void 0 ? void 0 : info.lineEnd) ? editor.posToOffset({ line: info.lineEnd, ch: 0 }) : -1;
                        if (startOffset === -1 || endOffset === -1)
                            return;
                        const sectionText = doc.slice(startOffset, endOffset);
                        const blockIndex = sectionText.indexOf(originalBlock);
                        if (blockIndex === -1)
                            return;
                        const absoluteStart = startOffset + blockIndex;
                        const absoluteEnd = absoluteStart + originalBlock.length;
                        const newBlock = "```api-endpoints\n" + JSON.stringify(endpoints, null, 2) + "\n```";
                        editor.replaceRange(newBlock, editor.offsetToPos(absoluteStart), editor.offsetToPos(absoluteEnd));
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
                    // TODO:
                    sendBtn.onclick = () => __awaiter(this, void 0, void 0, function* () {
                        // const url = endpointInput.value;
                        // const method = methodSelect.value;
                        // let body: any = null;
                        // if (["POST", "PUT"].includes(method)) {
                        //   body = {};
                        //   ep.requestBody.forEach((p) => {
                        //     body[p.name] = `example-${p.type}`;
                        //   });
                        // }
                        // try {
                        //   const res = await requestUrl({
                        //     url,
                        //     method,
                        //     headers: { "Content-Type": "application/json" },
                        //     body: body ? JSON.stringify(body) : undefined,
                        //   });
                        //   const contentType = res.headers["content-type"] || "text/plain";
                        //   const { lang, html } = formatAndHighlight(res.text, contentType);
                        //   responseBox.empty();
                        //   const pre = responseBox.createEl("pre", { cls: "api-response" });
                        //   const code = pre.createEl("code", { cls: `language-${lang}` });
                        //   code.innerHTML = html;
                        // } catch (err) {
                        //   responseBox.style.display = "block";
                        //   responseBox.textContent = `Error: ${err.message}`;
                        //   console.log(err);
                        // }
                    });
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
    buildCustomThemeCss(themeObj) {
        const lines = [];
        for (const [rawKey, value] of Object.entries(themeObj)) {
            const key = rawKey.startsWith("api-") ? rawKey : `api-${rawKey}`;
            lines.push(`  --${key}: ${value};`);
        }
        return `.api-card {\n${lines.join("\n")}\n}\n`;
    }
    ensureCustomStyleElement() {
        let el = document.getElementById(this.CUSTOM_STYLE_ID);
        if (!el) {
            el = document.createElement("style");
            el.id = this.CUSTOM_STYLE_ID;
            document.head.appendChild(el);
        }
        return el;
    }
    applyCustomTheme() {
        this.removeCustomThemeStyle();
        const theme = this.settings.customTheme;
        if (!theme || typeof theme !== "object") {
            return;
        }
        const css = this.buildCustomThemeCss(theme);
        const styleEl = this.ensureCustomStyleElement();
        styleEl.textContent = css;
    }
    removeCustomThemeStyle() {
        const existing = document.getElementById(this.CUSTOM_STYLE_ID);
        if (existing) {
            existing.remove();
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
    nameInput.placeholder = "property name";
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
// function formatAndHighlight(body: string, contentType: string): { lang: string; html: string } {
//   const Prism = window.Prism;
//   let lang = "plaintext";
//   let formatted = body;
//   try {
//     if (contentType.includes("application/json")) {
//       lang = "json";
//       formatted = JSON.stringify(JSON.parse(body), null, 2);
//     } else if (contentType.includes("xml")) {
//       lang = "xml";
//       formatted = body.replace(/></g, ">\n<");
//     }
//   } catch {
//     lang = "plaintext";
//     formatted = body;
//   }
//   if (Prism && Prism.languages[lang]) {
//     return { lang, html: Prism.highlight(formatted, Prism.languages[lang], lang) };
//   }
//   return { lang, html: formatted };
// }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNyYy9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQUEsdUNBUWtCO0FBYWxCLE1BQU0sZ0JBQWdCLEdBQXdCO0lBQzVDLGVBQWUsRUFBRSxFQUFFO0lBQ25CLFdBQVcsRUFBRSxJQUFJO0NBQ2xCLENBQUM7QUFFRixNQUFNLHFCQUFzQixTQUFRLDJCQUFnQjtJQUlsRCxZQUFZLEdBQVEsRUFBRSxNQUF5QjtRQUM3QyxLQUFLLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBSHJCLFlBQU8sR0FBdUIsSUFBSSxDQUFDO1FBSWpDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxPQUFPO1FBQ0wsTUFBTSxFQUFFLFdBQVcsRUFBRSxHQUFHLElBQUksQ0FBQztRQUM3QixXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFcEIsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO1FBQ3JFLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLHVCQUF1QixFQUFFLENBQUMsQ0FBQztRQUN6RCxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRTtZQUNuQixJQUFJLEVBQUUsNkNBQTZDO1NBQ3BELENBQUMsQ0FBQztRQUVILElBQUksa0JBQU8sQ0FBQyxXQUFXLENBQUM7YUFDckIsT0FBTyxDQUFDLG1CQUFtQixDQUFDO2FBQzVCLE9BQU8sQ0FDTixjQUFjLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUN0QixJQUFJLENBQUMsVUFBVSxDQUFDLHFEQUFxRCxDQUFDLENBQUM7WUFDdkUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwQixJQUFJLENBQUMsVUFBVSxDQUFDLGlDQUFpQyxDQUFDLENBQUM7WUFDbkQsSUFBSSxDQUFD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