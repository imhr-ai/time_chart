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
  // --- ▼▼▼ ここからが追加点 ▼▼▼ ---
  const createGraphButton = document.getElementById("create-graph-button");
  // --- ▲▲▲ 追加点はここまで ▲▲▲ ---

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
    controlsPanelGroup.style.display = "none";
    loadingSpinner.classList.remove("d-none");
    markAreaControls.innerHTML = "";
    channelControls.innerHTML = "";
    createGraphButton.disabled = true; // ボタンを無効化

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

  // --- ▼▼▼ ここからが追加点 ▼▼▼ ---
  /**
   * 「グラフを作成」ボタンの有効/無効を切り替える関数
   */
  function toggleCreateGraphButton() {
    const selectedChannels = Array.from(channelVisibility.values()).filter(
      (v) => v
    ).length;
    createGraphButton.disabled = selectedChannels === 0;
  }

  // 「グラフを作成」ボタンのクリックイベント
  createGraphButton.addEventListener("click", () => {
    const selectedChannels = originalChannels.filter((channel) =>
      channelVisibility.get(channel)
    );

    if (selectedChannels.length === 0) {
      alert("グラフを作成するチャンネルを1つ以上選択してください。");
      return;
    }

    // グラフ作成に必要なデータを準備
    const graphData = {
      time: fullOriginalData["Time"] || [],
      series: [],
    };

    selectedChannels.forEach((channel) => {
      graphData.series.push({
        name: channel,
        data: fullOriginalData[channel] || [],
      });
    });

    // sessionStorageにデータを保存して新しいタブを開く
    // データが大きい場合、localStorageやsessionStorageには限界があるため注意
    try {
      sessionStorage.setItem("graphDataForNewTab", JSON.stringify(graphData));
      window.open("/graph", "_blank");
    } catch (e) {
      console.error("Failed to save data to sessionStorage:", e);
      showError(
        "グラフ用データを一時保存できませんでした。データが大きすぎる可能性があります。"
      );
    }
  });
  // --- ▲▲▲ 追加点はここまで ▲▲▲ ---

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
    controlsPanelGroup.style.display = "block";

    if (myChart) {
      myChart.dispose();
    }
    myChart = echarts.init(chartContainer);

    originalChannels = apiData.channels;
    fullOriginalData = apiData.data;
    originalMarkAreaData = apiData.markAreaData;

    markAreaVisibility.clear();
    originalMarkAreaData.forEach((_, index) => {
      markAreaVisibility.set(`mark_area_${index}`, true);
    });

    channelVisibility.clear();
    originalChannels.forEach((channel) => {
      channelVisibility.set(channel, true);
    });

    generateMarkAreaControls(originalMarkAreaData, markAreaVisibility);
    generateChannelControls(originalChannels, channelVisibility);
    updateChart();
    toggleCreateGraphButton(); // --- ◀◀◀ 変更点: ボタンの状態を初期化
  }

  function generateMarkAreaControls(markAreaData, markAreaVisibility) {
    markAreaControls.innerHTML = "";

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

      const checkbox = div.querySelector("input[type='checkbox']");
      checkbox.addEventListener("change", (event) => {
        markAreaVisibility.set(markAreaId, event.target.checked);
        updateChart();
        event.target.blur();
      });
    });

    document.getElementById("select-all-markareas").onclick = () => {
      markAreaData.forEach((_, index) =>
        markAreaVisibility.set(`mark_area_${index}`, true)
      );
      updateChart();
      markAreaControls
        .querySelectorAll("input[type='checkbox']")
        .forEach((cb) => (cb.checked = true));
    };

    document.getElementById("deselect-all-markareas").onclick = () => {
      markAreaData.forEach((_, index) =>
        markAreaVisibility.set(`mark_area_${index}`, false)
      );
      updateChart();
      markAreaControls
        .querySelectorAll("input[type='checkbox']")
        .forEach((cb) => (cb.checked = false));
    };
  }

  function generateChannelControls(channels, channelVisibility) {
    channelControls.innerHTML = "";

    channels.forEach((channel) => {
      const div = document.createElement("div");
      div.className = "form-check mark-area-item";
      div.innerHTML = `
        <input
          class="form-check-input"
          type="checkbox"
          value="${channel}"
          id="checkbox-${channel}"
          ${channelVisibility.get(channel) ? "checked" : ""}
        >
        <label class="form-check-label" for="checkbox-${channel}">
          <span class="mark-area-color-box" style="background-color: #333;"></span>
          ${channel}
        </label>
      `;
      channelControls.appendChild(div);

      const checkbox = div.querySelector("input[type='checkbox']");
      checkbox.addEventListener("change", (event) => {
        channelVisibility.set(channel, event.target.checked);
        updateChart();
        toggleCreateGraphButton(); // --- ◀◀◀ 変更点: ボタンの状態を更新
        event.target.blur();
      });
    });

    document.getElementById("select-all-channels").onclick = () => {
      channels.forEach((ch) => channelVisibility.set(ch, true));
      updateChart();
      channelControls
        .querySelectorAll("input[type='checkbox']")
        .forEach((cb) => (cb.checked = true));
      toggleCreateGraphButton(); // --- ◀◀◀ 変更点: ボタンの状態を更新
    };

    document.getElementById("deselect-all-channels").onclick = () => {
      channels.forEach((ch) => channelVisibility.set(ch, false));
      updateChart();
      channelControls
        .querySelectorAll("input[type='checkbox']")
        .forEach((cb) => (cb.checked = false));
      toggleCreateGraphButton(); // --- ◀◀◀ 変更点: ボタンの状態を更新
    };
  }

  function updateChart() {
    // (この関数の中身は変更ありません)
    if (
      !myChart ||
      !originalChannels ||
      !fullOriginalData ||
      !originalMarkAreaData
    )
      return;
    const dataLength = fullOriginalData[originalChannels[0]]
      ? fullOriginalData[originalChannels[0]].length
      : 0;
    const visibleIndices = new Set(
      Array.from({ length: dataLength }, (_, i) => i)
    );
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
    const filteredMarkAreas = [];
    const originalIndexToFilteredIndex = new Map();
    sortedVisibleIndices.forEach((originalIdx, filteredIdx) => {
      originalIndexToFilteredIndex.set(originalIdx, filteredIdx);
    });
    originalMarkAreaData.forEach((area, index) => {
      if (markAreaVisibility.get(`mark_area_${index}`)) {
        const newStart = originalIndexToFilteredIndex.get(area.range[0]);
        const newEnd = originalIndexToFilteredIndex.get(area.range[1]);
        if (newStart !== undefined && newEnd !== undefined) {
          filteredMarkAreas.push([
            {
              xAxis: newStart,
              itemStyle: { color: area.color },
              name: area.name,
              label: {
                show: false,
              },
            },
            { xAxis: newEnd },
          ]);
        }
      }
    });
    const totalVisibleChannels = visibleChannels.length;
    const containerHeightRatio = 95;
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
        formatter: function (params) {
          let tooltipContent = "";
          const timeValue = params[0].axisValue;
          tooltipContent += `Time: <b>${timeValue}</b><br/>`;
          const currentXIndex = params[0].dataIndex;
          const relevantMarkArea = originalMarkAreaData.find((area, index) => {
            if (!markAreaVisibility.get(`mark_area_${index}`)) return false;
            const originalStart = area.range[0];
            const originalEnd = area.range[1];
            const filteredStart =
              originalIndexToFilteredIndex.get(originalStart);
            const filteredEnd = originalIndexToFilteredIndex.get(originalEnd);
            return (
              currentXIndex >= filteredStart && currentXIndex <= filteredEnd
            );
          });
          if (relevantMarkArea) {
            tooltipContent += `MarkArea: <span style="font-weight: bold; color:${relevantMarkArea.color.replace(
              /, 0\.\d+\)/,
              ", 1)"
            )}">${relevantMarkArea.name}</span><br/>`;
          }
          params.forEach(function (item) {
            tooltipContent += `${item.marker} ${item.seriesName}: <b>${item.value}</b><br/>`;
          });
          return tooltipContent;
        },
      },
      grid: visibleChannels.map((_, index) => ({
        top: `${(index / totalVisibleChannels) * containerHeightRatio + 0.5}%`,
        height: "30px",
        left: "310px",
        right: "30px",
      })),
      xAxis: visibleChannels.map((_, index) => ({
        gridIndex: index,
        type: "category",
        data: filteredTimeData,
        show: index === totalVisibleChannels - 1,
        axisLabel: {
          show: index === totalVisibleChannels - 1,
          formatter: function (value) {
            return value;
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
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
        min: -2,
        max: 2,
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
        data: filteredSeriesData[channel],
        xAxisIndex: index,
        yAxisIndex: index,
        showSymbol: false,
        lineStyle: { width: 1, color: "#333" },
        sampling: "lttb",
        markArea: {
          silent: true,
          data: filteredMarkAreas,
        },
      })),
      dataZoom: [
        {
          type: "slider",
          xAxisIndex: Array.from({ length: totalVisibleChannels }, (_, i) => i),
          bottom: "1%",
          height: 20,
        },
        {
          type: "inside",
          xAxisIndex: Array.from({ length: totalVisibleChannels }, (_, i) => i),
        },
      ],
    };
    chartContainer.style.height = `${totalVisibleChannels * 32 + 100}px`;
    myChart.setOption(newOption, { notMerge: true });
    myChart.resize();
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
