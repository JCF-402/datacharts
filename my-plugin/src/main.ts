
import {handleMarkdown,handleGlobalOptions, evaluateExpressions, PlotData, parsedText, handleTableData} from "./parser"
import { createPlot, buildDatasets} from "./graphs";
import {Notice, Plugin, Vault} from "obsidian";
import { apply } from "mathjs";
import { setApp } from "appContext";

export default class PlotPlugin extends Plugin {
	async onload() {
		setApp(this.app);
		this.registerMarkdownCodeBlockProcessor("lineplot", 
			async (source: string, el: HTMLElement) => {

			const sourcePaths = getSourcePaths(source);
			let cachedParsedText = await handleMarkdown(source);
			let globalXRange = checkGlobalRange(cachedParsedText)
			let cachedEquationData: PlotData[] = evaluateExpressions(cachedParsedText, isTuple(globalXRange) ? globalXRange : [-10,10,0.1]);
			let debounceTimer: number | undefined = undefined;
			let chartInstance: any = undefined;
			let isUpdating = false;

			const renderPlot = async () => {
				const parsedText = cachedParsedText;

					const data: PlotData[] = [
					...cachedEquationData,
					...parsedText.manualData,
					...parsedText.tableData
					]

					// Detect scale type depending on type of data
					if (parsedText.chartOptions.scales !== undefined && parsedText.chartOptions.scales.x !== undefined) {
							parsedText.chartOptions.scales.x.type = declareScalesType(data) ?? "linear";
						}


					//console.log(JSON.stringify(parsedText.chartOptions, null, 2));
					//console.log(data);
					//console.log(parsedText.tableData);

				if (!chartInstance) {
					const canvas = document.createElement("canvas"); 
					canvas.style.width = "100%";
					canvas.style.height = "300px";
					el.appendChild(canvas);
					chartInstance = createPlot(canvas,data,parsedText.lineProperties,parsedText.chartOptions);
				} else {
					chartInstance.data.datasets = buildDatasets(data,parsedText.lineProperties);
					chartInstance.update();
				}	
			};

			await renderPlot();

			this.registerEvent(
				this.app.vault.on("modify",async (file) => {
					if (!sourcePaths.includes(file.path)) return;

					if (debounceTimer) clearTimeout(debounceTimer);
					
					debounceTimer = window.setTimeout(async () => {
						if (isUpdating) return;
						isUpdating = true;
						try {
						const updateTableData = await handleTableData(source.split("\n").filter(s => s.includes("source(") && s.includes("::")));

						
						cachedParsedText.tableData = updateTableData;

						await renderPlot();
						} finally {
							isUpdating = false;
						}
					}, 400);
					

				})
			);
		}
	);

		this.registerMarkdownCodeBlockProcessor("plot-data", (source: string, el: HTMLElement) => {
			// This is for some other time
			const canvas = document.createElement("canvas"); 

			canvas.style.width = "100%";
			canvas.style.height = "300px";

			el.appendChild(canvas);


			return;
		})
	}
	
}




function isTuple(arr: number[]): arr is [number, number, number] {
	return arr.length === 3 && arr.every(n => typeof n === "number");
}

function declareScalesType(data: PlotData[]) {
	const sample = data[0]?.data[0]?.x;

	if (typeof sample === "number") return "linear";

    if (typeof sample === "string") return "category";

    return "linear";
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
						const parsed = JSON.parse(rhs.trim());
						if (Array.isArray(parsed) && isTuple(parsed)) {
							globalXRange = parsed;
							return globalXRange;
						}
						return [-10,10,0.1];
					} catch {
							return [-10,10,0.1];
							}

				
}