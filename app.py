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
