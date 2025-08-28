document.addEventListener("DOMContentLoaded", () => {
  const csvFileInput = document.getElementById("csvFile");
  const uploadButton = document.getElementById("uploadButton");
  const loadingSpinner = document.getElementById("loading");
  const errorAlert = document.getElementById("error-alert");
  const chartContainer = document.getElementById("chart-container");

  // EChartsインスタンスを保持する変数
  let myChart = null;

  uploadButton.addEventListener("click", async () => {
    const file = csvFileInput.files[0];
    if (!file) {
      showError("CSVファイルを選択してください。");
      return;
    }

    // UIをリセット
    hideError();
    chartContainer.style.display = "none";
    loadingSpinner.classList.remove("d-none");

    // FormDataオブジェクトを作成してファイルを格納
    const formData = new FormData();
    formData.append("file", file);

    try {
      // バックエンドにファイルをPOST
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

      // グラフ描画関数を呼び出し
      renderChart(apiData);
    } catch (error) {
      showError(error.message);
    } finally {
      // ローディングスピナーを非表示
      loadingSpinner.classList.add("d-none");
    }
  });

  /**
   * EChartsでグラフを描画する関数
   * @param {{channels: string[], data: {[key: string]: number[]}}} apiData
   */
  function renderChart(apiData) {
    chartContainer.style.display = "block";
    if (myChart) {
      myChart.dispose();
    }
    myChart = echarts.init(chartContainer);

    const channels = apiData.channels;
    const seriesData = apiData.data;
    const totalChannels = channels.length;
    const containerHeightRatio = 95; // コンテナの高さの95%をグラフ描画領域として使用

    const option = {
      tooltip: {
        trigger: "axis",
      },
      grid: channels.map((_, index) => ({
        top: `${(index / totalChannels) * containerHeightRatio + 0.5}%`,
        height: `${containerHeightRatio / totalChannels}%`,
        // ★ 変更点: 横向きラベルのためのスペースを確保
        left: "100px", // 以前は '120px' や '10%' だったかもしれません
        right: "30px",
      })),
      xAxis: channels.map((_, index) => ({
        gridIndex: index,
        type: "category",
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
        // ★ 変更点: ラベルとグラフの間の距離を調整
        nameGap: 30,
        nameRotate: 0,

        // ★★★ ここが今回の修正の核心部分です ★★★
        nameTextStyle: {
          // 2. テキストを右揃えにする (見た目が綺麗になる)
          align: "right",
          fontWeight: "bold",
          fontSize: 12,
          color: "#d9534f",
          // テキストがコンテナからはみ出した場合の処理
          overflow: "truncate",
          width: 60, // テキストの最大幅を指定
        },
        // ★★★★★★★★★★★★★★★★★★★★★★★★

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

        // ★★★ 重要変更点: サンプリングを有効にする ★★★
        sampling: "lttb", // Largest-Triangle-Three-Bucketsアルゴリズムを使用
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

    myChart.setOption(option);
  }

  function showError(message) {
    errorAlert.textContent = message;
    errorAlert.classList.remove("d-none");
  }

  function hideError() {
    errorAlert.classList.add("d-none");
  }

  // ウィンドウリサイズ時にチャートもリサイズ
  window.addEventListener("resize", () => {
    if (myChart) {
      myChart.resize();
    }
  });
});
