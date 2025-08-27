import time

import numpy as np
import polars as pl

# --- 設定 ---
NUM_ROWS = 6000
NUM_COLUMNS = 150
OUTPUT_FILENAME = "sample_ecg_data.csv"


def generate_ecg_data() -> pl.DataFrame:
    """150カラム x 6000行の心電図風データを生成し、Polars DataFrameとして返す関数"""
    print(f" generating data for {NUM_ROWS} rows and {NUM_COLUMNS} columns...")

    # 各カラムの名前を生成 ('CH_1', 'CH_2', ...)
    column_names = [f"CH_{i + 1}" for i in range(NUM_COLUMNS)]

    # データ全体を格納する辞書
    data_dict = {}

    # 全ての波形の基準となるX軸(時間軸のようなもの)を生成
    # 20*pi にすることで約10周期のサイン波が基準になる
    x = np.linspace(0, 20 * np.pi, NUM_ROWS)

    rng = np.random.default_rng(0)

    # 各カラムのデータをループで生成
    for i in range(NUM_COLUMNS):
        col_name = column_names[i]

        # --- 各カラムで波形にバリエーションを持たせる ---
        # 1. 周波数: 10カラムごとに少しずつ周波数を変える
        frequency_mod = 1 + (i % 10) * 0.1
        # 2. 位相: 全てのカラムで少しずつ波形の開始位置をずらす
        phase_shift = (i / NUM_COLUMNS) * np.pi
        # 3. 振幅: 各カラムでランダムに振幅を変える
        amplitude = 1.0 + rng.random() * 0.5
        # 4. ノイズ: 正規分布に従う小さな乱数を加える
        noise = rng.standard_normal(NUM_ROWS) * 0.15

        # サイン波をベースに波形を計算
        wave = amplitude * np.sin(x * frequency_mod + phase_shift) + noise

        # 特徴的な波形を追加(例: 20カラムごとにランダムな位置にスパイクを入れる)
        if i > 0 and i % 20 == 0:
            spike_position = rng.integers(NUM_ROWS // 4, 3 * NUM_ROWS // 4)
            spike_height = rng.uniform(3, 5)
            wave[spike_position] *= spike_height
            # スパイクを滑らかにする
            if spike_position > 0:
                wave[spike_position - 1] *= spike_height / 2
            if spike_position < NUM_ROWS - 1:
                wave[spike_position + 1] *= spike_height / 2

        data_dict[col_name] = wave

    # 辞書からPolars DataFrameを作成
    df = pl.DataFrame(data_dict)
    return df


def main() -> None:
    """メイン処理"""
    start_time = time.time()

    # データの生成
    df = generate_ecg_data()

    print(f"Data generation complete. Shape: {df.shape}")
    print(f"Writing DataFrame to '{OUTPUT_FILENAME}'...")

    # DataFrameをCSVファイルに書き出し
    try:
        df.write_csv(OUTPUT_FILENAME)
        end_time = time.time()

        print("\n" + "=" * 40)
        print(" Success!")
        print(f" Successfully created '{OUTPUT_FILENAME}'")
        print(f" Shape: {df.height} rows x {df.width} columns")
        print(f" Time taken: {end_time - start_time:.2f} seconds")
        print("=" * 40)

    except Exception as e:
        print(f"Error writing to file: {e}")


if __name__ == "__main__":
    main()
