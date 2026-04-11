
import {handleMarkdown,handleGlobalOptions, evaluateExpressions, PlotData, parsedText, handleTableData} from "./parser"
import { createPlot, buildDatasets} from "./graphs";
import {Notice, Plugin, Vault} from "obsidian";
import { apply } from "mathjs";
import { setApp } from "appContext";

export default class PlotPlugin extends Plugin {
	async onload() { // Loads plugin
		setApp(this.app); // Sets current app as the working app to use globally. 
		this.registerMarkdownCodeBlockProcessor("lineplot", 
			async (source: string, el: HTMLElement) => { // Runs whenever a codeblock with the "lineplot" identifier is edited.

			const sourcePaths = getSourcePaths(source); // Gets any source:: item from path PATHS. Stores them for comparisons later.
			let cachedParsedText = await handleMarkdown(source); // Evaluates all the markdown in the codeblock and creates a ParsedText type object.
			let globalXRange = checkGlobalRange(cachedParsedText) // Gets the global range for the current codeblock. This is because the plot might have a global definition of the xrange.
			let cachedEquationData: PlotData[] = evaluateExpressions(cachedParsedText, isTuple(globalXRange) ? globalXRange : [-10,10,0.1]); //Evaluates all expressions, if any, inside the codeblock.
			
			// There are a few reasons for optimization. But it started with wanting the plot to update whenever the source:: object it references (the table) is updated.

			let debounceTimer: number | undefined = undefined; // debounce timer for optimization. Minimizing delay intent.
			let chartInstance: any = undefined; 
			let isUpdating = false;

			const renderPlot = async () => { 
				const parsedText = cachedParsedText; 

					const data: PlotData[] = [
					...cachedEquationData, // equations are only computed once for optimization reasons.
					...parsedText.manualData, // Manual data is updated per codeblock modification but I expect it will be small amounts of data. (Or your crazy tbh)
					...parsedText.tableData // Will always be the latest table data stored in the cache.
					]

					// Detect scale type depending on type of data. For example ChartJs works best as category for an x axis like 
					// x = [January, February, etc]
					if (parsedText.chartOptions.scales !== undefined && parsedText.chartOptions.scales.x !== undefined) {
							parsedText.chartOptions.scales.x.type = declareScalesType(data) ?? "linear";
						}


					console.log(JSON.stringify(parsedText.chartOptions, null, 2));
					//console.log(data);
					console.log(parsedText.tableData);

				if (!chartInstance) { // If the chart doesnt exist yet. Create it
					const canvas = document.createElement("canvas"); 
					canvas.style.width = "100%";
					canvas.style.height = "300px";
					el.appendChild(canvas);
					chartInstance = createPlot(canvas,data,parsedText.lineProperties,parsedText.chartOptions); // Chart is created. 
				} else { // If the chart does exist only update it when a table it references is updated.
					chartInstance.data.datasets = buildDatasets(data,parsedText.lineProperties); 
					chartInstance.update();
				}	
			};

			await renderPlot(); // renderPlot() call

			this.registerEvent( // Register event 
				this.app.vault.on("modify", async (file) => { // where the event is a modification of the file
					if (!sourcePaths.includes(file.path)) return; // Only goes through if the file that is modified belongs to the codeblocks sourcepaths

					if (debounceTimer) clearTimeout(debounceTimer);
					
					debounceTimer = window.setTimeout(async () => { // Give the window a timer before updating
						if (isUpdating) return; 

						isUpdating = true; 
						try {
							// So the file that was modified is part of the source for the current codeblocks data. We need to updated the table data.
							// It hands the new markdown text to handleTableData which parses it for all tables.	
						const updateTableData = await handleTableData(source.split("\n").filter(s => s.includes("source(") && s.includes("::")));

						
						cachedParsedText.tableData = updateTableData; // Updates stored tableData

						await renderPlot(); // Calls renderPlot(). Because the parsedText is always dependant on the cached information, previous data isnt lost.

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


export function customNotice(msg: string, cls = "", timeout = 4000) {
    new Notice(msg, timeout);

    requestAnimationFrame(() => {
        const el = document.querySelector(".notice:last-child");
        if (el && cls) el.classList.add(cls);
    });
}