
import {create , all} from "mathjs";

import type {ChartOptions} from "chart.js/auto";
import { Notice } from "obsidian";
import { e } from "mathjs";

const math = create(all);
math.import({ // Created an alias so the user can write the more "normal" ln(x) and Mathjs wont hate me.
    ln: math.log,
});


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


type parsedText = {
    lineProperties: LineProperties[],
    chartOptions: ChartOptions<"line">,
    globalProperties: string[],
    equations: Equation[]
}

type optionTransform = {

}
const builtInConstants = ["e","E","pi","PI"];
/*
const validPlotProperties = [
    "type",
    "grid",
    "min",
    "max",
    "ticks",
    "display",
    "position",
    "title",
    "subtitle",
    "color",
    "color",
    "xrange",
    "text",
]
*/
const validPlotProperties = [
  "type",
  "min",
  "max",
  "display",
  "position",
  "text",
  "color",
  "stepSize",
  "beginAtZero",
  "suggestedMin",
  "suggestedMax",
  "lineWidth",
  "drawBorder",
  "drawOnChartArea",
  "drawTicks",
  "tickLength",
  "mode",
  "intersect",
  "enabled",
  "borderColor",
  "backgroundColor",
  "borderWidth",
  "pointRadius",
  "tension",
  "fill",
  "hidden"
];



export function handleMarkdown(markdown: string): parsedText {
    const lines = markdown.split("\n");
    const propertyPattern = /^\s*([a-zA-Z]\w*(?:\([a-zA-Z]\w*\))?)\.([a-zA-Z_]\w*)\s*=\s*(.+)\s*$/; // Every property definition follows 
    const equationRegex = /^\s*(?:[a-zA-Z]+\s*\(\s*[a-zA-Z]+\s*\)|[a-zA-Z]+)\s*=\s*.+$/;

    // something.property = value
    let lineProperties = handleLineProperties(lines.filter(s => (!s.includes("obj.") || !s.includes("global.")) && propertyPattern.test(s)),propertyPattern);
    let chartOptions = handlePlotProperties(lines.filter(s => s.startsWith("obj."))); // Plot properties are "obj.property = value"
    let globalOptions = handleGlobalOptions(lines.filter(s => s.includes("global.")));
    let equations = getEquations(handleEquations(lines.filter(s => equationRegex.test(s))));

    const parsedText: parsedText = {
        lineProperties: lineProperties,
        chartOptions: chartOptions,
        globalProperties: globalOptions,
        equations: equations,
    }
    return parsedText;
}

export function handleLineProperties(lines: string[], pattern: RegExp): LineProperties[] { 

    const lineProperties = lines.flatMap(s => {
        const match = s.match(pattern);
        if (!match || match[1] === undefined || match[2] === undefined || match[3] === undefined) return [];
        const signature = match[1];
        const property = match[2];
        const value = match[3];
        return [{signature,property,value}];
    });
    return lineProperties; // Returns an array of type LineProperties that contains all properties 
}

export function handlePlotProperties(lines: string[]) {
    const defaultProperties: ChartOptions<"line"> = {
    scales: {
        x: { type: "linear", 
            title: {
                display: true,
            } },
        y: { type: "linear", 
            title: {
                display: true,
            }
        }
    },
    plugins: {
        title: {
            display: true,
        }
    }
    };

    lines.forEach(prop => {
        const [rawKey,value] = prop.split("=").map(s => s.trim()); // ["obj.scales.x.type","linear"]
        const key = rawKey?.replace("obj.",""); // obj.x.title -> scales.x.title

        if (key !== undefined && value !== undefined) { //Type Narrowing
            if (validPlotProperties.includes(key.split(".").pop() ?? "")) { // validPlotProperties doesnt include x or y or etc just title
                    helperPlotProperties(defaultProperties,key,value);
            }
            else {
                // Throw an error later
            }
        }     
    }
    );
    return defaultProperties;
}

function helperPlotProperties(properties: ChartOptions<"line">, key: string, value: string) {
    const path = key.split("."); // scales.x.title -> [scales, x, title]
    let current: any = properties;
    
    for (let i = 0; i < path.length; i++) {
        const k = path[i];

        if (!k) return;

        if (i === path.length - 1) {
            current[k] = parseValue(value)
        }
        else {
            current[k] ??= {};
            current = current[k];
        }
    }
}

function parseValue(value: string) {
    if (value === "true") return true;
    if (value === "false") return false;
    if (!isNaN(Number(value))) return Number(value);
    return value;
}

export function handleGlobalOptions(lines: string[]) {
    return lines.filter(s => s.includes("global."));
}

export function handleEquations(lines: string[]) { // getEquations is in charge of moving through the array of lines and finding each equation.
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

export function getEquations(exprs: RawExpr[]): Equation[] {
    // Create new array with all objects. Input must be a string array with all right side equations.
    return exprs.map(({signature, expr}) => ({
        expr: expr,
        signature: signature,
        x_limits: [-10,10,0.1],
    }));
    // Returns array containing all equation objects for the codeblock
}

export function evaluateExpressions(equations: Equation[], parsedMd: LineProperties[], xRange: [number,number,number]) {
    const results = [];

    for (let equation of equations) {
        const limits = parsedMd.filter(l => l.signature === equation.signature && l.property === "xrange");
        let localRange: [number, number, number] = xRange;
        if (limits.length && limits[0]?.value){
            localRange = JSON.parse(limits[0].value) // limits[0] is looking something like "[-10,10,0.1]"
        }
        const arr = [];
        // equation is an equation object

        const vars = getVariable(equation).filter((v) => !builtInConstants.includes(v)); // vars can include builtInConstants that need to be filtered out so they arent recognized as the variable.

        const variable =  vars[0] ?? "x"; // !!!!!!!! Check this later 
        const compile = math.compile(equation.expr); // Compile is apparently faster when using loops. It only needs to be generated once.

        //console.log(vars);
        
        for (let val = localRange[0]; val <= localRange[1]; val += localRange[2]) {
            const scope = {[variable]:val}
            const y = compile.evaluate(scope);
            if (!isFinite(y)) continue;

            arr.push({x:val,y});
        }
        results.push({
        signature: equation.signature,
        data: arr
        });
    }
    return results;
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

