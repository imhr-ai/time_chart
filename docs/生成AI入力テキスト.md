# テキスト

## タスク

以下の URL に作成した web アプリに以下の機能を追加して
[time-chart](https://github.com/imhr-ai/time_chart)

## 追加内容

グラフの上部に markArea と色が紐づいたリストをつけたい
チェックボックスをつけて、その部分の表示・非表示をコントロールしたい

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
import io
from typing import Literal

import polars as pl
import polars.selectors as cs
from flask import Flask, Response, jsonify, render_template, request

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
        csv_data = file.read()
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

        plot_channels = df.select(cs.starts_with("CH_")).columns
        data_dict = df.to_dict(as_series=False)

        response_data = {
            "channels": plot_channels,
            "data": data_dict,
            "markAreaData": mark_area_data,
        }

        return jsonify(response_data)

    except Exception as e:
        return jsonify({"error": f"ファイルの処理中にエラーが発生しました: {e!s}"}), 500


if __name__ == "__main__":
    app.run(debug=True)


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
    <style>
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
    </style>
  </head>
  <body>
    <div class="container mt-4">
      <div class="card">
        <div class="card-header">
          <h3>CSVデータ可視化ツール</h3>
        </div>
        <div class="card-body">
          <p class="card-text">
            150カラム x 6000行程度のCSVファイルを想定しています。
          </p>
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

      <!-- EChartsを描画するコンテナ -->
      <div id="chart-container" class="mt-4" style="display: none"></div>
    </div>

    <!-- EChartsライブラリ -->
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <!-- カスタムJavaScript -->
    <script src="{{ url_for('static', filename='js/script.js') }}"></script>
  </body>
</html>
```

static/js/script.js

```js
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
```
