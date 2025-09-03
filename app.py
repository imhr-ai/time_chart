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
