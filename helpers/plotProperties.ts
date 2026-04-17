
import { Completion, CompletionContext } from "@codemirror/autocomplete";
import { PlotPluginSettings } from "settings";
import { getDefaultPlotProperties } from "main";
import LinearScaleBase from "chart.js/dist/scales/scale.linearbase";
import { index } from "mathjs";
import { format } from "mathjs";
import { filter } from "mathjs";
import { ChartType } from "chart.js";


export const validRoots = [
    "plugins",
    "scales",
    "elements",
    "interaction",
    "animation"
]

export const validObjProperties = [
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

	"responsive",
	"maintainAspectRatio",
	"animation",

	"padding",

	"stacked",
	"offset",

	"indexAxis",

	"borderColor",
	"backgroundColor",
	"borderWidth",

	"pointRadius",
	"tension",
	"fill",

	"hidden"
];

export const validLineDatasetProperties = [
	"label",
	"backgroundColor",
	"borderCapStyle",
	"borderColor",
	"borderDash",
	"borderDashOffset",
	"borderJoinStyle",
	"borderWidth",
	"fill",
	"tension",
	"showLine",
	"spanGaps",
	"range",
	"pointStyle",
	"pointRadius",
	"hidden"
]

export const globalOptions = [
    "range",
    "canvasWidth",
    "canvasHeight",
    "canvasRadius",
    "canvasBackground",
    "canvasMargin",
    "canvasPadding"

]

export const validBarDatasetProperties = [
	"label",
	"backgroundColor",
	"borderColor",
	"borderWidth",
	"borderRadius",
	"borderSkipped",

	"barPercentage",
	"categoryPercentage",

	"base",
	"inflateAmount",
	"maxBarThickness",
	"minBarLength",

	"order",
	"stack",
	"grouped",

	"hoverBackgroundColor",
	"hoverBorderColor",
	"hoverBorderWidth",

	"hidden"
];

const propertyPattern = /^\s*(.+?)\.([a-zA-Z_]\w*)?\s*/;

const propertyDescriptions: Record<string,string> = {

    // roots
    elements: "Controls style options for all datasets",
    interactions: "Controls options for mouse interactions with chart.",
    layout: "Controls the chart layout options.",
    // global
    range: "Controls the range for evaluating a main equation.",
    canvasWidth: "Controls the chart width in pixels.",
    canvasHeight: "Controls the chart height in pixels.",
    canvasRadius: "Controls chart corner radius.",
    canvasBackground: "Controls the color of the chart background.",
    canvasMargin: "Controls the margins of the chart in pixels.",
    canvasPadding: "Controls chart padding in pixels.",

    backgroundColor: "Main color option. Fills line, bar, pie, points, and areas.",
    borderColor: "Controls the border or stroke color.",
    borderWidth: "Controls border or line thickness.",
    borderCapStyle: "Controls the cap style of line ends.",
    borderDash: "Controls dashed line pattern.",
    borderDashOffset: "Controls dash starting offset.",
    borderJoinStyle: "Controls how line corners are joined.",
    borderRadius: "Rounds bar, arc, or element corners.",
    borderSkipped: "Skips drawing borders on selected sides.",

    fill: "Fills the area under a line or radar dataset.",
    tension: "Controls line curve smoothness. 0 = straight lines.",
    stepped: "Draws stepped lines instead of diagonal segments.",
    showLine: "Shows connecting lines between points.",
    spanGaps: "Connects lines across missing or null values.",

    pointRadius: "Controls point size.",
    pointHoverRadius: "Controls point size while hovered.",
    pointHitRadius: "Controls clickable area around points.",
    pointStyle: "Controls point shape.",
    padding: "The padding to add inside the chart.",
    radius: "Controls radius of arcs, bubbles, or points.",
    hoverRadius: "Controls radius while hovered.",
    hoverOffset: "Moves pie or doughnut slices outward on hover.",

    barThickness: "Sets fixed bar thickness.",
    maxBarThickness: "Sets maximum allowed bar thickness.",
    minBarLength: "Sets minimum visible bar length.",
    categoryPercentage: "Controls category width used by bars.",
    barPercentage: "Controls bar width inside category space.",
    indexAxis: "Changes chart direction. x = vertical, y = horizontal.",

    cutout: "Controls doughnut hole size.",
    rotation: "Controls starting rotation angle.",
    circumference: "Controls total sweep angle of pie or doughnut.",
    spacing: "Controls spacing between arc segments.",

    responsive: "Resizes chart with container.",
    maintainAspectRatio: "Keeps chart aspect ratio when resizing.",
    aspectRatio: "Sets preferred width to height ratio.",

    display: "Shows or hides an item.",
    text: "Controls displayed text.",
    position: "Controls element position.",
    align: "Controls alignment.",
    color: "Controls text or element color.",
    font: "Controls font styling.",

    min: "Sets minimum axis value.",
    max: "Sets maximum axis value.",
    beginAtZero: "Starts axis at zero.",
    suggestedMin: "Suggested minimum axis value.",
    suggestedMax: "Suggested maximum axis value.",
    reverse: "Reverses axis direction.",
    stacked: "Stacks datasets on the axis.",
    offset: "Adds spacing before first and after last tick.",
    type: "Controls axis scale type.",
    labels: "Controls category labels.",

    enabled: "Enables or disables a feature.",
    mode: "Controls interaction or display mode.",
    intersect: "Requires pointer to intersect element.",
    axis: "Controls active interaction axis.",

    plugins: "Container for plugin options.",
    legend: "Controls legend settings.",
    title: "Controls title settings.",
    tooltip: "Controls tooltip settings.",

    scales: "Container for axis settings.",
    animation: "Controls chart animation behavior.",
    parsing: "Controls automatic data parsing.",
    normalized: "Improves performance for sorted data.",
    clip: "Clips drawing outside chart area.",

    grid: "Controls axis grid line settings.",
    ticks: "Controls axis tick label settings.",
    autoSkip: "Automatically hides some tick labels if crowded.",
    precision: "Controls decimal precision of tick values.",


}

type TreeNode = {
  [key: string]: TreeNode;
};

export function PlotCompletionSource(settings: PlotPluginSettings) {
    
    return function(context: CompletionContext) {  // function that autocompletion accepts
        const chartType = getChartTypeFromEditor(context);
        if (!chartType) return null;
        
        const chartTree = objectToTree(getDefaultPlotProperties(settings, chartType)); // Get default properties from main and create a tree object to travers
        if (!inLineplotBlock(context)) return null; // if the text doesnt have ```lineplot at some point before, dont autocomplete. Couldnt get syntaxTree to work
        const match = context.matchBefore(/[a-zA-Z0-9_.()]*/); // Matches text before cursor stop
        if (!match) return null; 

        if (match.text.startsWith("obj.")) {
            const pathText = match.text.slice(4); // Remove obj.
            const parts = pathText.split("."); // Gets path scales.x

            const partial = parts.pop() ?? ""; // Removes what is being typed

            let node: any = chartTree; // Traversal starts at root

            for (const part of parts) { // Walk through path
                if (!part) continue; 

                if (!(part in node)) return null; // If part not a valid jey in nodes (chartTree) stop suggesting

                node = node[part]; // the node becomes the next object inside part so node was scales.x is now x. -> options for x
            }
            return {
                from: context.pos - partial.length, // we only replace the property being written not the whole obj. -> path
                options: Object.keys(node).filter(key => key.startsWith(partial)).map( key => ({
                    label: key,
                    type: "function",
                    info: getPropertyDescription(key)
                }))
            };
        }
        
        else if (propertyPattern.test(match.text) && !match.text.startsWith("obj.") && !match.text.startsWith("global.")) {
            const dotIndex = match.text.indexOf(".");
            const replaceText = match.text.slice(dotIndex + 1); // Removes anything before . so f(x).borderColor -> borderColor
            let arr = validLineDatasetProperties;
            switch(chartType){
                case "line":
                case "scatter": {
                    arr = validLineDatasetProperties;
                    break;
                }
                case "bar": {
                    arr = validBarDatasetProperties;
                    break;
                }
                default:
                    arr = [...validLineDatasetProperties,...validBarDatasetProperties];
                    break;
            }
            return {
                from: context.pos - replaceText.length,
                options: arr.map(s => ({
                    label: s,
                    type: "function",
                    info: getPropertyDescription(s)

                })),
            }
        }

        else if (match.text.startsWith("global.")) {
            const path = match.text.slice(7) // Removes global.
            return {
                from: context.pos - path.length,
                options: globalOptions.map(s => ({
                    label: s,
                    type: "function",
                    filter: false,
                    info: getPropertyDescription(s)
                }))
            }
        }

        return null;
    }
}

function inLineplotBlock(context: CompletionContext): boolean {
    let line = context.state.doc.lineAt(context.pos);

    let foundStart = false;

    for (let n = line.number; n >= 1; n--) {
        const txt = context.state.doc.line(n).text.trim();

        if (txt.startsWith("```")) {
            if (txt === "```datachart") {
                foundStart = true;
            }
            break;
        }
    }

    return foundStart;
}



export function objectToTree(obj: any): TreeNode {
  const tree: TreeNode = {};

  for (const key in obj) { 
    const value = obj[key];

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      tree[key] = objectToTree(value);
    } else {
      tree[key] = {};
    }
  }

  return tree;
}

function getPropertyDescription(property: string) {
    return propertyDescriptions[property] ?? "No description available.";
}

function getChartTypeFromEditor(context: CompletionContext): ChartType {
    const text = context.state.doc.toString();
    const pos = context.pos;

    const beforeCursor = text.slice(0,pos);
    const blockStart = beforeCursor.lastIndexOf("```datachart");
    if (blockStart === -1) return "line";

    const blockText = beforeCursor.slice(blockStart);
    const match = blockText.match(/type::\s*(\w+)/);
    if (!match || !match[1]) return "line";

    const type = match[1].trim().toLocaleLowerCase();

    if (type === "line" || type === "bar" || type === "scatter" || type === "pie" || type === "doughnut" || type === "radar") {
        return type;
    }
    return "line"

}