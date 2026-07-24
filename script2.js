// 1. ロード画面の制御
window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  if (loader) {
    setTimeout(() => {
      loader.style.transform = "translateY(-100%)";
    }, 1000);
  }
});

// ==========================================================================
// ★ 手ブレ曲線を生み出すための「1次元ノイズ（手ブレ数式）」の実装
// ==========================================================================
const NOISE_SIZE = 256;
const noiseTable = Array.from({ length: NOISE_SIZE }, () => Math.random());
function getHandDrawnNoise(x) {
  const X = Math.floor(x) & (NOISE_SIZE - 1);
  const nextX = (X + 1) & (NOISE_SIZE - 1);
  const t = x - Math.floor(x);
  // スムーズに補間（フェード）
  const f = t * t * (3 - 2 * t);
  return noiseTable[X] * (1 - f) + noiseTable[nextX] * f;
}

// 2. 本物の手ブレ曲線・大量アメーバ等高線システム
const canvas = document.getElementById("marchingSquaresCanvas");
const ctx = canvas.getContext("2d");

// クッキリシャープにするための解像度
const RESOLUTION = 8;
let columns, rows;
let field = [];

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  columns = Math.ceil(canvas.width / RESOLUTION) + 1;
  rows = Math.ceil(canvas.height / RESOLUTION) + 1;
  field = new Array(columns).fill(null).map(() => new Array(rows).fill(0));
}
window.addEventListener("resize", resize);
resize();

// 画面をのんびり漂う手書きアメーバのクラス
class Ball {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;

    // 脈打ちを感じさせないよう、超のんびりした一定速度
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = (Math.random() - 0.5) * 0.4;

    // 基本サイズ
    this.radius = Math.random() * 15 + 25;

    // 個体ごとの「手ブレ時間軸」のズレ
    this.noiseSeed = Math.random() * 1000;
    this.noiseSpeed = 0.005;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.noiseSeed += this.noiseSpeed;

    if (this.x < -this.radius * 2) this.x = canvas.width + this.radius * 2;
    if (this.x > canvas.width + this.radius * 2) this.x = -this.radius * 2;
    if (this.y < -this.radius * 2) this.y = canvas.height + this.radius * 2;
    if (this.y > canvas.height + this.radius * 2) this.y = -this.radius * 2;
  }
}

// 32個の小さな塊を画面に放流
const balls = Array.from({ length: 32 }, () => new Ball());

// 外側の輪郭線1本だけを抽出するしきい値
const THRESHOLD = 1.0;

function getState(a, b, c, d) {
  return (
    (a >= THRESHOLD ? 8 : 0) |
    (b >= THRESHOLD ? 4 : 0) |
    (c >= THRESHOLD ? 2 : 0) |
    (d >= THRESHOLD ? 1 : 0)
  );
}

function drawLine(v1, v2) {
  ctx.moveTo(v1.x, v1.y);
  ctx.lineTo(v2.x, v2.y);
}

// メインループ
function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  balls.forEach((b) => b.update());

  // グリッドごとの磁力を計算
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const x = i * RESOLUTION;
      const y = j * RESOLUTION;
      let sum = 0;

      balls.forEach((b) => {
        const dx = x - b.x;
        const dy = y - b.y;
        const angle = Math.atan2(dy, dx);

        const noiseInput = (angle + Math.PI) * 1.5 + b.noiseSeed;
        const handDrawnWobble = (getHandDrawnNoise(noiseInput) - 0.5) * 22;

        const currentRadius = b.radius + handDrawnWobble;

        sum += (currentRadius * currentRadius) / (dx * dx + dy * dy + 0.0001);
      });
      field[i][j] = sum;
    }
  }

  // マーチングスクエア法で1pxの細い線を引く
  ctx.beginPath();
  ctx.strokeStyle = "#7ba9e3";
  ctx.lineWidth = 0.6;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let i = 0; i < columns - 1; i++) {
    for (let j = 0; j < rows - 1; j++) {
      const x = i * RESOLUTION;
      const y = j * RESOLUTION;

      const amtA =
        (THRESHOLD - field[i][j]) / (field[i + 1][j] - field[i][j] + 0.0001);
      const amtB =
        (THRESHOLD - field[i + 1][j]) /
        (field[i + 1][j + 1] - field[i + 1][j] + 0.0001);
      const amtC =
        (THRESHOLD - field[i][j + 1]) /
        (field[i + 1][j + 1] - field[i][j + 1] + 0.0001);
      const amtD =
        (THRESHOLD - field[i][j]) / (field[i][j + 1] - field[i][j] + 0.0001);

      const t = { x: x + RESOLUTION * Math.max(0, Math.min(1, amtA)), y: y };
      const r = {
        x: x + RESOLUTION,
        y: y + RESOLUTION * Math.max(0, Math.min(1, amtB)),
      };
      const b = {
        x: x + RESOLUTION * Math.max(0, Math.min(1, amtC)),
        y: y + RESOLUTION,
      };
      const l = { x: x, y: y + RESOLUTION * Math.max(0, Math.min(1, amtD)) };

      const state = getState(
        field[i][j],
        field[i + 1][j],
        field[i + 1][j + 1],
        field[i][j + 1],
      );

      switch (state) {
        case 1:
          drawLine(l, b);
          break;
        case 2:
          drawLine(b, r);
          break;
        case 3:
          drawLine(l, r);
          break;
        case 4:
          drawLine(t, r);
          break;
        case 5:
          drawLine(l, t);
          drawLine(b, r);
          break;
        case 6:
          drawLine(t, b);
          break;
        case 7:
          drawLine(l, t);
          break;
        case 8:
          drawLine(l, t);
          break;
        case 9:
          drawLine(t, b);
          break;
        case 10:
          drawLine(l, b);
          drawLine(t, r);
          break;
        case 11:
          drawLine(t, r);
          break;
        case 12:
          drawLine(l, r);
          break;
        case 13:
          drawLine(b, r);
          break;
        case 14:
          drawLine(l, b);
          break;
      }
    }
  }
  ctx.stroke();

  requestAnimationFrame(animate);
}

animate();

// メニュー操作
const menuBtn = document.querySelector(".header-menu-btn");
const menu = document.querySelector(".header-menu");
const overlay = document.querySelector(".menu-overlay");
const closeBtn = document.querySelector(".menu-close-btn");
const siteMain = document.querySelector(".site-main");

const openMenu = () => {
  if (menu) menu.classList.add("active");
  if (overlay) overlay.classList.add("active");
  if (siteMain) siteMain.classList.add("menu-open");
};

const closeMenu = () => {
  if (menu) menu.classList.remove("active");
  if (overlay) overlay.classList.remove("active");
  if (siteMain) siteMain.classList.remove("menu-open");
};

if (menuBtn) menuBtn.addEventListener("click", openMenu);
if (closeBtn) closeBtn.addEventListener("click", closeMenu);
if (overlay) overlay.addEventListener("click", closeMenu);

// リンクカード処理
const linkCards = document.querySelectorAll(".card-profile, .link-card");
linkCards.forEach((card) => {
  const link = card.dataset.link;
  if (link) {
    const image = card.querySelector(".img-wrap");
    if (image) {
      image.addEventListener("click", () => {
        window.location.href = link;
      });
    }
  }
});

// カテゴリフィルター制御
const categoryButtons = document.querySelectorAll(".category-btn");
const cards = document.querySelectorAll(".card");

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.category;

    categoryButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    // cards.forEach((card) => {
    //   const cardCategory = card.dataset.category;
    //   if (category === "All" || cardCategory === category) {
    //     card.style.display = "";
    //   } else {
    //     card.style.display = "none";
    //   }
    // });

    //修正箇所

    cards.forEach((card) => {
      // card.dataset.category に含まれるカテゴリを配列に分割（例: ["Activity", "Design"]）
      const cardCategories = card.dataset.category
        ? card.dataset.category.split(" ")
        : [];

      // 「All」が選択されているか、選択されたカテゴリがカードに含まれているか判定
      if (category === "All" || cardCategories.includes(category)) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });
  });
});

// // グリッドレイアウト調整
// window.addEventListener("load", () => {
//   const items = document.querySelectorAll(".portfolio-grid .card");
//   const rowHeight = 10;
//   const gap = 20;

//   items.forEach((item) => {
//     const img = item.querySelector("img");
//     if (!img) return;

//     const resizeItem = () => {
//       const height = img.getBoundingClientRect().height;
//       const span = Math.ceil((height + gap) / (rowHeight + gap));
//       item.style.gridRowEnd = `span ${span}`;
//     };

//     if (img.complete) {
//       resizeItem();
//     } else {
//       img.onload = resizeItem;
//     }
//   });
// });

// グリッドレイアウト調整
window.addEventListener("load", () => {
  const items = document.querySelectorAll(".portfolio-grid .card");
  const rowHeight = 10; // CSSの grid-auto-rows の値
  const gap = 20; // CSSの gap / grid-gap の値

  items.forEach((item) => {
    const resizeItem = () => {
      // 画像単体ではなく、カード全体（テキスト等含む）の高さを取得
      const height = item.getBoundingClientRect().height;
      // 適切なスパン数を計算
      const span = Math.ceil((height + gap) / (rowHeight + gap));
      item.style.gridRowEnd = `span ${span}`;
    };

    const img = item.querySelector("img");
    if (img) {
      if (img.complete) {
        resizeItem();
      } else {
        img.onload = resizeItem;
      }
    } else {
      resizeItem();
    }
  });
});

//カテゴリ名自動表示

// 画面読み込み時に各カードの data-category を読み取ってタグを自動生成する
window.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".card");

  cards.forEach((card) => {
    // 1. data-category の文字列を取得（無ければ処理スキップ）
    const categoryData = card.dataset.category;
    if (!categoryData) return;

    // 2. スペース区切りで配列化（例: "Activity Design" -> ["Activity", "Design"]）
    const categories = categoryData.trim().split(/\s+/);

    // 3. カテゴリを入れる要素を取得（なければ info の中に作成）
    let categoriesContainer = card.querySelector(".categories");
    if (!categoriesContainer) {
      categoriesContainer = document.createElement("div");
      categoriesContainer = document.createElement("div");
      categoriesContainer.className = "categories";
      const info = card.querySelector(".info");
      if (info) info.appendChild(categoriesContainer);
    }

    // コンテナの中身をクリア（重複防止）
    categoriesContainer.innerHTML = "";

    // 4. カテゴリごとに <p> タグを生成して追加
    categories.forEach((cat) => {
      const p = document.createElement("p");
      p.textContent = cat;
      categoriesContainer.appendChild(p);
    });
  });
});
