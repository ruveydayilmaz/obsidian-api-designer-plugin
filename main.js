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
            .addTextArea(text => text
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
        })));
        const textarea = containerEl.querySelector("textarea");
        if (textarea) {
            textarea.style.width = "100%";
            textarea.style.minHeight = "250px";
            textarea.style.fontFamily = "monospace";
        }
    }
}
class APIDesignerPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.appliedVarKeys = [];
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
                        {
                            name: "tokens",
                            type: "string",
                        },
                    ],
                };
                editor.replaceSelection("```api-endpoints\n" + JSON.stringify([sample], null, 2) + "\n```\n");
            }));
            this.registerMarkdownCodeBlockProcessor("api-endpoints", (source, el, ctx) => {
                let endpoints;
                try {
                    endpoints = JSON.parse(source);
                }
                catch (_a) {
                    el.createEl("div", { text: "Invalid JSON" });
                    return;
                }
                let originalBlock = "```api-endpoints\n" + source + "\n```";
                let lastSearchIndex = 0;
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
                        let startOffset = doc.indexOf(originalBlock, lastSearchIndex);
                        if (startOffset === -1) {
                            startOffset = doc.indexOf("```api-endpoints");
                            if (startOffset === -1) {
                                return;
                            }
                        }
                        const closingIndex = doc.indexOf("```", startOffset + 3);
                        if (closingIndex === -1) {
                            return;
                        }
                        const endOffset = closingIndex + 3;
                        const newBlock = "```api-endpoints\n" + JSON.stringify(endpoints, null, 2) + "\n```";
                        const from = offsetToPos(editor, startOffset);
                        const to = offsetToPos(editor, endOffset);
                        editor.replaceRange(newBlock, from, to);
                        originalBlock = newBlock;
                        lastSearchIndex = startOffset;
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
                    const img = sendBtn.createEl("img", { cls: "send-icon" });
                    img.src = "data:image/svg+xml;base64,PHN2ZwogICAgICAgICAgICB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgICAgICAgICAgIHdpZHRoPSIxNiIKICAgICAgICAgICAgaGVpZ2h0PSIxNiIKICAgICAgICAgICAgdmlld0JveD0iMCAwIDI0IDI0IgogICAgICAgICAgICBmaWxsPSJub25lIgogICAgICAgICAgICBzdHJva2U9ImN1cnJlbnRDb2xvciIKICAgICAgICAgICAgc3Ryb2tlLXdpZHRoPSIyIgogICAgICAgICAgICBzdHJva2UtbGluZWNhcD0icm91bmQiCiAgICAgICAgICAgIHN0cm9rZS1saW5lam9pbj0icm91bmQiCiAgICAgICAgICAgIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXNlbmQtaG9yaXpvbnRhbC1pY29uIGx1Y2lkZS1zZW5kLWhvcml6b250YWwiCiAgICAgICAgICAgID4KICAgICAgICAgICAgPHBhdGggZD0iTTMuNzE0IDMuMDQ4YS40OTguNDk4IDAgMCAwLS42ODMuNjI3bDIuODQzIDcuNjI3YTIgMiAwIDAgMSAwIDEuMzk2bC0yLjg0MiA3LjYyN2EuNDk4LjQ5OCAwIDAgMCAuNjgyLjYyN2wxOC04LjVhLjUuNSAwIDAgMCAwLS45MDR6Ii8+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik02IDEyaDE2Ii8+CiAgICAgICAgICA8L3N2Zz4=";
                    img.alt = "Send";
                    sendBtn.onclick = () => __awaiter(this, void 0, void 0, function* () {
                        console.log('clicked');
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
                    wrapperLeft.createEl("h5", { text: "Request Body" });
                    const reqList = wrapperLeft.createDiv({ cls: "inner-body" });
                    renderPropList(reqList, ep.requestBody, () => updateNote());
                    const wrapperRight = body.createDiv({ cls: "title-wrapper" });
                    wrapperRight.createEl("h5", { text: "Response Body" });
                    const resList = wrapperRight.createDiv({ cls: "inner-body" });
                    renderPropList(resList, ep.responseBody, () => updateNote());
                    const responseBox = card.createEl("pre", { cls: "api-response" });
                    responseBox.createEl("code");
                    responseBox.style.display = "none";
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
        const root = document.body;
        this.appliedVarKeys.forEach((cssName) => {
            root.style.removeProperty(`--${cssName}`);
        });
        this.appliedVarKeys = [];
        const theme = this.settings.customTheme;
        if (!theme || typeof theme !== "object")
            return;
        for (const [key, value] of Object.entries(theme)) {
            const cssName = key.startsWith("api-") ? key : `api-${key}`;
            root.style.setProperty(`--${cssName}`, value);
            this.appliedVarKeys.push(cssName);
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
        if (prop.type === "object" && !Array.isArray(prop.items))
            prop.items = [];
        if (prop.type === "array" &&
            (prop.items == null || Array.isArray(prop.items))) {
            prop.items = { name: "item", type: "string" };
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
function offsetToPos(editor, offset) {
    const lastLine = editor.lastLine();
    let cur = 0;
    for (let i = 0; i <= lastLine; i++) {
        const lineLen = editor.getLine(i).length + 1;
        if (cur + lineLen > offset) {
            return { line: i, ch: Math.max(0, offset - cur) };
        }
        cur += lineLen;
    }
    return { line: lastLine, ch: editor.getLine(lastLine).length };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNyYy9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQUEsdUNBUWtCO0FBYWxCLE1BQU0sZ0JBQWdCLEdBQXdCO0lBQzVDLGVBQWUsRUFBRSxFQUFFO0lBQ25CLFdBQVcsRUFBRSxJQUFJO0NBQ2xCLENBQUM7QUFFRixNQUFNLHFCQUFzQixTQUFRLDJCQUFnQjtJQUlsRCxZQUFZLEdBQVEsRUFBRSxNQUF5QjtRQUM3QyxLQUFLLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBSHJCLFlBQU8sR0FBdUIsSUFBSSxDQUFDO1FBSWpDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxPQUFPO1FBQ0wsTUFBTSxFQUFFLFdBQVcsRUFBRSxHQUFHLElBQUksQ0FBQztRQUM3QixXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFcEIsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO1FBQ3JFLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLHVCQUF1QixFQUFFLENBQUMsQ0FBQztRQUN6RCxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRTtZQUNuQixJQUFJLEVBQUUsNkNBQTZDO1NBQ3BELENBQUMsQ0FBQztRQUVILElBQUksa0JBQU8sQ0FBQyxXQUFXLENBQUM7YUFDckIsT0FBTyxDQUFDLG1CQUFtQixDQUFDO2FBQzVCLE9BQU8sQ0FDTixjQUFjLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUN0QixJQUFJLENBQUMsVUFBVSxDQUFDLHFEQUFxRCxDQUFDLENBQUM7WUFDdkUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwQixJQUFJLENBQUMsVUFBVSxDQUFDLGlDQUFpQyxDQUFDLENBQUM7WUFDbkQsSUFBSSxDQUFD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