BELLE HOUSE 点呼システム Ver.6.0 / クラウド同期完成版

上書き方法：
1. このZIPを解凍
2. firebase-config.js は上書きしない
3. それ以外の index.html / app.js / style.css / firebase-sync.js / manifest.json / sw.js を上書き
4. VS Codeで以下を実行
   git add .
   git commit -m "Ver6.0 complete cloud sync"
   git push
5. スマホ・PCの両方で GitHub Pages のURLを開く
   https://kiyosato1410.github.io/belle-house-tenko-v3/?v=60

注意：
PCで C:\Users\... のローカルファイルを開くと同期しません。
必ずスマホとPCで同じ GitHub Pages URL を開いてください。
