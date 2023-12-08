// Available globals
var domo = window.domo;
var datasets = window.datasets;
var chart = {};

let isRendering = false;
let filterAdded = [];

//Chart Options
let datasetId = "d8e7ab0c-3c20-427d-a1cf-7f7435854a8e"; //this will determine what filters apply to the card
let xAxisLabel = "Quarter";
let xAxisField = "Year-Quarter";

let areaLabel = "PRI Funds Ending Balance";
let areaField = "PRI Funds Ending Balance w Exch Rate";
let areaColor = "#0098C3";

let lineLabel = "Capital Contributions";
let lineField = "Contributions Base v USD";
let lineColor = "#B8005C";

let quarterFilterField = "Year-Quarter";
let quarterDateField = "QTR End Date";

let legendSize = 16;

let exportName = "IP Fund Portfolio Growth";
var exportBackground = "#ffffff00";
var exportFontColor = "#fff";
var exportShadowColor = "#222f45";

domo.onFiltersUpdate((e) => {
  handleFilters(e);
});

async function handleFilters(e) {
  let filters = await parseFilter(e);
  await updateChart(filters);
}

async function parseFilter(e) {
  let datasetSpecificFilters = [];
  for (let i = 0; i < e.length; i++) {
    if (e[i].dataSourceId === datasetId) {
      datasetSpecificFilters.push(e[i]);
    }
  }
  let filters = [];
  for (let i = 0; i < datasetSpecificFilters.length; i++) {
    let outputString;

    if (datasetSpecificFilters[i].column === quarterFilterField) {
      let quarter = await datasetSpecificFilters[i].values;

      let filter = `${quarterFilterField} = '${quarter.join()}'`;
      const data = await domo.get(`/data/v1/${datasets[0]}?fields=${quarterDateField}&filter=${filter}&orderby='${quarterDateField}' descending&limit=1`);
      quarterFilter = data[0][quarterDateField];
      outputString = `'${quarterDateField}' <= ${quarterFilter}`;

      filters.push(outputString);
    } else if (datasetSpecificFilters[i].operand.toLowerCase() === "between") {
      outputString = `${datasetSpecificFilters[i].column} >= '${datasetSpecificFilters[i].values[0]}',`;
      filters.push(outputString);

      outputString = ` ${datasetSpecificFilters[i].column} <= ${datasetSpecificFilters[i].values[1]}`;
      filters.push(outputString);
    } else if (Array.isArray(datasetSpecificFilters[i].values)) {
      outputString = `${datasetSpecificFilters[i].column} ${datasetSpecificFilters[i].operand.toLowerCase()} [${datasetSpecificFilters[i].values.map((value) => `"${value}"`)}]`;
      filters.push(outputString);
    } else {
      outputString = `${datasetSpecificFilters[i].column} ${datasetSpecificFilters[i].operand.toLowerCase()} ["${datasetSpecificFilters[i].values}"]`;
      filters.push(outputString);
    }
  }
  return filters;
}

class VLineAreaChart {
  constructor({ el, data, xAxisTickLabelAngle = 45, yMax }) {
    this.el = el;
    this.data = data;
    this.xAxisTickLabelAngle = Math.max(Math.min(xAxisTickLabelAngle, 90), 0);
    (this.yMax = yMax), (this.resized = this.resized.bind(this));
    this.entered = this.entered.bind(this);
    this.moved = this.moved.bind(this);
    this.left = this.left.bind(this);
    this.init();
  }

  init() {
    this.setup();
    this.wrangle();
    this.scaffold();
    this.ro = new ResizeObserver(this.resized);
    this.ro.observe(this.el);
  }

  setup() {
    this.minWidth = 640;
    this.marginTop = 16;
    this.marginRight = 24;
    this.marginBottom = 0; // dynamically determined by x axis labels
    this.marginLeft = 64;
    this.lineWidth = 8;
    this.legendSize = legendSize;
    this.labelTextSize = 20;
    this.labelTextPadding = 4;
    this.focusCircleRadius = 6;

    this.formatYTick = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
    }).format;
    this.formatYValue = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format;

    this.x = d3.scalePoint();
    this.y = d3.scaleLinear();
    this.color = d3.scaleOrdinal();

    this.symbolPath = (type, size) => {
      switch (type) {
        case "area":
          return `M${-size / 2},${-size / 2} H${size / 2} V${size / 2} H${-size / 2} Z`;
        case "line":
          return `M${-size / 2},-2 H${size / 2} V2 H${-size / 2} Z`;
        default:
          return "";
      }
    };

    this.area = d3
      .area()
      .x((_, i) => this.x(this.data.labels[i]))
      .y0(() => this.y(0))
      .y1((d) => this.y(d))
      .curve(d3.curveMonotoneX);

    this.line = this.area.lineY1();
  }

  wrangle() {
    this.x.domain(this.data.labels);

    const yMax = this.yMax || d3.max(d3.merge(this.data.series.map((d) => d.data)));
    this.y.domain([0, yMax]).nice();

    this.color.domain(this.data.series.map((d) => d.name)).range(this.data.series.map((d) => d.color));

    this.areaSeries = this.data.series.find((d) => d.type === "area");
    this.lineSeries = this.data.series.find((d) => d.type === "line");

    this.labels = this.data.series.map((d) => ({
      key: d.type,
      value: d.data[d.data.length - 1],
      size: this.labelTextSize + this.labelTextPadding,
      text: this.formatYTick(d.data[d.data.length - 1]),
    }));
  }

  scaffold() {
    this.outerContainer = d3.select(this.el).classed("v v-range-bar-symbol", true);
    this.controlsContainer = this.outerContainer.append("div").attr("class", "controls-container");
    this.container = this.outerContainer.append("div").attr("class", "inner-container tooltip-parent");
    new VExport({
      elContainer: this.controlsContainer.node(),
      el: this.container.node(),
      filename: exportName,
    });

    this.scaffoldLegend();
    this.renderLegend();
    this.scaffoldChart();

    this.tooltip = this.chartContainer.append("div").attr("class", "tooltip");
  }

  scaffoldLegend() {
    this.legendContainer = this.container.append("div").attr("class", "swatches");
  }

  scaffoldChart() {
    this.chartContainer = this.container.append("div").attr("class", "chart-container");

    this.svg = this.chartContainer.append("svg").attr("class", "chart-svg").attr("height", this.height);

    this.xAxisG = this.svg.append("g").attr("class", "axis-g");
    this.yAxisG = this.svg.append("g").attr("class", "axis-g");
    this.areaPath = this.svg.append("path").attr("class", "area-path");
    this.linePath = this.svg.append("path").attr("class", "line-path");
    this.focusG = this.svg.append("g").attr("class", "focus-g");
    this.scaffoldFocus();
    this.labelsG = this.svg.append("g").attr("class", "labels-g").attr("text-anchor", "end");

    this.svg
      .on("pointerenter", this.entered)
      .on("pointermove", this.moved)
      .on("pointerleave", this.left)
      .on("touchstart", (event) => event.preventDefault());
  }

  scaffoldFocus() {
    this.focusLine = this.focusG.append("line").attr("class", "focus-line");
    this.focusCircle = this.focusG
      .selectAll(".focus-circle")
      .data(this.data.series)
      .join((enter) => enter.append("circle").attr("class", "focus-circle").attr("r", this.focusCircleRadius));
  }

  resized() {
    this.width = Math.max(this.chartContainer.node().clientWidth, this.minWidth);
    this.height = this.chartContainer.node().clientHeight;

    this.x.range([this.marginLeft, this.width - this.marginRight]);

    this.svg.attr("width", this.width).attr("viewBox", [0, 0, this.width, this.height]);

    this.render();
  }

  computeLabelPositions() {
    this.labels = this.labels.map((d) => ({ ...d, y: this.y(d.value) })).sort((a, b) => d3.descending(a.y, b.y));
    this.dodge(this.labels);
  }

  dodge(labels) {
    for (let i = 1; i < labels.length; i++) {
      const curr = labels[i];
      const prev = labels[i - 1];
      curr.y = Math.min(curr.y, prev.y - prev.size / 2 - curr.size / 2);
    }
  }

  render() {
    this.renderXAxis();
    this.renderYAxis();
    this.renderArea();
    this.renderLine();
    this.computeLabelPositions();
    this.renderLabels();
  }

  renderXAxis() {
    const minTickGap = 24;
    const tickFrequency = Math.ceil(minTickGap / this.x.step());
    const xTicks = this.data.labels.filter((_, i) => i % tickFrequency === 0);

    this.xAxisG
      .call(d3.axisBottom(this.x).tickSize(8).tickValues(xTicks))
      .attr("text-anchor", this.xAxisTickLabelAngle > 0 ? "end" : "middle")
      .call((g) =>
        g
          .selectAll(".tick text")
          .attr("dy", this.xAxisTickLabelAngle > 0 ? "0.32em" : "0.71em")
          .attr("y", null)
          .attr("transform", `translate(0,${16})rotate(${-this.xAxisTickLabelAngle})`)
      );

    this.marginBottom = Math.ceil(this.xAxisG.node().getBBox().height) + 8;

    this.xAxisG.attr("transform", `translate(0,${this.height - this.marginBottom})`);
  }

  renderYAxis() {
    this.y.range([this.height - this.marginBottom, this.marginTop]);

    this.yAxisG.attr("transform", `translate(${this.marginLeft},0)`).call(
      d3
        .axisLeft(this.y)
        .tickSize(6)
        .tickPadding(10)
        .tickFormat(this.formatYTick)
        .ticks((this.height - this.marginTop - this.marginBottom) / 40)
    );
  }

  renderArea() {
    this.areaPath
      .datum(this.areaSeries)
      .attr("fill", (d) => this.color(d.name))
      .attr("d", (d) => this.area(d.data));
  }

  renderLine() {
    this.linePath
      .datum(this.lineSeries)
      .attr("fill", "none")
      .attr("stroke", (d) => this.color(d.name))
      .attr("stroke-width", this.lineWidth)
      .attr("d", (d) => this.line(d.data));
  }

  renderLabels() {
    this.labelsG
      .attr("transform", `translate(${this.width - this.marginRight},0)`)
      .selectAll(".label-text")
      .data(this.labels)
      .join((enter) => enter.append("text").attr("class", "label-text halo-text").attr("dy", "0.35em").attr("dx", -8).attr("y", 8))
      .text((d) => d.text)
      .attr("y", (d) => d.y);
  }

  renderFocus() {
    this.focusG.attr("transform", `translate(${this.x(this.data.labels[this.iActive])},0)`);
    this.focusLine.attr("y1", this.marginTop).attr("y2", this.height - this.marginBottom);
    this.focusCircle
      .data(this.data.series)
      .attr("fill", (d) => d.color)
      .attr("cy", (d) => this.y(d.data[this.iActive]));
  }

  renderLegend() {
    this.legendContainer
      .selectAll(".swatch")
      .data(this.color.domain())
      .join((enter) =>
        enter
          .append("div")
          .attr("class", "swatch")
          .call((div) =>
            div
              .append("svg")
              .attr("class", "swatch__symbol")
              .attr("width", this.legendSize)
              .attr("height", this.legendSize)
              .attr("viewBox", [-this.legendSize / 2, -this.legendSize / 2, this.legendSize, this.legendSize])
              .append("path")
              .attr("d", (_, i) => this.symbolPath(i ? "line" : "area", this.legendSize))
          )
          .call((div) => div.append("div").attr("class", "swatch__label"))
      )
      .call((div) => div.select("path").attr("fill", (d) => this.color(d)))
      .call((div) => div.select(".swatch__label").text((d) => d));
  }

  entered() {
    this.focusG.classed("is-visible", true);
    this.tooltip.classed("is-visible", true);
  }

  moved(event) {
    const [xm, ym] = d3.pointer(event);
    const i = d3.leastIndex(this.data.labels, (d) => Math.abs(this.x(d) - xm));

    if (this.iActive !== i) {
      this.iActive = i;
      this.renderFocus();

      this.tooltip.html(this.tooltipContent());
      this.tRect = this.tooltip.node().getBoundingClientRect();
    }

    const tOffset = 8;
    let x = this.x(this.data.labels[this.iActive]);
    const xMin = this.chartContainer.node().scrollLeft;
    const xMax = xMin + this.chartContainer.node().clientWidth;
    if (x > (xMin + xMax) / 2) {
      x = Math.max(xMin, x - this.tRect.width - tOffset);
    } else {
      x = Math.min(xMax - this.tRect.width, x + tOffset);
    }
    let y = Math.max(0, ym - this.tRect.height - tOffset);
    this.tooltip.style("transform", `translate(${x}px,${y}px)`);
  }

  left() {
    this.focusG.classed("is-visible", false);
    this.tooltip.classed("is-visible", false);
  }

  tooltipContent() {
    const date = this.data.labels[this.iActive];
    const series = this.data.series.map((d) => ({
      color: d.color,
      name: d.name,
      value: this.formatYValue(d.data[this.iActive]),
    }));
    return `
      <div>${date}</div>
      ${series
        .map(
          ({ color, name, value }) => `
      <div><span class="t-swatch" style="background-color: ${color};"></span><span>${name}: </span><span><strong>${value}</strong></span></div>
      `
        )
        .join("")}
      `;
  }

  updateData(data) {
    this.data = data;
    this.wrangle();
    this.renderLegend();
    this.resized();
  }
}

class VExport {
  constructor({ elContainer, el, filename, textColorExport = exportFontColor, textHaloColorExport = exportShadowColor }) {
    this.elContainer = elContainer;
    this.el = el;
    this.filename = filename;
    this.textColorExport = textColorExport;
    this.textHaloColorExport = textHaloColorExport;
    this.exportPNG = this.exportPNG.bind(this);
    this.init();
  }

  init() {
    this.container = d3.select(this.elContainer).append("div").attr("class", "v-export");

    this.hamburgerContainer = this.container.append("div").attr("class", "hamburger").on("click", toggleMenu);

    for (let i = 0; i < 3; i++) {
      this.hamburgerContainer.append("div").attr("class", "bar");
    }

    this.dropdownMenu = this.container.append("div").attr("class", "dropdown-content").attr("id", "dropdown-content");
    this.dropdownMenuButton = this.dropdownMenu.append("button").text("Download PNG").on("click", this.exportPNG);
  }

  async exportPNG() {
    const style = getComputedStyle(this.el);
    const textColor = style.getPropertyValue("--color-text");
    const haloStrokeColor = style.getPropertyValue("--color-background");
    try {
      d3.select(this.el).style("--color-text", this.textColorExport);
      d3.select(this.el).style("--color-background", this.textHaloColorExport);
      const { width, height } = this.el.getBoundingClientRect();
      const padding = 24;
      const dataUrl = await htmlToImage.toPng(this.el, {
        pixelRatio: 2,
        width: width + padding * 2,
        height: height + padding * 2,
        style: {
          padding: padding + "px",
        },
      });
      const link = document.createElement("a");
      link.download = `${this.filename}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error(error);
      throw new Error("Oops, something went wrong when exporting PNG.");
    } finally {
      d3.select(this.el).style("--color-text", textColor);
      d3.select(this.el).style("--color-background", haloStrokeColor);
    }
  }
}

function toggleMenu() {
  var dropdownContent = document.getElementById("dropdown-content");

  if (dropdownContent.style.display === "block") {
    dropdownContent.style.display = "none";
  } else {
    dropdownContent.style.display = "block";
  }
}

async function fetchData(filters) {
  const xAxis = [];
  const list1 = [];
  const list2 = [];

  var fields = [xAxisField, areaField, lineField];
  var groupby = [xAxisField];
  if (filters === "none" || filters.length === 0) {
    var query = `/data/v1/${datasets[0]}?fields=${fields.join()}&groupby=${groupby.join()}&orderby=${xAxisField}`;
  } else {
    var query = `/data/v1/${datasets[0]}?fields=${fields.join()}&groupby=${groupby.join()}&filter=${filters}&orderby=${xAxisField}`;
  }
  const data = await domo.get(query);

  data.forEach((item) => {
    xAxis.push(item[xAxisField]);
    list1.push(item[areaField]);
    list2.push(item[lineField]);
  });

  return { xAxis, list1, list2 };
}

async function renderChart(filters) {
  isRendering = true;
  const { xAxis, list1, list2 } = await fetchData(filters);

  const data = {
    series: [
      {
        name: "PRI Funds Ending Balance",
        type: "area",
        color: areaColor,
        data: list1,
      },
      {
        name: "Capital Contributions",
        type: "line",
        color: lineColor,
        data: list2,
      },
    ],
    labels: xAxis,
  };

  if (filterAdded.length > 0) {
    await handleFilters(filterAdded);
  }

  chart = new VLineAreaChart({
    el: document.getElementById("lineAreaChart"),
    data,
  });
}

async function updateChart(filters) {
  const { xAxis, list1, list2 } = await fetchData(filters);

  const data = {
    series: [
      {
        name: "PRI Funds Ending Balance",
        type: "area",
        color: areaColor,
        data: list1,
      },
      {
        name: "Capital Contributions",
        type: "line",
        color: lineColor,
        data: list2,
      },
    ],
    labels: xAxis,
  };

  chart.updateData(data);
}

renderChart("none");
