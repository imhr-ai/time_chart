# テキスト

## タスク

作成した web アプリに以下の機能を追加して

## 追加内容

csv の step 列をもとに、波形の背景を変えたい
step1 なら青、step2 なら緑みたいな

```js
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
```

series に markArea を追加して色を変えたい

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
from flask import Flask, Response, jsonify, render_template, request

app = Flask(__name__)


# ルートURLにアクセスした際にindex.htmlを返す
@app.route("/")
def index() -> str:
    return render_template("index.html")


# /upload URLにCSVファイルがPOSTされた際の処理
@app.route("/upload", methods=["POST"])
def upload_csv() -> (
    tuple[Response, Literal[400]] | Response | tuple[Response, Literal[500]]
):
    # ファイルがリクエストに含まれているかチェック
    if "file" not in request.files:
        return jsonify({"error": "ファイルがありません"}), 400

    file = request.files["file"]

    # ファイル名が空でないかチェック
    if file.filename == "":
        return jsonify({"error": "ファイルが選択されていません"}), 400

    try:
        # アップロードされたファイルをメモリ上で直接Polarsに読み込ませる
        # (一度ディスクに保存しないため高速)
        csv_data = file.read()
        df = pl.read_csv(io.BytesIO(csv_data))

        # EChartsに渡すためのJSONを作成
        # 1. カラム名のリスト
        channels = df.columns
        # 2. 各カラムのデータを辞書形式で
        # {'col1': [v1, v2, ...], 'col2': [v1, v2, ...]}
        data_dict = df.to_dict(as_series=False)

        # データをJSONとしてフロントエンドに返す
        return jsonify(
            {
                "channels": channels,
                "data": data_dict,
            },
        )

    except Exception as e:
        # Polarsでの読み込みエラーなど
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
```
