document.addEventListener("DOMContentLoaded", () => {
  const csvFileInput = document.getElementById("csvFile");
  const uploadButton = document.getElementById("uploadButton");
  const loadingSpinner = document.getElementById("loading");
  const errorAlert = document.getElementById("error-alert");
  const chartContainer = document.getElementById("chart-container");
  const controlsPanelGroup = document.getElementById("controls-panel-group");
  const markAreaCard = document.getElementById("mark-area-card");
  const markAreaControls = document.getElementById("mark-area-controls");
  const channelCard = document.getElementById("channel-card");
  const channelControls = document.getElementById("channel-controls");

  let myChart = null;
  let originalChannels = []; // オリジナルのCH_チャンネル名を保持
  let fullOriginalData = {}; // Timeカラムを含む、APIから取得した全てのオリジナルデータを保持
  let originalMarkAreaData = []; // APIから取得したオリジナルのmarkAreaDataを保持

  let markAreaVisibility = new Map(); // markAreaの表示/非表示状態を保持
  let channelVisibility = new Map(); // 各チャンネルの表示/非表示状態を保持

  uploadButton.addEventListener("click", async () => {
    const file = csvFileInput.files[0];
    if (!file) {
      showError("CSVファイルを選択してください。");
      return;
    }

    hideError();
    chartContainer.style.display = "none";
    controlsPanelGroup.style.display = "none"; // アップロード時は非表示
    loadingSpinner.classList.remove("d-none");
    markAreaControls.innerHTML = ""; // 既存のチェックボックスをクリア
    channelControls.innerHTML = ""; // 既存のチェックボックスをクリア

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
   *   channels: string[], // CH_で始まるカラム名のみ
   *   data: {[key: string]: (number|string)[]}, // Timeカラムを含む全データ
   *   markAreaData: {name: string, color: string, range: [number, number]}[]
   * }} apiData
   */
  function renderChart(apiData) {
    chartContainer.style.display = "block";
    controlsPanelGroup.style.display = "block"; // グラフ表示時にコントロールも表示

    if (myChart) {
      myChart.dispose();
    }
    myChart = echarts.init(chartContainer);

    originalChannels = apiData.channels; // CH_チャンネル名を保存
    fullOriginalData = apiData.data; // Timeカラムを含む全データを保存
    originalMarkAreaData = apiData.markAreaData; // オリジナルmarkAreaデータを保存

    // markAreaのIDと初期表示状態を管理
    markAreaVisibility.clear(); // 新しいデータなのでクリア
    originalMarkAreaData.forEach((area, index) => {
      markAreaVisibility.set(`mark_area_${index}`, true); // デフォルトで表示
    });

    // チャンネルのIDと初期表示状態を管理
    channelVisibility.clear(); // 新しいデータなのでクリア
    originalChannels.forEach((channel) => {
      channelVisibility.set(channel, true); // デフォルトで表示
    });

    // MarkAreaコントロールを生成
    generateMarkAreaControls(originalMarkAreaData, markAreaVisibility);
    // チャンネルコントロールを生成
    generateChannelControls(originalChannels, channelVisibility);

    // 初期表示に合わせてグラフデータとmarkAreaを更新
    updateChart();
  }

  /**
   * MarkAreaの表示/非表示を切り替えるコントロールを生成する関数
   * @param {{name: string, color: string, range: [number, number]}[]} markAreaData
   * @param {Map<string, boolean>} markAreaVisibility
   */
  function generateMarkAreaControls(markAreaData, markAreaVisibility) {
    markAreaControls.innerHTML = ""; // 既存のコントロールをクリア

    markAreaData.forEach((area, index) => {
      const markAreaId = `mark_area_${index}`;
      const div = document.createElement("div");
      div.className = "form-check mark-area-item";
      div.innerHTML = `
        <input
          class="form-check-input"
          type="checkbox"
          value="${markAreaId}"
          id="checkbox-${markAreaId}"
          ${markAreaVisibility.get(markAreaId) ? "checked" : ""}
        >
        <label class="form-check-label" for="checkbox-${markAreaId}">
          <span class="mark-area-color-box" style="background-color: ${area.color.replace(
            /, 0\.\d+\)/,
            ", 1)"
          )};"></span>
          ${area.name} (idx: ${area.range[0]} - ${area.range[1]})
        </label>
      `;
      markAreaControls.appendChild(div);

      div
        .querySelector("input[type='checkbox']")
        .addEventListener("change", (event) => {
          markAreaVisibility.set(markAreaId, event.target.checked);
          updateChart(); // グラフ全体を更新
        });
    });
  }

  /**
   * チャンネルの表示/非表示を切り替えるコントロールを生成する関数
   * @param {string[]} channels
   * @param {Map<string, boolean>} channelVisibility
   */
  function generateChannelControls(channels, channelVisibility) {
    channelControls.innerHTML = ""; // 既存のコントロールをクリア

    channels.forEach((channel) => {
      const div = document.createElement("div");
      div.className = "form-check mark-area-item"; // スタイルを流用
      div.innerHTML = `
        <input
          class="form-check-input"
          type="checkbox"
          value="${channel}"
          id="checkbox-${channel}"
          ${channelVisibility.get(channel) ? "checked" : ""}
        >
        <label class="form-check-label" for="checkbox-${channel}">
          <span class="mark-area-color-box" style="background-color: #333;"></span> <!-- チャンネル共通の色 -->
          ${channel}
        </label>
      `;
      channelControls.appendChild(div);

      div
        .querySelector("input[type='checkbox']")
        .addEventListener("change", (event) => {
          channelVisibility.set(channel, event.target.checked);
          updateChart(); // グラフ全体を更新
        });
    });
  }

  /**
   * markAreaとチャンネルの表示/非表示状態に基づいてグラフ全体を更新する関数
   */
  function updateChart() {
    if (
      !myChart ||
      !originalChannels ||
      !fullOriginalData ||
      !originalMarkAreaData
    )
      return;

    // --- 表示するデータポイントのインデックスを決定 ---
    const dataLength = fullOriginalData[originalChannels[0]]
      ? fullOriginalData[originalChannels[0]].length
      : 0;
    const visibleIndices = new Set(
      Array.from({ length: dataLength }, (_, i) => i)
    );

    // 非表示にするmarkAreaの範囲をvisibleIndicesから削除
    originalMarkAreaData.forEach((area, index) => {
      if (!markAreaVisibility.get(`mark_area_${index}`)) {
        for (let i = area.range[0]; i <= area.range[1]; i++) {
          visibleIndices.delete(i);
        }
      }
    });
    const sortedVisibleIndices = Array.from(visibleIndices).sort(
      (a, b) => a - b
    );

    // --- フィルタリングされたTimeデータと各CH_チャンネルのデータを再構築 ---
    let filteredTimeData = [];
    if (fullOriginalData["Time"]) {
      filteredTimeData = sortedVisibleIndices.map(
        (idx) => fullOriginalData["Time"][idx]
      );
    } else {
      filteredTimeData = Array.from(
        { length: sortedVisibleIndices.length },
        (_, i) => i
      );
    }

    const filteredSeriesData = {};
    const visibleChannels = originalChannels.filter((channel) =>
      channelVisibility.get(channel)
    );

    visibleChannels.forEach((channel) => {
      const originalChannelData = fullOriginalData[channel];
      filteredSeriesData[channel] = sortedVisibleIndices.map(
        (idx) => originalChannelData[idx]
      );
    });

    // --- markAreaデータを再構築し、新しいX軸インデックスにマッピング ---
    const filteredMarkAreas = [];
    originalMarkAreaData.forEach((area, index) => {
      if (markAreaVisibility.get(`mark_area_${index}`)) {
        let newStart = -1;
        let newEnd = -1;

        for (let i = 0; i < sortedVisibleIndices.length; i++) {
          if (sortedVisibleIndices[i] === area.range[0]) {
            newStart = i;
          }
          if (sortedVisibleIndices[i] === area.range[1]) {
            newEnd = i;
          }
        }
        if (newStart !== -1 && newEnd !== -1) {
          filteredMarkAreas.push([
            { xAxis: newStart, itemStyle: { color: area.color } },
            { xAxis: newEnd },
          ]);
        }
      }
    });

    // --- EChartsオプションの再構築 ---
    const totalVisibleChannels = visibleChannels.length;
    const containerHeightRatio = 95;

    // 表示するチャンネルがない場合は、空のグラフを表示
    if (totalVisibleChannels === 0) {
      myChart.setOption(
        {
          tooltip: {},
          grid: [],
          xAxis: [],
          yAxis: [],
          series: [],
          dataZoom: [],
        },
        { notMerge: true }
      );
      return;
    }

    const newOption = {
      tooltip: {
        trigger: "axis",
      },
      grid: visibleChannels.map((_, index) => ({
        top: `${(index / totalVisibleChannels) * containerHeightRatio + 0.5}%`,
        height: `${containerHeightRatio / totalVisibleChannels}%`,
        left: "100px",
        right: "30px",
      })),
      xAxis: visibleChannels.map((_, index) => ({
        gridIndex: index,
        type: "category",
        data: filteredTimeData, // フィルタリングされたTimeデータを使用
        show: index === totalVisibleChannels - 1,
        axisLabel: {
          show: index === totalVisibleChannels - 1,
          formatter: function (value) {
            // Timeデータの表示形式を調整 (必要に応じてカスタマイズ)
            return value;
          },
        },
      })),
      yAxis: visibleChannels.map((channel, index) => ({
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
      series: visibleChannels.map((channel, index) => ({
        name: channel,
        type: "line",
        data: filteredSeriesData[channel], // フィルタリングされたデータを使用
        xAxisIndex: index,
        yAxisIndex: index,
        showSymbol: false,
        lineStyle: { width: 1, color: "#333" },
        sampling: "lttb",
        markArea: {
          silent: true,
          data: filteredMarkAreas, // フィルタリングされたmarkAreaデータを使用
        },
      })),
      dataZoom: [
        {
          type: "slider",
          xAxisIndex: Array.from({ length: totalVisibleChannels }, (_, i) => i),
          // start: 0,
          // end: Math.min(
          //   100,
          //   filteredTimeData.length > 0
          //     ? (100 * 10) / filteredTimeData.length
          //     : 100
          // ),
          // スライダーの初期範囲を調整
          bottom: "1%",
          height: 20,
        },
      ],
    };

    // グラフコンテナの高さを動的に調整
    chartContainer.style.height = `${totalVisibleChannels * 30}px`; // 各チャンネルに30px割り当て

    myChart.setOption(newOption, { notMerge: true });
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
