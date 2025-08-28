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
                        "name": step_name,  # nameはJavaScript側で使わないが、念のため残す
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
