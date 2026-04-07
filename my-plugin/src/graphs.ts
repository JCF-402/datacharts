

import Chart from "chart.js/auto";
import type {PlotData,Data,LineProperties} from "./parser"

type Dataset = {
    label: string,
    data: Data[];
    [key: string]: number | string | Data[]
}

export function createPlot(canvas: HTMLCanvasElement, data: PlotData[], parsedMd: LineProperties[] ) {
    Chart.getChart(canvas)?.destroy(); // If a canvas exists. Destroy it.


    const datasets = data.map(eq => {
        const dataset: Dataset = {
            label: eq.signature,
            data: eq.data.map((p: Data) => ({ x: p.x, y: p.y})),
        };
        const props = parsedMd.filter(p => p.signature === eq.signature);
        props.forEach(p => {
            dataset[p.property] = p.value;
        });
        return dataset
    });


    new Chart(canvas, {
    type: "line",
    data: {
        datasets: datasets},
    options: {
        scales: {
        x: { 
            type: "linear",
            min: -10,
            max: 10
         },
        y: {
            type: "linear"
        }
        }
    }
    });
}
