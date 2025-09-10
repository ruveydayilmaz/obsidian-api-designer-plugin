import {
  App,
  Plugin,
  MarkdownView,
  MarkdownPostProcessorContext,
  PluginSettingTab,
  Setting,
  // requestUrl,
} from "obsidian";

declare global {
  interface Window {
    Prism: any;
  }
}

interface APIDesignerSettings {
  customThemeJson: string;
  customTheme?: Record<string, string> | null;
}

const DEFAULT_SETTINGS: APIDesignerSettings = {
  customThemeJson: "",
  customTheme: null,
};

class APIDesignerSettingTab extends PluginSettingTab {
  plugin: APIDesignerPlugin;
  errorEl: HTMLElement | null = null;

  constructor(app: App, plugin: APIDesignerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const header = containerEl.createDiv("api-designer-settings-header");
    header.createEl("h2", { text: "API Designer Settings" });
    header.createEl("p", {
      text: "Customize how your API endpoint cards look.",
    });

    new Setting(containerEl)
      .setName("Custom theme JSON")
      .setDesc(
        createFragment((frag) => {
          frag.appendText("Paste a JSON object defining custom CSS variables. ");
          frag.createEl("br");
          frag.appendText("You can find a JSON example on ");
          frag.createEl("a", {
            href: "https://github.com/ruveydayilmaz/obsidian-api-designer-plugin",
            text: "GitHub",
          });
        })
      )
      .addTextArea(text => {
        text
          .setPlaceholder("{ \"blue\": \"#4dabf7\" }")
          .setValue(this.plugin.settings.customThemeJson || "")
          .onChange(async (value) => {
            if (this.errorEl) { this.errorEl.remove(); this.errorEl = null; }

            if (!value.trim()) {
              this.plugin.settings.customThemeJson = "";
              this.plugin.settings.customTheme = null;
              await this.plugin.saveSettings();
              this.plugin.applyCustomTheme();
              return;
            }

            this.plugin.settings.customThemeJson = value;
            try {
              const parsed = JSON.parse(value) as Record<string, string>;
              this.plugin.settings.customTheme = parsed;
            } catch {
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
            await this.plugin.saveSettings();
            this.plugin.applyCustomTheme();
          });

        text.inputEl.addClass("api-theme-json-input")
      })
  }
}

interface APIProp {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array" | string;
  items?: APIProp[] | APIProp;
}

interface APIEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | string;
  endpoint: string;
  requestBody: APIProp[];
  responseBody: APIProp[];
}

export default class APIDesignerPlugin extends Plugin {
  settings: APIDesignerSettings;
  private CUSTOM_STYLE_ID = "api-designer-custom-style";

  async onload() {
    await this.loadSettings();
    this.applyCustomTheme();

    this.addRibbonIcon("code", "Add API Endpoint", async () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) return;
      const editor = view.editor;
      const sample: APIEndpoint = {
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
      editor.replaceSelection(
        "```api-endpoints\n" + JSON.stringify([sample], null, 2) + "\n```\n"
      );
    });

    this.registerMarkdownCodeBlockProcessor(
      "api-endpoints",
      (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        let endpoints: APIEndpoint[];
        try {
          endpoints = deepClone(JSON.parse(source));
        } catch {
          el.createEl("div", { text: "Invalid JSON" });
          return;
        }

        const originalBlock = "```api-endpoints\n" + source + "\n```";

        const info = ctx.getSectionInfo(el);
        if (!info) return;

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;
        const editor: any = view.editor;

        const updateNote = () => {
          setTimeout(() => {
            const doc = editor.getValue();

            const startOffset = info?.lineStart ? editor.posToOffset({ line: info.lineStart, ch: 0 }) : -1;
            const endOffset = info?.lineEnd ? editor.posToOffset({ line: info.lineEnd, ch: 0 }) : -1;
            if (startOffset === -1 || endOffset === -1) return;

            const sectionText = doc.slice(startOffset, endOffset);
            const blockIndex = sectionText.indexOf(originalBlock);

            if (blockIndex === -1) return;

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
            if (ep.method === m) opt.selected = true;
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
            ep.method = methodSelect.value as APIEndpoint["method"];
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
          sendBtn.onclick = async () => {
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
          };

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
      }
    );

    this.addSettingTab(new APIDesignerSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private buildCustomThemeCss(themeObj: Record<string, string>) {
    const lines: string[] = [];
    for (const [rawKey, value] of Object.entries(themeObj)) {
      const key = rawKey.startsWith("api-") ? rawKey : `api-${rawKey}`;
      lines.push(`  --${key}: ${value};`);
    }
    return `.api-card {\n${lines.join("\n")}\n}\n`;
  }

  private ensureCustomStyleElement(): HTMLStyleElement {
    let el = document.getElementById(this.CUSTOM_STYLE_ID) as HTMLStyleElement | null;
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


// ------------ HELPERS ------------ //
function renderPropList(
  container: HTMLElement,
  props: APIProp[],
  onUpdate: () => void
) {
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

function renderPropRow(
  container: HTMLElement,
  prop: APIProp,
  onUpdate: () => void,
  onDelete: () => void
) {
  const row = container.createDiv({ cls: "inner-body-item" });

  const nameInput = row.createEl("input", { type: "text" });
  nameInput.value = prop.name ?? "";
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
    if (prop.type === t) opt.selected = true;
  });

  typeSelect.onchange = () => {
    prop.type = typeSelect.value as APIProp["type"];

    if (prop.type === "object") {
      if (!Array.isArray(prop.items)) prop.items = [];
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

  let subContainer: HTMLDivElement | null = null;

  const ensureSubContainer = () => {
    if (!subContainer) subContainer = row.createDiv({ cls: "sub-fields" });
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
    } else if (
      prop.type === "array" &&
      prop.items &&
      !Array.isArray(prop.items)
    ) {
      const sc = ensureSubContainer();
      sc.empty();
      const label = sc.createEl("div", { text: "Array items" });
      label.addClass("sub-label");
      renderPropRow(sc, prop.items as APIProp, onUpdate, () => {
        prop.items = { name: "item", type: "string" };
        renderSub();
        onUpdate();
      });
    } else {
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

function debounce<T extends (...a: any[]) => void>(fn: T, wait = 200) {
  let t: number | null = null;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), wait);
  };
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
