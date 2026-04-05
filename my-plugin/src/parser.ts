// This file contains the necessary functions to receive, PARSE, and interpret the markdown code blocks.
// This includes intepreting and calculating the functions, limits for plotting, etc. 
import {create , all} from "mathjs";

const math = create(all);
math.import({ // Created an alias so the user can write the more "normal" ln(x) and Mathjs wont hate me.
    ln: math.log,
});


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



export function getVariable(expr: string) {
    // Math parser is used to determine the variable in the expression.
    // For cases where the expression is something like x^2 + G(x) + sin(x)
    const node = math.parse(expr);
    const vars = new Set<string>();

    node.traverse(function (node: any, path: string, parent: any){
        if (node.isSymbolNode) {
            if (parent && parent.isFunctionNode && parent.fn === node) { //Filters out functions.
                return
            }
            vars.add(node.name);
        }
    })
    return [...vars];

}

export function getEquations(lines: string[]): string[] {
    const equations = []
    for (let line of lines) {
        if (line.includes("=")) {
            // Equation found. Add it to array
            const expr = line.split("=");
            if (expr[1]) {
                equations.push(expr[1].trim()); // Need to handle undefined later
            }
        }
    }

    return equations;
}


export function evaluateExpression(equation: string) {
    const x_limits: [number, number, number] = [0,100,0.001]; // Using tuples. [Min, Max, Step]
    const results = [];

    const vars = getVariable(equation);
    const variable =  vars[0] ?? "x";
    const compile = math.compile(equation); // Compile is apparently faster when using loops. It only needs to be generated once.


    for (let val = x_limits[0]; val <= x_limits[1]; val += x_limits[2]) {
        const scope = {[variable]:val}
        const y = compile.evaluate(scope);
        results.push({x:val,y});
    }
    return results;
}