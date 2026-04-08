
import {evaluateExpressions, splitMarkdown, getEquations, getExprObjects, handleLineProperties, handlePlotProperties,
	handleGlobalProperties,
} from "./parser"
import { createPlot } from "./graphs";
import {Notice, Plugin} from "obsidian";

export default class PlotPlugin extends Plugin {
	async onload() {
		this.registerMarkdownCodeBlockProcessor("plot", 
			(source: string, el: HTMLElement) => {
			
			const canvas = document.createElement("canvas"); 

			canvas.style.width = "100%";
			canvas.style.height = "300px";


			el.appendChild(canvas);

			const codeBlock = splitMarkdown(source); // Splits markdown code block by line

			const allExpr = getEquations(codeBlock); // gets all equations on the codeblock in one array
			const parsedMd = handleLineProperties(codeBlock); // gets all properties defined by user for each equation, if any.
			
			const exprObjects = getExprObjects(allExpr); // gets array with all expression objects

			// Handling possible global range property
			let globalXRange: [number, number, number] = [-10,10,0.1];
			const line = (handleGlobalProperties(codeBlock)).find(s => s.includes("xrange"));
			if (line !== undefined) {
				const rhs = line.split("=")[1];
				if (rhs !== undefined) {
					try {
						const parsed = JSON.parse(rhs.trim());
						if (Array.isArray(parsed) && isTuple(parsed)) {
						globalXRange = parsed;
					}} catch {
					}
				}
			}

			const data = evaluateExpressions(exprObjects,parsedMd,globalXRange);
			const plotProperties = handlePlotProperties(codeBlock)

			console.log(JSON.stringify(plotProperties, null, 2));

			createPlot(canvas,data,parsedMd,plotProperties);
			

			function isTuple(arr: number[]): arr is [number, number, number] {
				return arr.length === 3 && arr.every(n => typeof n === "number");
			}
		}
	)}
}


