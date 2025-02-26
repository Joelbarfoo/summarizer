import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

interface MyPluginSettings {
	secret: string;
	HeadingLevel: number;
	HeadingName: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	secret: "default",
	HeadingLevel: 1,
	HeadingName: "Dokumentation",
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// Create an icon in the left ribbon
		const ribbonIconEl = this.addRibbonIcon(
			"pdf-file",
			"Summarize current file",
			async () => {
				await this.handleSummarizeFile();
			}
		);
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// Add a status bar item
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Found a diary");

		// Add a command to summarize the file
		this.addCommand({
			id: "summarize-file",
			name: "Summarize File",
			callback: async () => {
				await this.handleSummarizeFile();
			},
		});

		// Register settings tab
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// Register a global event listener
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// Register an interval
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);
	}

	async handleSummarizeFile() {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("No active file found!");
			return;
		}

		try {
			const content = await this.app.vault.read(file);
			const documentationContent = this.summarizeFile(content);

			if (documentationContent.length > 0) {
				new Notice(documentationContent);
			} else {
				new Notice("No Dokumentation section found in this file.");
			}
		} catch (err) {
			new Notice("Error reading file: " + err.message);
			console.error(err);
		}
	}

	summarizeFile(content: string): string {
		const lines = content.split("\n");
		let inSection = false;
		let sectionContent: string[] = [];

		// Generate the correct heading prefix (e.g., "### Dokumentation" for HeadingLevel = 3)
		const headingPrefix = `${"#".repeat(this.settings.HeadingLevel)} ${
			this.settings.HeadingName
		}`;

		for (const line of lines) {
			if (line.startsWith(headingPrefix)) {
				inSection = true;
				continue;
			}

			if (inSection) {
				if (line.match(/^#+\s/)) break; // Stop at the next heading
				sectionContent.push(line.trim());
			}
		}

		return sectionContent.join("\n");
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Setting #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.secret)
					.onChange(async (value) => {
						this.plugin.settings.secret = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Name of heading").addText((text) =>
			text
				.setPlaceholder("Dokumentation")
				.setValue(this.plugin.settings.HeadingName)
				.onChange(async (value) => {
					this.plugin.settings.HeadingName = value;
					await this.plugin.saveSettings();
				})
		);

		new Setting(containerEl)
			.setName("Level of heading")
			.addSlider((slider) => {
				const settingDiv = containerEl.createDiv({
					cls: "slider-container",
					attr: {
						style: "display: flex; align-items: center; gap: 10px;",
					},
				});
				const label = settingDiv.createEl("span", {
					text: "Level of heading:",
					cls: "slider-label",
				});
				const valueDisplay = settingDiv.createEl("span", {
					text: ` ${this.plugin.settings.HeadingLevel}`,
					cls: "slider-value",
				});

				slider
					.setLimits(1, 6, 1)
					.setValue(this.plugin.settings.HeadingLevel)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.HeadingLevel = value;
						valueDisplay.setText(` ${value}`);
						await this.plugin.saveSettings();
					});

				settingDiv.appendChild(label);
				settingDiv.appendChild(slider.sliderEl);
				settingDiv.appendChild(valueDisplay);
			});
	}
}
