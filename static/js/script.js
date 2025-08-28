document.addEventListener("DOMContentLoaded", () => {
  const csvFileInput = document.getElementById("csvFile");
  const uploadButton = document.getElementById("uploadButton");
  const loadingSpinner = document.getElementById("loading");
  const errorAlert = document.getElementById("error-alert");
  const chartContainer = document.getElementById("chart-container");

  let myChart = null;

  uploadButton.addEventListener("click", async () => {
    const file = csvFileInput.files[0];
    if (!file) {
      showError("CSVファイルを選択してください。");
      return;
    }

    hideError();
    chartContainer.style.display = "none";
    loadingSpinner.classList.remove("d-none");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            `サーバーエラーが発生しました (Status: ${response.status})`
        );
      }

      const apiData = await response.json();
      renderChart(apiData);
    } catch (error) {
      showError(error.message);
    } finally {
      loadingSpinner.classList.add("d-none");
    }
  });

  /**
   * EChartsでグラフを描画する関数
   * @param {{
   *   channels: string[],
   *   data: {[key: string]: (number|string)[]},
   *   markAreaData: {name: string, color: string, range: [number, number]}[]
   * }} apiData
   */
  function renderChart(apiData) {
    chartContainer.style.display = "block";
    if (myChart) {
      myChart.dispose();
    }
    myChart = echarts.init(chartContainer);

    const channels = apiData.channels;
    const seriesData = apiData.data;
    const markAreaData = apiData.markAreaData;

    // --- ▼▼▼ ここからが注釈削除の変更点 ▼▼▼ ---

    // 背景色用のmarkAreaデータをEChartsのフォーマットに変換
    const markAreas = markAreaData.map((area) => {
      return [
        // 開始点
        {
          // 'name' プロパティを削除することで、"step1"等のラベルが非表示になる
          xAxis: area.range[0],
          itemStyle: {
            color: area.color,
          },
        },
        // 終了点
        {
          xAxis: area.range[1],
        },
      ];
    });

    // --- ▲▲▲ 注釈削除の変更点はここまで ▲▲▲ ---

    const totalChannels = channels.length;
    const containerHeightRatio = 95;

    const option = {
      tooltip: {
        trigger: "axis",
      },
      grid: channels.map((_, index) => ({
        top: `${(index / totalChannels) * containerHeightRatio + 0.5}%`,
        height: `${containerHeightRatio / totalChannels}%`,
        left: "100px",
        right: "30px",
      })),
      xAxis: channels.map((_, index) => ({
        gridIndex: index,
        type: "category",
        // x軸のデータポイント数が多いので、Time列を使うよりインデックスが安定
        data: Array.from(
          { length: seriesData[channels[0]].length },
          (_, i) => i
        ),
        show: index === totalChannels - 1,
        axisLabel: {
          show: index === totalChannels - 1,
        },
      })),
      yAxis: channels.map((channel, index) => ({
        gridIndex: index,
        type: "value",
        name: channel,
        nameLocation: "middle",
        nameGap: 30,
        nameRotate: 0,
        nameTextStyle: {
          align: "right",
          fontWeight: "bold",
          fontSize: 12,
          color: "#d9534f",
          overflow: "truncate",
          width: 60,
        },
        min: -4,
        max: 4,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: {
          show: true,
          lineStyle: { color: "#f0f0f0", type: "dashed" },
        },
      })),
      series: channels.map((channel, index) => ({
        name: channel,
        type: "line",
        data: seriesData[channel],
        xAxisIndex: index,
        yAxisIndex: index,
        showSymbol: false,
        lineStyle: { width: 1, color: "#333" },
        sampling: "lttb",

        // --- ▼▼▼ ここが今回の機能の核心部 ▼▼▼ ---
        markArea: {
          silent: true, // markArea上でマウスイベントを無効化
          data: markAreas,
        },
        // --- ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ---
      })),
      dataZoom: [
        {
          type: "slider",
          xAxisIndex: Array.from({ length: totalChannels }, (_, i) => i),
          start: 0,
          end: 10,
          bottom: "1%",
          height: 20,
        },
      ],
    };

    myChart.setOption(option, { notMerge: true });
  }

  function showError(message) {
    errorAlert.textContent = message;
    errorAlert.classList.remove("d-none");
  }

  function hideError() {
    errorAlert.classList.add("d-none");
  }

  window.addEventListener("resize", () => {
    if (myChart) {
      myChart.resize();
    }
  });
});
