class VStackedBar {
  constructor({ el, data, xAxisTickLabelAngle = 45, totalSymbolColor = "currentColor" }) {
    this.el = el;
    this.data = data;
    this.xAxisTickLabelAngle = Math.max(Math.min(xAxisTickLabelAngle, 90), 0);
    this.totalSymbolColor = totalSymbolColor;
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
    this.marginBottom = 0; // dynamically determined by x axis labels
    this.marginLeft = 64;
    this.legendSize = 16;
    this.symbolSize = 20;
    this.symbolLabelTextSize = 20;
    this.labelTextPadding = 4;

    this.formatYTick = d3.format("~f");
    this.formatYValue = d3.format(".1~f");

    this.x = d3.scaleBand().paddingOuter(0.2).paddingInner(0.4);

    this.y = d3.scaleLinear();

    this.color = d3.scaleOrdinal();

    this.symbolPath = (type, size) => {
      switch (type) {
        case "square":
          return `M${-size / 2},${-size / 2} H${size / 2} V${size / 2} H${-size / 2} Z`;
        case "diamond":
          return `M0,${-size / 2} L${size / 2},0 L0,${size / 2} L${-size / 2},0 Z`;
        default:
          return "";
      }
    };
  }

  wrangle() {
    this.color.domain([...this.data.series.map((d) => d.name), "Total"]).range([...this.data.series.map((d) => d.color), this.totalSymbolColor]);

    this.x.domain(this.data.labels);

    this.barSeries = this.data.series.map((d) => ({
      ...d,
      data: d.data.map((d) => d || 0),
    }));
    let stacked = Array(this.barSeries[0].data.length).fill(0);
    this.barSeries.forEach((d) => {
      d.stacked = d.data.map((e, i) => [stacked[i], (stacked[i] += e)]);
    });

    this.symbolSeries = this.barSeries[this.barSeries.length - 1].stacked.map((d, i) => ({
      name: this.data.labels[i],
      total: d[1],
    }));

    let yMax = d3.max(this.barSeries[this.barSeries.length - 1].stacked, (d) => d[1]);
    const yMin = 0;
    const yExtent = yMax - yMin;
    yMax = yMax + yExtent * 0.2;
    this.y.domain([yMin, yMax]).nice();
  }

  scaffold() {
    this.container = d3.select(this.el).append("div").attr("class", "v-stacked-bar");
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

    this.svg.attr("width", this.width).attr("viewBox", [0, 0, this.width, this.height]);

    this.render();
  }

  render() {
    this.renderXAxis();
    this.renderYAxis();
    this.renderBars();
    this.renderSymbols();
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
      .call(d3.axisBottom(this.x).tickSize(0))
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
        .ticks((this.height - this.marginTop - this.marginBottom) / 80)
    );
  }

  renderBars() {
    this.barsG
      .selectAll(".series-g")
      .data(this.barSeries, (d) => d.name)
      .join((enter) => enter.append("g").attr("class", "series-g"))
      .attr("fill", (d) => this.color(d.name))
      .selectAll(".bar-rect")
      .data((d) => d.stacked)
      .join((enter) => enter.append("rect").attr("class", "bar-rect"))
      .attr("x", (_, i) => this.x(this.data.labels[i]))
      .attr("width", this.x.bandwidth())
      .attr("y", (d) => this.y(d[1]))
      .attr("height", (d) => this.y(d[0]) - this.y(d[1]));
  }

  renderSymbols() {
    this.symbolsG
      .selectAll(".symbol-path")
      .data(this.symbolSeries, (d) => d.name)
      .join((enter) => enter.append("path").attr("class", "symbol-path").attr("d", this.symbolPath("diamond", this.symbolSize)))
      .attr("fill", this.totalSymbolColor)
      .attr("transform", (d) => `translate(${this.x(d.name) + this.x.bandwidth() / 2},${this.y(d.total)})`);
  }

  renderLabels() {
    this.labelsG
      .selectAll(".label-text")
      .data(this.symbolSeries, (d) => d.name)
      .join((enter) => enter.append("text").attr("class", "label-text label-text--symbol-label"))
      .attr("x", (d) => this.x(d.name) + this.x.bandwidth() / 2)
      .attr("y", (d) => this.y(d.total) - this.symbolSize / 2 - this.labelTextPadding)
      .text((d) => this.formatYValue(d.total));
  }

  updateData(data) {
    this.data = data;
    this.wrangle();
    this.renderLegend();
    this.resized();
  }
}

const data0 = {
  series: [
    {
      name: "Account Value",
      data: [240, 464, 343, 123, 234, 187, 57, null],
      color: "#00697A",
    },
    {
      name: "Return of Capital",
      data: [120, null, 45, 66, null, 87, 10, null],
      color: "#C9005C",
    },
    {
      name: "Return on Capital",
      data: [25, null, 12, null, null, null, 47, 88],
      color: "#C4DE00",
    },
  ],
  labels: ["MS Prime", "DWS RREEF", "Clarion LIT", "USAA Eagle", "BX BPP EUR", "AEW CPT", "USAA Rockwall Co-Invest", "BX BPP Ind Co-Invest"],
};

const chart = new VStackedBar({
  el: document.getElementById("stackedBarChart"),
  data: data0,
  totalSymbolColor: "#C7CCCE",
});
