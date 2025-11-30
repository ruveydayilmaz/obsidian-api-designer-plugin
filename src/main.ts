import {
  App,
  Plugin,
  MarkdownView,
  MarkdownPostProcessorContext,
  PluginSettingTab,
  Setting,
  Editor,
  PluginManifest,
} from "obsidian";
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

    containerEl
      .createEl("p", { text: "Created by ", cls: "api-designer-settings-desc" })
      .createEl("a", {
        text: "Ruveyda",
        href: "https://github.com/ruveydayilmaz",
      });
    new Setting(containerEl)
      .setName("Customize theme")
      .setDesc("Customize how your API endpoint cards look.")
      .setDesc(
        createFragment((frag) => {
          frag.appendText(
            "Paste a JSON object defining custom CSS variables. "
          );
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
              const parsed = JSON.parse(value) as Record<string, string>;
              this.plugin.settings.customTheme = parsed;
            } catch {
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

    this.addRibbonIcon("code", "Add API endpoint", () => {
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

        const codeBlock: HTMLElement | null = el.closest(
          ".block-language-api-endpoints"
        );
        if (!codeBlock) return;

        const info = ctx.getSectionInfo(codeBlock);
        if (!info) return;

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;
        const editor: Editor = view.editor;

        const updateNote = () => {
          setTimeout(() => {
            const doc = editor.getValue();
            const lines = doc.split("\n");

            let start = info.lineStart;
            while (start >= 0 && !/^```api-endpoints\b/.test(lines[start]))
              start--;
            if (start < 0) return;

            let end = start + 1;
            while (end < lines.length && !/^```/.test(lines[end])) end++;
            if (end >= lines.length) end = lines.length - 1;

            const newBlock =
              "```api-endpoints\n" +
              JSON.stringify(endpoints, null, 2) +
              "\n```";

            editor.replaceRange(
              newBlock,
              { line: start, ch: 0 },
              { line: end, ch: lines[end].length }
            );
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

  applyCustomTheme() {
    const theme = this.settings.customTheme;
    if (!theme) return;

    for (const [rawKey, value] of Object.entries(theme)) {
      const key = rawKey.startsWith("api-") ? rawKey : `api-${rawKey}`;
      document.body.style.setProperty(`--${key}`, value);
    }
  }

  onunload() {}
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

function debounce<T extends (...a: unknown[]) => void>(fn: T, wait = 200) {
  let t: number | null = null;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), wait);
  };
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
