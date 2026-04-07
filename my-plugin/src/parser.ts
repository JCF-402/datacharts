// This file contains the necessary functions to receive, PARSE, and interpret the markdown code blocks.
// This includes intepreting and calculating the functions, limits for plotting, etc. 
import { number } from "mathjs";
import { kldivergence } from "mathjs";
import { string } from "mathjs";
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
    borderColor?: string,
    pointStyle?: string,
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

export type LineProperties = {
    signature: string,
    property: string,
    value: string
}



const builtInConstants = ["e","E","pi","PI"];


export function splitMarkdown(markdown: string) {
    const lines = markdown.split("\n"); // Splits code block by new lines.
    return lines;
}

export function handleLineProperties(markdown: string[]): LineProperties[] { 
   //const regex = /^\s*([a-zA-Z]\w*\([a-zA-Z]\w*\))\.([a-zA-Z_]\w*)\s*=\s*(.+)\s*$/; // Property line pattern
   //const alternateRegex = /^\s*[a-zA-Z]\.[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*".*"/;
   const combinedRegex = /^\s*([a-zA-Z]\w*(?:\([a-zA-Z]\w*\))?)\.([a-zA-Z_]\w*)\s*=\s*(.+)\s*$/;
   const parsed = markdown.flatMap(s => {
    const match = s.match(combinedRegex);
    if (!match || match[1] === undefined || match[2] === undefined || match[3] === undefined) return [];

    const signature = match[1];
    const property = match[2];
    const value = match[3];
    //console.log(`${property} = ${value}`);
    return [{signature,property,value}];


    });
    return parsed; // Returns an array of type LineProperties that contains all properties 
}

export function getExprObjects(exprs: RawExpr[]): Equation[] {
    // Create new array with all objects. Input must be a string array with all right side equations.
    return exprs.map(({signature, expr}) => ({
        expr: expr,
        signature: signature,
        x_limits: [-10,10,0.1],
    }));
    // Returns array containing all equation objects for the codeblock
}

export function getEquations(lines: string[]) { // getEquations is in charge of moving through the array of lines and finding each equation.
    const exprs = []
    const equationRegex = /^\s*(?:[a-zA-Z]+\s*\(\s*[a-zA-Z]+\s*\)|[a-zA-Z]+)\s*=\s*.+$/;


    for (let line of lines) {
        if (!equationRegex.test(line)) continue;

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



export function evaluateExpressions(equations: Equation[], parsedMd: LineProperties[]) {
    const results = [];
    let xRange: [number, number, number] = [-100,100,1];

    for (let equation of equations) {
        const limits = parsedMd.filter(l => l.signature === equation.signature && l.property === "xrange");

        if (limits.length !== 0 && limits !== undefined && limits[0]?.value ) {
            xRange = JSON.parse(limits[0].value) // limits[0] is looking something like "[-10,10,0.1]"
        }
        const arr = [];
        // equation is an equation object

        const vars = getVariable(equation).filter((v) => !builtInConstants.includes(v)); // vars can include builtInConstants that need to be filtered out so they arent recognized as the variable.

        const variable =  vars[0] ?? "x"; // !!!!!!!! Check this later 
        const compile = math.compile(equation.expr); // Compile is apparently faster when using loops. It only needs to be generated once.

        //console.log(vars);
        
        for (let val = xRange[0]; val <= xRange[1]; val += xRange[2]) {
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