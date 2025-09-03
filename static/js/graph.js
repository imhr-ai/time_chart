document.addEventListener("DOMContentLoaded", () => {
  const chartContainer = document.getElementById("chart-container");
  let myChart = null;

  // sessionStorageからデータを取得
  const storedData = sessionStorage.getItem("graphDataForNewTab");

  if (!storedData) {
    chartContainer.innerHTML =
      '<div class="alert alert-danger">グラフデータを読み込めませんでした。元のタブから再度グラフを作成してください。</div>';
    return;
  }

  try {
    const graphData = JSON.parse(storedData);
    // データを読み込んだら不要なので削除
    sessionStorage.removeItem("graphDataForNewTab");

    // EChartsのインスタンスを初期化
    myChart = echarts.init(chartContainer);

    // seriesとlegendのデータを生成
    const series = graphData.series.map((s) => ({
      name: s.name,
      type: "line",
      data: s.data,
      showSymbol: false,
      sampling: "lttb", // データが多い場合に備えてサンプリングを有効化
      lineStyle: {
        width: 1.5,
      },
    }));

    const legendData = graphData.series.map((s) => s.name);

    // EChartsのオプションを設定
    const option = {
      tooltip: {
        trigger: "axis",
        position: function (pt) {
          return [pt[0], "10%"];
        },
      },
      legend: {
        data: legendData,
        top: 10,
        type: "scroll", // 凡例が多い場合にスクロール可能にする
      },
      grid: {
        left: "5%",
        right: "5%",
        top: "60px", // legendの高さに応じて調整
        bottom: "80px", // dataZoomの高さに応じて調整
      },
      xAxis: {
        type: "category",
        data: graphData.time,
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        boundaryGap: [0, "10%"],
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

    // オプションを適用してグラフを描画
    myChart.setOption(option);
  } catch (e) {
    console.error("Failed to parse graph data or render chart:", e);
    chartContainer.innerHTML =
      '<div class="alert alert-danger">グラフの描画中にエラーが発生しました。</div>';
  }

  // ウィンドウリサイズ時にグラフもリサイズ
  window.addEventListener("resize", () => {
    if (myChart) {
      myChart.resize();
    }
  });
});
