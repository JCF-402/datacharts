import { PluginSettingTab, App, Setting, DropdownComponent } from "obsidian";
import PlotPlugin from "main"

type ScaleType = "linear" | "category" | "logarithmic" | "time";

export interface PlotPluginSettings {
    canvasHeight: number;
    canvasWidth: number;
    canvasPadding: number;
    canvasRadius: number;
    showBorder: boolean;
    backgroundColor: string;
    transparentBackground: boolean;
    marginY: number;
	titleStatus: boolean,

	zoomStatus: boolean;
    EborderWidth: number;
    pointRadius: number;
    useThemeColors: boolean;
    legendStatus: boolean;
    xScalesType: ScaleType;
    yScalesType: ScaleType;
}

export const DEFAULT_SETTINGS: PlotPluginSettings = {
    canvasHeight: 320,
    canvasWidth: 100,
    EborderWidth: 2,
    pointRadius: 0,
    useThemeColors: true,
    legendStatus: false,
    xScalesType: "linear",
    yScalesType: "linear",
    canvasPadding: 12,
    canvasRadius: 12,
    marginY: 10,
    showBorder: true,
    transparentBackground: true,
    backgroundColor: "var(--background-primary)",
	titleStatus: false,
	zoomStatus: true
}


export class PlotSettingTab extends PluginSettingTab {
	plugin: PlotPlugin;

	constructor(app: App, plugin: PlotPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

        const appearance = this.makeSection(containerEl,"Appearance",true);

        const plot = this.makeSection(containerEl,"Plot Defaults",true);
		const advanced = this.makeSection(containerEl,"Advanced",true);
		/*
        new Setting(appearance)
        .setName("Use Theme Colors")
        .setDesc("Adapt charts to current theme")
        .addToggle(toggle => toggle
			.setValue(this.plugin.settings.useThemeColors)
			.onChange(async value => {
				this.plugin.settings.useThemeColors = value;
				await this.plugin.saveSettings();

			}));
		*/


		new Setting(appearance) 
			.setName("Canvas Height")
			.setDesc("Default chart height in pixels: 320px")
			.addText(text => text
				.setPlaceholder('320')
				.setValue(String(this.plugin.settings.canvasHeight))
				.onChange(async (value) => {
					this.plugin.settings.canvasHeight = Number(value) || DEFAULT_SETTINGS.canvasHeight;
					await this.plugin.saveSettings();

				}))
            .addExtraButton(btn => btn
                .setIcon("reset")
                .setTooltip("Reset")
                .onClick(async () => {
                    this.plugin.settings.canvasHeight = DEFAULT_SETTINGS.canvasHeight;
                    await this.plugin.saveSettings();

                    this.display()
                })
            );

            new Setting(appearance) 
			.setName("Canvas Padding")
			.setDesc("Controls spacing between border and chart.")
			.addText(text => text
				.setPlaceholder('12')
				.setValue(String(this.plugin.settings.canvasPadding))
				.onChange(async (value) => {
					this.plugin.settings.canvasPadding = Number(value) || DEFAULT_SETTINGS.canvasPadding;
					await this.plugin.saveSettings();

				}))
            .addExtraButton(btn => btn
                .setIcon("reset")
                .setTooltip("Reset")
                .onClick(async () => {
                    this.plugin.settings.canvasPadding = DEFAULT_SETTINGS.canvasPadding;
                    await this.plugin.saveSettings();

                    this.display()
                })
            );

            new Setting(appearance) 
			.setName("Canvas Radius")
			.setDesc("Controls how rounded the corners look.")
			.addText(text => text
				.setPlaceholder('12')
				.setValue(String(this.plugin.settings.canvasRadius))
				.onChange(async (value) => {
					this.plugin.settings.canvasRadius = Number(value) || DEFAULT_SETTINGS.canvasRadius;
					await this.plugin.saveSettings();

				}))
            .addExtraButton(btn => btn
                .setIcon("reset")
                .setTooltip("Reset")
                .onClick(async () => {
                    this.plugin.settings.canvasRadius = DEFAULT_SETTINGS.canvasRadius;
                    await this.plugin.saveSettings();

                    this.display()
                })
            );

            new Setting(appearance) 
			.setName("Don't Show Border")
			.setDesc("Controls if canvas border shows.")
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.showBorder)
                    .onChange(async value => {
                        this.plugin.settings.showBorder = value;
                        await this.plugin.saveSettings();
                    })
                );
            new Setting(appearance) 
			.setName("Transparent Background")
			.setDesc("Toggles transparent background.")
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.transparentBackground)
                    .onChange(async value => {
                        this.plugin.settings.transparentBackground = value;
                        await this.plugin.saveSettings();
                    })
                );
            
            plotSchema.forEach(item => this.buildPlotSetting(plot, item));

			new Setting(advanced)
			.setName("Disable Chart Zoom")
			.setDesc("Disallow zooming and panning on charts.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.zoomStatus)
				.onChange(async value => {
					this.plugin.settings.zoomStatus = value;
					await this.plugin.saveSettings();
				})
			)
       

	}
    makeSection(parent: HTMLElement, title: string, open = false): HTMLElement {
            const details = parent.createEl("details", {cls: "plot-settings-section"});
            if (open) details.setAttr("open","true");
            details.createEl("summary",{text: title});
            return details.createDiv("plot-settings-body");
        }
    buildPlotSetting(parent: HTMLElement, item: PlotSettingSchema) {
	const setting = new Setting(parent)
		.setName(item.name)
		.setDesc(item.desc);

	switch (item.type) {
		case "number":
			setting.addText(text =>
				text
					.setPlaceholder(String(DEFAULT_SETTINGS[item.key]))
					.setValue(String(this.plugin.settings[item.key]))
					.onChange(async value => {
						const n = Number(value);

						this.plugin.settings[item.key] =
							isNaN(n)
								? DEFAULT_SETTINGS[item.key]
								: n;

						await this.plugin.saveSettings();
					})
			);
			break;

		case "toggle":
			setting.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings[item.key])
					.onChange(async value => {
						this.plugin.settings[item.key] = value;
						await this.plugin.saveSettings();
					})
			);
			break;

		case "dropdown":
			setting.addDropdown(drop => {
				Object.entries(item.options).forEach(([value, label]) =>
					drop.addOption(value, label)
				);

				drop
					.setValue(this.plugin.settings[item.key])
					.onChange(async value => {
						this.plugin.settings[item.key] =
							value as ScaleType;

						await this.plugin.saveSettings();
					});
			});
			break;
	}

	setting.addExtraButton(btn =>
		btn
			.setIcon("reset")
			.setTooltip("Reset")
			.onClick(async () => {
				switch (item.type) {
					case "number":
						this.plugin.settings[item.key] =
							DEFAULT_SETTINGS[item.key];
						break;

					case "toggle":
						this.plugin.settings[item.key] =
							DEFAULT_SETTINGS[item.key];
						break;

					case "dropdown":
						this.plugin.settings[item.key] =
							DEFAULT_SETTINGS[item.key];
						break;
				}

				await this.plugin.saveSettings();
				this.display();
			})
	);
}
}

type PlotSettingSchema =
	| {
			type: "number";
			key: "canvasHeight" | "canvasWidth" | "EborderWidth" | "pointRadius";
			name: string;
			desc: string;
	  }
	| {
			type: "toggle";
			key: "useThemeColors" | "legendStatus" | "titleStatus";
			name: string;
			desc: string;
	  }
	| {
			type: "dropdown";
			key: "xScalesType" | "yScalesType";
			name: string;
			desc: string;
			options: Record<ScaleType, string>;
	  };

const plotSchema: PlotSettingSchema[] = [
	{
		type: "dropdown",
		key: "xScalesType",
		name: "X Scale Type",
		desc: "Scale type for x axis.",
		options: {
			linear: "Linear",
			category: "Category",
			logarithmic: "Logarithmic",
			time: "Time"
		}
	},
	{
		type: "dropdown",
		key: "yScalesType",
		name: "Y Scale Type",
		desc: "Scale type for y axis.",
		options: {
			linear: "Linear",
			category: "Category",
			logarithmic: "Logarithmic",
			time: "Time"
		}
	},
	{
		type: "toggle",
		key: "titleStatus",
		name: "Display Ttiles",
		desc: "If on titles will always be displayed. Meaning you don't have to use obj.plugins.title.display = true \n Kept false as default for tidiness."
	},
	{
		type: "number",
		key: "EborderWidth",
		name: "Line Width",
		desc: "Default line thickness"
	},
	{
		type: "number",
		key: "pointRadius",
		name: "Point Radius",
		desc: "Default point radius"
	},
	{
		type: "toggle",
		key: "legendStatus",
		name: "Legend Status",
		desc: "Show legend by default"
	}
];


 /*
        new Setting(plot)
            .setName("X Scale Type")
			.setDesc("Scale type for the x axis. Linear works well for numerical values. \n categorical for stuff like dates, strings, etc.")
			.addText(text => text
				.setPlaceholder('linear')
				.setValue(String(this.plugin.settings.xScalesType))
				.onChange(async (value) => {
					this.plugin.settings.xScalesType = String(value) || DEFAULT_SETTINGS.xScalesType;
					await this.plugin.saveSettings();

				}))
            .addExtraButton(btn => btn
                .setIcon("reset")
                .setTooltip("Reset")
                .onClick(async () => {
                    this.plugin.settings.xScalesType = DEFAULT_SETTINGS.xScalesType;
                    await this.plugin.saveSettings();

                    this.display()
                })
            );
        new Setting(plot)
            .setName("Line Width")
			.setDesc("Default line thickness")
			.addText(text => text
				.setPlaceholder('2')
				.setValue(String(this.plugin.settings.EborderWidth))
				.onChange(async (value) => {
					this.plugin.settings.EborderWidth = Number(value) || DEFAULT_SETTINGS.EborderWidth;
					await this.plugin.saveSettings();

				}))
            .addExtraButton(btn => btn
                .setIcon("reset")
                .setTooltip("Reset")
                .onClick(async () => {
                    this.plugin.settings.EborderWidth = DEFAULT_SETTINGS.EborderWidth;
                    await this.plugin.saveSettings();

                    this.display()
                })
            );
        new Setting(plot)
            .setName("Legend Status")
			.setDesc("Legend does not appear by default")
			.addText(text => text
				.setPlaceholder('false')
				.setValue(String(this.plugin.settings.legendStatus))
				.onChange(async (value) => {
					this.plugin.settings.legendStatus = Boolean(value) || DEFAULT_SETTINGS.legendStatus;
					await this.plugin.saveSettings();

				}))
            .addExtraButton(btn => btn
                .setIcon("reset")
                .setTooltip("Reset")
                .onClick(async () => {
                    this.plugin.settings.legendStatus = DEFAULT_SETTINGS.legendStatus;
                    await this.plugin.saveSettings();

                    this.display()
                })
            );
        */