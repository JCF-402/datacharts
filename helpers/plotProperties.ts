
import { CompletionContext } from "@codemirror/autocomplete";
import { PlotPluginSettings } from "settings";
import { getDefaultPlotProperties } from "main";
import LinearScaleBase from "chart.js/dist/scales/scale.linearbase";
import { index } from "mathjs";
import { format } from "mathjs";
import { filter } from "mathjs";


export const myCompletions = {
    "obj.": [
        {label: "plugins", type: "property", info: "Chart plugins"},
        {label: "scales", type: "property", info: "Axis settings"},
        {label: "elements",type: "property",info: "Line settings"},
        {label: "animations",type: "property",info: "Animation settings"},
        {label: "interaction",type: "property",info: "Interaction settings"}
    ],
}


export const validRoots = [
    "plugins",
    "scales",
    "elements",
    "interaction",
    "animation"
]

export const validPlotProperties = [
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

export const validLineProperties = [
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
    "xrange",
    "pointStyle",
    "pointRadius"
]

export const globalOptions = [
    "xrange",
    "canvasWidth",
    "canvasHeight",
    "canvasRadius",
    "canvasBackground",
    "canvasMargin",
    "canvasPadding"

]

const propertyPattern = /^\s*(.+?)\.([a-zA-Z_]\w*)\s*/;


type TreeNode = {
  [key: string]: TreeNode;
};

export function linePlotCompletionSource(settings: PlotPluginSettings) {
    const chartTree = objectToTree(getDefaultPlotProperties(settings)); // Get default properties from main and create a tree object to travers
    return function(context: CompletionContext) {  // function that autocompletion accepts
        
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
                    type: "function"
                }))
            };
        }
        
        else if (propertyPattern.test(match.text) && !match.text.startsWith("obj.") && !match.text.startsWith("global.")) {
            const dotIndex = match.text.indexOf(".");
            const replaceText = match.text.slice(dotIndex + 1); // Removes anything before . so f(x).borderColor -> borderColor

            return {
                from: context.pos - replaceText.length,
                options: validLineProperties.map(s => ({
                    label: s,
                    type: "function"
                }))
            }
        }

        else if (match.text.startsWith("global.")) {
            const path = match.text.slice(7) // Removes global.
            return {
                from: context.pos - path.length,
                options: globalOptions.map(s => ({
                    label: s,
                    type: "function",
                    filter: false
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
            if (txt === "```lineplot") {
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