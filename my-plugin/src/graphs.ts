

import Chart, { ChartConfiguration } from "chart.js/auto";

import type {PlotData,Data,LineProperties} from "./parser"



type Dataset = {
    label: string,
    data: Data[];
    [key: string]: number | string | Data[]
}

export function createPlot(canvas: HTMLCanvasElement, data: PlotData[], parsedMd: LineProperties[], plotProperties: ChartConfiguration<"line">["options"] ) {

    /*
    // Modifies the background color of the plot to adjust for whatever theme is being used. Look at styles.css
    const parent = canvas.parentElement;

    if (parent && !parent.classList.contains("canvas-plot")) {
    const container = document.createElement("div");
    container.className = "canvas-plot";

    parent.replaceChild(container, canvas);
    container.appendChild(canvas);
    }
    */
    const datasets = buildDatasets(data,parsedMd)
    console.log(datasets);
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
        const randomColor = getRandomRGB();
		const dataset: Dataset = {
			label: eq.signature,
			data: eq.data.map((p: Data) => ({ x: p.x, y: p.y })),
			borderWidth: 2,
			pointStyle: "circle",
			pointRadius: 1,

    		};

		const props = parsedMd.filter(p => p.signature === eq.signature);
		props.forEach(p => {
			dataset[p.property] = p.value;

            if (p.property === "borderColor") {
                dataset.backgroundColor = p.value;
            }
            if (p.property === "backgroundColor") {
                dataset.borderColor = p.value;
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