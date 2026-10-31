import {
  App,
  Plugin,
  MarkdownView,
  MarkdownPostProcessorContext,
  PluginSettingTab,
  Setting,
  SettingDefinitionItem,
  Editor,
  PluginManifest,
  debounce,
  setIcon,
} from "obsidian";
interface APIDesignerSettings {
  customThemeJson: string;
  customTheme?: Record<string, string> | null;
}

const METHODS = ["GET", "POST", "PUT", "DELETE"];
const PROP_TYPES = ["string", "number", "boolean", "object", "array"];
const MAX_DEPTH = 8;
const MAX_SOURCE_LENGTH = 1000000;
const THEME_KEY = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;
const THEME_VALUE = /^[#A-Za-z0-9(),.%\s-]{1,64}$/;

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

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "Customize theme",
        render: (setting) => this.renderThemeSetting(setting),
      },
    ];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl
      .createEl("p", { text: "Created by ", cls: "api-designer-settings-desc" })
      .createEl("a", {
        text: "Ruveyda",
        href: "https://github.com/ruveydayilmaz",
      });
    this.renderThemeSetting(new Setting(containerEl));
  }

  private renderThemeSetting(setting: Setting) {
    setting
      .setName("Customize theme")
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
      .addTextArea((text) => {
        text
          .setPlaceholder('{ "blue": "#4dabf7" }')
          .setValue(this.plugin.settings.customThemeJson || "")
          .onChange(async (value) => {
            if (this.errorEl) {
              this.errorEl.remove();
              this.errorEl = null;
            }

            if (!value.trim()) {
              this.plugin.settings.customThemeJson = "";
              this.plugin.settings.customTheme = null;
              await this.plugin.saveSettings();
              return;
            }

            this.plugin.settings.customThemeJson = value;
            try {
              const parsed: unknown = JSON.parse(value);
              this.plugin.settings.customTheme = sanitizeTheme(parsed);
            } catch {
              this.errorEl = setting.controlEl.createDiv({
                text: "Invalid format",
                cls: "api-designer-api-theme-error",
              });
              this.errorEl.addClass("api-designer-error");
            }
            await this.plugin.saveSettings();
          });

        text.inputEl.addClass("api-theme-json-input");
      });
  }
}

interface APIProp {
  name: string;
  type: string;
  items?: APIProp[] | APIProp;
}

interface APIEndpoint {
  method: string;
  endpoint: string;
  requestBody: APIProp[];
  responseBody: APIProp[];
}

export default class APIDesignerPlugin extends Plugin {
  settings: APIDesignerSettings;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.settings = {
      customThemeJson: "",
      customTheme: null,
    };
  }

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "add-api-endpoint",
      name: "Add an endpoint",
      checkCallback: (checking: boolean) => {
        const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!mdView) return false;

        if (!checking) {
          this.insertSampleEndpoint();
        }

        return true;
      },
    });

    this.addRibbonIcon("code", "Add an endpoint", () => {
      this.insertSampleEndpoint();
    });

    this.registerMarkdownCodeBlockProcessor(
      "api-endpoints",
      (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        let endpoints: APIEndpoint[];
        try {
          if (source.length > MAX_SOURCE_LENGTH) throw new Error("too large");
          endpoints = sanitizeEndpoints(JSON.parse(source));
        } catch {
          el.createDiv({ text: "Invalid JSON" });
          return;
        }

        const codeBlock: HTMLElement | null = el.closest(
          ".block-language-api-endpoints"
        );
        if (!codeBlock) return;

        if (!ctx.getSectionInfo(codeBlock)) return;

        let lastSource = source.trim();

        const updateNote = () => {
          window.setTimeout(() => {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!view || !view.file || view.file.path !== ctx.sourcePath) return;

            const info = ctx.getSectionInfo(codeBlock);
            if (!info) return;

            const editor: Editor = view.editor;
            const lines = editor.getValue().split("\n");

            const start = info.lineStart;
            if (!/^```api-endpoints\b/.test(lines[start] ?? "")) return;

            let end = start + 1;
            while (end < lines.length && !/^```/.test(lines[end])) end++;
            if (end >= lines.length) end = lines.length - 1;

            const currentBody = lines.slice(start + 1, end).join("\n").trim();
            if (currentBody !== lastSource) return;

            const json = JSON.stringify(endpoints, null, 2);
            const newBlock = "```api-endpoints\n" + json + "\n```";

            editor.replaceRange(
              newBlock,
              { line: start, ch: 0 },
              { line: end, ch: lines[end].length }
            );
            lastSource = json.trim();
          }, 0);
        };

        const debouncedUpdate = debounce(updateNote, 120);

        endpoints.forEach((ep) => {
          const card = el.createDiv({ cls: `api-designer-api-card` });
          const header = card.createDiv({ cls: "api-designer-api-header" });

          const methodSelect = header.createEl("select", {
            cls: "api-designer-method-select",
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
            ep.method = methodSelect.value;
            refreshMethodClass();
            debouncedUpdate();
          };

          const endpointInput = header.createEl("input", {
            type: "text",
            cls: "api-designer-endpoint-input",
          });
          endpointInput.value = ep.endpoint;
          endpointInput.placeholder = "/endpoint";
          endpointInput.onblur = () => {
            ep.endpoint = endpointInput.value;
            updateNote();
          };

          const sendBtn = header.createEl("button", { cls: "api-designer-send-btn" });
          sendBtn.ariaLabel = "WIP";
          sendBtn.disabled = true;

          const icon = sendBtn.createDiv({ cls: "api-designer-send-icon" });
          setIcon(icon, "send-horizontal");

          const body = card.createDiv({ cls: "api-designer-body" });

          const wrapperLeft = body.createDiv({ cls: "api-designer-title-wrapper" });
          wrapperLeft.createEl("h5", { text: "Request" });
          const reqList = wrapperLeft.createDiv({ cls: "api-designer-inner-body" });
          renderPropList(reqList, ep.requestBody, () => updateNote());

          const wrapperRight = body.createDiv({ cls: "api-designer-title-wrapper" });
          wrapperRight.createEl("h5", { text: "Response" });
          const resList = wrapperRight.createDiv({ cls: "api-designer-inner-body" });
          renderPropList(resList, ep.responseBody, () => updateNote());

          const responseBox = card.createEl("pre", {
            cls: "api-designer-api-response hidden",
          });
          responseBox.createEl("code");
        });
      }
    );

    this.addSettingTab(new APIDesignerSettingTab(this.app, this));
  }

  async loadSettings() {
    const data = (await this.loadData()) as Partial<APIDesignerSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  applyCustomTheme() {
    const theme = this.settings.customTheme;
    if (!theme) return;

    for (const [rawKey, value] of Object.entries(sanitizeTheme(theme) ?? {})) {
      const key = rawKey.startsWith("api-") ? rawKey : `api-${rawKey}`;
      activeDocument.body.style.setProperty(`--${key}`, value);
    }
  }

  private insertSampleEndpoint() {
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

  const addBtn = container.createEl("button", { text: "New", cls: "api-designer-add-btn" });
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
  const row = container.createDiv({ cls: "api-designer-inner-body-item" });

  const nameInput = row.createEl("input", { type: "text" });
  nameInput.value = prop.name ?? "";
  nameInput.placeholder = "Property name";
  nameInput.onblur = () => {
    prop.name = nameInput.value;
    onUpdate();
  };

  const wrapper = row.createDiv({ cls: "api-designer-select-wrapper" });

  const icon = wrapper.createDiv({ cls: "api-designer-select-icon" });
  setIcon(icon, "chevron-down");

  const typeSelect = wrapper.createEl("select", { cls: "api-designer-type-select" });
  ["string", "number", "boolean", "object", "array"].forEach((t) => {
    const opt = typeSelect.createEl("option", { text: t, value: t });
    if (prop.type === t) opt.selected = true;
  });

  typeSelect.onchange = () => {
    prop.type = typeSelect.value;

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

  const delBtn = row.createEl("button", { text: "🗑️", cls: "api-designer-delete-btn" });
  delBtn.onclick = () => onDelete();

  let subContainer: HTMLDivElement | null = null;

  const ensureSubContainer = () => {
    if (!subContainer) subContainer = row.createDiv({ cls: "api-designer-sub-fields" });
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
      const label = sc.createDiv({ text: "Array items" });
      label.addClass("sub-label");
      renderPropRow(sc, prop.items, onUpdate, () => {
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

function sanitizeTheme(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(value)) {
    if (
      THEME_KEY.test(key) &&
      typeof val === "string" &&
      THEME_VALUE.test(val) &&
      !/url\s*\(/i.test(val)
    ) {
      result[key] = val;
    }
  }
  return result;
}

function sanitizeProp(value: unknown, depth: number, fallbackName: string): APIProp {
  const o = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const type = typeof o.type === "string" && PROP_TYPES.includes(o.type) ? o.type : "string";
  const prop: APIProp = {
    name: typeof o.name === "string" ? o.name : fallbackName,
    type,
  };
  if (type === "object") {
    prop.items = sanitizeProps(o.items, depth + 1);
  } else if (type === "array") {
    prop.items =
      depth + 1 > MAX_DEPTH
        ? { name: "item", type: "string" }
        : sanitizeProp(Array.isArray(o.items) ? undefined : o.items, depth + 1, "item");
  }
  return prop;
}

function sanitizeProps(value: unknown, depth: number): APIProp[] {
  if (!Array.isArray(value) || depth > MAX_DEPTH) return [];
  return value.map((p) => sanitizeProp(p, depth, ""));
}

function sanitizeEndpoints(value: unknown): APIEndpoint[] {
  if (!Array.isArray(value)) throw new Error("not an array");
  return value.map((v) => {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    return {
      method: typeof o.method === "string" && METHODS.includes(o.method) ? o.method : "GET",
      endpoint: typeof o.endpoint === "string" ? o.endpoint : "",
      requestBody: sanitizeProps(o.requestBody, 0),
      responseBody: sanitizeProps(o.responseBody, 0),
    };
  });
}