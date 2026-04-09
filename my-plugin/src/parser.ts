
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
    x_limits?: [number, number, number],
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

export type NestedEquations = {
    expr: string 
    signature: string 
}
type parsedText = {
    lineProperties: LineProperties[],
    chartOptions: ChartOptions<"line">,
    globalProperties: string[],
    equations: Equation[],
    nestedEquations: NestedEquations[];

}


const builtInConstants = ["e","E","pi","PI"];

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
    const nestedRegex = /^\s*([a-zA-Z]\w*)\s*:\s*(.+?)\s*(?:#.*)?$/;

    // something.property = value
    let lineProperties = handleLineProperties(lines.filter(s => (!s.includes("obj.") || !s.includes("global.")) && propertyPattern.test(s)),propertyPattern);
    let chartOptions = handlePlotProperties(lines.filter(s => s.startsWith("obj."))); // Plot properties are "obj.property = value"
    let globalOptions = handleGlobalOptions(lines.filter(s => s.includes("global.")));
    let equations = getEquations(handleEquations(lines.filter(s => equationRegex.test(s))));
    let nestedEquations = getEquations(handleNestedEquations(lines.filter(s => nestedRegex.test(s))));

    const parsedText: parsedText = {
        lineProperties: lineProperties,
        chartOptions: chartOptions,
        globalProperties: globalOptions,
        equations: equations,
        nestedEquations: nestedEquations
    }
    return parsedText;
}

export function handleNestedEquations(lines: string[]) {
    const nestedEquations = []
    for (let line of lines) {
        if (line.includes(":")) {
            // Equation found. Add it to array
            const expr = line.split(":");
            if (expr[1] && expr[0]) { // expr[1] is the right hand of the equation and expr[0] is the left hand side or the signature.
                nestedEquations.push({signature: expr[0].trim(), expr:expr[1].trim()}); 
            }
        }
    }
    return nestedEquations; //Array of RawExpr objects
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

export function getEquations(exprs: RawExpr[]) {
    // Create new array with all objects. Input must be a string array with all right side equations.
    return exprs.map(({signature, expr}) => ({
        expr: expr,
        signature: signature,
    }));
    // Returns array containing all equation objects for the codeblock
}

export function evaluateExpressions(parsedText: parsedText, xRange: [number,number,number]) {
    const results = [];
    const nestInfo = [ // [[expresions],[signatures]]
        parsedText.nestedEquations.map(n => n.expr),
        parsedText.nestedEquations.map(n => n.signature)
    ];


    for (let equation of parsedText.equations) {
        // equation is an equation object


        const mDataPoints = []; // array to be filled with equation data points

        // Get Main Equation Variable --------------------------------------
        const vars = getVariable(equation).filter((v) => !builtInConstants.includes(v)); 
        // vars can include builtInConstants that need to be filtered out so they arent recognized as the variable.
        const newVars = vars.flatMap(v => {
            if (nestInfo[1]?.includes(v)) {
                return [];
            }
            return [v];
        })
        // vars also filters out any variabales that are actually nested function signatures. Think if f(x) = G + x -> filters out G as long as G is declared as G: val


        const variable =  newVars[0] ?? "x"; // !!!!!!!! Check this later 

        // -----------------------------------------------------------------

        // --------- Handle Nested Equations ------------------
        const compiledNested: Record<string,any> = {};
        const nestedVars: Record<string,string> = {};

        for (let obj of parsedText.nestedEquations) {
            const expr = obj.expr.trim();

            if (isNumberString(expr)) {
                compiledNested[obj.signature] = Number(expr);
            } 
            else if (expr.startsWith("[") && expr.endsWith("]")) {
                compiledNested[obj.signature] = JSON.parse(expr);
            } 
            else {
                compiledNested[obj.signature] = math.compile(expr);
            }
        }
        
        //--------------------------------------------------------

        // -------------- This block sets local range ----------------------------------
        const limits = parsedText.lineProperties.filter(l => l.signature === equation.signature && l.property === "xrange");
        let localRange: [number, number, number] = xRange;
        if (limits.length && limits[0]?.value){
            localRange = JSON.parse(limits[0].value) // limits[0] is looking something like "[-10,10,0.1]"
        }
        // ------------------------------------------------------------------------------

        
        const compile = math.compile(equation.expr); // Compile is apparently faster when using loops. It only needs to be generated once.

        
        for (let val = localRange[0]; val <= localRange[1]; val += localRange[2]) {
            const scope: any = { [variable]: val };

            for (let name in compiledNested) {
                const v = compiledNested[name];

                if (typeof v === "number") {
                    scope[name] = v;
                } 
                else if (Array.isArray(v)) {
                    continue; // handle separately later
                } 
                else {
                    scope[name] = v.evaluate(scope); // uses current x
                }
            }

            let y = compile.evaluate(scope);

            // ---------------- Discontinuities ---------------------------------------
            const prev = mDataPoints[mDataPoints.length - 1];
            const prevY = prev?.y;

            const currY = y;
            let isDiscontinuity = false;

            if (prevY !== undefined) {
                const delta = Math.abs(currY - prevY); 
                const slope = Math.abs((currY - prevY) / localRange[2]);
                const scale = Math.max(Math.abs(prevY), 1); // avoids near-zero blowup
                const relative = delta / scale;
                if (!Number.isFinite(currY) || relative > 20 || slope > 1e5 ) { // relative and slope limits are manually optimized. Both are need for 
                    // division by 0 discontinuities and equations that grow very quickly like e^x
                    isDiscontinuity = true;
                }
            }

            if (isDiscontinuity) {
                mDataPoints.push({ x: val, y: NaN });
                continue;
            }
            mDataPoints.push({x:val,y});
        }
        // ------------------------------------------------------------------------------



        results.push({
        signature: equation.signature,
        data: mDataPoints
        });
    }
    return results;
}


export function getVariable(expr: Equation | NestedEquations) {
    // Math parser is used to determine the variable in the expression.
    // For cases where the expression is something like x^2 + G(x) + sin(x)
    const node = math.parse(expr.expr);
    const vars = new Set<string>();

    node.traverse(function (node: any, path: string, parent: any){
        if (node.isSymbolNode) {
            if (parent && parent.isFunctionNode && parent.fn === node) { //Filters out functions.
                return
            }

            //console.log(`This is the node.name: ${node.name}`);
            vars.add(node.name);
        }
    })
    return [...vars];

}

function isNumberString(val: string): boolean {
  return val.trim() !== "" && !isNaN(Number(val));
}

function parseExpr(expr: string) {
  const val = expr.trim();

  // number
  if (val !== "" && !isNaN(Number(val))) {
    return Number(val);
  }

  // array like [0.3,0.4]
  if (val.startsWith("[") && val.endsWith("]")) {
    return JSON.parse(val) as number[];
  }

  // otherwise math expression
  return math.compile(val);
}