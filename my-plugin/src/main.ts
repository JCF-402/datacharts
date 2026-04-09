
import {handleMarkdown,handleGlobalOptions, evaluateExpressions} from "./parser"
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

			const parsedText = handleMarkdown(source);

			// Handling possible global range property
			let globalXRange: [number, number, number] = [-10,10,0.1];
			const line = (parsedText.globalProperties).find(s => s.includes("xrange"));
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

			const data = evaluateExpressions(parsedText,globalXRange);

			console.log(JSON.stringify(parsedText.chartOptions, null, 2));
			console.log(data)

			createPlot(canvas,data,parsedText.lineProperties,parsedText.chartOptions);
			

			function isTuple(arr: number[]): arr is [number, number, number] {
				return arr.length === 3 && arr.every(n => typeof n === "number");
			}
		}
	)}
}


