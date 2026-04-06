

import Chart from "chart.js/auto";
import type {PlotData,Data} from "./parser"

export function createPlot(canvas: HTMLCanvasElement, data: PlotData[]) {
    Chart.getChart(canvas)?.destroy();
    const datasets = data.map(eq => ({
        label: eq.signature,
        data: eq.data.map((p: Data) => ({ x: p.x, y: p.y})),
        borderWidth: 2,
        pointRadius: 0,
    }))


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
