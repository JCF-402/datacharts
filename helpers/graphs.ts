

import Chart, { ChartConfiguration, ChartType } from "chart.js/auto";
import zoomPlugin from "chartjs-plugin-zoom";

import { customNotice } from "main";
import {PlotData,Data,LineProperties, findPossibleProperty} from "./parser"

import { validBarDatasetProperties, validLineDatasetProperties } from "./plotProperties";

type Dataset = {
    label: string,
    data: Data[];
    [key: string]: number | string | Data[]
}

Chart.register(zoomPlugin as any);

export function createPlot(canvas: HTMLCanvasElement, data: PlotData[], parsedMd: LineProperties[], plotProperties: ChartConfiguration["options"], chartType: ChartType ) {
    if (chartType === "pie" || chartType === "doughnut" || chartType === "polarArea" || chartType === "radar"){
        const circularData = transformData(data,chartType);
        if (circularData === undefined) return;
            return new Chart(canvas, {
            type: chartType,
            data: circularData,
            options: {

                ...plotProperties,
            }}); 
    } else {
        const datasets = buildDatasets(data,parsedMd);
            return new Chart(canvas, {
            type: chartType,
            data: {
                datasets: datasets},
            options: {

                ...plotProperties,
            }});
    };

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
			if (validLineDatasetProperties.includes(p.property) || validBarDatasetProperties.includes(p.property)) {
                dataset[p.property] = p.value;

                if (p.property === "borderColor") {
                    dataset.backgroundColor = p.value;
                }
                if (p.property === "backgroundColor") {
                    dataset.borderColor = p.value;
                }
            }
            else {
                findPossibleProperty(p.property,[...validLineDatasetProperties,...validBarDatasetProperties],"LineProperty");
            }
		});

		return dataset;
	});
}

// Transform data is meant for non-scatter/line charts. I.e. pie, radar, etc
function transformData(data: PlotData[], chartType: ChartType){
    switch(chartType){
        case "pie":
        case "polarArea":
            if (data.length > 1) {
                customNotice("Pie and Polar Area charts are meant for 1 dataset. Use doughnut for multiple");
            };
            const first = data[0];
            if (!first) return {labels: [], datasets: []};
            return {
                labels: first.data.map(p => p.x),
                datasets: [
                    {
                        label: first.signature,
                        data: first.data.map(p => p.y)
                    }
                ]
            };
        case "doughnut":
            case "radar":
                const labels = data[0]?.data.map(p=> p.x) ?? [];
                return {
                    labels,
                    datasets: data.map(ds => ({
                        label: ds.signature,
                        data: labels.map(label => {
                            const found = ds.data.find(p => p.x === label);
                            return found ? found.y : null;
                        })
                    }))
                };
        default:
            return undefined;
    }	
}

