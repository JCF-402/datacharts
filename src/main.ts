
import {handleMarkdown, handleGlobalOptions, evaluateExpressions, PlotData, parsedText, handleTableData, Equation, GlobalProperties,Data} from "../helpers/parser"
import { createPlot, buildDatasets} from "../helpers/graphs";
import {Menu, Notice, Plugin, TextAreaComponent} from "obsidian";
import { apply } from "mathjs";
import { setApp } from "../helpers/appContext";
import { PlotPluginSettings, DEFAULT_SETTINGS, PlotSettingTab } from "settings";
import {  ChartOptions, ChartType, Ticks } from "chart.js/auto";
import {autocompletion} from "@codemirror/autocomplete";

import { linePlotCompletionSource } from "../helpers/plotProperties";
import { zoom } from "chartjs-plugin-zoom";
import { divideScalarDependencies } from "mathjs";

export default class PlotPlugin extends Plugin {
	settings!: PlotPluginSettings;
	private charts = new Set<any>();

	async onload() { // Loads plugin
		await this.loadSettings();
		this.addSettingTab(new PlotSettingTab(this.app,this));

		this.registerEditorExtension([
			autocompletion({
				override: [linePlotCompletionSource(this.settings,"line")],
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

			

			let globalXRange = checkGlobalRange(cachedParsedText) // Gets the global range for the current codeblock. This is because the plot might have a global definition of the xrange.
			let cachedEquationData: PlotData[] = evaluateExpressions(cachedParsedText, isTuple(globalXRange) ? globalXRange : [-10,10,0.1]); //Evaluates all expressions, if any, inside the codeblock.
			
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

				}
			};

			await renderCurrentChart();

			this.registerEvent( // Register event 
				this.app.vault.on("modify", async (file) => { // where the event is a modification of the file
					if (!sourcePaths.includes(file.path)) return; // Only goes through if the file that is modified belongs to the codeblocks sourcepaths

					// So the file that was modified is part of the source for the current codeblocks data. We need to updated the table data.
					// It hands the new markdown text to handleTableData which parses it for all tables.

					await refreshTableData(); 
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

	refreshPlots() {
		this.app.workspace.updateOptions();
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
							await this.exportChartSVG(chartInstance)
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
		async exportChartSVG(chartInstance: any, path = `${this.settings.saveImagesPath}/Chart_${Date.now()}.svg`) {
			const width = chartInstance.width;
			const height = chartInstance.height;

			//const backgroundColor = this.settings.backgroundColor;
			const xScale = chartInstance.scales.x;
			const yScale = chartInstance.scales.y;
			const area = chartInstance.chartArea;
			const style = getComputedStyle(document.body);
			const bg = style.getPropertyValue("--background-secondary").trim() || "#ffffff";
			const text = style.getPropertyValue("--text-normal").trim() || "#000000";
			const muted = style.getPropertyValue("--text-muted").trim() || "#666666";
			const border = style.getPropertyValue("--background-modifier-border").trim() || "#d0d0d0";

		    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${bg}" />`; 
			 svg += `
			 <line
			 	x1="${area.left}"
				y1="${area.bottom}"
				x2="${area.right}"
				y2="${area.bottom}"
				stroke="${muted}"
				stroke-width="1"
			/>

			<line
				x1="${area.left}"
				y1="${area.top}"
				x2="${area.left}"
				y2="${area.bottom}"
				stroke="${muted}"
				stroke-width="1"
			/>
			 `;
			 const title = chartInstance.options?.plugins?.title;

				if (title?.display && title.text) {
					svg += `
					<text
						x="${width / 2}"
						y="20"
						font-size="16"
						font-weight="bold"
						text-anchor="middle"
						fill="${text}">${title.text}</text>
					`;
				}
			xScale.ticks.forEach((tick: any, i: number) => {
			const x = xScale.getPixelForTick(i);

			    svg += `
				<line
					x1="${x}"
					y1="${area.top}"
					x2="${x}"
					y2="${area.bottom}"
					stroke="${border}"
					stroke-width="1"
				/>
   				 `;
			svg += `
			<line
				x1="${x}"
				y1="${area.bottom}"
				x2="${x}"
				y2="${area.bottom + 6}"
				stroke="${border}"
				stroke-width="1"
			/>
			    <text
				x="${x}"
				y="${area.bottom + 18}"
				font-size="12"
				text-anchor="middle"
				dominant-baseline="middle"
				fill="${text}">
				${tick.label}
    			</text>
			`;


				});

			yScale.ticks.forEach((tick: any, i: number) => {
				const y = yScale.getPixelForTick(i);
				svg += `
				<line
					x1="${area.left}"
					y1="${y}"
					x2="${area.right}"
					y2="${y}"
					stroke="${border}"
					stroke-width="1"
				/>
				`;
				svg += `
				<line
					x1="${area.left - 6}"
					y1="${y}"
					x2="${area.left}"
					y2="${y}"
					stroke="${border}"
					stroke-width="1"
					
				/>
				<text
					x="${area.left - 8}"
					y="${y}"
					font-size="12"
					text-anchor="end"
					dominant-baseline="middle"
					fill="${text}">${tick.label}</text>
				`;
			});
			let lx = width - 74;
			let ly = 25;

			 chartInstance.data.datasets.forEach((dataset: any, i: number) => {
				const y = ly + i*20;
				const meta = chartInstance.getDatasetMeta(i);
				const points = meta.data.map((pt: Data) => `${pt.x},${pt.y}`).join(" ");
				const color = dataset.borderColor || "black";
				const radius = (dataset.pointRadius && dataset.pointRadius === 0) ? 0 : dataset.pointRadius;
				//const radius = dataset.pointRadius && dataset.pointRadius > 0 ? dataset.pointRadius : 3;
				svg += `
				<rect x="${lx}" y="${y-10}" width="12" height="12" fill="${color}" />
				<text
					x="${lx + 18}"
					y="${y}"
					font-size="12"
					dominant-baseline="middle"
					fill="${text}">${dataset.label || `Series ${i+1}`}</text>

				<polyline
					fill="none"
					stroke="${color}"
					stroke-width="${dataset.borderWidth || 2}"
					points="${points}"
					
				/>`;
				meta.data.forEach((pt: Data) => {
					svg += `
					<circle
						cx="${pt.x}"
                		cy="${pt.y}"
                		r="${radius}"
                		fill="${color}"
					/>
					`;
			 });

			
		});
		const xTitle = chartInstance.options?.scales?.x?.title;

		if (xTitle?.display && xTitle.text) {
			svg += `
			<text
				x="${(area.left + area.right) / 2}"
				y="${height - 8}"
				font-size="13"
				font-weight="bold"
				text-anchor="middle"
				fill="${text}">${xTitle.text}</text>
			`;
		}

		const yTitle = chartInstance.options?.scales?.y?.title;

		if (yTitle?.display && yTitle.text) {
			svg += `
			<text
				x="16"
				y="${(area.top + area.bottom) / 2}"
				font-size="13"
				font-weight="bold"
				text-anchor="middle"
				fill="${text}"
				transform="rotate(-90 16 ${(area.top + area.bottom) / 2})">
				${yTitle.text}
			</text>
			`;
		}
		 svg += `</svg>`;
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
	let globalXRange: [number, number, number] = [-10,10,0.1];
				const line = (parsedText.globalProperties).find(s => s.expr.includes("xrange"));
				if (line == undefined) return [-10,10,0.1];
		
					const rhs = line.expr.split("=")[1]; 
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
    const notice = new Notice(msg, timeout);

    requestAnimationFrame(() => {
        const el = notice.noticeEl;
        if (el && cls) el.classList.add(cls);
    });
}

export function getDefaultPlotProperties(settings: PlotPluginSettings, chartType: ChartType): ChartOptions<ChartType> {
	return {
		...getBaseDefaults(settings),
		...getTypeDefaults(chartType,settings)
	};
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
					bar: {borderWidth: settings.EborderWidth, borderRadius: 4}
				},
				scales: {
					x: {type: settings.xScalesType},
					y: {type: settings.yScalesType}
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
			title: {display: !settings.titleStatus, font: {family: fontFamily, size: 13, weight: 600}},
			tooltip: {enabled: true, padding: 10, cornerRadius: 8}
		}
	};
}