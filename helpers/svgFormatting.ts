import { ChartType} from "chart.js/auto";
import {DataChartsChart} from "./graphs";

export function generateSVG(chartInstance: DataChartsChart, chartType: ChartType) {
    const width = chartInstance.width;
	const height = chartInstance.height;

	//const backgroundColor = this.settings.backgroundColor;
	const xScale = chartInstance.scales.x;
	const yScale = chartInstance.scales.y;
	if (!xScale || !yScale) {
    throw new Error("Scales not found in chart instance. Unable to generate SVG.");
	}
	const area = chartInstance.chartArea;
	const style = getComputedStyle(document.body);
	const bg = style.getPropertyValue("--background-secondary").trim() || "#ffffff";
	const text = style.getPropertyValue("--text-normal").trim() || "#000000";
	const muted = style.getPropertyValue("--text-muted").trim() || "#666666";
	const border = style.getPropertyValue("--background-modifier-border").trim() || "#d0d0d0";
	
    let svg = "";
    switch(chartType) {
        case "line": {
		    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${bg}" />`; 
			 svg += `
			 <line
			 	x1="${area.left}"
				y1="${area.bottom}"
				x2="${area.right}"
				y2="${area.bottom}"
				stroke="${muted}"
				stroke-width="1"
			/>

			<line
				x1="${area.left}"
				y1="${area.top}"
				x2="${area.left}"
				y2="${area.bottom}"
				stroke="${muted}"
				stroke-width="1"
			/>
			 `;
			 let title = chartInstance.options?.plugins?.title;
			 if (!title) title = { display: false, text: "" };
			 const titleText = svgText(title.text);

				if (title?.display && title.text) {
					svg += `
					<text
						x="${width / 2}"
						y="20"
						font-size="16"
						font-weight="bold"
						text-anchor="middle"
						fill="${text}">${titleText}</text>
					`;
				}
			xScale.ticks.forEach((tick, i: number) => {
			const x = xScale.getPixelForTick(i);

			    svg += `
				<line
					x1="${x}"
					y1="${area.top}"
					x2="${x}"
					y2="${area.bottom}"
					stroke="${border}"
					stroke-width="1"
				/>
   				 `;
			svg += `
			<line
				x1="${x}"
				y1="${area.bottom}"
				x2="${x}"
				y2="${area.bottom + 6}"
				stroke="${border}"
				stroke-width="1"
			/>
			    <text
				x="${x}"
				y="${area.bottom + 18}"
				font-size="12"
				text-anchor="middle"
				dominant-baseline="middle"
				fill="${text}">
				${svgText(tick.label)}
    			</text>
			`;


				});

			yScale.ticks.forEach((tick, i: number) => {
				const y = yScale.getPixelForTick(i);
				svg += `
				<line
					x1="${area.left}"
					y1="${y}"
					x2="${area.right}"
					y2="${y}"
					stroke="${border}"
					stroke-width="1"
				/>
				`;
				svg += `
				<line
					x1="${area.left - 6}"
					y1="${y}"
					x2="${area.left}"
					y2="${y}"
					stroke="${border}"
					stroke-width="1"
					
				/>
				<text
					x="${area.left - 8}"
					y="${y}"
					font-size="12"
					text-anchor="end"
					dominant-baseline="middle"
					fill="${text}">${svgText(tick.label)}</text>
				`;
			});
			let lx = width - 74;
			let ly = 25;

			 chartInstance.data.datasets.forEach((dataset, i: number) => {
				const y = ly + i*20;
				const meta = chartInstance.getDatasetMeta(i);
				const points = meta.data.map((pt) => `${pt.x},${pt.y}`).join(" ");
				const color = svgColor(dataset.borderColor);
				const borderWidth = svgNumber(dataset.borderWidth, 2);

				let radius = 1; // Default radius
				if ("pointRadius" in dataset && typeof dataset.pointRadius === "number") { 
					radius = dataset.pointRadius; // Use dataset's pointRadius if available
				}

				//const radius = (dataset.pointRadius && dataset.pointRadius === 0) ? 0 : dataset.pointRadius;
				//const radius = dataset.pointRadius && dataset.pointRadius > 0 ? dataset.pointRadius : 3;
				svg += `
				<rect x="${lx}" y="${y-10}" width="12" height="12" fill="${color}" />
				<text
					x="${lx + 18}"
					y="${y}"
					font-size="12"
					dominant-baseline="middle"
					fill="${text}">${dataset.label || `Series ${i+1}`}</text>

				<polyline
					fill="none"
					stroke="${color}"
					stroke-width="${borderWidth}"
					points="${points}"
					
				/>`;
				meta.data.forEach((pt) => {
					svg += `
					<circle
						cx="${pt.x}"
                		cy="${pt.y}"
                		r="${radius}"
                		fill="${color}"
					/>
					`;
			 });

			
		});
		
		let xTitle = "title" in xScale.options && isScaleTitle(xScale.options.title) ? xScale.options.title : undefined; // xTitle is not present in some chart types, so we need to check if it exists and is of the correct type
		if (!xTitle) xTitle = { display: false, text: "" };
		const xtitleText = svgText(xTitle.text);
		if (xTitle?.display && xTitle.text) {
			svg += `
			<text
				x="${(area.left + area.right) / 2}"
				y="${height - 8}"
				font-size="13"
				font-weight="bold"
				text-anchor="middle"
				fill="${text}">${xtitleText}</text>
			`;
		}

		let yTitle = "title" in yScale.options && isScaleTitle(yScale.options.title) ? yScale.options.title : undefined;
		if (!yTitle) yTitle = { display: false, text: "" };
		const ytitleText = svgText(yTitle.text);
		if (yTitle?.display && yTitle.text) {
			svg += `
			<text
				x="16"
				y="${(area.top + area.bottom) / 2}"
				font-size="13"
				font-weight="bold"
				text-anchor="middle"
				fill="${text}"
				transform="rotate(-90 16 ${(area.top + area.bottom) / 2})">
				${ytitleText}
			</text>
			`;
		}
		 svg += `</svg>`;
         break;
    }
    }
    return svg
}
// Type definition for scale titles. Because when trying to access the title property of a scale, it can be undefined or not have the expected structure. This type helps ensure that we only try to access properties that exist and are of the correct type.
// Specifically for making xTitle and yTitle work
type ScaleTitle = {
    display?: boolean;
    text?: string | string[];
};

function isScaleTitle(value: unknown): value is ScaleTitle {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const title = value as Record<string, unknown>;

    return (
        (title.display === undefined ||
            typeof title.display === "boolean") &&
        (title.text === undefined ||
            typeof title.text === "string" ||
            (Array.isArray(title.text) &&
                title.text.every(v => typeof v === "string")))
    );
}

function svgText(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }

    if (
        Array.isArray(value) &&
        value.every(item => typeof item === "string")
    ) {
        return value.join(" ");
    }

    return "";
}

function svgColor(value: unknown, fallback = "black"): string {
    return typeof value === "string"
        ? value
        : fallback;
}

function svgNumber(value: unknown, fallback: number): number {
    return typeof value === "number"
        ? value
        : fallback;
}