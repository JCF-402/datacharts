import { ChartType} from "chart.js/auto";
import {Data} from "./parser";

export function generateSVG(chartInstance: any, chartType: ChartType) {
    const width = chartInstance.width;
	const height = chartInstance.height;

	//const backgroundColor = this.settings.backgroundColor;
	const xScale = chartInstance.scales.x;
	const yScale = chartInstance.scales.y;
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
			 const title = chartInstance.options?.plugins?.title;

				if (title?.display && title.text) {
					svg += `
					<text
						x="${width / 2}"
						y="20"
						font-size="16"
						font-weight="bold"
						text-anchor="middle"
						fill="${text}">${title.text}</text>
					`;
				}
			xScale.ticks.forEach((tick: any, i: number) => {
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
				${tick.label}
    			</text>
			`;


				});

			yScale.ticks.forEach((tick: any, i: number) => {
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
					fill="${text}">${tick.label}</text>
				`;
			});
			let lx = width - 74;
			let ly = 25;

			 chartInstance.data.datasets.forEach((dataset: any, i: number) => {
				const y = ly + i*20;
				const meta = chartInstance.getDatasetMeta(i);
				const points = meta.data.map((pt: Data) => `${pt.x},${pt.y}`).join(" ");
				const color = dataset.borderColor || "black";
				const radius = (dataset.pointRadius && dataset.pointRadius === 0) ? 0 : dataset.pointRadius;
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
					stroke-width="${dataset.borderWidth || 2}"
					points="${points}"
					
				/>`;
				meta.data.forEach((pt: Data) => {
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
		const xTitle = chartInstance.options?.scales?.x?.title;

		if (xTitle?.display && xTitle.text) {
			svg += `
			<text
				x="${(area.left + area.right) / 2}"
				y="${height - 8}"
				font-size="13"
				font-weight="bold"
				text-anchor="middle"
				fill="${text}">${xTitle.text}</text>
			`;
		}

		const yTitle = chartInstance.options?.scales?.y?.title;

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
				${yTitle.text}
			</text>
			`;
		}
		 svg += `</svg>`;
         break;
    }
    }
    return svg
}