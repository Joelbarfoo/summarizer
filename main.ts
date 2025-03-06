import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";

import OpenAI from "openai";

// Plugin Settings Interface
interface MyPluginSettings {
	secret: string;
	HeadingLevel: number;
	HeadingName: string;
	SummaryLevel: number;
	SummaryName: string;
}

// Default Plugin Settings
const DEFAULT_SETTINGS: MyPluginSettings = {
	secret: "default",
	HeadingLevel: 1,
	HeadingName: "Dokumentation",
	SummaryLevel: 1,
	SummaryName: "Summary",
};

class SetupModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        let { contentEl } = this;
        contentEl.createEl("h2", { text: "Welcome to Chat GPT Summarizer Plugin!" });
        contentEl.createEl("p", { text: "Please enter your Chat GPT API Key" });

        let input = contentEl.createEl("input", { type: "text", placeholder: "Enter here" });

        let submitBtn = contentEl.createEl("button", { text: "Save" });
		submitBtn.style.marginLeft = "10px"; 
        submitBtn.addEventListener("click", () => {
            console.log("User entered:", input.value);
            this.close();
        });
    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	statusBarItemEl: HTMLElement;

	async onload() {
        const data = await this.loadData();
        if (!data || !data.setupCompleted) {
            new SetupModal(this.app).open();
            await this.saveData({ setupCompleted: true }); // Save that setup was completed
        }
		
		await this.loadSettings();
		this.addRibbonButton();
		this.createStatusBar();
		this.registerCommands();
		this.registerEvents();
		this.addSettingTab(new SampleSettingTab(this.app, this));
		this.registerInterval(
			window.setInterval(() => this.updateStatusBar(), 1000)
		);
	}

	// Add ribbon icon with a click handler
	addRibbonButton() {
		const ribbonIconEl = this.addRibbonIcon(
			"pdf-file",
			"Summarize current file",
			async () => {
				await this.handleSummarizeFile();
			}
		);
		ribbonIconEl.addClass("my-plugin-ribbon-class");
	}

	// Create the status bar element
	createStatusBar() {
		this.statusBarItemEl = this.addStatusBarItem();
		this.updateStatusBar();
	}

	// Register plugin commands
	registerCommands() {
		this.addCommand({
			id: "summarize-file",
			name: "Summarize File",
			callback: async () => await this.handleSummarizeFile(),
		});
	}

	// Register event listeners
	registerEvents() {
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () =>
				this.updateStatusBar()
			)
		);
		this.registerEvent(
			this.app.vault.on("modify", () => this.updateStatusBar())
		);
	}

	// Summarize the active file
	async handleSummarizeFile() {
		const file = this.app.workspace.getActiveFile();
		if (!file) return new Notice("No active file found!");

		try {
			const content = await this.app.vault.read(file);
			const documentationContent = this.extractSection(content);

			if (!documentationContent) {
				new Notice("No documentation section found.");
				return;
			}

			new Notice(
				"Extracted content: " +
					documentationContent.substring(0, 100) +
					"..."
			);

			const client = new OpenAI({
				dangerouslyAllowBrowser: true,
				apiKey: this.settings.secret,
			});

			
			const chatCompletion = await client.chat.completions.create({
				messages: [
					{
						role: "user",
						content:
							"Fasse diesen Text zusammen in ein bis drei Sätzen: \n\n\n" +
							documentationContent,
					},
				],
				model: "gpt-4o",
			});
			
			
			if (chatCompletion && chatCompletion.choices.length > 0) {
				const editor = this.app.workspace.activeEditor?.editor;
				if (editor) {
					const content = editor.getValue();
					const lines = content.split("\n");

					const index = lines.findIndex((line) =>
						line.includes(
							`${"#".repeat(this.settings.SummaryLevel)} ${
								this.settings.SummaryName
							}`
						)
					);
					if (index !== -1) {
						// Füge eine neue Zeile nach der gefundenen Zeile ein
						lines.splice(index + 1, 0, chatCompletion.choices[0].message.content ?? "Keine Antwort erhalten");
						editor.setValue(lines.join("\n"));
					}
				}
			} else {
				new Notice("Keine Antwort von OpenAI erhalten.");
			}
		} catch (err) {
			new Notice("Error reading or processing file. Error: " + err);
			console.error(err);
		}
	}

	// Update the status bar with the presence of the heading
	async updateStatusBar() {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			this.statusBarItemEl.setText("No active file");
			return;
		}

		const content = await this.app.vault.read(file);
		const hasHeading = this.extractSection(content).length > 0;
		this.statusBarItemEl.setText(
			hasHeading
				? `Heading '${this.settings.HeadingName}' with Level ${this.settings.HeadingLevel} found`
				: `Heading '${this.settings.HeadingName}' with Level ${this.settings.HeadingLevel} missing`
		);
	}

	// Extract content under the specified heading
	extractSection(content: string): string {
		const lines = content.split("\n");
		const heading = `${"#".repeat(this.settings.HeadingLevel)} ${
			this.settings.HeadingName
		}`;
		const headingRegex = new RegExp(`^${heading}\\s*$`);

		let inSection = false;
		let sectionContent: string[] = [];

		for (const line of lines) {
			if (headingRegex.test(line)) {
				inSection = true;
				continue;
			}
			if (inSection && line.match(/^#+\s/)) break;
			if (inSection) sectionContent.push(line.trim());
		}

		return sectionContent.join("\n");
	}

	onunload() {}

	// Load plugin settings
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	// Save plugin settings
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	message: string;
	prompt: string = "Fasse diesen Tag zusammen in ein bis drei Sätzen:\n\n\n";

	constructor(app: App, message: string) {
		super(app);
		this.message = message;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Create a <pre> element to preserve formatting
		const preEl = contentEl.createEl("pre");

		// Set text properly, ensuring all line breaks in `prompt` are preserved
		preEl.appendText(this.prompt);
		preEl.appendText(this.message.replace(/\n{3,}/g, "\n\n"));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Settings Tab
class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Secret Setting
		new Setting(containerEl).setName("ChatGPT secret").addText((text) =>
			text
				.setPlaceholder("Enter your secret")
				.setValue(this.plugin.settings.secret)
				.onChange(async (value) => {
					this.plugin.settings.secret = value;
					await this.plugin.saveSettings();
				})
		);

		// Heading Name Setting
		new Setting(containerEl).setName("Name of heading").addText((text) =>
			text
				.setPlaceholder("Dokumentation")
				.setValue(this.plugin.settings.HeadingName)
				.onChange(async (value) => {
					this.plugin.settings.HeadingName = value;
					await this.plugin.saveSettings();
				})
		);

		// Heading Level Setting
		new Setting(containerEl)
			.setName("Level of heading")
			.addSlider((slider) => {
				const settingDiv = containerEl.createDiv({
					cls: "slider-container",
					attr: {
						style: "display: flex; align-items: center; gap: 10px;",
					},
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

				settingDiv.appendChild(slider.sliderEl);
				settingDiv.appendChild(valueDisplay);
			});

		// Summary Name Setting
		new Setting(containerEl).setName("Name of summary").addText((text) =>
			text
				.setPlaceholder("Summary")
				.setValue(this.plugin.settings.SummaryName)
				.onChange(async (value) => {
					this.plugin.settings.SummaryName = value;
					await this.plugin.saveSettings();
				})
		);

		// Summmary Level Setting
		new Setting(containerEl)
			.setName("Level of summary")
			.addSlider((slider) => {
				const settingDiv = containerEl.createDiv({
					cls: "slider-container",
					attr: {
						style: "display: flex; align-items: center; gap: 10px;",
					},
				});
				const valueDisplay = settingDiv.createEl("span", {
					text: ` ${this.plugin.settings.HeadingLevel}`,
					cls: "slider-value",
				});

				slider
					.setLimits(1, 6, 1)
					.setValue(this.plugin.settings.SummaryLevel)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.SummaryLevel = value;
						valueDisplay.setText(` ${value}`);
						await this.plugin.saveSettings();
					});

				settingDiv.appendChild(slider.sliderEl);
				settingDiv.appendChild(valueDisplay);
			});
	}
}
