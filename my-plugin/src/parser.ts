// This file contains the necessary functions to receive, PARSE, and interpret the markdown code blocks.
// This includes intepreting and calculating the functions, limits for plotting, etc. 
import {evaluate} from "mathjs";


export function splitMarkdown(markdown: string) {
    const lines = markdown.split("\n"); // Splits code block by new lines.
    return lines;
}

export type Plot = {
    equation: string | string[],
    x_limits: number[],
    y_limits: number[],
    color: string,
}

export function getEquations(lines: string[]): string[] {
    const equations = []
    for (let line of lines) {
        if (line.includes("=")) {
            // Equation found. Add it to array
            const expr = line.split("=");
            if (expr[1]) {
                equations.push(expr[1]); // Need to handle undefined later
            }
        }
    }

    return equations;
}

export function evaluateExpression(equation: string) {
    const x_limits: [number, number, number] = [0,100,1]; // Using tuples.
    const results = [];

    for (let x = x_limits[0]; x <= x_limits[1]; x += x_limits[2]) {
        const y = evaluate(equation,{x});
        results.push({x,y});
    }
    return results;
}