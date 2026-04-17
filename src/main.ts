
import {handleMarkdown, evaluateExpressions, PlotData, parsedText, handleTableData, GlobalProperties, handleGlobalOptions} from "../helpers/parser"
import { createPlot, buildDatasets} from "../helpers/graphs";
import {Menu, Notice, Plugin, MarkdownView} from "obsidian";
import { apply } from "mathjs";
import { setApp } from "../helpers/appContext";
import { PlotPluginSettings, DEFAULT_SETTINGS, PlotSettingTab } from "settings";
import {  ChartOptions, ChartType} from "chart.js/auto";
import {autocompletion} from "@codemirror/autocomplete";
import {generateSVG} from "../helpers/svgFormatting";
import { PlotCompletionSource } from "../helpers/plotProperties";
import { zoom } from "chartjs-plugin-zoom";
import { divideScalarDependencies } from "mathjs";
import { codePointSize } from "@codemirror/state";
import { e } from "mathjs";
import { simplify } from "mathjs";

export default class PlotPlugin extends Plugin {
	settings!: PlotPluginSettings;
	private charts = new Set<any>();

	async onload() { // Loads plugin
		await this.loadSettings();
		this.addSettingTab(new PlotSettingTab(this.app,this));

		this.registerEditorExtension([
			autocompletion({
				override: [PlotCompletionSource(this.settings)],
				activateOnTyping: true,
			})]
		)

		

		setApp(this.app); // Sets current app as the working app to use globally. 
		this.registerMarkdownCodeBlockProcessor("datachart", 
			async (source: string, el: HTMLElement) => { 
			const newMarkdown: string[] = this.removeComments(source); // Removes all # comments
			const chartType: ChartType = this.getChartTypes(newMarkdown); // Gets type:: line/bar etc

			const defaultProperties: ChartOptions<ChartType> = getDefaultPlotProperties(this.settings,chartType);
			const sourcePaths = getSourcePaths(newMarkdown); // Gets any source:: item from path PATHS. Stores them for comparisons later.
			if (defaultProperties === undefined) return;
			
			let cachedParsedText = await handleMarkdown(newMarkdown,defaultProperties,chartType); // Evaluates all the markdown in the codeblock and creates a ParsedText type object.
			let chartInstance: any = undefined;

			

			let globalrange = checkGlobalRange(cachedParsedText) // Gets the global range for the current codeblock. This is because the plot might have a global definition of the range.

			let cachedEquationData: PlotData[] = evaluateExpressions(cachedParsedText, isTuple(globalrange) ? globalrange : [-10,10,0.1]); //Evaluates all expressions, if any, inside the codeblock.
			
			const refreshTableData = async () => {
				const sourceLines = newMarkdown.filter(s => s.includes("source(") && s.includes("::"));
				cachedParsedText.tableData = await handleTableData(sourceLines);
			};

			const renderCurrentChart = async () => {
				switch (chartType) {
					case "line":
					case "scatter":
						chartInstance = await this.renderLine(cachedParsedText,cachedEquationData,chartInstance,el,chartType);
						break;
					case "bar":
						chartInstance = await this.renderBar(cachedParsedText,chartInstance,el, chartType);
						break;
					case "pie":
						case "doughnut":
							case "polarArea":
								case "radar":
								chartInstance = await this.renderCircular(cachedParsedText, chartInstance, el, chartType);
								break;

				}
			};

			await renderCurrentChart();

			this.registerEvent( // Register event 
				this.app.vault.on("modify", async (file) => { // where the event is a modification of the file
					if (!sourcePaths.includes(file.path)) return; // Only goes through if the file that is modified belongs to the codeblocks sourcepaths
					// So the file that was modified is part of the source for the current codeblocks data. We need to updated the table data.
					

					await refreshTableData(); // It hands the new markdown text to handleTableData which parses it for all tables.
					await renderCurrentChart();

				})
			);
		}
	);
		
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

	async refreshOpenCharts() {
  	this.app.workspace.getLeavesOfType("markdown").forEach(async (leaf) => {
    const view = leaf.view as MarkdownView;
    view.previewMode?.rerender(true);
  });
}

	getChartTypes(markdown: string[]): ChartType {
		const lines = markdown;
		for (const line of lines) {
			if (line.startsWith("type::")) {
				const path = line.split("::");
				if ( path[1] === undefined) continue;
				const type = path[1].trim() as ChartType
				return type;
			}
		}
		customNotice("No valid chart type found. Defaulting to line","notice-error",5000);
		return "line"
	}

	removeComments(source: string) {
		const lines = source.split("\n");
		const newMarkdown: string[] = [];
		for (const line of lines) {
			if (line.includes("#")) {
				// Comment line found
				const newLine = line.split("#"); // If a single line comment newLine is an array with length 1
				// Otherwise its 2 or more. It can have # inside the comment but thats fine. 
				if (newLine.length > 1 && newLine[0] !== undefined) {
					newMarkdown.push(newLine[0].trimEnd()); // I only push the first part which is not a comment
				} 
			} else {
				newMarkdown.push(line);
			}
		}
		return newMarkdown;
	}

	async renderLine(cachedParsedText: parsedText, cachedEquationData: PlotData[], chartInstance: any, el: HTMLElement, chartType: ChartType) {
		const parsedText = cachedParsedText; 
		const globalProperties = parsedText.globalProperties; // Gets all global properties

		const data: PlotData[] = [
			...cachedEquationData, // equations are only computed once for optimization reasons.
			...parsedText.manualData, // Manual data is updated per codeblock modification but I expect it will be small amounts of data. (Or your crazy tbh)
			...parsedText.tableData // Will always be the latest table data stored in the cache.
			]

			//console.log(JSON.stringify(parsedText.chartOptions, null, 2));
			//console.log(data);
			//console.log(parsedText.tableData);

			return await this.createChartInstane(chartInstance,el,globalProperties,data,parsedText, chartType);
		};

	async renderBar(cachedParsedText: parsedText, chartInstance: any,el: HTMLElement, chartType: ChartType) {
		const parsedText = cachedParsedText;
				const globalProperties = parsedText.globalProperties; // Gets all global properties
				const data: PlotData[] = [
					...parsedText.manualData,
					...parsedText.tableData
				]
				return await this.createChartInstane(chartInstance,el,globalProperties,data,parsedText, chartType);
			};
	async renderCircular(cachedParsedText: parsedText, chartInstance: any, el: HTMLElement, chartType: ChartType){
		const parsedText = cachedParsedText;
		const globalProperties = parsedText.globalProperties;
		const data: PlotData[] = [
			...parsedText.manualData,
			...parsedText.tableData
		]
		// Manage data to fit how pie and others accept it. 
		return await this.createChartInstane(chartInstance, el, globalProperties, data, parsedText, chartType);
	};


		async createChartInstane (chartInstance: any, el: HTMLElement, globalProperties: GlobalProperties[], data: PlotData[], parsedText: parsedText, chartType: ChartType) {
				if (!chartInstance) {
					const wrapper = el.createDiv("plot-wrapper");
					let globalSignatures = globalProperties.map(s => {return s.signature}); // Array of only signatures
					let globalExpressions = globalProperties.map(s => {return s.expr}); // Array of expressions
					// Index should be preserved so that signatures and expressions match
					const height = globalSignatures.indexOf("canvasHeight");
					const padding = globalSignatures.indexOf("canvasPadding");
					const borderRadius = globalSignatures.indexOf("canvasRadius");
					const margin = globalSignatures.indexOf("canvasMargin");
					const background = globalSignatures.indexOf("canvasBackground");
					wrapper.setCssProps({
						"--wrapper-height": height !== -1 ? `${Number(globalExpressions[height])}px` : `${this.settings.canvasHeight}px`,
						"--wrapper-padding": padding !== -1 ? `${Number(globalExpressions[padding])}px` : `${this.settings.canvasPadding}px`,
						"--wrapper-borderRadius": borderRadius !== -1 ? `${Number(globalExpressions[borderRadius])}px` : `${this.settings.canvasRadius}px`,
						"--wrapper-margin": margin !== -1 ? `${Number(globalExpressions[margin])}px 0px` : `${this.settings.marginY}px 0px`,
						"--wrapper-background": background !== -1 ? `${(globalExpressions[background])}` : (this.settings.transparentBackground ? "transparent" : this.settings.backgroundColor),
						"--wrapper-border":  this.settings.showBorder ? "none" : "1px solid var(--background-modifier-border)"
					})
					const canvas = wrapper.createEl("canvas"); 
					canvas.setCssProps({
						width: "100%",
						height: `${this.settings.canvasHeight}px`,
						"--canvas-background": background !== -1 ? `${(globalExpressions[background])}` : (this.settings.transparentBackground ? "transparent" : this.settings.backgroundColor),
					})

					chartInstance = createPlot(canvas,data,parsedText.lineProperties,parsedText.chartOptions, chartType); // Chart is created. 
					this.charts.add(chartInstance);
					canvas.addEventListener("contextmenu", async (e) => {
						e.preventDefault();

						const menu = new Menu();
						menu.addItem((item) => item
						.setTitle("Save PNG to Vault")
						.setIcon("image-file")
						.onClick( async () => {
							await this.exportChartPNG(chartInstance)
						}));

						menu.addItem((item) => item
						.setTitle("Save SVG to Vault")
						.setIcon("image-file")
						.onClick( async () => {
							await this.exportChartSVG(chartInstance,chartType)
						}));

						menu.showAtPosition({x: e.pageX, y: e.pageY});
					})

				} else {
					chartInstance.data.datasets = buildDatasets(data,parsedText.lineProperties); 
					chartInstance.update();					
				}
			return chartInstance;
		};

		async exportChartPNG(chartInstance: any, path = `${this.settings.saveImagesPath}/Chart_${Date.now()}.png`){
			const base64 = chartInstance.toBase64Image("image/png",1);
			const base64Data = base64.replace(/^data:image\/png;base64,/,"");
			const binary = atob(base64Data);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0 ; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i);
			}
			await this.app.vault.createBinary(path,bytes.buffer);
		}
		async exportChartSVG(chartInstance: any, chartType: ChartType, path = `${this.settings.saveImagesPath}/Chart_${Date.now()}.svg`) {
		 const svg = generateSVG(chartInstance,chartType);
		 await this.app.vault.create(path, svg);
		}
	}


	



export function isTuple(arr: number[]): arr is [number, number, number] {
	return arr.length === 3 && arr.every(n => typeof n === "number");
}


function getSourcePaths(src: string[]) {
	const paths: string[] = [];
	const lines = src;

	for (const line of lines) {
		if (!line.includes("source(") || !line.includes("::")) continue;

		const [,expr] = line.split("::"); // source(name) :: tableTitle is table from path;
		if (!expr) continue;
		const info = expr.split(/ is | from /); // [tableSelector, table, path]

		const path = info[2]?.trimEnd() + ".md";
		paths.push(path);
	}
	return paths;
};

function checkGlobalRange(parsedText: parsedText) {
	let globalrange: [number, number, number] = [-10,10,0.1];
				const line = (parsedText.globalProperties).find(s => s.signature.includes("range"));
				if (line == undefined) return [-10,10,0.1];
					try {
						const parsed = line.expr.replace("[","").replace("]","").split(",").map(s => Number(s));
						//const parsed = JSON.parse(rhs.trim());
						if (Array.isArray(parsed) && isTuple(parsed)) {
							globalrange = parsed;
							return globalrange;
						}
						return [-10,10,0.1];
					} catch {
							return [-10,10,0.1];
							}

				
}


export function customNotice(msg: string, cls = "", timeout = 4000) {
    const notice = new Notice(msg, timeout);

    requestAnimationFrame(() => {
        const el = notice.containerEl;
        if (el && cls) el.classList.add(cls);
    });
}

export function getDefaultPlotProperties(settings: PlotPluginSettings, chartType: ChartType): ChartOptions<ChartType> {
	return {
		...getBaseDefaults(settings),
		...getTypeDefaults(chartType,settings)
	};
}

function showError(container: HTMLElement, title: string, err: unknown) {
	const msg = err instanceof Error ? err.message: String(err); 
	container.empty();
	const box = container.createDiv("datachart-error");
	box.createEl("div",{text: title, cls: "datachart-error-title"});
	box.createEl("div",{text: simplifyError(msg)});
	console.error(err);
}

function simplifyError(err: unknown): string {
	const msg = err instanceof Error ? err.message : String(err);

	if (msg.includes("Undefined symbol")) {
		const m = msg.match(/Undefined symbol (\w+)/);
		if (m) return `Unknown variable: ${m[1]}. Variables written as var(x) are not currently supported.`;
	}
	if (msg.includes("Unexpected token")) return "Syntax error in expression";
	if (msg.includes("Cannot read")) return "Missing property or invalid object path.";

	return msg;
}

export function getTypeDefaults(chartType: ChartType, settings: PlotPluginSettings): ChartOptions<ChartType> {
		const style = getComputedStyle(document.body);
		const fontFamily = style.getPropertyValue("--font-interface").trim() || "sans-serif";
	switch (chartType) {
		case "line" :
			return {
				elements: {
					line: { borderWidth: settings.EborderWidth, tension: 0.15, fill: false},
					point: {radius: settings.pointRadius, hoverRadius: 4, hitRadius: 6, pointStyle: "circle"},
				},
				scales: {
					x: {type: settings.xScalesType, display: true, 
						grid: {display: true}, 
						ticks: {display: true, font: {family: fontFamily, size: 11}},
						title: {display: !settings.titleStatus, text: ""}
					},
					y: {type: settings.xScalesType, display: true, 
						grid: {display: true}, 
						ticks: {display: true, font: {family: fontFamily, size: 11}},
						title: {display: !settings.titleStatus, text: ""}
					},
				}
			}
		case "scatter":
			return {
				elements: {
					line: { borderWidth: settings.EborderWidth, tension: 0.15, fill: false},
					point: {radius: settings.pointRadius, hoverRadius: 4, hitRadius: 6, pointStyle: "circle"},
				},
				scales: {
					x: {type: "linear", display: true, 
						grid: {display: true}, 
						ticks: {display: true, font: {family: fontFamily, size: 11}},
						title: {display: !settings.titleStatus, text: ""}
					},
					y: {type: "linear", display: true, 
						grid: {display: true}, 
						ticks: {display: true, font: {family: fontFamily, size: 11}},
						title: {display: !settings.titleStatus, text: ""}
					},
				}
			}
		case "bar": 
			return {
				elements: {
					bar: {borderWidth: settings.EborderWidth, borderRadius: 4, borderSkipped: false}
				},
				scales: {
					x: {type: settings.xScalesType, offset: true, stacked: false, grid: {display:false}, ticks: {autoSkip:false}, 
					title: {display: !settings.titleStatus, text: ""}},
					y: {type: settings.yScalesType, stacked: false, grid: {display: true}, title: {display: !settings.titleStatus, text: ""}} 
				},
				indexAxis: "x"
			};
		case "pie":
			return {
				elements: {arc: {borderWidth: settings.EborderWidth}},
				radius: "90%",
				rotation: 0,
				circumference: 360
			} as any;
		case "doughnut":
			return {
				elements: {arc: {borderWidth: settings.EborderWidth}},
				radius: "90%",
				cutout: "50%",
				rotation: 0,
				circumference: 360
			} as any;
		case "polarArea":
			return {
				elements: {arc: {borderWidth: settings.EborderWidth}},
				scales: {r: {beginAtZero: true, ticks: {backdropColor: "transparent"}}}
			} as any;
		case "radar":
	return {
				elements: {line: {borderWidth: settings.EborderWidth,tension: 0.15,fill: true},
				point: {radius: settings.pointRadius,hoverRadius: 4,hitRadius: 6,pointStyle: "circle"}},
				scales: {r: {beginAtZero: true,
					grid: {display: true},
					angleLines: {display: true},
					pointLabels: {display: true,font: {family: fontFamily,size: 11}},
					ticks: {display: true,backdropColor: "transparent",font: {family: fontFamily,size: 10}
				}
			}
		}
	};

		default:
			return {};		
	}
}

export function getBaseDefaults(settings: PlotPluginSettings): ChartOptions<ChartType> {
	const style = getComputedStyle(document.body);
	const fontFamily = style.getPropertyValue("--font-interface").trim() || "sans-serif";
	return {
		responsive: true,
		maintainAspectRatio: false,
		animation: false,
		interaction: {mode:"nearest",intersect: false},
		layout: {padding: 8},
		plugins: {
			legend: {display: settings.legendStatus, position: "right", 
						labels: {boxWidth: 5, boxHeight: 5, padding: 14, usePointStyle: true, 
							font: {family: fontFamily, size: 12}
						},
			},
			zoom: {pan: {enabled: settings.zoomStatus ? false :true , mode: "xy"}, 
				   zoom: {wheel: {enabled: settings.zoomStatus ? false : true}, 
							pinch: {enabled: settings.zoomStatus ? false : true}, mode: "xy"}
			},
			title: {display: !settings.titleStatus, text: "", font: {family: fontFamily, size: 13, weight: 600}},
			tooltip: {enabled: true, padding: 10, cornerRadius: 8}
		}
	};
}