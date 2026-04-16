
import {create , all} from "mathjs";

import type {ChartOptions, ChartConfiguration, ChartType} from "chart.js/auto";
import { Notice, App, TFile} from "obsidian";

import { getApp } from "./appContext";

import { customNotice,isTuple } from "main";
import { validLineDatasetProperties,validBarDatasetProperties } from "./plotProperties";
import { min } from "mathjs";
import { string } from "mathjs";
import { isArray } from "chart.js/dist/helpers/helpers.core";
import {validObjProperties,validRoots} from "./plotProperties"
import { sign } from "mathjs";

const math = create(all);
math.import({ // Created an alias so the user can write the more "normal" ln(x) and Mathjs wont hate me.
    ln: math.log,
});

type CompiledExpression = any; // Not good I know

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

export type GlobalProperties = {
    expr: string,
    signature: string;
}

export type parsedText = {
    lineProperties: LineProperties[],
    chartOptions: ChartConfiguration["options"],
    globalProperties: GlobalProperties[],
    equations: Equation[],
    nestedEquations: NestedEquations[],
    manualData: PlotData[]
    tableData: PlotData[]

}


const builtInConstants = ["e","E","pi","PI"];

export const propertyPattern = /^\s*(.+?)\.([a-zA-Z_]\w*)\s*=\s*(.+)\s*$/; // Every property definition follows 
const equationRegex = /^\s*(?:[a-zA-Z]+\s*\(\s*[a-zA-Z]+\s*\)|[a-zA-Z]+)\s*=\s*.+$/;
const nestedRegex = /^\s*([a-zA-Z]\w*)\s*:\s*(.+?)\s*(?:#.*)?$/;




export async function handleMarkdown(markdown: string[], defaultProperties: ChartConfiguration["options"], chartType: ChartType): Promise<parsedText> {
    const lines = markdown.filter(s => s !== "");

    switch (chartType) {
        case "line":
        case "scatter": {
            const lineProperties = handleLineProperties(lines.filter(s => (!s.includes("obj.") || !s.includes("global.")) && propertyPattern.test(s)),propertyPattern);
            const chartOptions = handlePlotProperties(lines.filter(s => s.startsWith("obj.")), defaultProperties); // Plot properties are "obj.property = value"
            const globalOptions = handleGlobalOptions(lines.filter(s => s.startsWith("global."))); // Global properties are global.
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
        case "bar":
        case "pie":
        case "doughnut":
        case "polarArea":
        case "radar": {
           return {
             lineProperties: handleLineProperties(lines.filter(s => (!s.includes("obj.") || !s.includes("global.")) && propertyPattern.test(s)),propertyPattern),
             chartOptions: handlePlotProperties(lines.filter(s => s.startsWith("obj.")), defaultProperties),
             globalProperties: handleGlobalOptions(lines.filter(s => s.includes("global."))),
             equations: [],
             nestedEquations: [],
             manualData: getData(handleManualData(lines.filter(s => s.includes("::") || (!s.includes("=") && !propertyPattern.test(s))))),
             tableData: await handleTableData(lines.filter(s => s.includes("source(") && s.includes("::"))),
           }

        }
        default:
            return {
                lineProperties: [],
                chartOptions: {},
                globalProperties: [],
                equations: [],
                nestedEquations: [],
                manualData: [],
                tableData: [],
            };
    }
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
        const mDataPoints: Data[] = [];
        if (data.signature.trim().endsWith(")")) {
            let name = data.signature.replace("data","").replace("(","").replace(")","");
            data.signature = name;
        }
        const vars = getVariable(data); // Gets the variables for the current data object so data(name) = [x,y] gets x and y as variables.
        const objData: (string[] | number[])[] = []; // Stores data about the current data:: object
        for (let v of datasets) {

            if (vars.includes(v.signature)) {
                if (v.signature.trim() === vars[0]) {
                // v is currently something like x :: [0.3,0.4,0.5] but can also be strings ["Monday","Tuesday"]
                        try {
                            objData.push(JSON.parse(v.expr.trim())); // Gives me an any but JSON just works well for numbers
                        } catch {
                            const safe = (v.expr.replace("[","").replace("]","").split(",").map((s: string) => s.trim()));
                            objData.push(safe);

                        }
                } 
                else if (v.signature.trim() === vars[1]) {
                        try {
                          objData.push(JSON.parse(v.expr.trim()));
                        } catch {
                            const safe = (v.expr.replace("[","").replace("]","").split(",").map((s: string) => s.trim()));
                            objData.push(safe)

                        }
                }
            }
        }

        // ObjData contains the x and y values that belong to the current data:: object. Where the current data:: [x,y]
        // If the expressions for x or y couldnt resolver or where never given it would be an error. I wont stop parsing so
        if (objData[0] === undefined || objData[1] === undefined) {
            customNotice(`Error: could not resolve data for ${data.signature}. Check inputs.`,"notic-error",5000);
            continue;
        }
        if (objData[0].length !== objData[1].length) customNotice(`Data arrays for ${data.signature} are not the same length`,"notice-error",5000);

        for (let i = 0; i < objData[0].length; i ++) {
            const x = objData[0][i]; // Can be undefined because I didnt check for obj[0][i] specifically. 
            const y = objData[1][i];
            if (x === undefined || y === undefined) continue; // Shouldnt happen. Fingers crossed moment? 

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
        // Check if property is valid before matching

        const property = match[2];
        const value = match[3];
        return [{signature,property,value}];
    });
    return lineProperties; // Returns an array of type LineProperties that contains all properties 
}

export function handlePlotProperties(lines: string[], defaultProperties: ChartConfiguration["options"]) {
    const properties: ChartConfiguration["options"] = defaultProperties;
    lines.forEach(prop => {
        const [rawKey,value] = prop.split("=").map(s => s.trim()); // ["obj.scales.x.type","linear"]
        const key = rawKey?.replace("obj.",""); // obj.x.title -> scales.x.title
        
        if (key !== undefined && value !== undefined) { //Type Narrowing
            const last = key.split(".").pop() ?? ""
            if (validObjProperties.includes(last)) { // validPlotProperties doesnt include x or y or etc just title
                    helperPlotProperties(properties,key,value);
            }
            else {
                // Evaluate using fuzzy matching later
                findPossibleProperty(key,validObjProperties,"PlotProperties",validRoots);
                // Throw an error later
            }
        }     
    }
    );
    return properties;
}

function helperPlotProperties(properties: ChartConfiguration["options"], key: string, value: string) {
    const path = key.split("."); // scales.x.title -> [scales, x, title]
    let current: any = properties; // running copy of the properties. Any is needed because I am dynamically accessing a chartoptions
    // object that requires static keys. I am already checking if the properties are valid in handlePlotProperties
    // typescript doesnt know this because I am checking against a personal list. 
    for (let i = 0; i < path.length; i++) {
        const k = path[i];

        if (k === undefined) return;

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

export function handleGlobalOptions(lines: string[]): GlobalProperties[] {
    const globalProperties: GlobalProperties[] = lines.map(s => {
        let arr = s.replace(" ","").split("="); // [global.property, value]
        const expr = arr[1];
        const signature = arr[0]?.split(".")[1];
        if (expr === undefined || signature === undefined) return {expr: "", signature: ""};
        return {expr:expr,signature: signature };
    })
    return globalProperties;
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

        const variable =  newVars[0]
        const isConstant = (variable === undefined);

        // -----------------------------------------------------------------

        // --------- Handle Nested Equations ------------------
        const compiledNested: Record<string, string | number | CompiledExpression> = {}; // CompiledExpressions is any but it helps visualize
        // the kind of values I expect to receive.

        for (let obj of parsedText.nestedEquations) {
            const expr = obj.expr.trim();

            if (isNumberString(expr)) {
                compiledNested[obj.signature] = Number(expr); // if the expr is a scalar
            } 
            else if (expr.startsWith("[") && expr.endsWith("]")) {
                const parsed = expr.replace("[","").replace("]","").split(",").map(s => Number(s));
                compiledNested[obj.signature] = parsed // expr is an array
            } 
            else {
                compiledNested[obj.signature] = (expr); // expr is supposed to be a valid equation.
            }
        }
        
        //--------------------------------------------------------

        // -------------- This block sets local range ----------------------------------
        const limits = parsedText.lineProperties.filter(l => l.signature === equation.signature && l.property === "xrange");
        let localRange: [number, number, number] = xRange;
        if (limits.length && limits[0]?.value){
            const parsed = limits[0].value.replace("[","").replace("]","").split(",").map(s => Number(s));
            //localRange = JSON.parse(limits[0].value) // limits[0] is looking something like "[-10,10,0.1]"
            if (!isTuple(parsed)) localRange = [-10,10,0.1];
            else { localRange = parsed}
           
        }
        // ------------------------------------------------------------------------------

        
        const compile = math.compile(equation.expr); // Compile is apparently faster when using loops. It only needs to be generated once.

        
        for (let val = localRange[0]; val <= localRange[1]; val += localRange[2]) {
            const scope: Record<string, string | number> = { };
            if (!isConstant) {
                scope[variable] = val;
            }
            for (let signature in compiledNested) {
                const nestedExpr = compiledNested[signature]; // grabs the expression with "name" signature

                if (nestedExpr === undefined) continue;

                if (typeof nestedExpr === "number") {
                    scope[signature] = nestedExpr; // if the expression is a scalar (constant). Simply assign it to the scope with the signature as its variable. 
                } 
                else if (Array.isArray(nestedExpr)) { // if the expression is a list of values the current equation needs to be evaluated with the current val
                    // at each value in the array. 
                    // So if f(x) = x^2 * D -> D: [0.3,0.4,0.5]. We get three plots, one for each D value. 
                    // ONLY the equation that contains the nested function needs to be plotted. Other functions work as normal.

                    if (   vars.includes(signature)     ) { // Checks if the signature that matches the list is a variable of the current equation.

                        // Essentially evaluateExpressions needs to be called for each one. But evaluateExpressions has too much logic not need at this point.
                        // I also need to stop evaluating this equation entirely. 
                        // Ill call the function that evaluates the expression with a value. That function returns an array with all datasets. Then I push that into the datasets array. 
                        // Then continue to the next equation
                        if (variable === undefined) continue equationLoop;

                         results.push(...handleNestedArray(equation.expr,variable,localRange,nestedExpr,signature,scope));
                         continue equationLoop;
                    } 
                } 
                else {
                    const xranges = parsedText.lineProperties.map(prop => `${prop.signature}.${prop.property}=${prop.value}`).filter(s => s.includes("xrange"));
                    const indexRange = xranges.findIndex(s => s.startsWith(`${signature}.xrange=`));
                    if (indexRange !== -1){
                        // As of version 1.0.3 I want to support independant variables inside the nested equation. 
                        // Re = DV/v
                        // D: 0.3
                        // v: 2T + 10
                        // v.xrange = [100,300,50] Which creates a reynolds plot for each viscosity. Where Velocity is the main variable
                        if (!xranges[indexRange]) continue equationLoop;
                        const nestedLocalRangeString = xranges[indexRange].split("=")[1];
                        if (!nestedLocalRangeString) continue equationLoop;
                        let nestedLocalRange: [number,number,number] = JSON.parse(nestedLocalRangeString);
                        if (variable === undefined) continue equationLoop;
                        results.push(...handleNestedIndependant(equation,variable,localRange,nestedLocalRange,nestedExpr,signature, nestInfo,scope));
                        continue equationLoop;


                    } else {
                    const compiledNestedExpr = math.compile(nestedExpr);
                    scope[signature] = compiledNestedExpr.evaluate(scope); // if the expression is neither a scalar nor an array then its an expression. evaluate it with normal the current val
                    }
                }
            }

            let y: number = compile.evaluate(scope);

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
        return expr.expr.replace("[", "").replace("]","").split(",").map(s => s.trim());
    }

    const node = math.parse(expr.expr);
    const vars = new Set<string>();

    node.traverse(function (node: any, path: string, parent: any){
        if (node.isSymbolNode) {
            if (parent && parent.isFunctionNode && parent.fn === node) { //Filters out functions.
                return;
            }
            vars.add(node.name);
        }
    })
    return [...vars];

}


function isNumberString(val: string): boolean {
  return val.trim() !== "" && !isNaN(Number(val));
}

function handleNestedArray(mainExpr: string ,variable: string, localRange: [number, number, number], v: number[], name: string, baseScope: Record<string, string | number>, legendName?: string): PlotData[] {
    const expr = math.compile(mainExpr);
    const results: PlotData[] = [];

    for (let i of v) {
        const mDataPoints: Data[] = []
        for (let val = localRange[0]; val <= localRange[1]; val += localRange[2]) {
            const scope = {
                ...baseScope,
                [variable]: val,
                [name]: i
            }
            let y = expr.evaluate(scope);
            const isDiscontinuity = handleDiscontinuities(mDataPoints,localRange,y);
            if (isDiscontinuity === undefined) continue; 
            if (isDiscontinuity) { 
                mDataPoints.push({ x: val, y: NaN });
                continue;
            }
            mDataPoints.push({x:val,y});
        }
    if (!legendName) results.push({signature: `${name}=${i}`, data: mDataPoints});
    else results.push({signature: `${legendName}=${i}`, data: mDataPoints});
    
    }
    return results;
}

function handleNestedIndependant(eq: Equation, variable: string, localRange: [number,number,number], 
    nestedLocalRange: [number,number,number], nestedExpr: any, signature: string, nestInfo: string[][], baseScope: Record<string, string | number>): PlotData[]{
    
    const nestedResults: number[] = [];
    // Get Main Equation Variable --------------------------------------
    const nestedEquationObject: Equation = {
        expr: nestedExpr,
        signature:signature
    };
    const vars = getVariable(nestedEquationObject).filter((v) => !builtInConstants.includes(v)); 
    // vars can include builtInConstants that need to be filtered out so they arent recognized as the variable.
    const newVars = vars.flatMap(v => {
        if (nestInfo[1]?.includes(v)) {
            return [];
        }
        return [v];
        })
        // vars also filters out any variabales that are actually nested function signatures. Think if f(x) = G + x -> filters out G as long as G is declared as G: val
        const nestedVariable =  newVars[0];
        if (!nestedVariable) return [];
    const nestedEquation = math.compile(nestedExpr);
    for (let i = nestedLocalRange[0]; i <= nestedLocalRange[1]; i += nestedLocalRange[2]){
        const nestedScope: Record<string, number | string> = {
            ...baseScope,
        };
        nestedScope[nestedVariable] = i;
        let nestedY = nestedEquation.evaluate(nestedScope);
        nestedResults.push(nestedY);
    };
    return handleNestedArray(eq.expr, variable, localRange, nestedResults, signature, baseScope, nestedVariable);

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
        // Syntax is source(dataLabel) :: tableSelector[col1,col2] is table from path
		let [signature, expr] = line.split("::"); // [source(name), tableSelector[] is table from "path"]

		if (!signature || !expr) continue;
        if (!line.includes("is")) {
            customNotice(`Missing syntax key: is on source`,"notice-error",5000);
            continue;
        }
        if (!line.includes("from")) {
            customNotice(`Missing syntax key: from on source`,"notice-error",5000);
        }

        const info = expr.split(/ is | from /); // [tableSelector, table, path]
		const name =  signature.replace("source","").replace("(","").replace(")","").trim();
    	signature = name;
        if (!info[0]) {
            customNotice(`Cannot find TableName for ${signature}`,'notice-error',5000);
            continue;
        }
        const sourceInfo = info[0];
		if (info[1] === "table") {

			const path = info[2]?.trim() + ".md";
            const file = app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {

                const markdown = await app.vault.cachedRead(file);
                results.push(extractTable(markdown, signature, sourceInfo));
            }


        }	

	}
    return results;
}


function extractTable(markdown: string, signature: string, sourceInfo: string) {
    const lines = markdown.split("\n");
    const data: Data[] = [];
    let tableStart = true;
    let currentRow = 1;

    let col1: string | number | undefined = undefined;
    let col2: string | number | undefined = undefined;
    let col1Index: number | undefined = undefined;
    let col2Index: number | undefined = undefined;
    let tableTitle = sourceInfo;
    // Right here the signature can still be something like name[column1,column2]
    if (sourceInfo.endsWith("]")) {
        const nameAndColumns = sourceInfo.split("["); // [name, [column1,column2] ]
        if (nameAndColumns[0] === undefined || nameAndColumns[1] === undefined) {
            customNotice(`${signature} column names aren't defined`, "notice-warning",5000);
        } else {
        tableTitle = nameAndColumns[0]
        const columns = nameAndColumns[1].replace("]","").split(",");
        col1 = isNaN(Number(columns[0])) ? columns[0] : Number(columns[0]);
        col2 = isNaN(Number(columns[1])) ? columns[1] : Number(columns[1]);
        
        }
        
        if (typeof col1 === "number") col1Index = col1;
        if (typeof col2 === "number") col2Index = col2;



    }
     let warnedCol1 = false;
    let warnedCol2 = false;

    for (let line of lines) {
        if (line.startsWith("|") && line.includes(tableTitle) && tableStart) { // Right table found
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
                        customNotice(`${col1} does not match any ${tableTitle} table header`,"notice-warning",5000);
                        continue;
                    }
                    // If it does match a known header. Find the index it matches 
                    col1Index = headers.indexOf(col1);
                }
                if (col2 !== undefined && typeof col2 === "string") {
                    if (!headers.includes(col2)) {
                        customNotice(`${col2} does not match any ${tableTitle} table header`,"notice-warning", 5000);
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
                    if (col1Index > arr.length -1) {
                        if (!warnedCol1) {
                        customNotice(`${col1Index} exceeds table size`,"notice-error",5000);
                        warnedCol1 = true;
                        }
                        continue;
                    }
                    if (col2Index > arr.length - 1) {
                        if (!warnedCol2) {
                        customNotice(`${col2Index} exceeds table size`,"notice-error",5000);
                        warnedCol2 = true;
                        }
                        continue;
                    }
                    const x = arr[col1Index];
                    const y = arr[col2Index];
                    data.push({x: x ?? "", y: y ?? ""});
                }
                
                
                
            }


    }}

    return { signature: signature, data: data };
}

export function findPossibleProperty(key: string, validProps: string[], flag: string, validRoots?: string[], ) {

    switch (flag) {
        case "LineProperty": {
                let bestMatch = "";
                let bestDist = Infinity;
            for (let prop of validProps) {
                const dist = levD(key, prop);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestMatch = prop;
                }
            }
                if (bestDist <= 9) {
                    customNotice(`${key} is not a valid line property. Did you mean ${bestMatch}?`, "notice-info",5000);
                    return;
                } else if (bestDist > 9) {
                    customNotice(`${key} not recognized.`, "notice-warning",5000);
                    return
                }

            break;
        }
        case "PlotProperty": {
               let bestMatch = "";
                let bestDist = Infinity;
            const keyPath = key.split("."); 
            if (keyPath[0] === undefined) return;
            if (validRoots === undefined) return;
            if (!validRoots.includes(keyPath[0])) {
                for (let root of validRoots){
                    const dist = levD(keyPath[0],root);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestMatch = root;
                    }

                }
                if (bestDist <= 9) {
                    customNotice(`${keyPath[0]} is not a valid chart options root. Did you mean ${bestMatch}?`,"notice-info",5000);
                    return;
                }
                else if (bestDist > 9) {
                    customNotice(`${keyPath[0]} is not a recognized chart root.`,"notice-error",5000);
                    return;
                }
            }

            for (let p = 1; p < keyPath.length; p++) {
                const k = keyPath[p];
                if (k === undefined) continue;

                if (!validProps.includes(k)) {
                    for (let prop of validProps) {
                        const dist = levD(k,prop);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestMatch = prop;
                        }
                    }
                    if (bestDist <= 9) {
                         customNotice(`${k} is not a valid chart option. Did you mean ${bestMatch}?`,"notice-info",5000);
                         return;
                    }
                    customNotice(`${k} is not a recognized chart option.`,"notice-error",5000);
                    return;

                }
            }
            break;
        }


            
    }
}

function levD(a: string, b: string ): number {

    const rows = a.length + 1;
    const cols = b.length + 1;

    const dist: number[][] = Array.from({length: rows}, () => Array(cols).fill(0));

    for (let i = 1; i < rows; i++) {

        dist[i]![0] = i;
    }

    for (let i = 1; i < cols; i++) {
        dist[0]![i] = i;
    }

    for (let col = 1; col < cols; col++) {
        for (let row = 1; row < rows; row++) {
            let cost = 0;
            if (a[row-1] === b[col-1]) {
                cost = 0;
            }
            else {
                cost = 1;
            }
            dist[row]![col] = Math.min(dist[row-1]![col]! + 1, dist[row]![col-1]! + 1, dist[row-1]![col-1]! + cost);
        }
    }


    return dist[rows-1]![cols-1]!;

}