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
