// Available globals
var domo = window.domo;
var datasets = window.datasets;

//chart settings
let datasetId = "8b21d5f3-11f5-41f8-bbb9-43d5506a6058";

var bar1Label = "Income Return";
var bar1Field = "Income Return";
var bar1Color = "#C9005C";

var bar2Label = "Appreciation Return";
var bar2Field = "App Return";
var bar2Color = "#009BC8";

var symbolLabel = "Total Return";
var symbolField = "Total Return";
var symbolColor = "#C4DF00";

var xAxisField = "Asset";

var groupingField = "Benchmark Type";
let quarterFilterField = "Year-Quarter";
let quarterDateField = "Quarter End Date";

var sortField = "Asset_Sort";

//Export File Name
let exportName = "1 QTR Portfolio Performance";

var exportBackground = "#ffffff00";
var exportFontColor = "white";
var exportShadowColor = "#222f45";

var legendSizing = 16;

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
      outputString = `'${quarterFilterField}' = ${datasetSpecificFilters[i].values}`;

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

class VStackedBarSymbol {
  constructor({ el, data }) {
    this.el = el;
    this.data = data;
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
    this.marginBottom = 80;
    this.marginLeft = 64;
    this.legendSize = legendSizing;
    this.symbolSize = 20;
    this.barLabelTextSize = 14;
    this.symbolLabelTextSize = 20;
    this.labelTextPadding = 6;

    this.formatYTick = d3.format("~%");
    this.formatYValue = d3.format(".1~%");

    this.x = d3.scaleBand().paddingOuter(0.1).paddingInner(0.2);

    this.y = d3.scaleLinear();

    this.color = d3.scaleOrdinal();

    this.symbolPath = (type, size) => {
      switch (type) {
        case "triangle":
          return `M0,${-size / 2} L${size / 2},${size / 2} H${-size / 2} Z`;
        case "square":
          return `M${-size / 2},${-size / 2} H${size / 2} V${size / 2} H${-size / 2} Z`;
        default:
          return "";
      }
    };
  }

  wrangle() {
    this.x.domain(this.data.labels1);

    this.groupLabels = Array.from(
      d3.rollup(
        d3.zip(this.data.labels1, this.data.labels2),
        (v) => ({
          start: v[0][0],
          end: v[v.length - 1][0],
        }),
        (d) => d[1]
      ),
      ([key, v]) => ({
        key,
        ...v,
      })
    );

    let [yMin, yMax] = d3.extent(d3.merge(this.data.series.map((d) => d.data)));
    const yExtent = yMax - yMin;
    yMin = yMin - yExtent * 0.2;
    yMax = yMax + yExtent * 0.2;
    if (yMin > 0) {
      yMin = 0;
    } else if (yMax < 0) {
      yMax = 0;
    }
    this.y.domain([yMin, yMax]).nice();

    this.color.domain(this.data.series.map((d) => d.name)).range(this.data.series.map((d) => d.color));

    this.barSeries = this.data.series.slice(0, -1);
    const transformed = this.data.labels1.map((d, i) =>
      this.barSeries.reduce((t, e) => {
        t[e.name] = e.data[i];
        return t;
      }, {})
    );
    const stack = d3
      .stack()
      .keys(this.barSeries.map((d) => d.name))
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetDiverging);
    const stacked = stack(transformed);
    this.barSeries.forEach((d, i) => {
      d.stacked = stacked[i];
    });

    this.symbolSeries = this.data.series.slice(-1);

    this.potentialLabels = this.data.labels1.map((d, j) => [
      ...this.symbolSeries.map((e, i) => ({
        key: `symbol-${i}`,
        fixed: true,
        value: e.data[j],
        size: this.symbolSize + this.labelTextPadding,
      })),
      ...this.symbolSeries.map((e, i) => ({
        key: `symbol-label-${i}`,
        text: this.formatYValue(e.data[j]),
        value: e.data[j],
        size: this.symbolLabelTextSize + this.labelTextPadding,
        type: "symbol-label",
      })),
      ...this.barSeries.map((e, i) => ({
        key: `bar-label-${i}`,
        text: this.formatYValue(e.data[j]),
        value: d3.mean(e.stacked[j]), // label in the middle of the bar
        size: this.barLabelTextSize + this.labelTextPadding,
        type: "bar-label",
      })),
    ]);
  }

  scaffold() {
    this.outerContainer = d3.select(this.el).classed("v v-stacked-bar-symbol", true);
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
    this.labels = this.potentialLabels.map(([symbol, symbolLabel, ...barLabels]) => {
      const ySymbolLabel = symbolLabel.value >= 0 ? this.y(symbolLabel.value) - symbol.size / 2 - symbolLabel.size / 2 : this.y(symbolLabel.value) + symbol.size / 2 + symbolLabel.size / 2;
      let labels = [
        { ...symbol, y: this.y(symbol.value) },
        {
          ...symbolLabel,
          y: ySymbolLabel,
        },
        ...barLabels.map((barLabel) => ({
          ...barLabel,
          y: this.y(barLabel.value) > this.y(symbol.value) ? Math.max(this.y(barLabel.value), this.y(symbol.value) + symbol.size / 2 + barLabel.size / 2) : Math.min(this.y(barLabel.value), this.y(symbol.value) - symbol.size / 2 - barLabel.size / 2),
        })),
      ].sort((a, b) => d3.ascending(a.y, b.y));

      const symbolIndex = labels.findIndex((d) => d.fixed);
      let upDodgingLabels = labels
        .slice(0, symbolIndex + 1)
        .reverse()
        .map((d) => Object.assign({}, d));
      let downDodgingLabels = labels.slice(symbolIndex).map((d) => Object.assign({}, d));
      this.dodge(upDodgingLabels, false);
      this.dodge(downDodgingLabels, true);
      return [...upDodgingLabels.slice(1).reverse(), ...downDodgingLabels.slice(1)];
    });
  }

  dodge(labels, isDownDodging) {
    for (let i = 1; i < labels.length; i++) {
      const curr = labels[i];
      const prev = labels[i - 1];
      curr.y = isDownDodging ? Math.max(curr.y, prev.y + prev.size / 2 + curr.size / 2) : Math.min(curr.y, prev.y - prev.size / 2 - curr.size / 2);
    }
  }

  render() {
    this.renderXAxis();
    this.renderYAxis();
    this.renderBars();
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
              .attr("d", (_, i, n) => this.symbolPath(i === n.length - 1 ? "triangle" : "square", this.legendSize))
          )
          .call((div) => div.append("div").attr("class", "swatch__label"))
      )
      .call((div) => div.select("path").attr("fill", (d) => this.color(d)))
      .call((div) => div.select(".swatch__label").text((d) => d));
  }

  renderXAxis() {
    this.xAxisG.attr("transform", `translate(0,${this.height - this.marginBottom})`);

    this.xAxisG
      .selectAll(".axis-g__row-1")
      .data([0])
      .join((enter) => enter.append("g").attr("class", "axis-g axis-g__row-1"))
      .call(d3.axisBottom(this.x).tickSize(0).tickPadding(16))
      .call((g) => g.select(".domain").remove())
      .call((g) => g.selectAll(".tick text").call(this.wrapLabelText, this.x.bandwidth()));

    this.xAxisG
      .selectAll(".axis-g__row-2")
      .data([0])
      .join((enter) => enter.append("g").attr("class", "axis-g axis-g__row-2").attr("text-anchor", "middle"))
      .selectAll(".tick")
      .data(this.groupLabels, (d) => d.key)
      .join((enter) =>
        enter
          .append("g")
          .attr("class", "tick")
          .call((g) => g.append("line").attr("stroke", "currentColor"))
          .call((g) => g.append("text").attr("fill", "currentColor").attr("dy", "1em"))
      )
      .attr("transform", (d) => `translate(${this.x(d.start) - (this.x.step() - this.x.bandwidth()) / 2},0)`)
      .call((g) =>
        g
          .select("line")
          .attr("y1", -this.height + this.marginBottom + this.marginTop)
          .attr("y2", this.marginBottom - 4)
          .attr("opacity", (_, i) => (i === 0 ? 0 : 1))
      )
      .call((g) =>
        g
          .select("text")
          .attr("x", (d) => (this.x(d.end) + this.x.step() - this.x(d.start)) / 2)
          .attr("y", this.marginBottom - 20)
          .text((d) => d.key)
      );
  }

  renderYAxis() {
    this.yAxisG
      .attr("transform", `translate(${this.marginLeft},0)`)
      .call(
        d3
          .axisLeft(this.y)
          .tickSize(6)
          .tickPadding(10)
          .tickFormat(this.formatYTick)
          .ticks((this.height - this.marginTop - this.marginBottom) / 40)
      )
      .call((g) =>
        g
          .selectAll(".tick")
          .filter((d) => d === 0)
          .select("line")
          .attr("x1", this.width - this.marginLeft - this.marginRight)
      );
  }

  renderBars() {
    this.barsG
      .selectAll(".bars-group-g")
      .data(this.data.labels1)
      .join((enter) => enter.append("g").attr("class", "bars-group-g"))
      .attr("transform", (d) => `translate(${this.x(d)},0)`)
      .call((g) =>
        g
          .selectAll(".bar-rect")
          .data(this.barSeries, (d) => d.name)
          .join((enter) => enter.append("rect").attr("class", "bar-rect"))
          .attr("fill", (d) => this.color(d.name))
          .attr("width", this.x.bandwidth())
          .each((d, i, n) => {
            const label = d3.select(n[i].parentNode).datum();
            const index = this.data.labels1.findIndex((e) => e === label);
            const [v0, v1] = d.stacked[index];
            d3.select(n[i])
              .attr("y", Math.min(this.y(v0), this.y(v1)))
              .attr("height", Math.abs(this.y(v0) - this.y(v1)));
          })
      )
      .call((g) =>
        g
          .selectAll(".symbol-path")
          .data(this.symbolSeries, (d) => d.name)
          .join((enter) => enter.append("path").attr("class", "symbol-path").attr("d", this.symbolPath("triangle", this.symbolSize)))
          .attr("fill", (d) => this.color(d.name))
          .each((d, i, n) => {
            const label = d3.select(n[i].parentNode).datum();
            const index = this.data.labels1.findIndex((e) => e === label);
            const v = d.data[index];
            d3.select(n[i]).attr("transform", `translate(${this.x.bandwidth() / 2},${this.y(v)})`);
          })
      );
  }

  renderLabels() {
    this.labelsG
      .selectAll(".labels-group-g")
      .data(this.labels)
      .join((enter) => enter.append("g").attr("class", "labels-group-g"))
      .attr("transform", (d, i) => `translate(${this.x(this.data.labels1[i]) + this.x.bandwidth() / 2},0)`)
      .selectAll(".label-text")
      .data(
        (d) => d,
        (d) => d.key
      )
      .join((enter) => enter.append("text").attr("dy", "0.35em"))
      .attr("class", (d) => `label-text label-text--${d.type}`)
      .text((d) => d.text)
      .attr("y", (d) => d.y);
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
  const bar1 = [];
  const bar2 = [];
  const symbol = [];
  const grouping = [];

  var fields = [xAxisField, bar1Field, bar2Field, symbolField, groupingField];
  var groupby = [xAxisField, groupingField];

  var formattedGroupby = groupby.map((field) => (field.includes(" ") ? `'${field}'` : field));

  if (filters === "none" || filters.length === 0) {
    var filter = [];
    var maxQuarter = await getMaxQuarter();
    quarterFilter = `'${quarterDateField}' = '${maxQuarter}'`;
    filter.push(quarterFilter);
    var query = `/data/v1/${datasets[0]}?fields=${fields.join()}&groupby=${formattedGroupby.join()}&filter=${filter.join()}&orderby=${sortField}`;
  } else {
    // firstFilter = [`'Time Range' = "1YR"`];
    // filters.push(firstFilter);
    var query = `/data/v1/${datasets[0]}?fields=${fields.join(",")}&groupby=${formattedGroupby.join()}&filter=${filters.join(",")}&orderby='${sortField}'`;
  }
  const data = await domo.get(query);

  data.forEach((item) => {
    xAxis.push(item[xAxisField]);
    bar1.push(item[bar1Field]);
    bar2.push(item[bar2Field]);
    symbol.push(item[symbolField]);
    grouping.push(item[groupingField]);
  });
  return { xAxis, bar1, bar2, symbol, grouping };
}

async function renderChart(filters) {
  var { xAxis, bar1, bar2, symbol, grouping } = await fetchData(filters);

  const data = {
    //   series: [
    //     {
    //       name: "Income",
    //       data: [0.1, 0.2, 1.5, 2.5, -0.8, 0.6, 0.6, 0.8],
    //       color: "#fb8072",
    //     },
    //     {
    //       name: "Appreciation",
    //       data: [0.1, -0.3, -1.6, -1.5, -2.3, 2.0, -4.0, -4.5],
    //       color: "#80b1d3",
    //     },
    //     {
    //       name: "Total Return",
    //       data: [0.2, -0.1, -0.1, 1, -3.1, 2.6, -3.4, -3.7],
    //       color: "#ffed6f",
    //     },
    //   ],
    //   labels: ["IP CORE", "Global ODCE", "IP Core+", "Core + 100", "IP Non-Core", "ODCE +250 bps", "IP Portfolio", "Blended Benchmark"],
    // };
    series: [
      {
        name: bar1Label,
        data: bar1,
        color: bar1Color,
      },
      {
        name: bar2Label,
        data: bar2,
        color: bar2Color,
      },
      {
        name: symbolLabel,
        data: symbol,
        color: symbolColor,
      },
    ],
    labels1: xAxis,
    labels2: grouping,
  };

  chart = new VStackedBarSymbol({
    el: document.getElementById("stackedBarSymbolChart"),
    data,
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
  var { xAxis, bar1, bar2, symbol, grouping } = await fetchData(filters);
  const data = {
    series: [
      {
        name: bar1Label,
        data: bar1,
        color: bar1Color,
      },
      {
        name: bar2Label,
        data: bar2,
        color: bar2Color,
      },
      {
        name: symbolLabel,
        data: symbol,
        color: symbolColor,
      },
    ],
    labels1: xAxis,
    labels2: grouping,
  };

  chart.updateData(data);
}

renderChart("none");
