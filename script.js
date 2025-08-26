// EChartsを描画するDOM要素を取得
var chartDom = document.getElementById("main");
// EChartsインスタンスを初期化
var myChart = echarts.init(chartDom);

// --- データの準備 ---

// グラフのカラム名リスト
const channels = [
  "I",
  "II",
  "III",
  "aVR",
  "aVL",
  "aVF",
  "V1",
  "V2",
  "V3",
  "V4",
  "V5",
  "V6",
];

// ★ 1. X軸用の時間データを生成
const dataPoints = 200;
const baseTime = new Date(); // 現在時刻を基準にする
const timeData = [];
for (let i = 0; i < dataPoints; i++) {
  // 基準時刻から100ミリ秒ずつ加算した時刻を生成
  timeData.push(new Date(baseTime.getTime() + i * 100));
}

// ★ 2. 各カラムのデータセットを [時間, 値] の形式で生成
const datasets = channels.map((channelName) => {
  // 心電図のPQRST波を簡易的に模したパターン
  const pattern = [0, 0.1, 0.5, 2.5, -1.5, 0.3, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const seriesData = [];
  for (let i = 0; i < dataPoints; i++) {
    const value = pattern[i % pattern.length] + (Math.random() - 0.5) * 0.2;
    // データポイントを [時間, 値] のペアにする
    seriesData.push([timeData[i], value]);
  }

  return {
    name: channelName,
    type: "line",
    showSymbol: false,
    lineStyle: {
      width: 1.5,
      color: "#333",
    },
    data: seriesData, // [時間, 値] の配列をセット
  };
});

// --- EChartsのオプション設定 ---

const option = {
  tooltip: {
    trigger: "axis",
  },
  // ★ 4. レイアウトを微調整
  grid: channels.map((channel, index) => {
    return {
      top: `${index * 7 + 4}%`, // 上マージンを少し詰める
      height: "6.5%", // 各グラフの高さを少し広げる
      left: "8%",
      right: "5%",
    };
  }),
  // ★ 3. X軸の設定を変更
  xAxis: channels.map((channel, index) => {
    const isLast = index === channels.length - 1; // 最後のグラフかどうかを判定
    return {
      gridIndex: index,
      type: "time", // 軸のタイプを'time'に変更
      show: isLast, // 最後のX軸のみ表示する
      axisLabel: {
        // 軸ラベルのフォーマットを指定
        formatter: "{HH}:{mm}:{ss}",
      },
    };
  }),
  yAxis: channels.map((channel, index) => {
    return {
      gridIndex: index,
      type: "value",
      name: channel,
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: {
        fontWeight: "bold",
        fontSize: 14,
        color: "#d9534f",
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: {
        show: true,
        lineStyle: {
          color: "#fde0e0",
          type: "dashed",
        },
      },
    };
  }),
  series: datasets.map((dataset, index) => {
    return { ...dataset, xAxisIndex: index, yAxisIndex: index };
  }),
  dataZoom: [
    {
      type: "slider",
      xAxisIndex: Array.from({ length: channels.length }, (_, i) => i),
      start: 0,
      end: 50,
      bottom: "1%", // X軸ラベルと被らないように位置を調整
      height: 20,
    },
  ],
};

// オプションをEChartsインスタンスにセット
myChart.setOption(option);
