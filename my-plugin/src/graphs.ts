

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
            borderWidth: 2,
            pointStyle: "circle",
            pointRadius: 1
            
        };
        const props = parsedMd.filter(p => p.signature === eq.signature); // Create array with signatures that match eq signature

        props.forEach(p => { // Traverse array of filtered properties. And add the property 
            //console.log(`${p.property} = ${p.value}`);
            dataset[p.property] = p.value; 
        });
        return dataset
    });
    //console.log(datasets);

    new Chart(canvas, {
    type: "line",
    data: {
        datasets: datasets},
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
        x: { 
            type: "linear",
         },
        y: {
            type: "linear"
        }
        }
    }
    });
}
