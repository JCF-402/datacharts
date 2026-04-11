

import Chart from "chart.js/auto";
import type {PlotData,Data,LineProperties} from "./parser"
import type { ChartOptions } from "chart.js/auto";

type Dataset = {
    label: string,
    data: Data[];
    [key: string]: number | string | Data[]
}



export function createPlot(canvas: HTMLCanvasElement, data: PlotData[], parsedMd: LineProperties[], plotProperties: ChartOptions<"line"> ) {


    // Modifies the background color of the plot to adjust for whatever theme is being used. Look at styles.css
    const parent = canvas.parentElement;

    if (parent && !parent.classList.contains("canvas-plot")) {
    const container = document.createElement("div");
    container.className = "canvas-plot";

    parent.replaceChild(container, canvas);
    container.appendChild(canvas);
    }
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
			pointRadius: 1
		};

		const props = parsedMd.filter(p => p.signature === eq.signature);
		props.forEach(p => {
			dataset[p.property] = p.value;
		});

		return dataset;
	});
}