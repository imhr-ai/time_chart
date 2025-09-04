# テキスト

## タスク

Web アプリを作成しました
以下の内容を追加して、コードの修正して

## 追加内容

graph.html で表示している x 軸は時間であるが、
ドロップダウンで選択することで、今描画してるデータから x 軸を変更できるようにしてほしい

## 技術仕様

- バックエンド
  - Python
    - flask
    - polars
- フロントエンド
  - html
  - css
    - bootstrap
  - javascript
    - echarts

## アプリ仕様

csv をダイアログから指定
polars で読み込み
echarts でカラムごとの折れ線グラフを描画

csv は 150 カラム、6000 行あることを想定

## 作成したコード

app.py

```py
from typing import Literal

from flask import Flask, Response, jsonify, render_template, request

from process_df import process_df

app = Flask(__name__)


@app.route("/")
def index() -> str:
    return render_template("index.html")


# --- ▼▼▼ ここからが追加点 ▼▼▼ ---
@app.route("/graph")
def graph_page() -> str:
    """別タブでグラフを表示するためのページ"""
    return render_template("graph.html")


# --- ▲▲▲ 追加点はここまで ▲▲▲ ---


@app.route("/upload", methods=["POST"])
def upload_csv() -> (
    tuple[Response, Literal[400]] | Response | tuple[Response, Literal[500]]
):
    if "file" not in request.files:
        return jsonify({"error": "ファイルがありません"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "ファイルが選択されていません"}), 400

    try:
        csv_data = file.stream.read()

        response_data = process_df(csv_data)
        return jsonify(response_data)

    except Exception as e:
        return jsonify({"error": f"ファイルの処理中にエラーが発生しました: {e!s}"}), 500


if __name__ == "__main__":
    app.run(debug=True)

```

process_df.py

```py
import io
from typing import Any

import polars as pl
import polars.selectors as cs


def process_df(csv_data: bytes) -> dict[str, list[str] | dict[str, list[Any]]]:
    df = pl.read_csv(io.BytesIO(csv_data))

    mark_area_data = []
    if "step" in df.columns:
        # --- ▼▼▼ ここからが色割り当ての変更点 ▼▼▼ ---

        # はっきりと区別できる色のカラーパレットを定義 (透明度20%)
        # このリストはお好みで変更・追加が可能です
        distinct_colors = [
            "rgba(114, 147, 203, 0.2)",  # Blue
            "rgba(225, 151, 76, 0.2)",  # Orange
            "rgba(132, 186, 91, 0.2)",  # Green
            "rgba(211, 94, 96, 0.2)",  # Red
            "rgba(128, 133, 133, 0.2)",  # Gray
            "rgba(144, 103, 167, 0.2)",  # Purple
            "rgba(171, 104, 87, 0.2)",  # Brown
            "rgba(204, 194, 16, 0.2)",  # Yellow-Green
            "rgba(100, 192, 203, 0.2)",  # Cyan
        ]
        num_palette_colors = len(distinct_colors)

        # step列のユニークな値を出現順に取得
        unique_steps = df["step"].unique(maintain_order=True).to_list()

        # 各stepにカラーパレットから順番に色を割り当てる
        # ステップ数がパレット数を超えたら色は循環する (i % num_palette_colors)
        step_colors = {
            step: distinct_colors[i % num_palette_colors]
            for i, step in enumerate(unique_steps)
        }
        default_color = "rgba(128, 128, 128, 0.1)"

        # --- ▲▲▲ 色割り当ての変更点はここまで ▲▲▲ ---

        # stepごとのインデックス範囲を取得 (この部分は変更なし)
        step_ranges = (
            df.with_row_index("index")
            .group_by("step", maintain_order=True)
            .agg(
                pl.min("index").alias("start"),
                pl.max("index").alias("end"),
            )
        )

        for row in step_ranges.iter_rows(named=True):
            step_name = row["step"]
            mark_area_data.append(
                {
                    "name": step_name,  # nameはJS側で使わないが、念のため残す
                    "color": step_colors.get(step_name, default_color),
                    "range": [row["start"], row["end"]],
                },
            )

    # --- ▼▼▼ 変更点: "Time"カラムも選択してフロントエンドに渡す ▼▼▼ ---
    plot_columns = ["Time"] if "Time" in df.columns else []
    plot_columns.extend(df.select(cs.starts_with("CH_")).columns)

    # plot_columnsから重複を除去(もし"Time"が"CH_"で始まるカラムに含まれる場合のため)
    plot_columns = list(dict.fromkeys(plot_columns))

    df_selected = df.select(plot_columns)
    data_dict = df_selected.to_dict(as_series=False)
    # --- ▲▲▲ 変更点ここまで ▲▲▲ ---

    response_data = {
        "channels": df.select(
            cs.starts_with("CH_"),
        ).columns,  # channelsはCH_のみを渡す
        "data": data_dict,  # Timeカラムを含んだ全データを渡す
        "markAreaData": mark_area_data,
    }

    return response_data

```

temlates/index.html

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CSV Viewer with ECharts</title>
    <!-- Bootstrap CSS -->
    <link
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
      rel="stylesheet"
    />
    <!-- Custom CSS -->
    <link
      rel="stylesheet"
      href="{{ url_for('static', filename='css/style.css') }}"
    />
  </head>
  <body>
    <div class="container mt-4">
      <div class="card">
        <div class="card-header">
          <h3>CSVデータ可視化ツール</h3>
        </div>
        <div class="card-body">
          <div class="input-group">
            <input
              type="file"
              class="form-control"
              id="csvFile"
              accept=".csv"
            />
            <button class="btn btn-primary" type="button" id="uploadButton">
              グラフ描画
            </button>
          </div>
        </div>
      </div>

      <!-- ローディングスピナー -->
      <div id="loading" class="text-center my-4 d-none">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p>データを処理中です。しばらくお待ちください...</p>
      </div>

      <!-- エラー表示エリア -->
      <div
        id="error-alert"
        class="alert alert-danger mt-4 d-none"
        role="alert"
      ></div>

      <!-- コントロールパネルとグラフコンテナ -->
      <div class="row mt-4">
        <div class="col-md-3">
          <div id="controls-panel-group" style="display: none">
            <!-- MarkAreaコントロール -->
            <div class="card mb-3" id="mark-area-card">
              <div
                class="card-header d-flex justify-content-between align-items-center"
              >
                <span>コマンド</span>
                <div
                  class="btn-group"
                  role="group"
                  aria-label="MarkArea 全選択全解除"
                >
                  <button
                    class="btn btn-sm btn-outline-primary"
                    id="select-all-markareas"
                  >
                    全選択
                  </button>
                  <button
                    class="btn btn-sm btn-outline-secondary"
                    id="deselect-all-markareas"
                  >
                    全解除
                  </button>
                </div>
              </div>
              <div class="card-body control-panel" id="mark-area-controls">
                <!-- MarkAreaのチェックボックスがここに動的に挿入されます -->
              </div>
            </div>

            <!-- チャンネルコントロール -->
            <div class="card" id="channel-card">
              <div
                class="card-header d-flex justify-content-between align-items-center"
              >
                <span>ステータス</span>
                <div
                  class="btn-group"
                  role="group"
                  aria-label="MarkArea 全選択全解除"
                >
                  <button
                    class="btn btn-sm btn-outline-primary"
                    id="select-all-channels"
                  >
                    全選択
                  </button>
                  <button
                    class="btn btn-sm btn-outline-secondary"
                    id="deselect-all-channels"
                  >
                    全解除
                  </button>
                </div>
              </div>
              <div class="card-body control-panel" id="channel-controls">
                <!-- チャンネルのチェックボックスがここに動的に挿入されます -->
              </div>
              <!-- --- ▼▼▼ ここからが追加点 ▼▼▼ --- -->
              <div class="card-footer text-center">
                <button
                  class="btn btn-success"
                  id="create-graph-button"
                  disabled
                >
                  選択したチャンネルでグラフを作成
                </button>
              </div>
              <!-- --- ▲▲▲ 追加点はここまで ▲▲▲ --- -->
            </div>
          </div>
        </div>
        <div class="col-md-9">
          <!-- EChartsを描画するコンテナ -->
          <div id="chart-container" style="display: none"></div>
        </div>
      </div>
    </div>

    <!-- EChartsライブラリ -->
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <!-- カスタムJavaScript -->
    <script src="{{ url_for('static', filename='js/script.js') }}"></script>
  </body>
</html>
```

templates/graph.html

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>選択チャンネルのグラフ</title>
    <!-- Bootstrap CSS -->
    <link
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
      rel="stylesheet"
    />
    <style>
      /* グラフコンテナのスタイル */
      #chart-container {
        width: 100%;
        height: 90vh; /* ビューポートの高さの90% */
        min-height: 500px;
        border: 1px solid #dee2e6;
        background-color: white;
      }
    </style>
  </head>
  <body>
    <div class="container-fluid mt-4">
      <div class="card">
        <div class="card-header">
          <h3>選択チャンネルのグラフ</h3>
        </div>
        <div class="card-body">
          <!-- EChartsを描画するコンテナ -->
          <div id="chart-container"></div>
        </div>
      </div>
    </div>

    <!-- EChartsライブラリ -->
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <!-- このページ専用のJavaScript -->
    <script src="{{ url_for('static', filename='js/graph.js') }}"></script>
  </body>
</html>
```

static/css/style.css

```css
body {
  background-color: #f8f9fa;
}
#chart-container {
  width: 100%;
  /* 各チャンネルに30pxを割り当てる想定 (150 * 30px = 4500px) */
  height: 4500px;
  border: 1px solid #dee2e6;
  background-color: white;
}
.control-panel {
  max-height: 400px; /* スクロール可能な高さを設定 */
  overflow-y: auto; /* 縦スクロールを有効にする */
  padding-right: 15px; /* スクロールバーとの間にスペースを確保 */
}
/* スクロールバーのスタイル調整 (任意) */
.control-panel::-webkit-scrollbar {
  width: 8px;
}
.control-panel::-webkit-scrollbar-thumb {
  background-color: #ced4da;
  border-radius: 4px;
}
.control-panel::-webkit-scrollbar-track {
  background-color: #f1f1f1;
}
.mark-area-item {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.mark-area-color-box {
  width: 20px;
  height: 20px;
  border: 1px solid #ccc;
  margin-right: 8px;
  flex-shrink: 0;
}

.mark-area-item label {
  margin-bottom: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex-grow: 1;
}

.mark-area-item input[type="checkbox"] {
  margin-right: 5px;
  cursor: pointer;
}
```

static/js/script.js

```js
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
```

static/js/graph.js

```js
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
```
