document.addEventListener("DOMContentLoaded", () => {
  const chartContainer = document.getElementById("chart-container");
  const xAxisSelector = document.getElementById("xAxisSelector");
  let myChart = null;
  let graphData = null;

  chartContainer.innerHTML =
    '<div class="d-flex justify-content-center align-items-center h-100"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="ms-3">グラフデータを待っています...</p></div>';

  window.addEventListener(
    "message",
    (event) => {
      if (event.origin !== window.location.origin) {
        console.warn(`Message from unexpected origin: ${event.origin}`);
        return;
      }

      try {
        graphData = event.data;

        if (!graphData || !graphData.fullData || !graphData.selectedChannels) {
          throw new Error("受信したグラフデータが無効です。");
        }

        myChart = echarts.init(chartContainer);

        populateXAxisSelector(graphData.xAxisCandidates);

        // --- ▼▼▼ ここからが追加点 ▼▼▼ ---
        // X軸の初期値を 'Time' に設定する (候補に存在する場合)
        const initialXAxis = "Time";
        if (graphData.xAxisCandidates.includes(initialXAxis)) {
          xAxisSelector.value = initialXAxis;
        }
        // --- ▲▲▲ 追加点はここまで ▲▲▲ ---

        xAxisSelector.addEventListener("change", () => {
          updateGraph();
        });

        // 初期グラフを描画
        updateGraph();
      } catch (e) {
        console.error("グラフの描画中にエラーが発生しました:", e);
        chartContainer.innerHTML =
          '<div class="alert alert-danger">グラフの描画中にエラーが発生しました。</div>';
      }
    },
    { once: true }
  );

  /**
   * X軸セレクターに選択肢を追加する関数
   * @param {string[]} candidates - X軸の候補となるカラム名の配列
   */
  function populateXAxisSelector(candidates) {
    if (!candidates || candidates.length === 0) {
      xAxisSelector.parentElement.style.display = "none";
      return;
    }
    xAxisSelector.innerHTML = "";
    candidates.forEach((candidate) => {
      const option = document.createElement("option");
      option.value = candidate;
      option.textContent = candidate;
      xAxisSelector.appendChild(option);
    });
  }

  /**
   * ドロップダウンで選択されたX軸に基づいてグラフを更新・描画する関数
   */
  function updateGraph() {
    const selectedXAxis = xAxisSelector.value;
    if (!selectedXAxis) {
      return;
    }

    const allData = graphData.fullData;
    const xAxisData = allData[selectedXAxis];
    const yAxisChannels = graphData.selectedChannels;

    const series = yAxisChannels.map((channel) => ({
      name: channel,
      type: "line",
      data: xAxisData.map((xValue, i) => [xValue, allData[channel][i]]),
      showSymbol: false,
      sampling: "lttb",
      lineStyle: {
        width: 1.5,
      },
    }));

    const legendData = yAxisChannels;

    const option = {
      tooltip: {
        trigger: "axis",
        position: (pt) => [pt[0], "10%"],
      },
      legend: {
        data: legendData,
        top: 10,
        type: "scroll",
      },
      grid: {
        left: "5%",
        right: "5%",
        top: "60px",
        bottom: "80px",
      },
      xAxis: {
        type: "value",
        scale: true,
      },
      yAxis: {
        type: "value",
        scale: true,
      },
      dataZoom: [
        {
          type: "inside",
          start: 0,
          end: 100,
        },
        {
          type: "slider",
          start: 0,
          end: 100,
          bottom: 20,
        },
      ],
      series: series,
    };

    myChart.setOption(option, true);
  }

  window.addEventListener("resize", () => {
    if (myChart) {
      myChart.resize();
    }
  });
});
