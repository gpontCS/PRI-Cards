var datasetId = "b9a25271-ccca-49ed-905d-6f944601df0a";

var barColor = "#C9DD03";
var minRange = "Low";
var maxRange = "High";
var barLabel = "IP Target";

var symbolColor = "#00B0F0";
var symbolLabel = "IP Portfolio";
var symbolField = "Diversification Calc Asset Type";

var xAxisField = "Asset Type Abbreviated";

var quarterFilterField = "Year-Quarter";
var quarterDateField = "QTR End Date";

var sortField = "Sector Sort";

//Export File Name
let exportName = "Sector Diversification";

var exportBackground = "#ffffff00";
var exportFontColor = "white";
var legendSizing = 24;

var yMinValue = -0.05;
var yMaxValue = 0.5;

let chart;

domo.onFiltersUpdate((e) => {
  handleFilters(e);
});

async function handleFilters(e) {
  let filters = await parseFilter(e);
  updateChart(filters);
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
      outputString = `'${quarterFilterField}' = '${datasetSpecificFilters[i].values}'`;
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

function toggleMenu() {
  console.log("RUN");
  var dropdownContent = document.getElementById("dropdown-content");

  if (dropdownContent.style.display === "block") {
    dropdownContent.style.display = "none";
  } else {
    dropdownContent.style.display = "block";
  }
}

class VRangeBarSymbol {
  constructor({ el, data, yMax, yMin, yStep = 0.05 }) {
    this.el = el;
    this.data = data;
    this.yMax = yMax;
    this.yMin = yMin;
    this.yStep = yStep;
    this.resized = this.resized.bind(this);
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
    this.marginBottom = 48;
    this.marginLeft = 64;
    this.legendSize = legendSizing;
    this.symbolSize = 20;
    this.barLabelTextSize = 14;
    this.symbolLabelTextSize = 20;
    this.labelTextPadding = 4;

    this.formatYTick = d3.format("~%");
    this.formatYValue = d3.format(".1~%");

    this.x = d3.scaleBand().paddingOuter(0.25).paddingInner(0.5);

    this.y = d3.scaleLinear();

    this.color = d3.scaleOrdinal();

    this.symbolPath = (type, size) => {
      switch (type) {
        case "diamond":
          return `M0,${-size / 2} L${size / 2},0 L0,${size / 2} L${-size / 2},0 Z`;
        case "square":
          return `M${-size / 2},${-size / 2} H${size / 2} V${size / 2} H${-size / 2} Z`;
        default:
          return "";
      }
    };
  }

  wrangle() {
    this.x.domain(this.data.labels);

    let [yMin, yMax] = d3.extent(d3.merge(this.data.series.map((d) => (Array.isArray(d.data[0]) ? d3.merge(d.data) : d.data))));
    const yExtent = yMax - yMin;
    yMin = yMin - yExtent * 0.2;
    yMax = yMax + yExtent * 0.2;
    if (this.yMin !== undefined) yMin = this.yMin;
    if (this.yMax !== undefined) yMax = this.yMax;
    this.y.domain([yMin, yMax]).nice();

    this.yTicks = d3.range(this.y.domain()[0], this.y.domain()[1] + this.yStep, this.yStep);

    this.color.domain(this.data.series.map((d) => d.name)).range(this.data.series.map((d) => d.color));

    this.barSeries = this.data.series[0];
    this.barSeries.data = this.barSeries.data.map((d) => d.sort(d3.ascending));
    this.symbolSeries = this.data.series[1];

    this.potentialLabels = this.data.labels.map((_, i) => [
      {
        key: "symbol",
        fixed: true,
        value: this.symbolSeries.data[i],
        size: this.symbolSize + this.labelTextPadding,
      },
    ]);

    this.symbolLabels = this.data.labels.map((_, i) => ({
      text: this.formatYValue(this.symbolSeries.data[i]),
      value: this.symbolSeries.data[i],
    }));
  }

  scaffold() {
    this.outerContainer = d3.select(this.el).classed("v v-range-bar-symbol", true);
    this.controlsContainer = this.outerContainer.append("div").attr("class", "controls-container");
    this.container = this.outerContainer.append("div").attr("class", "inner-container");
    new VExport({
      elContainer: this.controlsContainer.node(),
      el: this.container.node(),
      filename: exportName,
    });

    this.scaffoldLegend();
    this.renderLegend();
    this.scaffoldChart();
  }

  scaffoldLegend() {
    this.legendContainer = this.container.append("div").attr("class", "swatches");
  }

  scaffoldChart() {
    this.chartContainer = this.container.append("div").attr("class", "chart-container");

    this.svg = this.chartContainer.append("svg").attr("class", "chart-svg").attr("height", this.height);

    this.xAxisG = this.svg.append("g").attr("class", "axis-g");
    this.yAxisG = this.svg.append("g").attr("class", "axis-g");
    this.barsG = this.svg.append("g").attr("class", "bars-g");
    this.symbolsG = this.svg.append("g").attr("class", "symbols-g");
    this.labelsG = this.svg.append("g").attr("class", "labels-g").attr("text-anchor", "middle");
  }

  resized() {
    this.width = Math.max(this.chartContainer.node().clientWidth, this.minWidth);
    this.height = this.chartContainer.node().clientHeight;

    this.x.range([this.marginLeft, this.width - this.marginRight]);

    this.y.range([this.height - this.marginBottom, this.marginTop]);

    this.svg.attr("width", this.width).attr("viewBox", [0, 0, this.width, this.height]);

    this.render();
  }

  computeLabelPositions() {
    this.labels = this.potentialLabels.map(([symbol, ...barLabels]) => {
      let labels = [
        { ...symbol, y: this.y(symbol.value) },
        ...barLabels.map((barLabel, i) => {
          let y;
          if (this.y(barLabel.value) >= this.y(symbol.value)) {
            if (i === 0) {
              y = Math.max(this.y(barLabel.value) + barLabel.size / 2, this.y(symbol.value) + symbol.size / 2 + barLabel.size / 2);
            } else {
              y = this.y(barLabel.value) - barLabel.size / 2;
              if (y - this.y(symbol.value) < barLabel.size / 2 + symbol.size / 2) y = this.y(symbol.value) - symbol.size / 2 - barLabel.size / 2;
            }
          } else {
            if (i === 0) {
              y = this.y(barLabel.value) + barLabel.size / 2;
              if (this.y(symbol.value) - y < barLabel.size / 2 + symbol.size / 2) y = this.y(symbol.value) + symbol.size / 2 + barLabel.size / 2;
            } else {
              y = Math.min(this.y(barLabel.value) - barLabel.size / 2, this.y(symbol.value) - symbol.size / 2 - barLabel.size / 2);
            }
          }
          return {
            ...barLabel,
            y,
          };
        }),
      ].sort((a, b) => d3.ascending(a.y, b.y));
      return labels;
    });
  }

  render() {
    this.renderXAxis();
    this.renderYAxis();
    this.renderBars();
    this.renderSymbols();
    this.computeLabelPositions();
    this.renderLabels();
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
              .attr("d", (_, i, n) => this.symbolPath(i === n.length - 1 ? "diamond" : "square", this.legendSize))
          )
          .call((div) => div.append("div").attr("class", "swatch__label"))
      )
      .call((div) => div.select("path").attr("fill", (d) => this.color(d)))
      .call((div) => div.select(".swatch__label").text((d) => d));
  }

  renderXAxis() {
    this.xAxisG
      .attr("transform", `translate(0,${this.height - this.marginBottom})`)
      .call(d3.axisBottom(this.x).tickSize(0).tickPadding(16))
      .call((g) => g.selectAll(".tick text").call(this.wrapLabelText, this.x.bandwidth()));
  }

  renderYAxis() {
    this.yAxisG.attr("transform", `translate(${this.marginLeft},0)`).call(d3.axisLeft(this.y).tickSize(6).tickPadding(10).tickFormat(this.formatYTick).tickValues(this.yTicks));
  }

  renderBars() {
    this.barsG
      .attr("fill", this.color(this.barSeries.name))
      .selectAll(".bar-rect")
      .data(this.barSeries.data)
      .join((enter) => enter.append("rect").attr("class", "bar-rect"))
      .attr("x", (_, i) => this.x(this.data.labels[i]))
      .attr("width", this.x.bandwidth())
      .attr("y", (d) => Math.min(this.y(d[0]), this.y(d[1])))
      .attr("height", (d) => Math.abs(this.y(d[0]) - this.y(d[1])));
  }

  renderSymbols() {
    this.symbolsG
      .attr("fill", this.color(this.symbolSeries.name))
      .selectAll(".symbol-path")
      .data(this.symbolSeries.data)
      .join((enter) => enter.append("path").attr("class", "symbol-path").attr("d", this.symbolPath("diamond", this.symbolSize)))
      .attr("transform", (d, i) => `translate(${this.x(this.data.labels[i]) + this.x.bandwidth() / 2},${this.y(d)})`);
  }

  renderLabels() {
    this.labelsG
      .selectAll(".labels-group-g")
      .data(this.labels)
      .join((enter) => enter.append("g").attr("class", "labels-group-g"))
      .attr("transform", (_, i) => `translate(${this.x(this.data.labels[i]) + this.x.bandwidth() / 2},0)`)
      .call((g) =>
        g
          .selectAll(".label-text--bar-label")
          .data(
            (d) => d,
            (d) => d.key
          )
          .join((enter) => enter.append("text").attr("dy", "0.35em").attr("class", `label-text label-text--bar-label`))
          .text((d) => d.text)
          .attr("y", (d) => d.y)
      )
      .call((g) =>
        g
          .selectAll(".label-text--symbol-label")
          .data((d, i) => [this.symbolLabels[i]])
          .join((enter) => enter.append("text").attr("dy", "0.35em").attr("class", `label-text label-text--symbol-label`).attr("text-anchor", "start"))
          .text((d) => d.text)
          .attr("x", this.symbolSize / 2 + 4)
          .attr("y", (d) => this.y(d.value))
      );
  }

  wrapLabelText(text, width) {
    text.each(function () {
      var text = d3.select(this),
        words = text.text().split(/\s+/).reverse(),
        word,
        line = [],
        lineNumber = 0,
        lineHeight = 1.1, // ems
        y = text.attr("y"),
        dy = parseFloat(text.attr("dy")),
        tspan = text
          .text(null)
          .append("tspan")
          .attr("x", 0)
          .attr("y", y)
          .attr("dy", dy + "em");
      while ((word = words.pop())) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > width) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = text
            .append("tspan")
            .attr("x", 0)
            .attr("y", y)
            .attr("dy", ++lineNumber * lineHeight + dy + "em")
            .text(word);
        }
      }
    });
  }

  updateData(data) {
    this.data = data;
    this.wrangle();
    this.renderLegend();
    this.resized();
  }
}

class VExport {
  constructor({ elContainer, el, filename }) {
    this.elContainer = elContainer;
    this.el = el;
    this.filename = filename;
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

  // init() {
  //   this.container = d3.select(this.elContainer).append("div").attr("class", "v-export");
  //   ths.pngExportButton = this.container.append("button").text("Export PNG").on("click", this.exportPNG);
  // }

  async exportPNG() {
    // this.pngExportButton.attr("disabled", "disabled");
    const style = getComputedStyle(this.el);
    const textColor = style.getPropertyValue("--color-text");
    const haloStrokeColor = style.getPropertyValue("--color-background");
    const textColorExport = "#fff";
    const haloStrokeColorExport = "#222F45";
    try {
      d3.select(this.el).style("--color-text", textColorExport);
      d3.select(this.el).style("--color-background", haloStrokeColorExport);
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
      this.pngExportButton.attr("disabled", undefined);
    } catch (error) {
      this.pngExportButton.attr("disabled", undefined);
      console.error(error);
      throw new Error("Oops, something went wrong when exporting PNG.");
    } finally {
      d3.select(this.el).style("--color-text", textColor);
      d3.select(this.el).style("--color-background", haloStrokeColor);
    }
  }
}

async function fetchData(filters) {
  const xAxis = [];
  const range = [];
  const symbol = [];

  var fields = [xAxisField, minRange, maxRange, symbolField];
  var groupby = [xAxisField];

  if (filters === "none" || filters.length === 0) {
    var filter = [];
    var maxQuarter = await getMaxQuarter();
    quarterFilter = `'${quarterDateField}' = '${maxQuarter}'`;
    filter.push(quarterFilter);
    var query = `/data/v1/${datasets[0]}?fields=${fields.join()}&filter=${filter.join()}&groupby='${groupby}'&orderby='${sortField}'`;
  } else {
    var query = `/data/v1/${datasets[0]}?fields=${fields.join(",")}&groupby='${groupby.join()}'&filter=${filters.join(",")}&orderby='${sortField}'`;
  }
  const data = await domo.get(query);

  data.forEach((item) => {
    xAxis.push(item[xAxisField]);
    range.push([item[minRange], item[maxRange]]);

    symbol.push(item[symbolField]);
  });

  return { xAxis, range, symbol };
}

async function renderChart(filters) {
  var { xAxis, range, symbol } = await fetchData(filters);

  const data = {
    series: [
      {
        name: barLabel,
        data: range,
        color: barColor,
      },
      {
        name: symbolLabel,
        data: symbol,
        color: symbolColor,
      },
    ],
    labels: xAxis,
  };

  //sample data
  // const data = {
  //   series: [
  //     {
  //       name: "IP Target",
  //       data: [
  //         [0.21, 0.3],
  //         [0.23, 0.3],
  //         [0.15, 0.21],
  //         [0.01, 0.07],
  //         [0.09, 0.15],
  //         [0.09, 0.14],
  //         [0.001, 0.04],
  //       ],
  //       color: "#B7015C",
  //     },
  //     {
  //       name: "IP Portfolio",
  //       data: [0.24, 0.23, 0.16, 0.07, 0.07, 0, 0.04],
  //       color: "#C8DE00",
  //     },
  //   ],
  //   labels: ["Apt", "Whs", "Ofc", "Ret", "Alts", "Ldg", "Oth"],
  // };

  async function getMaxQuarter() {
    var maxDate = [];
    var sql = `SELECT MAX(${quarterDateField} FROM datasets[0] LIMIT 1)`;
    await domo.post(`/sql/v1/${datasets[0]}`, `SELECT MAX("${quarterDateField}") FROM ${datasets[0]}`, { contentType: "text/plain" }).then(function (data) {
      maxDate = data.rows[0];
    });
    return maxDate;
  }

  chart = new VRangeBarSymbol({
    el: document.getElementById("rangeBarSymbolChart"),
    data: data,
    yMin: yMinValue,
    yMax: yMaxValue,
  });
}
async function getMaxQuarter() {
  var maxDate = [];
  var sql = `SELECT MAX(${quarterDateField} FROM datasets[0] LIMIT 1)`;
  await domo.post(`/sql/v1/${datasets[0]}`, `SELECT MAX("${quarterDateField}") FROM ${datasets[0]}`, { contentType: "text/plain" }).then(function (data) {
    maxDate = data.rows[0];
  });
  return maxDate;
}

async function updateChart(filters) {
  var { xAxis, range, symbol } = await fetchData(filters);
  const data = {
    series: [
      {
        name: barLabel,
        data: range,
        color: barColor,
      },
      {
        name: symbolLabel,
        data: symbol,
        color: symbolColor,
      },
    ],
    labels: xAxis,
  };

  chart.updateData(data);
}

renderChart("none");
