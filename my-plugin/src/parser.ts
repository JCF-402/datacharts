
import {create , all} from "mathjs";
import type {ChartOptions} from "chart.js/auto";
import { Notice, App, TFile} from "obsidian";
import { e } from "mathjs";
import { boolean } from "mathjs";
import { re } from "mathjs";
import { getApp } from "appContext";
import { exp } from "mathjs";
import { customNotice } from "main";
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
    x: number | string,
    y: number | string
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

export type parsedText = {
    lineProperties: LineProperties[],
    chartOptions: ChartOptions<"line">,
    globalProperties: string[],
    equations: Equation[],
    nestedEquations: NestedEquations[],
    manualData: PlotData[]
    tableData: PlotData[]

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



export async function handleMarkdown(markdown: string): Promise<parsedText> {
    const lines = markdown.split("\n").filter(s => s !== "");
    const propertyPattern = /^\s*(.+?)\.([a-zA-Z_]\w*)\s*=\s*(.+)\s*$/; // Every property definition follows 
    const equationRegex = /^\s*(?:[a-zA-Z]+\s*\(\s*[a-zA-Z]+\s*\)|[a-zA-Z]+)\s*=\s*.+$/;
    const nestedRegex = /^\s*([a-zA-Z]\w*)\s*:\s*(.+?)\s*(?:#.*)?$/;
    const manualDataRegex = /^(\w+)(?:\(([^)]+)\))?\s*::\s*(.+)$/;

    // something.property = value
    const lineProperties = handleLineProperties(lines.filter(s => (!s.includes("obj.") || !s.includes("global.")) && propertyPattern.test(s)),propertyPattern);
    const chartOptions = handlePlotProperties(lines.filter(s => s.startsWith("obj."))); // Plot properties are "obj.property = value"
    const globalOptions = handleGlobalOptions(lines.filter(s => s.includes("global."))); // Global properties are global.
    const equations = getEquations(handleEquations(lines.filter(s => equationRegex.test(s))));
    const nestedEquations = getEquations(handleNestedEquations(lines.filter(s => nestedRegex.test(s))));
    const manualData = getData(handleManualData(lines.filter(s => s.includes("::") || (!s.includes("=") && !propertyPattern.test(s)))));
    const tableData = await handleTableData(lines.filter(s => s.includes("source(") && s.includes("::")));

    const parsedText: parsedText = {
        lineProperties: lineProperties,
        chartOptions: chartOptions,
        globalProperties: globalOptions,
        equations: equations,
        nestedEquations: nestedEquations,
        manualData: manualData,
        tableData: tableData
    }
    return parsedText;
}


function handleManualData(lines: string[]) {
    const datasets: RawExpr[] = [];
    let current: RawExpr | undefined = undefined;

    for (let raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        if (line.includes("::")) {
            const [signature, expr] = line.split("::").map(s => s.trim());

            current = {expr: expr ?? "", signature: signature ?? ""};
            datasets.push(current);
        }
        else if (current) {
            current.expr += line;
        }
    }
    return datasets; 
}

function getData(datasets: RawExpr[]) {
    const results = [];

    const parentObjects = datasets.filter(s => s.signature.startsWith("data")); // Only gets RawExpr objects that have data in the string.
    for (let data of parentObjects) {
        const mDataPoints = [];
        if (data.signature.trim().endsWith(")")) {
            let name = data.signature.replace("data","").replace("(","").replace(")","");
            data.signature = name;
        }
        const vars = getVariable(data); // Gets the variables for the current data object so data(name) = [x,y] gets x and y as variables.
        const objData = [];
        for (let v of datasets) {

            if (vars.includes(v.signature)) {
                if (v.signature.trim() === vars[0]) {
                // v is currently something like x :: [0.3,0.4,0.5] but can also be strings ["Monday","Tuesday"]
                    try {
                        objData.push(JSON.parse(v.expr.trim())); 

                    } catch {
                        const safe = v.expr.replace(/([A-Za-z]+\s*\d+)/g, '"$1"');
                        objData.push(JSON.parse(safe));
                        //new Notice("Mixed number/string axis values is not currently supported",5000);
                    }
                } 
                else if (v.signature.trim() === vars[1]) {
                    try {
                        objData.push(JSON.parse(v.expr.trim())); 

                    } catch {
                        const safe = v.expr.replace(/([A-Za-z]+\s*\d+)/g, '"$1"');
                        objData.push(JSON.parse(safe));
                        //new Notice("Mixed number/string axis values is not currently supported",5000);
                    }
                }
            }
        }
        if (objData[0].length !== objData[1].length) new Notice(`Data arrays for ${data.signature} are not the same length`,5000);

        for (let i = 0; i < objData[0].length; i ++) {
            const x = objData[0][i];
            const y = objData[1][i];
            mDataPoints.push({x: x, y: y});
        }
        results.push({signature: data.signature, data: mDataPoints});
    }
    return results;
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
        legend: {
            display: true,
            position: "right",
            labels: {
                usePointStyle: true,
            }
        },

        title: {
            display: true,
        }
    },
    responsive: true,
    maintainAspectRatio: false,
    animation: false
    };
    lines.forEach(prop => {
        const [rawKey,value] = prop.split("=").map(s => s.trim()); // ["obj.scales.x.type","linear"]
        const key = rawKey?.replace("obj.",""); // obj.x.title -> scales.x.title
        
        if (key !== undefined && value !== undefined) { //Type Narrowing
            const last = key.split(".").pop() ?? ""
            if (validPlotProperties.includes(last)) { // validPlotProperties doesnt include x or y or etc just title
                    helperPlotProperties(defaultProperties,key,value);
            }
            else {
                new Notice(`Oops ${key} is not a valid property.`, 5000);
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


    equationLoop: for (let equation of parsedText.equations) {
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
                const v = compiledNested[name]; // grabs the expression with "name" signature

                if (typeof v === "number") {
                    scope[name] = v; // if the expression is a scalar (constant). Simply assign it to the scope with the signature as its variable. 
                } 
                else if (Array.isArray(v)) { // if the expression is a list of values the current equation needs to be evaluated with the current val
                    // at each value in the array. 
                    // So if f(x) = x^2 * D -> D: [0.3,0.4,0.5]. We get three plots, one for each D value. 
                    // ONLY the equation that contains the nested function needs to be plotted. Other functions work as normal.
                    if (   vars.includes(name)     ) { // Checks if the signature that matches the list is a variable of the current equation.
                        // Essentially evaluateExpressions needs to be called for each one. But evaluateExpressions has too much logic not need at this point.
                        // I also need to stop evaluating this equation entirely. 
                        // Ill call the function that evaluates the expression with a value. That function returns an array with all datasets. Then I push that into the datasets array. Then break to the next equation
                         results.push(...handleNestedArray(equation,variable,localRange,v,name));
                         continue equationLoop;
                    } 
                } 
                else {
                    scope[name] = v.evaluate(scope); // if the expression is neither a scalar nor an array then its an expression. evaluate it with normal the current val
                }
            }

            let y = compile.evaluate(scope);

            const isDiscontinuity = handleDiscontinuities(mDataPoints,localRange,y);

            if (isDiscontinuity) { 
                mDataPoints.push({ x: val, y: NaN });
                continue;
            }
            mDataPoints.push({x:val,y});
        }
        // ------------------------------------------------------------------------------
        results.push({signature: equation.signature, data: mDataPoints});
    }
    return results;
}


export function getVariable(expr: Equation | NestedEquations | RawExpr) {
    // Math parser is used to determine the variable in the expression.
    // For cases where the expression is something like x^2 + G(x) + sin(x)
    if (expr.signature.includes("data")) {
        return expr.expr
            .replace(/[\[\]]/g, "")
            .split(",")
            .map(s => s.trim());
    }

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

function handleNestedArray(eq: Equation,variable: string, localRange: [number, number, number], v: number[], name: string) {
    const expr = math.compile(eq.expr);
    const results: PlotData[] = [];

    for (let i of v) {
        const mDataPoints: Data[] = []
        for (let val = localRange[0]; val <= localRange[1]; val += localRange[2]) {
            const scope = {
                [variable]: val,
                [name]: i
            }
            let y = expr.evaluate(scope);
            const isDiscontinuity = handleDiscontinuities(mDataPoints,localRange,y);
            
            if (isDiscontinuity) { 
                mDataPoints.push({ x: val, y: NaN });
                continue;
            }
            mDataPoints.push({x:val,y});
        }
    results.push({signature: `${name}=${i}`, data: mDataPoints});
    }
    return results;
}

function handleDiscontinuities(mDataPoints: Data[], localRange: [number, number, number], y: number) {
                // ---------------- Discontinuities ---------------------------------------
            const prev = mDataPoints[mDataPoints.length - 1];
            const prevY = prev?.y;

            const currY = y;
            let isDiscontinuity = false;

            if (prevY !== undefined) {
                if (typeof prevY === "string" || typeof currY === "string") {
                    return;
                }
                const delta = Math.abs(currY - prevY); 
                const slope = Math.abs((currY - prevY) / localRange[2]);
                const scale = Math.max(Math.abs(prevY), 1); // avoids near-zero blowup
                const relative = delta / scale;
                if (!Number.isFinite(currY) || relative > 20 || slope > 1e5 ) { // relative and slope limits are manually optimized. Both are need for 
                    // division by 0 discontinuities and equations that grow very quickly like e^x
                    isDiscontinuity = true;
                }
                
            }
            return isDiscontinuity;
}

export async function handleTableData(lines: string[]) {
    const app = getApp();
    const results = [];
	for (let line of lines) {

		let [signature, expr] = line.split("::"); // [source(name), table from "path"]

		if (!signature || !expr) continue;

		const tableTitle =  signature.replace("source","").replace("(","").replace(")","");
    	signature = tableTitle;
		if (expr.includes("table")) {

			const path = expr.replace("table","").replace("from","").trim() + ".md";
            const file = app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {

                const markdown = await app.vault.cachedRead(file);
                results.push(extractTable(markdown, signature));
            }


		}

		

	}
    return results;
}


function extractTable(markdown: string, signature: string) {
    const lines = markdown.split("\n");
    const data: Data[] = [];
    let tableStart = true;
    let currentRow = 1;

    let col1: string | number | undefined = undefined;
    let col2: string | number | undefined = undefined;
    let col1Index: number | undefined = undefined;
    let col2Index: number | undefined = undefined;

    // Right here the signature can still be something like name[column1,column2]
    if (signature.endsWith("]")) {
        const nameAndColumns = signature.split("["); // [name, [column1,column2] ]
        if (nameAndColumns[0] === undefined || nameAndColumns[1] === undefined) {
            signature = "name-error";
            // Throw notice here better. 
        } else {
        signature = nameAndColumns[0]
        const columns = nameAndColumns[1].replace("]","").split(",");
        col1 = isNaN(Number(columns[0])) ? columns[0] : Number(columns[0]);
        col2 = isNaN(Number(columns[1])) ? columns[1] : Number(columns[1]);
        
        }
        
        if (typeof col1 === "number") col1Index = col1;
        if (typeof col2 === "number") col2Index = col2;

    }

    for (let line of lines) {
        if (line.startsWith("|") && line.includes(signature) && tableStart) { // Right table found
            tableStart = false; // Registers start of table only once per search
            continue;
        }
        if (!tableStart) {
            if (!line.trim().startsWith("|")) break;
            currentRow ++;

            if (currentRow === 2) {
                continue; // Lines ------- 
            }
            if (currentRow === 3) {
                // These are headers (names for variables)
                // Check if there any headers.
                const headers = line.split("|").map(s => s.trim()).filter(s => s !== ""); // Split the line by |  and eliminate any whitespaces
                
                if (headers.length === 0) {
                    continue;
                }
                if (col1 !== undefined && typeof col1 === "string") {
                    // Column 1 is a string
                    if (!headers.includes(col1)) {
                        new Notice(`${col1} does not match any ${signature} table header`,5000);
                        continue;
                    }
                    // If it does match a known header. Find the index it matches 
                    col1Index = headers.indexOf(col1);
                }
                if (col2 !== undefined && typeof col2 === "string") {
                    if (!headers.includes(col2)) {
                        customNotice(`${col2} does not match any ${signature} table header`,"notice-warning", 5000);
                        continue;
                    }
                    col2Index = headers.indexOf(col2);
                }

            }
            if (line.startsWith("|") && currentRow > 3) {
                let arr = line.split("|").map(s => s.trim()).filter(s => s !== "");
                if (arr.length < 2) continue;
                if (col1Index === undefined || col2Index === undefined) { // Default to using the first two columns
                    const x = isNaN(Number(arr[0])) ? arr[0] : Number(arr[0]);
                    const y = isNaN(Number(arr[1])) ? arr[1] : Number(arr[1]);
                    data.push({x: x ?? "", y: y ?? ""});
                } else  {
                    const x = arr[col1Index];
                    const y = arr[col2Index];
                    data.push({x: x ?? "", y: y ?? ""});
                }
                
                
                
            }


    }}

    return { signature: signature, data: data };
}


