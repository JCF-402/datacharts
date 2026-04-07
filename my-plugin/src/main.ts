
import {evaluateExpressions, splitMarkdown, getEquations, getExprObjects, handleLineProperties} from "./parser"
import { createPlot } from "./graphs";
import {Plugin} from "obsidian";

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

			const data = evaluateExpressions(exprObjects);
			
			
			createPlot(canvas,data,parsedMd);
			
			/*
			createPlot(canvas,
				[{ x: 0, y: 0 },
        		{ x: 1, y: 1 }]
			)
			*/

		}
	)}
}


