import io
from typing import Any

import polars as pl
import polars.selectors as cs


def process_df(csv_data: bytes) -> dict[str, list[str] | dict[str, list[Any]]]:
    df = pl.read_csv(io.BytesIO(csv_data))

    mark_area_data = []
    if "step" in df.columns:
        # (MarkAreaの処理は変更なし)
        distinct_colors = [
            "rgba(114, 147, 203, 0.2)",
            "rgba(225, 151, 76, 0.2)",
            "rgba(132, 186, 91, 0.2)",
            "rgba(211, 94, 96, 0.2)",
            "rgba(128, 133, 133, 0.2)",
            "rgba(144, 103, 167, 0.2)",
            "rgba(171, 104, 87, 0.2)",
            "rgba(204, 194, 16, 0.2)",
            "rgba(100, 192, 203, 0.2)",
        ]
        num_palette_colors = len(distinct_colors)
        unique_steps = df["step"].unique(maintain_order=True).to_list()
        step_colors = {
            step: distinct_colors[i % num_palette_colors]
            for i, step in enumerate(unique_steps)
        }
        default_color = "rgba(128, 128, 128, 0.1)"
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
                    "name": step_name,
                    "color": step_colors.get(step_name, default_color),
                    "range": [row["start"], row["end"]],
                },
            )

    plot_columns = ["Time"] if "Time" in df.columns else []
    plot_columns.extend(df.select(cs.starts_with("CH_")).columns)
    plot_columns = list(dict.fromkeys(plot_columns))
    df_selected = df.select(plot_columns)
    data_dict = df_selected.to_dict(as_series=False)

    # --- ▼▼▼ ここからが追加点 ▼▼▼ ---
    # X軸の候補として、数値型のカラムをすべてリストアップする
    x_axis_candidates = df_selected.select(cs.numeric()).columns
    x_axis_candidates.insert(0, "Time")

    # もし"Time"が候補にあれば、リストの先頭に移動させてデフォルトにする
    if "Time" in x_axis_candidates:
        x_axis_candidates.remove("Time")
        x_axis_candidates.insert(0, "Time")
    # --- ▲▲▲ 追加点はここまで ▲▲▲ ---

    print(x_axis_candidates)

    response_data = {
        "channels": df.select(
            cs.starts_with("CH_"),
        ).columns,
        "data": data_dict,
        "markAreaData": mark_area_data,
        "xAxisCandidates": x_axis_candidates,  # X軸候補のリストを追加
    }

    return response_data
