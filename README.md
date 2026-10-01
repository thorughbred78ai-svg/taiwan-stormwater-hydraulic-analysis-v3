# taiwan-stormwater-hydraulic-analysis-v3

\# 台灣雨水下水道數值水理分析 V3



\*\*Taiwan Stormwater Sewer Numerical Hydraulic Analysis V3\*\*



創建者：HHHuang



\---



\## 1. 系統簡介



「台灣雨水下水道數值水理分析 V3」是一套以瀏覽器為執行環境的雨水下水道工程分析原型系統。



系統以 HTML5、CSS、JavaScript 建置，可部署於 GitHub Pages，不需要後端伺服器。



V3 的主要發展方向已由單一管段計算，提升至：



\- 節點／管段網路資料

\- 設計流量

\- 管網流量傳遞

\- 圓管非滿流水理

\- Manning 公式

\- 正常水深

\- 臨界水深

\- 流速

\- 滿管容量

\- 下游邊界條件

\- 沿程損失

\- 局部損失

\- HGL

\- EGL

\- 節點頂托

\- 節點溢淹

\- 管網縱剖面

\- CSV 匯出

\- 示範案例



\---



\## 2. GitHub Pages



本系統為純前端 Web Application。



不需要：



\- Node.js

\- PHP

\- Python Server

\- MySQL

\- Apache

\- IIS



只需要將檔案放入 GitHub repository，即可透過 GitHub Pages 發布。



\---



\## 3. 專案結構



```text

taiwan-stormwater-v3/

│

├── index.html

│

├── README.md

│

├── css/

│   └── style.css

│

├── js/

│   ├── app.js

│   ├── hydraulic.js

│   ├── losses.js

│   ├── boundary.js

│   ├── hgl-egl.js

│   ├── overflow.js

│   ├── profile.js

│   └── export.js

│

├── data/

│   └── example-case.json

│

└── assets/

&#x20;   └── ...




