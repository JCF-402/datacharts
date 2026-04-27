# DataCharts Plugin

DataCharts is an Obsidian plugin for creating charts, plotting functions, and visualizing note data directly in markdown. Further documentation can be found at https://datacharts-docs.vercel.app/. 

![Line Plot Demo](assets/introGIF.gif)

## Features

- Currently supports line charts powered by Chart.js

- Uses Mathjs for parsing and plotting mathematical equations.

- Create plots with manually given data.

- Create plots with data stored in normal markdown tables.

- Customize datasets, plots, and canvas styling.

- Zoom, Pan, Inspect plot values.

  
## Installation

Install from Community Plugins once published or
Manually place the plugin files in your vault's `.obsidian/plugins/datacharts` folder.
- main.js
- styles.css
- manifest.json

## Roadmap

- Improve stability from user feedback.
- Query vault data through Bases / Datacore / Custom syntax.
- Polish existing chart support. 
- Expand equation parsing and custom math syntax.
- Add to export chart/note as PNG and SVG to file location.


## Issues

Found a bug or have an idea? Open a GitHub Issue.


## Changelog

### 1.0.3
- Added support for Nested Independent Equations. For details look at docs.
- Changed xrange to range
- Fixed bug with global range
- Added preliminary support for spreadsheet plugin support. More to come.

### 1.0.2

- Changed ```lineplot``` to ```datachart```. 
- Introduced `type :: chartType` for defining plot type.
- Added bar and scatter chart support. 
- Added pie, doughnut, polarArea and radar chart support. (Work but need polish).
- Changed syntax for `source::` read new documentation at https://datacharts-docs.vercel.app/. 
- Added option to save chart to vault as PNG by right clicking on the chart. 
- Added option to save chart to vaul as SVG (limited to line charts only right now)

### 1.0.1

- Added a simple autocomplete feature for properties.

![Autocomplete][assets/autocomplete.gif]


### 1.0.0

- Initial release
- Function plotting
- Manual Datasets
- Markdown Table Sources
- Plot and Line customizations
