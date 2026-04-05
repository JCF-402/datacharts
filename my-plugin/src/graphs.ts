
import {Chart} from "chart.js/auto";

export function createPlot(canvas: HTMLCanvasElement, data: object) {
    new Chart(canvas, {
    type: "line",
    data: {
        datasets: [{
        label: "Some Function",
        data: data,   // already in correct format
        borderWidth: 2,
        pointRadius: 0
        }]
    },
    options: {
        scales: {
        x: { type: "linear" }
        }
    }
    });
}

