

import Chart, { ChartConfiguration } from "chart.js/auto";
import zoomPlugin from "chartjs-plugin-zoom";


import {PlotData,Data,LineProperties, findPossibleProperty} from "./parser"

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

type Dataset = {
    label: string,
    data: Data[];
    [key: string]: number | string | Data[]
}

Chart.register(zoomPlugin as any);

export function createPlot(canvas: HTMLCanvasElement, data: PlotData[], parsedMd: LineProperties[], plotProperties: ChartConfiguration<"line">["options"] ) {


    const datasets = buildDatasets(data,parsedMd)
    return new Chart(canvas, {
    type: "line",
    data: {
        datasets: datasets},
    options: {

        ...plotProperties,
    }
    });
}

export function buildDatasets(data: PlotData[], parsedMd: LineProperties[]) {
	return data.map(eq => {
		const dataset: Dataset = {
			label: eq.signature,
			data: eq.data.map((p: Data) => ({ x: p.x, y: p.y })),
			borderWidth: 2,
			pointStyle: "circle",
			pointRadius: 1,

    		};

		const props = parsedMd.filter(p => p.signature === eq.signature);
		props.forEach(p => {
			if (validLineProperties.includes(p.property)) {
                dataset[p.property] = p.value;

                if (p.property === "borderColor") {
                    dataset.backgroundColor = p.value;
                }
                if (p.property === "backgroundColor") {
                    dataset.borderColor = p.value;
                }
            }
            else {
                findPossibleProperty(p.property,validLineProperties,"LineProperty");
            }
		});

		return dataset;
	});
}

const getRandomRGB = (): string => {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgb(${r}, ${g}, ${b})`;
};

