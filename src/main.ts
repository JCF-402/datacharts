
import {handleMarkdown, handleGlobalOptions, evaluateExpressions, PlotData, parsedText, handleTableData} from "../helpers/parser"
import { createPlot, buildDatasets} from "../helpers/graphs";
import {Notice, Plugin} from "obsidian";
import { apply } from "mathjs";
import { setApp } from "../helpers/appContext";
import { PlotPluginSettings, DEFAULT_SETTINGS, PlotSettingTab } from "settings";
import { ChartConfiguration } from "chart.js/auto";
import {autocompletion} from "@codemirror/autocomplete";
import {EditorView} from "@codemirror/view";
import { linePlotCompletionSource } from "../helpers/plotProperties";

export default class PlotPlugin extends Plugin {
	settings!: PlotPluginSettings;
	private charts = new Set<any>();

	async onload() { // Loads plugin
		await this.loadSettings();
		this.addSettingTab(new PlotSettingTab(this.app,this));

		this.registerEditorExtension([
			autocompletion({
				override: [linePlotCompletionSource(this.settings)],
				activateOnTyping: true,
			})]
		)

		

		setApp(this.app); // Sets current app as the working app to use globally. 
		this.registerMarkdownCodeBlockProcessor("lineplot", 
			async (source: string, el: HTMLElement) => { // Runs whenever a codeblock with the "lineplot" identifier is edited.
			const defaultProperties: ChartConfiguration<"line">["options"] = getDefaultPlotProperties(this.settings);
			const sourcePaths = getSourcePaths(source); // Gets any source:: item from path PATHS. Stores them for comparisons later.
			if (defaultProperties === undefined) return;
			let cachedParsedText = await handleMarkdown(source,defaultProperties); // Evaluates all the markdown in the codeblock and creates a ParsedText type object.

			let globalXRange = checkGlobalRange(cachedParsedText) // Gets the global range for the current codeblock. This is because the plot might have a global definition of the xrange.
			let cachedEquationData: PlotData[] = evaluateExpressions(cachedParsedText, isTuple(globalXRange) ? globalXRange : [-10,10,0.1]); //Evaluates all expressions, if any, inside the codeblock.

			// There are a few reasons for optimization. But it started with wanting the plot to update whenever the source:: object it references (the table) is updated.

			let chartInstance: any = undefined; 

			const renderPlot = async () => { 
				const parsedText = cachedParsedText; 

					const data: PlotData[] = [
					...cachedEquationData, // equations are only computed once for optimization reasons.
					...parsedText.manualData, // Manual data is updated per codeblock modification but I expect it will be small amounts of data. (Or your crazy tbh)
					...parsedText.tableData // Will always be the latest table data stored in the cache.
					]
					/*
					// Detect scale type depending on type of data. For example ChartJs works best as category for an x axis like 
					// x = [January, February, etc]
					if (parsedText.chartOptions.scales !== undefined && parsedText.chartOptions.scales.x !== undefined) {
							parsedText.chartOptions.scales.x.type = declareScalesType(data,"x") ?? "linear";
						}
					if (parsedText.chartOptions.scales !== undefined && parsedText.chartOptions.scales.y !== undefined) {
							parsedText.chartOptions.scales.y.type = declareScalesType(data,"y") ?? "linear";
						}
							*/


					//console.log(JSON.stringify(parsedText.chartOptions, null, 2));
					//console.log(data);
					//console.log(parsedText.tableData);

				if (!chartInstance) { // If the chart doesnt exist yet. Create it			
					const wrapper = el.createDiv("plot-wrapper");

					wrapper.setCssProps({
						"--wrapper-height": `${this.settings.canvasHeight}px`,
						"--wrapper-padding": `${this.settings.canvasPadding}px`,
						"--wrapper-borderRadius": `${this.settings.canvasRadius}px`,
						"--wrapper-margin": `${this.settings.marginY}px 0px`,
						"--wrapper-background": this.settings.transparentBackground ? "transparent" : "var(--background-secondary)",
						"--wrapper-border":  this.settings.showBorder ? "none" : "1px solid var(--background-modifier-border)"
					})
					const canvas = wrapper.createEl("canvas"); 
					canvas.setCssProps({
						width: "100%",
						height: `${this.settings.canvasHeight}px`
					})

					chartInstance = createPlot(canvas,data,parsedText.lineProperties,parsedText.chartOptions); // Chart is created. 
					this.charts.add(chartInstance);

				} else { // If the chart does exist only update it when a table it references is updated.
					chartInstance.data.datasets = buildDatasets(data,parsedText.lineProperties); 
					chartInstance.update();
				}	
			};

			await renderPlot(); // renderPlot() call

			this.registerEvent( // Register event 
				this.app.vault.on("modify", async (file) => { // where the event is a modification of the file
					if (!sourcePaths.includes(file.path)) return; // Only goes through if the file that is modified belongs to the codeblocks sourcepaths


						// So the file that was modified is part of the source for the current codeblocks data. We need to updated the table data.
							// It hands the new markdown text to handleTableData which parses it for all tables.	
					const updateTableData = await handleTableData(source.split("\n").filter(s => s.includes("source(") && s.includes("::")));

						
					cachedParsedText.tableData = updateTableData; // Updates stored tableData

					await renderPlot(); // Calls renderPlot(). Because the parsedText is always dependant on the cached information, previous data isnt lost.

				})
			);
		}
	);

		this.registerMarkdownCodeBlockProcessor("bases", (source: string, el: HTMLElement) => { // Later feature
			// This is for some other time
			const canvas = document.createElement("canvas"); 

			el.appendChild(canvas);


			return;
		})
	}

	onunload(): void {
		this.charts.forEach(chart => {
			try {chart.destroy();} catch {return}
		});
		this.charts.clear();
	}

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

	refreshPlots() {
		this.app.workspace.updateOptions();
	}
	
	


	
	
}




export function isTuple(arr: number[]): arr is [number, number, number] {
	return arr.length === 3 && arr.every(n => typeof n === "number");
}


function getSourcePaths(src: string) {
	const paths: string[] = [];
	const lines = src.split("\n");

	for (const line of lines) {
		if (!line.includes("source(") || !line.includes("::")) continue;

		const [,expr] = line.split("::");
		if (!expr) continue;

		const path = expr.replace("table","").replace("from","").trim() + ".md";
		paths.push(path);
	}
	return paths;
};

function checkGlobalRange(parsedText: parsedText) {
	let globalXRange: [number, number, number] = [-10,10,0.1];
				const line = (parsedText.globalProperties).find(s => s.includes("xrange"));
				if (line == undefined) return [-10,10,0.1];
		
					const rhs = line.split("=")[1];
					if (rhs === undefined) return [-10,10,0.1];
					try {
						const parsed = rhs.replace("[","").replace("]","").split(",").map(s => Number(s));
						//const parsed = JSON.parse(rhs.trim());
						if (Array.isArray(parsed) && isTuple(parsed)) {
							globalXRange = parsed;
							return globalXRange;
						}
						return [-10,10,0.1];
					} catch {
							return [-10,10,0.1];
							}

				
}


export function customNotice(msg: string, cls = "", timeout = 4000) {
    new Notice(msg, timeout);

    requestAnimationFrame(() => {
        const el = document.querySelector(".notice:last-child");
        if (el && cls) el.classList.add(cls);
    });
}

export function getDefaultPlotProperties(settings: PlotPluginSettings): ChartConfiguration<"line">["options"] {
		const style = getComputedStyle(document.body);
		const fontFamily = style.getPropertyValue("--font-interface").trim() || "sans-serif";
	return  {
		responsive: true,
		maintainAspectRatio: false,
		animation: false,
		interaction: {
			mode: "nearest",
			intersect: false
		},
		layout: {
			padding: 8
		},
		plugins: {
			legend: {
				display: settings.legendStatus,
				position: "right",
				labels: {
					boxWidth: 5,
					boxHeight: 5,
					padding: 14,
					usePointStyle: true,
					font: {
						family: fontFamily,
						size: 12
					}
				}
			},
			zoom: {
				
				pan: {
					enabled: settings.zoomStatus ? false : true,
					mode: "xy"
				},
				zoom: {
					wheel: {
						enabled: settings.zoomStatus ? false : true,
					},
					pinch: {
						enabled: settings.zoomStatus ? false : true,
					},
					mode: "xy"
				}
			},
			title: {
				display: settings.titleStatus,
				font: {
					family: fontFamily,
					size: 13,
					weight: 600
				}
			},
			tooltip: {
				enabled: true,
				padding: 10,
				cornerRadius: 8
			},
			
		},
		elements: {
			line: {
				borderWidth: settings.EborderWidth,
				tension: 0.15,
				fill: false,
			},

			point: {
				radius: settings.pointRadius,
				hoverRadius: 4,
				hitRadius: 6,
				pointStyle: "circle"
			}
		},

		scales: {
			x: {
				type: settings.xScalesType,

				display: true,

				grid: {
					display: true
				},

				ticks: {
					display: true,
					font: {
						family: fontFamily,
						size: 11
					}
				},

				title: {
					display: settings.titleStatus,
					text: ""
				}
			},

			y: {
				type: settings.yScalesType,
				display: true,

				grid: {
					display: true
				},

				ticks: {
					display: true
				},

				title: {
					display: settings.titleStatus,
					text: ""
				}}}};
				
	
		}