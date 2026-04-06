// This file contains the necessary functions to receive, PARSE, and interpret the markdown code blocks.
// This includes intepreting and calculating the functions, limits for plotting, etc. 
import { number } from "mathjs";
import {create , all} from "mathjs";

const math = create(all);
math.import({ // Created an alias so the user can write the more "normal" ln(x) and Mathjs wont hate me.
    ln: math.log,
});

export type LPlot = {
    equation: Equation[],
    x_range?: number[],
    y_range?: number[],
}

export type Equation = {
    expr: string,
    signature: string,
    x_limits: [number, number, number],
    color?: string,
    marker?: string,
}

export type RawExpr = {
    signature: string,
    expr: string,
}
export type PlotData = {
    signature: string,
    data: Data[]
}

export type Data = {
    x: number,
    y: number
}

const builtInConstants = ["e","E","pi","PI"];

export function getExprObjects(exprs: RawExpr[]): Equation[] {
    // Create new array with all objects. Input must be a string array with all right side equations.
    return exprs.map(({signature, expr}) => ({
        expr: expr,
        signature: signature,
        x_limits: [-10,10,0.1],
    }));
    // Returns array containing all equation objects for the codeblock
}

export function splitMarkdown(markdown: string) {
    const lines = markdown.split("\n"); // Splits code block by new lines.
    return lines;
}



export function getVariable(expr: Equation) {
    // Math parser is used to determine the variable in the expression.
    // For cases where the expression is something like x^2 + G(x) + sin(x)
    const node = math.parse(expr.expr);
    const vars = new Set<string>();

    node.traverse(function (node: any, path: string, parent: any){
        if (node.isSymbolNode) {
            if (parent && parent.isFunctionNode && parent.fn === node) { //Filters out functions.
                //console.log(`This cannot be a variable: ${node.name}`);
                return
            }
            //console.log(`This is the node.name: ${node.name}`);
            vars.add(node.name);
        }
    })
    return [...vars];

}

export function getEquations(lines: string[]) {
    const exprs = []
    for (let line of lines) {
        if (line.includes("=")) {
            // Equation found. Add it to array
            const expr = line.split("=");
            if (expr[1] && expr[0]) { // expr[1] is the right hand of the equation and expr[0] is the left hand side or the signature.
                exprs.push({signature: expr[0].trim(), expr:expr[1].trim()}); // Need to handle undefined later
            }
        }
    }

    return exprs; //Array of RawExpr objects
}


export function evaluateExpressions(equations: Equation[]) {
    const results = [];
    
    for (let equation of equations) {
        const arr = [];
        // equation is an equation object
        const x_limits: [number, number, number] = equation.x_limits; // Using tuples. [Min, Max, Step]

        const vars = getVariable(equation).filter((v) => !builtInConstants.includes(v)); // vars can include builtInConstants that need to be filtered out so they arent recognized as the variable.

        const variable =  vars[0] ?? "x"; // !!!!!!!! Check this later 
        const compile = math.compile(equation.expr); // Compile is apparently faster when using loops. It only needs to be generated once.

        //console.log(vars);
        
        for (let val = x_limits[0]; val <= x_limits[1]; val += x_limits[2]) {
            const scope = {[variable]:val}
            const y = compile.evaluate(scope);
            arr.push({x:val,y});
        }
        results.push({
        signature: equation.signature,
        data: arr
        });
    }
    return results;
}