# テキスト

## タスク

Web アプリを作成しました
以下の内容を追加して、コードの修正した点を提示して

## 追加内容

グラフをホバーしたときに対応してる markArea の名前も表示してほしい

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
              <div class="card-header">MarkArea 表示/非表示</div>
              <div class="card-body control-panel" id="mark-area-controls">
                <!-- MarkAreaのチェックボックスがここに動的に挿入されます -->
              </div>
            </div>

            <!-- チャンネルコントロール -->
            <div class="card" id="channel-card">
              <div class="card-header">チャンネル 表示/非表示</div>
              <div class="card-body control-panel" id="channel-controls">
                <!-- チャンネルのチェックボックスがここに動的に挿入されます -->
              </div>
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
        {
          type: "inside",
          xAxisIndex: Array.from({ length: totalVisibleChannels }, (_, i) => i),
        },
      ],
    };

    // グラフコンテナの高さを動的に調整
    chartContainer.style.height = `${totalVisibleChannels * 30}px`; // 各チャンネルに30px割り当て

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
