
import {evaluateExpression, splitMarkdown, getEquations} from "./parser"
import { createPlot } from "./graphs";
import {Plugin} from "obsidian";

export default class PlotPlugin extends Plugin {
	async onload() {
		this.registerMarkdownCodeBlockProcessor("plot", 
			(source: string, el: HTMLElement) => {
			
			const canvas = document.createElement("canvas");
			el.appendChild(canvas);

			const text = splitMarkdown(source);
			const allExpr = getEquations(text);
			if (!allExpr[0]) return;

			const expr = allExpr[0];
			const data = evaluateExpression(expr);
			
			createPlot(canvas,data);
			
			/*
			createPlot(canvas,
				[{ x: 0, y: 0 },
        		{ x: 1, y: 1 }]
			)
			*/

		}
	)}
}


